const { Interview, AgentNegotiation, Job, User, Conversation, Message } = require('../models');
const { Op } = require('sequelize');

(async () => {
  try {
    // Find Saeed's mutual_match negotiation
    const negotiation = await AgentNegotiation.findOne({
      where: { 
        candidateId: '10615ad6-717a-4074-a7c7-a59089b34b3d', 
        status: 'mutual_match' 
      }
    });
    
    if (!negotiation) {
      console.log('No mutual_match negotiation found for Saeed');
      process.exit(0);
    }
    
    console.log('Found negotiation:', negotiation.id);
    
    // Check if interview already exists
    const existingInterview = await Interview.findOne({
      where: { 
        candidateId: negotiation.candidateId,
        jobId: negotiation.jobId
      }
    });
    
    if (existingInterview) {
      console.log('Interview already exists:', existingInterview.id);
      console.log('Status:', existingInterview.status);
      console.log('ScheduledAt:', existingInterview.scheduledAt);
      process.exit(0);
    }
    
    // Generate interview slot - Wednesday at 10:00 AM
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + 1);
    scheduledDate.setHours(10, 0, 0, 0);
    
    // Skip weekend
    while (scheduledDate.getDay() === 0 || scheduledDate.getDay() === 6) {
      scheduledDate.setDate(scheduledDate.getDate() + 1);
    }
    
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    const dayName = days[scheduledDate.getDay()];
    const monthName = months[scheduledDate.getMonth()];
    const dayOfMonth = scheduledDate.getDate();
    const year = scheduledDate.getFullYear();
    const slotLabel = `${dayName}, ${monthName} ${dayOfMonth}, ${year} at 10:00 AM`;
    
    const proposedSlots = [
      { datetime: scheduledDate.toISOString(), label: slotLabel }
    ];
    
    // Create confirmed interview
    const interview = await Interview.create({
      jobId: negotiation.jobId,
      candidateId: negotiation.candidateId,
      recruiterId: negotiation.recruiterId,
      proposedSlots,
      scheduledAt: scheduledDate, // Auto-confirmed
      confirmedAt: new Date(),
      type: 'screening',
      format: 'video',
      duration: 30,
      status: 'confirmed',
      meetingLink: `https://meet.profileai.com/interview/${Date.now()}`,
      recruiterNotes: 'Auto-scheduled by AI Agent after mutual match in Agent Arena.',
      candidateResponse: {
        autoConfirmed: true,
        selectedSlot: 0,
        message: 'Interview automatically confirmed by AI Agent after successful negotiation.'
      }
    });
    
    console.log('\n✅ Interview created for Saeed Darvish!');
    console.log('Interview ID:', interview.id);
    console.log('Status:', interview.status);
    console.log('ScheduledAt:', interview.scheduledAt);
    console.log('Meeting Link:', interview.meetingLink);
    
    // Send notification message
    const recruiter = await User.findByPk(negotiation.recruiterId);
    const candidate = await User.findByPk(negotiation.candidateId);
    const job = await Job.findByPk(negotiation.jobId);
    
    // Find or create conversation
    let conversation = await Conversation.findOne({
      where: {
        [Op.or]: [
          { participant1Id: recruiter.id, participant2Id: candidate.id },
          { participant1Id: candidate.id, participant2Id: recruiter.id }
        ]
      }
    });
    
    if (!conversation) {
      conversation = await Conversation.create({
        participant1Id: recruiter.id,
        participant2Id: candidate.id,
        lastMessageAt: new Date()
      });
    }
    
    await Message.create({
      conversationId: conversation.id,
      senderId: recruiter.id,
      content: `🎉 Great news! Based on our AI Agent negotiation, an interview has been scheduled.\n\n` +
               `📋 Position: ${job.title} at ${job.company}\n` +
               `📅 Date/Time: ${slotLabel}\n` +
               `⏱️ Duration: 30 minutes\n` +
               `🎥 Format: Video Call\n` +
               `🔗 Meeting Link: ${interview.meetingLink}\n\n` +
               `Looking forward to speaking with you!`,
      isRead: false
    });
    
    await conversation.update({
      lastMessageAt: new Date(),
      lastMessagePreview: 'Interview scheduled! 🎉'
    });
    
    console.log('\n📧 Notification sent to candidate');
    console.log('\n🗓️ Interview will appear on Recruiter Calendar!');
    console.log(`   Date: ${scheduledDate.toLocaleDateString()}`);
    
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  }
  process.exit(0);
})();
