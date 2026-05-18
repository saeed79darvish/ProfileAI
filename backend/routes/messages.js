const express = require('express');
const router = express.Router();
const { Conversation, Message, User, Profile, RecruiterProfile, Interview, Job } = require('../models');
const auth = require('../middleware/auth');
const { Op } = require('sequelize');
const aiService = require('../services/aiService');
const notificationService = require('../services/notificationService');
const { strictLimiter } = require('../middleware/rateLimiters');
const featureFlags = require('../config/featureFlags');

// Helper function to get user profile info
const getUserProfileInfo = async (user) => {
  if (!user) return null;
  
  const isRecruiter = user.role === 'recruiter';
  let profileData = {};
  
  if (isRecruiter && user.recruiterProfile) {
    profileData = {
      headline: user.recruiterProfile.jobTitle,
      companyName: user.recruiterProfile.companyName,
      profilePicture: user.recruiterProfile.profilePicture
    };
  } else if (user.profile) {
    profileData = {
      headline: user.profile.headline,
      profilePicture: user.profile.profilePicture
    };
  }
  
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    ...profileData
  };
};

// @route   GET /api/messages/conversations
// @desc    Get all conversations for current user
// @access  Private
router.get('/conversations', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const conversations = await Conversation.findAll({
      where: {
        [Op.or]: [
          { participant1Id: userId },
          { participant2Id: userId }
        ]
      },
      include: [
        {
          model: User,
          as: 'participant1',
          attributes: ['id', 'firstName', 'lastName', 'role'],
          include: [
            { model: Profile, as: 'profile', attributes: ['headline', 'profilePicture'] },
            { model: RecruiterProfile, as: 'recruiterProfile', attributes: ['jobTitle', 'companyName', 'profilePicture'] }
          ]
        },
        {
          model: User,
          as: 'participant2',
          attributes: ['id', 'firstName', 'lastName', 'role'],
          include: [
            { model: Profile, as: 'profile', attributes: ['headline', 'profilePicture'] },
            { model: RecruiterProfile, as: 'recruiterProfile', attributes: ['jobTitle', 'companyName', 'profilePicture'] }
          ]
        }
      ],
      order: [['lastMessageAt', 'DESC']]
    });

    // Get unread counts for each conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await Message.count({
          where: {
            conversationId: conv.id,
            senderId: { [Op.ne]: userId },
            isRead: false
          }
        });

        // Determine the other participant
        const otherUser = conv.participant1Id === userId ? conv.participant2 : conv.participant1;
        const otherUserInfo = await getUserProfileInfo(otherUser);

        return {
          id: conv.id,
          otherUser: otherUserInfo,
          lastMessageAt: conv.lastMessageAt,
          lastMessagePreview: conv.lastMessagePreview,
          unreadCount,
          createdAt: conv.createdAt
        };
      })
    );

    res.json({ conversations: conversationsWithUnread });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/messages/conversations/:conversationId
// @desc    Get messages in a conversation
// @access  Private
router.get('/conversations/:conversationId', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Verify user is part of this conversation
    const conversation = await Conversation.findOne({
      where: {
        id: conversationId,
        [Op.or]: [
          { participant1Id: userId },
          { participant2Id: userId }
        ]
      },
      include: [
        {
          model: User,
          as: 'participant1',
          attributes: ['id', 'firstName', 'lastName', 'role'],
          include: [
            { model: Profile, as: 'profile', attributes: ['headline', 'profilePicture'] },
            { model: RecruiterProfile, as: 'recruiterProfile', attributes: ['jobTitle', 'companyName', 'profilePicture'] }
          ]
        },
        {
          model: User,
          as: 'participant2',
          attributes: ['id', 'firstName', 'lastName', 'role'],
          include: [
            { model: Profile, as: 'profile', attributes: ['headline', 'profilePicture'] },
            { model: RecruiterProfile, as: 'recruiterProfile', attributes: ['jobTitle', 'companyName', 'profilePicture'] }
          ]
        }
      ]
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Get messages
    const { count, rows: messages } = await Message.findAndCountAll({
      where: { conversationId },
      include: [{
        model: User,
        as: 'sender',
        attributes: ['id', 'firstName', 'lastName']
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    // Mark messages as read
    await Message.update(
      { isRead: true, readAt: new Date() },
      {
        where: {
          conversationId,
          senderId: { [Op.ne]: userId },
          isRead: false
        }
      }
    );

    // Determine other participant info
    const otherUser = conversation.participant1Id === userId 
      ? conversation.participant2 
      : conversation.participant1;
    const otherUserInfo = await getUserProfileInfo(otherUser);

    res.json({
      conversation: {
        id: conversation.id,
        otherUser: otherUserInfo,
        createdAt: conversation.createdAt
      },
      messages: messages.reverse(), // Return in chronological order
      total: count,
      page: parseInt(page),
      pages: Math.ceil(count / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/messages/start/:userId
// @desc    Create or get a conversation with a user (no message sent)
// @access  Private
router.post('/start/:userId', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const otherUserId = req.params.userId;

    if (currentUserId === otherUserId) {
      return res.status(400).json({ error: 'Cannot start conversation with yourself' });
    }

    const other = await User.findByPk(otherUserId);
    if (!other) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [p1, p2] = [currentUserId, otherUserId].sort();

    let conversation = await Conversation.findOne({
      where: {
        [Op.or]: [
          { participant1Id: currentUserId, participant2Id: otherUserId },
          { participant1Id: otherUserId, participant2Id: currentUserId }
        ]
      }
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participant1Id: p1,
        participant2Id: p2,
        lastMessageAt: new Date()
      });
    }

    res.json({ conversationId: conversation.id });
  } catch (error) {
    console.error('Error starting conversation:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/messages/send/:userId
// @desc    Send a message to a user (creates conversation if needed)
// @access  Private
router.post('/send/:userId', strictLimiter, auth, async (req, res) => {
  try {
    const senderId = req.user.id;
    const receiverId = req.params.userId;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    if (senderId === receiverId) {
      return res.status(400).json({ error: 'Cannot send message to yourself' });
    }

    // Check if receiver exists
    const receiver = await User.findByPk(receiverId);
    if (!receiver) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find or create conversation
    // Normalize participant order to ensure uniqueness
    const [p1, p2] = [senderId, receiverId].sort();
    
    let conversation = await Conversation.findOne({
      where: {
        [Op.or]: [
          { participant1Id: senderId, participant2Id: receiverId },
          { participant1Id: receiverId, participant2Id: senderId }
        ]
      }
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participant1Id: p1,
        participant2Id: p2,
        lastMessageAt: new Date(),
        lastMessagePreview: content.substring(0, 255)
      });
    }

    // Create message
    const message = await Message.create({
      conversationId: conversation.id,
      senderId,
      content: content.trim()
    });

    // Update conversation with last message info
    await conversation.update({
      lastMessageAt: new Date(),
      lastMessagePreview: content.substring(0, 255)
    });

    // Fetch message with sender info
    const messageWithSender = await Message.findByPk(message.id, {
      include: [{
        model: User,
        as: 'sender',
        attributes: ['id', 'firstName', 'lastName']
      }]
    });

    // Get sender info for notification
    const sender = await User.findByPk(senderId, {
      attributes: ['id', 'firstName', 'lastName']
    });

    // Notify recipient about new message
    notificationService.notifyNewMessage(receiverId, sender, conversation, content.substring(0, 100))
      .catch(err => console.error('Error creating message notification:', err));

    res.status(201).json({
      success: true,
      message: messageWithSender,
      conversationId: conversation.id
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/messages/conversations/:conversationId
// @desc    Send a message in an existing conversation
// @access  Private
router.post('/conversations/:conversationId', strictLimiter, auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    const { content } = req.body;

    console.log('📨 [Message] POST received:', { userId, conversationId, content });

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Verify user is part of this conversation
    const conversation = await Conversation.findOne({
      where: {
        id: conversationId,
        [Op.or]: [
          { participant1Id: userId },
          { participant2Id: userId }
        ]
      }
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Create message
    const message = await Message.create({
      conversationId,
      senderId: userId,
      content: content.trim()
    });

    // Update conversation with last message info
    await conversation.update({
      lastMessageAt: new Date(),
      lastMessagePreview: content.substring(0, 255)
    });

    // Fetch message with sender info
    const messageWithSender = await Message.findByPk(message.id, {
      include: [{
        model: User,
        as: 'sender',
        attributes: ['id', 'firstName', 'lastName']
      }]
    });

    // Check if this is a message to a recruiter and generate AI agent response
    let aiAgentResponse = null;
    try {
      const otherUserId = conversation.participant1Id === userId 
        ? conversation.participant2Id 
        : conversation.participant1Id;
      
      const otherUser = await User.findByPk(otherUserId, {
        include: [{ model: RecruiterProfile, as: 'recruiterProfile' }]
      });

      // If sending to a recruiter, AI agent should respond.
      // Skipped when recruiter surface is disabled (candidate-only launch).
      if (featureFlags.recruiterSurface && otherUser && otherUser.role === 'recruiter') {
        console.log('🤖 [AI Agent] Message is to recruiter, generating response...');
        const sender = await User.findByPk(userId);
        const recruiterProfile = otherUser.recruiterProfile || {};
        
        // Find any pending/confirmed interviews between these users
        const interview = await Interview.findOne({
          where: {
            candidateId: userId,
            recruiterId: otherUserId,
            status: { [Op.in]: ['pending', 'confirmed', 'rescheduled', 'reschedule_requested'] }
          },
          include: [{ model: Job, as: 'job' }],
          order: [['createdAt', 'DESC']]
        });

        // Detect message intent (greeting, reschedule, question, etc.)
        // The enhanced analyzeMessageIntent handles greetings efficiently without API calls for simple cases
        let intentAnalysis = { isRescheduleRequest: false, confidence: 0, messageType: 'general' };
        try {
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Intent detection timeout')), 5000)
          );
          intentAnalysis = await Promise.race([
            aiService.detectRescheduleIntent(content, {
              interviewId: interview?.id,
              scheduledAt: interview?.scheduledAt,
              status: interview?.status,
              jobTitle: interview?.job?.title
            }),
            timeoutPromise
          ]);
        } catch (intentError) {
          console.log('🤖 [AI Agent] Intent detection failed:', intentError.message);
          // Enhanced fallback: check for greetings first, then reschedule keywords
          const lowerContent = content.toLowerCase().trim();
          const simpleGreetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy', 'greetings'];
          
          if (simpleGreetings.some(g => lowerContent === g || lowerContent.startsWith(g + ' ') || lowerContent.startsWith(g + '!'))) {
            intentAnalysis = { 
              isRescheduleRequest: false, 
              confidence: 90, 
              messageType: 'greeting',
              sentiment: 'positive'
            };
          } else if (lowerContent.includes('reschedule') || lowerContent.includes('different time') || 
              lowerContent.includes('can\'t make') || lowerContent.includes('change the time')) {
            intentAnalysis = { isRescheduleRequest: true, confidence: 70, requestedAction: 'reschedule', messageType: 'reschedule' };
          }
        }

        console.log('🤖 [AI Agent] Intent analysis:', intentAnalysis);

        // Generate AI response for ANY message to recruiter
        let aiResponseContent = null;
        let actionTaken = 'acknowledged';
        let availableSlots = [];

        if (intentAnalysis.isRescheduleRequest && intentAnalysis.confidence >= 60) {
          // Handle RESCHEDULE request
          let agentResponse = null;
          try {
            const responseTimeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Response generation timeout')), 10000)
            );
            agentResponse = await Promise.race([
              aiService.generateRecruiterAgentResponse(
                sender.firstName,
                content,
                interview,
                { firstName: otherUser.firstName, companyName: recruiterProfile.companyName },
                intentAnalysis.requestedAction
              ),
              responseTimeoutPromise
            ]);
          } catch (responseError) {
            console.log('🤖 [AI Agent] Using fallback response:', responseError.message);
            agentResponse = {
              response: `Thank you for reaching out, ${sender.firstName}. I've received your request to reschedule and will get back to you shortly with available times.\n\n- AI Assistant on behalf of ${otherUser.firstName}`,
              actionTaken: 'acknowledged',
              requiresRecruiterApproval: true
            };
          }

          console.log('🤖 [AI Agent] Generated reschedule response:', agentResponse);

          // Generate available slots if rescheduling
          if (intentAnalysis.requestedAction === 'reschedule') {
            try {
              const recruiterInterviews = await Interview.findAll({
                where: {
                  recruiterId: otherUserId,
                  status: { [Op.in]: ['confirmed', 'pending', 'reschedule_requested'] },
                  scheduledAt: { [Op.gte]: new Date() }
                }
              });
              availableSlots = await aiService.generateAvailableSlots(recruiterInterviews);
            } catch (slotError) {
              console.log('🤖 [AI Agent] Slot generation failed:', slotError.message);
            }
          }

          // If no interview found but user is asking to reschedule, provide helpful response
          if (!interview && intentAnalysis.isRescheduleRequest) {
            agentResponse = {
              response: `Hi ${sender.firstName}! 👋\n\nI received your message about rescheduling. I don't see an active interview scheduled between you and ${otherUser.firstName} at the moment.\n\nCould you please let me know which position or interview you're referring to? ${otherUser.firstName} will review your message and get back to you.\n\n_— AI Assistant for ${otherUser.firstName}_`,
              actionTaken: 'no_interview_found',
              requiresRecruiterApproval: true
            };
          }

          aiResponseContent = agentResponse.response;
          if (availableSlots.length > 0 && !aiResponseContent.includes('slot')) {
            aiResponseContent += '\n\nHere are some available times:\n' + 
              availableSlots.map((s, i) => `${i + 1}. ${s.formatted}`).join('\n');
          }
          actionTaken = agentResponse.actionTaken || 'reschedule_acknowledged';

          // Update interview status if appropriate
          if (interview && intentAnalysis.requestedAction === 'reschedule') {
            await interview.update({
              status: 'rescheduled',
              candidateResponse: {
                action: 'reschedule_requested',
                message: content,
                requestedAt: new Date(),
                availableSlotsOffered: availableSlots
              }
            });
          }
        } else {
          // Handle GENERAL message (greetings, questions, etc.)
          console.log('🤖 [AI Agent] Generating general response for:', content, 'MessageType:', intentAnalysis.messageType);
          
          // Generate a contextual response based on message content and intent analysis
          const lowerContent = content.toLowerCase().trim();
          const companyName = recruiterProfile.companyName || 'our company';
          const recruiterName = otherUser.firstName;
          
          // Build suggested prompts based on context
          let suggestedPrompts = [];
          
          // Use enhanced messageType from intent analysis for better routing
          const isGreeting = intentAnalysis.messageType === 'greeting' || 
                             intentAnalysis.messageType === 'gratitude' ||
                             lowerContent.match(/^(hi|hello|hey|good morning|good afternoon|good evening|howdy|greetings|yo|sup)/i);
          
          if (isGreeting && intentAnalysis.messageType !== 'gratitude') {
            // Enhanced greeting response - warm, welcoming, and guides user through options
            if (interview) {
              const jobTitle = interview.job?.title || 'the position';
              const scheduledDate = interview.scheduledAt 
                ? new Date(interview.scheduledAt).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'short', 
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  }) 
                : 'soon';
              const interviewStatus = interview.status;
              
              // Customize greeting based on interview status
              let statusContext = '';
              if (interviewStatus === 'pending') {
                statusContext = 'Your interview is **pending confirmation**.';
              } else if (interviewStatus === 'confirmed') {
                statusContext = `Your interview is **confirmed** for ${scheduledDate}.`;
              } else if (interviewStatus === 'reschedule_requested') {
                statusContext = 'I see you have a **reschedule request pending**. Let me know if you need anything else!';
              }
              
              aiResponseContent = `Hi ${sender.firstName}! 👋 Great to hear from you!\n\nI'm the AI scheduling assistant for ${recruiterName}. ${statusContext}\n\n📋 **Interview Details:**\n• Position: ${jobTitle}\n• Date: ${scheduledDate}\n• Duration: ${interview.duration || 30} minutes\n\nHow can I help you today? Here are some things I can assist with:`;
              
              suggestedPrompts = [
                '📅 I need to reschedule',
                '✅ Confirm my attendance',
                '❓ What should I prepare?',
                '📍 Where is the interview?',
                '⏱️ How long will it take?',
                '👤 Who will I be meeting?'
              ];
            } else {
              aiResponseContent = `Hi ${sender.firstName}! 👋 Thanks for reaching out!\n\nI'm the AI assistant for ${recruiterName} at ${companyName}. I'm here to help you with scheduling, questions, or connecting you with the right person.\n\nWhat can I help you with today?`;
              
              suggestedPrompts = [
                '💼 Ask about open positions',
                '📅 Schedule a conversation',
                '📄 Share my resume',
                '📞 Request a callback',
                '❓ I have a question'
              ];
            }
            actionTaken = 'greeting_response';
          } else if (lowerContent.match(/^(hi|hello|hey|good morning|good afternoon|good evening)/)) {
            // Fallback for greetings not caught by intent analysis
            if (interview) {
              const jobTitle = interview.job?.title || 'the position';
              const scheduledDate = interview.scheduledAt ? new Date(interview.scheduledAt).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : 'soon';
              
              aiResponseContent = `Thanks for reaching out, ${sender.firstName}! 👋\n\nI'm the AI assistant for ${recruiterName}. I can see you have an interview scheduled for **${jobTitle}** on ${scheduledDate}.\n\nHow can I help you today?`;
              
              suggestedPrompts = [
                '📅 I need to reschedule',
                '❓ What should I prepare?',
                '📍 Where is the interview?',
                '⏱️ How long will it take?'
              ];
            } else {
              aiResponseContent = `Thanks for reaching out, ${sender.firstName}! 👋\n\nI'm the AI assistant for ${recruiterName} at ${companyName}.\n\nWhat can I help you with?`;
              
              suggestedPrompts = [
                '💼 Ask about open positions',
                '📄 Share my resume',
                '📞 Request a call',
                '❓ General question'
              ];
            }
            actionTaken = 'greeting_response';
          } else if (intentAnalysis.messageType === 'gratitude' || lowerContent.includes('thank') || lowerContent.includes('thanks')) {
            const responses = [
              `You're welcome, ${sender.firstName}! 😊 Let me know if there's anything else.`,
              `Happy to help, ${sender.firstName}! Don't hesitate to reach out again.`,
              `Glad I could assist! ${recruiterName} will follow up if needed.`
            ];
            aiResponseContent = responses[Math.floor(Math.random() * responses.length)];
            
            if (interview) {
              suggestedPrompts = [
                '📅 Reschedule interview',
                '❓ Ask another question',
                '✅ All set for now'
              ];
            }
            actionTaken = 'courtesy_response';
          } else if (lowerContent.includes('prepare') || lowerContent.includes('preparation') || lowerContent.includes('what should i')) {
            if (interview) {
              const jobTitle = interview.job?.title || 'the position';
              aiResponseContent = `Great question, ${sender.firstName}! 📚\n\nFor your **${jobTitle}** interview, I'd recommend:\n\n• Research ${companyName} and our recent projects\n• Review the job description and match your experience\n• Prepare examples using the STAR method\n• Have questions ready for the interviewer\n\n${recruiterName} may send additional prep materials closer to the date.`;
              
              suggestedPrompts = [
                '📋 What\'s the interview format?',
                '👥 Who will I meet?',
                '📅 Need to reschedule'
              ];
            } else {
              aiResponseContent = `Thanks for asking, ${sender.firstName}! I'll let ${recruiterName} know you're interested in preparation tips. They'll get back to you with specific guidance.`;
            }
            actionTaken = 'preparation_inquiry';
          } else if (lowerContent.includes('where') || lowerContent.includes('location') || lowerContent.includes('address')) {
            if (interview) {
              const location = interview.location || interview.meetingLink ? 'virtual (link will be sent)' : 'TBD';
              aiResponseContent = `Good question! 📍\n\nYour interview is **${interview.type === 'video' ? 'virtual' : interview.location || 'location TBD'}**.\n\n${interview.meetingLink ? `Meeting link: ${interview.meetingLink}` : 'The meeting link or address will be shared closer to the date.'}`;
              
              suggestedPrompts = [
                '⏱️ How long is the interview?',
                '📅 Need to reschedule',
                '✅ Got it, thanks!'
              ];
            } else {
              aiResponseContent = `I'll check with ${recruiterName} about the location details and get back to you!`;
            }
            actionTaken = 'location_inquiry';
          } else if (lowerContent.includes('interview') || lowerContent.includes('job') || lowerContent.includes('position')) {
            if (interview) {
              const jobTitle = interview.job?.title || 'the position';
              const status = interview.status;
              const scheduledDate = interview.scheduledAt ? new Date(interview.scheduledAt).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'TBD';
              
              aiResponseContent = `Here's your interview summary, ${sender.firstName}:\n\n📋 **${jobTitle}**\n📅 ${scheduledDate}\n⏱️ ${interview.duration || 30} minutes\n🎯 Status: ${status}\n\nAnything else you'd like to know?`;
              
              suggestedPrompts = [
                '📅 Reschedule this interview',
                '❓ What should I prepare?',
                '📍 Where is it located?'
              ];
            } else {
              aiResponseContent = `Thanks for your interest, ${sender.firstName}! I'll make sure ${recruiterName} sees your message about opportunities at ${companyName}.`;
              
              suggestedPrompts = [
                '📄 View open positions',
                '📞 Request a call',
                '📧 Send my resume'
              ];
            }
            actionTaken = 'interview_inquiry_response';
          } else {
            // Generic response for other messages
            const responses = [
              `Got it, ${sender.firstName}! I've noted your message and ${recruiterName} will be notified.`,
              `Thanks for the message, ${sender.firstName}! ${recruiterName} will see this and respond soon.`,
              `Received, ${sender.firstName}! I'll make sure ${recruiterName} gets back to you.`
            ];
            aiResponseContent = responses[Math.floor(Math.random() * responses.length)];
            
            if (interview) {
              suggestedPrompts = [
                '📅 Reschedule interview',
                '❓ Interview questions',
                '📞 Request urgent callback'
              ];
            } else {
              suggestedPrompts = [
                '💼 Job opportunities',
                '📞 Schedule a call',
                '❓ Ask a question'
              ];
            }
            actionTaken = 'general_response';
          }
          
          // Append suggested prompts to the response
          if (suggestedPrompts.length > 0) {
            aiResponseContent += '\n\n---\n**Quick actions:**\n' + suggestedPrompts.map(p => `• ${p}`).join('\n');
          }
          
          aiResponseContent += `\n\n_— AI Assistant for ${recruiterName}_`;
        }

        // Create AI agent response message
        if (aiResponseContent) {
          const aiMessage = await Message.create({
            conversationId,
            senderId: otherUserId, // Sent on behalf of recruiter
            content: aiResponseContent,
            metadata: {
              type: 'ai_agent_response',
              isAiGenerated: true,
              intentAnalysis,
              actionTaken,
              availableSlots,
              suggestedPrompts, // Include prompts for frontend to render as buttons
              requiresRecruiterApproval: true,
              originalInterviewId: interview?.id
            }
          });

          // Update conversation
          await conversation.update({
            lastMessageAt: new Date(),
            lastMessagePreview: aiResponseContent.substring(0, 100) + '...'
          });

          // Fetch AI message with sender info
          const aiMessageWithSender = await Message.findByPk(aiMessage.id, {
            include: [{
              model: User,
              as: 'sender',
              attributes: ['id', 'firstName', 'lastName']
            }]
          });

          aiAgentResponse = {
            message: aiMessageWithSender,
            availableSlots,
            actionTaken
          };

          console.log('🤖 [AI Agent] Response sent:', aiMessage.id, 'Action:', actionTaken);
        }
      }
    } catch (aiError) {
      console.error('AI Agent error (non-blocking):', aiError);
      // Don't fail the main message send if AI fails
    }

    // Notify the recipient about the new message
    const recipientId = conversation.participant1Id === userId 
      ? conversation.participant2Id 
      : conversation.participant1Id;
    const sender = await User.findByPk(userId, {
      attributes: ['id', 'firstName', 'lastName']
    });
    notificationService.notifyNewMessage(recipientId, sender, conversation, content.substring(0, 100))
      .catch(err => console.error('Error creating message notification:', err));

    res.status(201).json({
      success: true,
      message: messageWithSender,
      aiAgentResponse
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/messages/reschedule-confirm
// @desc    Candidate confirms a new time slot from AI-offered options
// @access  Private
router.post('/reschedule-confirm', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { interviewId, selectedSlotIndex, conversationId } = req.body;

    // Find the interview
    const interview = await Interview.findByPk(interviewId, {
      include: [
        { model: User, as: 'recruiter', attributes: ['id', 'firstName', 'lastName'] },
        { model: Job, as: 'job', attributes: ['id', 'title', 'company'] }
      ]
    });

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    if (interview.candidateId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get the available slots from candidate response
    const availableSlots = interview.candidateResponse?.availableSlotsOffered || [];
    
    if (selectedSlotIndex < 0 || selectedSlotIndex >= availableSlots.length) {
      return res.status(400).json({ error: 'Invalid slot selection' });
    }

    const selectedSlot = availableSlots[selectedSlotIndex];

    // Update interview
    await interview.update({
      status: 'confirmed',
      scheduledAt: new Date(selectedSlot.datetime),
      confirmedAt: new Date(),
      meetingLink: `https://meet.profileai.com/interview/${interview.id}`,
      candidateResponse: {
        ...interview.candidateResponse,
        confirmedSlot: selectedSlotIndex,
        confirmedAt: new Date()
      }
    });

    // Send confirmation message
    const confirmMessage = await Message.create({
      conversationId,
      senderId: userId,
      content: `I've confirmed the interview for ${selectedSlot.formatted}. Looking forward to it!`,
      metadata: {
        type: 'interview_confirmed',
        interviewId: interview.id,
        selectedSlot
      }
    });

    // AI agent confirmation response
    const aiConfirmation = await Message.create({
      conversationId,
      senderId: interview.recruiterId,
      content: `Perfect! Your interview is now confirmed for ${selectedSlot.formatted}.\n\nMeeting link: https://meet.profileai.com/interview/${interview.id}\n\nYou'll receive a reminder before the interview. Good luck! 🎉\n\n- AI Assistant on behalf of ${interview.recruiter.firstName}`,
      metadata: {
        type: 'ai_agent_response',
        isAiGenerated: true,
        actionTaken: 'confirmed'
      }
    });

    // Update conversation
    const conversation = await Conversation.findByPk(conversationId);
    if (conversation) {
      await conversation.update({
        lastMessageAt: new Date(),
        lastMessagePreview: 'Interview confirmed!'
      });
    }

    res.json({
      success: true,
      interview: await Interview.findByPk(interviewId, {
        include: [
          { model: User, as: 'candidate', attributes: ['id', 'firstName', 'lastName'] },
          { model: User, as: 'recruiter', attributes: ['id', 'firstName', 'lastName'] },
          { model: Job, as: 'job', attributes: ['id', 'title', 'company'] }
        ]
      }),
      confirmationMessage: aiConfirmation
    });
  } catch (error) {
    console.error('Error confirming reschedule:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/messages/unread-count
// @desc    Get total unread message count for current user
// @access  Private
router.get('/unread-count', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all conversations where user is a participant
    const conversations = await Conversation.findAll({
      where: {
        [Op.or]: [
          { participant1Id: userId },
          { participant2Id: userId }
        ]
      },
      attributes: ['id']
    });

    const conversationIds = conversations.map(c => c.id);

    // Count unread messages not sent by current user
    const unreadCount = await Message.count({
      where: {
        conversationId: { [Op.in]: conversationIds },
        senderId: { [Op.ne]: userId },
        isRead: false
      }
    });

    res.json({ unreadCount });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/messages/read/:conversationId
// @desc    Mark all messages in a conversation as read
// @access  Private
router.put('/read/:conversationId', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;

    // Verify user is part of this conversation
    const conversation = await Conversation.findOne({
      where: {
        id: conversationId,
        [Op.or]: [
          { participant1Id: userId },
          { participant2Id: userId }
        ]
      }
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Mark messages as read (only messages not sent by current user)
    const [updatedCount] = await Message.update(
      { isRead: true, readAt: new Date() },
      {
        where: {
          conversationId,
          senderId: { [Op.ne]: userId },
          isRead: false
        }
      }
    );

    res.json({ success: true, markedAsRead: updatedCount });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/messages/conversations/:conversationId
// @desc    Delete a conversation and all its messages
// @access  Private
router.delete('/conversations/:conversationId', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;

    // Verify user is part of this conversation
    const conversation = await Conversation.findOne({
      where: {
        id: conversationId,
        [Op.or]: [
          { participant1Id: userId },
          { participant2Id: userId }
        ]
      }
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Delete all messages in the conversation
    await Message.destroy({ where: { conversationId } });
    
    // Delete the conversation
    await conversation.destroy();

    res.json({ success: true, message: 'Conversation deleted' });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/messages/conversation-with/:userId
// @desc    Get or check conversation with a specific user
// @access  Private
router.get('/conversation-with/:userId', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const otherUserId = req.params.userId;

    const conversation = await Conversation.findOne({
      where: {
        [Op.or]: [
          { participant1Id: currentUserId, participant2Id: otherUserId },
          { participant1Id: otherUserId, participant2Id: currentUserId }
        ]
      }
    });

    if (conversation) {
      res.json({ exists: true, conversationId: conversation.id });
    } else {
      res.json({ exists: false, conversationId: null });
    }
  } catch (error) {
    console.error('Error checking conversation:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
