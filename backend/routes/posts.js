const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const multer = require('multer');
const auth = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth');
const { Post, User, Profile, RecruiterProfile, Like, Comment, CommentLike, Follow, Notification } = require('../models');
const { postStorage } = require('../config/cloudinary');
const aiService = require('../services/aiService');
const { aiRateLimiter, recordAIUsage } = require('../middleware/aiRateLimiter');
const { strictLimiter } = require('../middleware/rateLimiters');

// Configure multer for post images with Cloudinary
const upload = multer({
  storage: postStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|gif|webp)$/i.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only PNG, JPEG, GIF or WebP images are allowed'));
  },
});

// Helper function to notify followers when user creates a new post
async function notifyFollowersOfPost(userId, postId, authorName, content) {
  try {
    // Get all followers of this user
    const followers = await Follow.findAll({
      where: { followingId: userId },
      attributes: ['followerId']
    });
    
    if (followers.length === 0) return;
    
    // Create notifications for each follower (limit to prevent spam)
    const maxNotifications = 100;
    const followerIds = followers.slice(0, maxNotifications).map(f => f.followerId);
    
    // Create notifications in bulk
    const notifications = followerIds.map(followerId => ({
      userId: followerId,
      type: 'friend_post',
      title: 'New Post',
      message: `${authorName} shared a new post: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
      relatedData: { postId, authorId: userId },
      isRead: false
    }));
    
    await Notification.bulkCreate(notifications);
    console.log(`📬 Notified ${notifications.length} followers about new post`);
  } catch (error) {
    console.error('Error notifying followers:', error);
  }
}

// @route   GET /api/posts
// @desc    Get all posts with optional filtering
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { 
      authorType, 
      postType, 
      page = 1, 
      limit = 20,
      userId 
    } = req.query;

    const where = { isPublic: true };
    
    if (authorType && ['candidate', 'recruiter'].includes(authorType)) {
      where.authorType = authorType;
    }
    
    if (postType) {
      where.postType = postType;
    }
    
    if (userId) {
      where.userId = userId;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: posts } = await Post.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'firstName', 'lastName', 'email', 'role']
        }
      ],
      distinct: true,
      subQuery: false,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    // Format posts with author info - fetch profiles separately to ensure correct ordering
    const formattedPosts = await Promise.all(posts.map(async post => {
      const postData = post.toJSON();
      const author = postData.author;
      
      // Fetch the most recent profile for each author
      let avatar = null;
      let profileData = null;
      
      if (author.role === 'recruiter') {
        const recruiterProfile = await RecruiterProfile.findOne({
          where: { userId: author.id },
          order: [['createdAt', 'DESC']],
          attributes: ['companyName', 'jobTitle', 'companyLogo', 'profilePicture']
        });
        if (recruiterProfile) {
          profileData = recruiterProfile;
          avatar = recruiterProfile.profilePicture || recruiterProfile.companyLogo || null;
        }
      } else {
        const profile = await Profile.findOne({
          where: { userId: author.id },
          order: [['createdAt', 'DESC']],
          attributes: ['headline', 'location', 'skills', 'profilePicture']
        });
        if (profile) {
          profileData = profile;
          avatar = profile.profilePicture || null;
        }
      }

      let authorInfo = {
        id: author.id,
        name: `${author.firstName} ${author.lastName}`,
        role: author.role,
        avatar
      };

      if (author.role === 'candidate' && profileData) {
        authorInfo = {
          ...authorInfo,
          headline: profileData.headline,
          location: profileData.location
        };
      } else if (author.role === 'recruiter' && profileData) {
        authorInfo = {
          ...authorInfo,
          companyName: profileData.companyName,
          title: profileData.jobTitle
        };
      }

      return {
        ...postData,
        author: authorInfo
      };
    }));

    res.json({
      posts: formattedPosts,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / parseInt(limit)),
        hasMore: offset + posts.length < count
      }
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/posts/check-likes
// @desc    Check if user has liked specific posts
// @access  Private
router.post('/check-likes', auth, async (req, res) => {
  try {
    const { postIds } = req.body;

    if (!postIds || !Array.isArray(postIds)) {
      return res.status(400).json({ message: 'postIds array is required' });
    }

    const likes = await Like.findAll({
      where: {
        userId: req.user.id,
        postId: { [Op.in]: postIds }
      },
      attributes: ['postId']
    });

    const likedPostIds = likes.map(like => like.postId);
    
    res.json({ likedPostIds });
  } catch (error) {
    console.error('Error checking likes:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/posts/upload-image
// @desc    Upload an image for a post
// @access  Private
router.post('/upload-image', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    // Cloudinary returns the URL in req.file.path
    const imageUrl = req.file.path;
    
    res.json({ 
      success: true,
      imageUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/posts/:id/view
// @desc    Increment view count for a post
// @access  Public (anyone can view a post)
router.post('/:id/view', async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Increment views
    await post.increment('views');
    
    res.json({ 
      success: true,
      views: post.views + 1
    });
  } catch (error) {
    console.error('Error tracking view:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/posts
// @desc    Create a new post
// @access  Private
router.post('/', strictLimiter, auth, async (req, res) => {
  try {
    const { content, postType, imageUrl, linkUrl, linkTitle, tags, isPublic, idempotencyKey } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Post content is required' });
    }

    if (content.length > 5000) {
      return res.status(400).json({ message: 'Post content must be less than 5000 characters' });
    }

    // Idempotency: if the client supplied a key, short-circuit on retries.
    if (idempotencyKey && typeof idempotencyKey === 'string' && idempotencyKey.length <= 64) {
      const existing = await Post.findOne({
        where: { userId: req.user.id, idempotencyKey }
      });
      if (existing) {
        console.log('[POST /posts] Idempotent retry — returning existing post', existing.id);
        return res.status(200).json(existing);
      }
    }

    const post = await Post.create({
      userId: req.user.id,
      content: content.trim().replace(/<script[^>]*>.*?<\/script>/gi, '').replace(/<[^>]+on\w+\s*=\s*['"][^'"]*['"][^>]*>/gi, ''),
      postType: postType || 'update',
      authorType: req.user.role,
      imageUrl,
      linkUrl,
      linkTitle,
      tags: tags || [],
      isPublic: isPublic !== false,
      idempotencyKey: idempotencyKey && idempotencyKey.length <= 64 ? idempotencyKey : null,
    });

    // Fetch the post with author details
    const createdPost = await Post.findByPk(post.id, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
          include: [
            {
              model: Profile,
              as: 'profile',
              attributes: ['headline', 'location', 'skills', 'profilePicture'],
              required: false
            },
            {
              model: RecruiterProfile,
              as: 'recruiterProfile',
              attributes: ['companyName', 'jobTitle', 'companyLogo', 'profilePicture'],
              required: false
            }
          ]
        }
      ]
    });

    // Format the post with author info (same as GET /posts)
    const postData = createdPost.toJSON();
    const author = postData.author;
    
    // Determine avatar with consistent priority: recruiterProfile.profilePicture > profile.profilePicture > companyLogo
    const avatar = (author.recruiterProfile?.profilePicture) || 
                   (author.profile?.profilePicture) || 
                   (author.recruiterProfile?.companyLogo) || 
                   null;
    
    let authorInfo = {
      id: author.id,
      name: `${author.firstName} ${author.lastName}`,
      role: author.role,
      avatar // Always include avatar
    };

    if (author.role === 'candidate' && author.profile) {
      authorInfo = {
        ...authorInfo,
        headline: author.profile.headline,
        location: author.profile.location
      };
    } else if (author.role === 'recruiter' && author.recruiterProfile) {
      authorInfo = {
        ...authorInfo,
        companyName: author.recruiterProfile.companyName,
        title: author.recruiterProfile.jobTitle
      };
    }

    const formattedPost = {
      ...postData,
      author: authorInfo
    };
    
    // Notify followers about the new post (async, don't wait)
    notifyFollowersOfPost(req.user.id, post.id, authorInfo.name, content).catch(err => {
      console.error('Failed to notify followers:', err);
    });
    
    console.log('✅ [POST /posts] Returning formatted post');
    res.status(201).json(formattedPost);
  } catch (error) {
    console.error('❌ [POST /posts] Error creating post:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/posts/:id
// @desc    Get a single post by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
          include: [
            {
              model: Profile,
              as: 'profile',
              attributes: ['headline', 'location', 'skills', 'profilePicture'],
              required: false
            },
            {
              model: RecruiterProfile,
              as: 'recruiterProfile',
              attributes: ['companyName', 'jobTitle', 'companyLogo', 'profilePicture'],
              required: false
            }
          ]
        }
      ]
    });

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    res.json(post);
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/posts/:id
// @desc    Update a post
// @access  Private (owner only)
router.put('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to edit this post' });
    }

    const { content, postType, imageUrl, linkUrl, linkTitle, tags, isPublic } = req.body;

    await post.update({
      content: content?.trim() || post.content,
      postType: postType || post.postType,
      imageUrl: imageUrl !== undefined ? imageUrl : post.imageUrl,
      linkUrl: linkUrl !== undefined ? linkUrl : post.linkUrl,
      linkTitle: linkTitle !== undefined ? linkTitle : post.linkTitle,
      tags: tags || post.tags,
      isPublic: isPublic !== undefined ? isPublic : post.isPublic
    });

    res.json(post);
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/posts/:id
// @desc    Delete a post
// @access  Private (owner only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    await post.destroy();
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/posts/:id/like
// @desc    Like/Unlike a post (toggle)
// @access  Private
router.post('/:id/like', auth, async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if user already liked this post
    const existingLike = await Like.findOne({
      where: {
        userId: req.user.id,
        postId: req.params.id
      }
    });

    if (existingLike) {
      // Unlike: Remove the like
      await existingLike.destroy();
      await post.decrement('likes');
      await post.reload();
      return res.json({ 
        liked: false, 
        likes: post.likes,
        message: 'Post unliked successfully'
      });
    } else {
      // Like: Add the like
      await Like.create({
        userId: req.user.id,
        postId: req.params.id
      });
      await post.increment('likes');
      await post.reload();
      return res.json({ 
        liked: true, 
        likes: post.likes,
        message: 'Post liked successfully'
      });
    }
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/posts/:id/likes
// @desc    Get list of users who liked a post
// @access  Public
router.get('/:id/likes', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const likes = await Like.findAll({
      where: { postId: req.params.id },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'role']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Fetch profile pictures separately with proper ordering
    const likesWithProfiles = await Promise.all(likes.map(async like => {
      const likeData = like.toJSON();
      const user = likeData.user;

      let profilePicture = null;
      if (user.role === 'recruiter') {
        const recruiterProfile = await RecruiterProfile.findOne({
          where: { userId: user.id },
          order: [['createdAt', 'DESC']],
          attributes: ['profilePicture']
        });
        profilePicture = recruiterProfile?.profilePicture || null;
      } else {
        const profile = await Profile.findOne({
          where: { userId: user.id },
          order: [['createdAt', 'DESC']],
          attributes: ['profilePicture']
        });
        profilePicture = profile?.profilePicture || null;
      }

      return {
        id: likeData.id,
        createdAt: likeData.createdAt,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          profilePicture
        }
      };
    }));

    res.json(likesWithProfiles);
  } catch (error) {
    console.error('Error fetching likes:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/posts/:id/comments
// @desc    Get all top-level comments for a post (not replies)
// @access  Public
router.get('/:id/comments', optionalAuth, async (req, res) => {
  try {
    const { CommentLike } = require('../models');
    const comments = await Comment.findAll({
      where: { 
        postId: req.params.id,
        parentCommentId: null // Only top-level comments
      },
      order: [['createdAt', 'DESC']]
    });

    // Fetch profiles separately with proper ordering and like status
    const formattedComments = await Promise.all(comments.map(async comment => {
      const commentData = comment.toJSON();
      const user = await User.findByPk(comment.userId, {
        attributes: ['id', 'firstName', 'lastName', 'role']
      });

      if (!user) return commentData;

      let profilePicture = null;
      if (user.role === 'recruiter') {
        const recruiterProfile = await RecruiterProfile.findOne({
          where: { userId: user.id },
          order: [['createdAt', 'DESC']],
          attributes: ['profilePicture']
        });
        profilePicture = recruiterProfile?.profilePicture || null;
      } else {
        const profile = await Profile.findOne({
          where: { userId: user.id },
          order: [['createdAt', 'DESC']],
          attributes: ['profilePicture']
        });
        profilePicture = profile?.profilePicture || null;
      }

      // Check if current user liked this comment
      let isLikedByUser = false;
      if (req.user) {
        const userLike = await CommentLike.findOne({
          where: {
            userId: req.user.id,
            commentId: comment.id
          }
        });
        isLikedByUser = !!userLike;
      }

      // Count replies
      const repliesCount = await Comment.count({
        where: { parentCommentId: comment.id }
      });

      return {
        ...commentData,
        isLikedByUser,
        repliesCount,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          profile: user.role === 'candidate' ? { profilePicture } : null,
          recruiterProfile: user.role === 'recruiter' ? { profilePicture } : null
        }
      };
    }));

    res.json(formattedComments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/posts/:id/comments
// @desc    Add a comment to a post
// @access  Private
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    const post = await Post.findByPk(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = await Comment.create({
      userId: req.user.id,
      postId: req.params.id,
      content: content.trim()
    });

    // Increment comment count on post
    await post.increment('commentsCount');
    await post.reload();

    // Fetch user and profile separately with proper ordering
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'firstName', 'lastName', 'role']
    });

    let profilePicture = null;
    if (user.role === 'recruiter') {
      const recruiterProfile = await RecruiterProfile.findOne({
        where: { userId: user.id },
        order: [['createdAt', 'DESC']],
        attributes: ['profilePicture']
      });
      profilePicture = recruiterProfile?.profilePicture || null;
    } else {
      const profile = await Profile.findOne({
        where: { userId: user.id },
        order: [['createdAt', 'DESC']],
        attributes: ['profilePicture']
      });
      profilePicture = profile?.profilePicture || null;
    }

    const commentResponse = {
      ...comment.toJSON(),
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        profile: user.role === 'candidate' ? { profilePicture } : null,
        recruiterProfile: user.role === 'recruiter' ? { profilePicture } : null
      }
    };

    res.status(201).json(commentResponse);
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/posts/:id/comments/:commentId
// @desc    Edit a comment
// @access  Private (only comment author)
router.put('/:id/comments/:commentId', auth, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    const comment = await Comment.findByPk(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user is the comment author
    if (comment.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to edit this comment' });
    }

    // Update comment
    await comment.update({ content: content.trim() });

    // Fetch user and profile
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'firstName', 'lastName', 'role']
    });

    let profilePicture = null;
    if (user.role === 'recruiter') {
      const recruiterProfile = await RecruiterProfile.findOne({
        where: { userId: user.id },
        order: [['createdAt', 'DESC']],
        attributes: ['profilePicture']
      });
      profilePicture = recruiterProfile?.profilePicture || null;
    } else {
      const profile = await Profile.findOne({
        where: { userId: user.id },
        order: [['createdAt', 'DESC']],
        attributes: ['profilePicture']
      });
      profilePicture = profile?.profilePicture || null;
    }

    const commentResponse = {
      ...comment.toJSON(),
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        profile: user.role === 'candidate' ? { profilePicture } : null,
        recruiterProfile: user.role === 'recruiter' ? { profilePicture } : null
      }
    };

    res.json(commentResponse);
  } catch (error) {
    console.error('Error editing comment:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/posts/:id/comments/:commentId
// @desc    Delete a comment
// @access  Private (only comment author)
router.delete('/:id/comments/:commentId', auth, async (req, res) => {
  try {
    const comment = await Comment.findByPk(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user is the comment author
    if (comment.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    await comment.destroy();

    // Decrement comment count on post
    const post = await Post.findByPk(req.params.id);
    if (post) {
      await post.decrement('commentsCount');
    }

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/posts/:id/comments/:commentId/like
// @desc    Like/unlike a comment
// @access  Private
router.post('/:id/comments/:commentId/like', auth, async (req, res) => {
  try {
    const { CommentLike } = require('../models');
    const comment = await Comment.findByPk(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const existingLike = await CommentLike.findOne({
      where: {
        userId: req.user.id,
        commentId: req.params.commentId
      }
    });

    if (existingLike) {
      // Unlike the comment
      await existingLike.destroy();
      await comment.decrement('likesCount');
      await comment.reload();
      return res.json({ liked: false, likesCount: comment.likesCount });
    } else {
      // Like the comment
      await CommentLike.create({
        userId: req.user.id,
        commentId: req.params.commentId
      });
      await comment.increment('likesCount');
      await comment.reload();
      return res.json({ liked: true, likesCount: comment.likesCount });
    }
  } catch (error) {
    console.error('Error liking comment:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/posts/:id/comments/:commentId/likes
// @desc    Get all users who liked a comment
// @access  Public
router.get('/:id/comments/:commentId/likes', async (req, res) => {
  try {
    const { CommentLike } = require('../models');
    const comment = await Comment.findByPk(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const likes = await CommentLike.findAll({
      where: { commentId: req.params.commentId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          include: [
            {
              model: Profile,
              as: 'profile',
              attributes: ['profilePicture']
            },
            {
              model: RecruiterProfile,
              as: 'recruiterProfile',
              attributes: ['profilePicture']
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const users = likes.map(like => {
      const user = like.user;
      const profilePicture = user.profile?.profilePicture || user.recruiterProfile?.profilePicture;
      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        profilePicture,
        likedAt: like.createdAt
      };
    });

    res.json(users);
  } catch (error) {
    console.error('Error fetching comment likes:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/posts/:id/comments/:commentId/reply
// @desc    Reply to a comment
// @access  Private
router.post('/:id/comments/:commentId/reply', auth, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    const parentComment = await Comment.findByPk(req.params.commentId);
    if (!parentComment) {
      return res.status(404).json({ message: 'Parent comment not found' });
    }

    const post = await Post.findByPk(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const reply = await Comment.create({
      content: content.trim(),
      userId: req.user.id,
      postId: req.params.id,
      parentCommentId: req.params.commentId
    });

    await post.increment('commentsCount');

    const replyWithUser = await Comment.findByPk(reply.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          include: [
            {
              model: Profile,
              as: 'profile',
              attributes: ['profilePicture']
            },
            {
              model: RecruiterProfile,
              as: 'recruiterProfile',
              attributes: ['profilePicture']
            }
          ]
        }
      ]
    });

    res.status(201).json(replyWithUser);
  } catch (error) {
    console.error('Error creating reply:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/posts/:id/comments/:commentId/replies
// @desc    Get all replies to a comment
// @access  Public
router.get('/:id/comments/:commentId/replies', async (req, res) => {
  try {
    const replies = await Comment.findAll({
      where: { parentCommentId: req.params.commentId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
          include: [
            {
              model: Profile,
              as: 'profile',
              attributes: ['profilePicture']
            },
            {
              model: RecruiterProfile,
              as: 'recruiterProfile',
              attributes: ['profilePicture']
            }
          ]
        }
      ],
      order: [['createdAt', 'ASC']]
    });

    res.json(replies);
  } catch (error) {
    console.error('Error fetching replies:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/posts/user/:userId
// @desc    Get all posts by a specific user
// @access  Public
router.get('/user/:userId', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: posts } = await Post.findAndCountAll({
      where: { 
        userId: req.params.userId,
        isPublic: true
      },
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'firstName', 'lastName', 'email', 'role']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      posts,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / parseInt(limit)),
        hasMore: offset + posts.length < count
      }
    });
  } catch (error) {
    console.error('Error fetching user posts:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// =============== SAVED POSTS (BOOKMARKS) ===============

// @route   POST /api/posts/:id/save
// @desc    Save/Unsave a post (bookmark)
// @access  Private
router.post('/:id/save', auth, async (req, res) => {
  try {
    const { SavedPost } = require('../models');
    const postId = req.params.id;
    const userId = req.user.id;
    
    // Check if post exists
    const post = await Post.findByPk(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Check if already saved
    const existingSave = await SavedPost.findOne({
      where: { userId, postId }
    });
    
    if (existingSave) {
      // Unsave
      await existingSave.destroy();
      return res.json({ saved: false, message: 'Post removed from saved' });
    }
    
    // Save
    await SavedPost.create({ userId, postId });
    res.json({ saved: true, message: 'Post saved' });
  } catch (error) {
    console.error('Error saving post:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/posts/saved
// @desc    Get all saved posts for current user
// @access  Private
router.get('/saved', auth, async (req, res) => {
  try {
    const { SavedPost } = require('../models');
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const { count, rows: savedPosts } = await SavedPost.findAndCountAll({
      where: { userId: req.user.id },
      include: [{
        model: Post,
        as: 'post',
        include: [{
          model: User,
          as: 'author',
          attributes: ['id', 'firstName', 'lastName', 'email', 'role']
        }]
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });
    
    // Format posts with author info
    const formattedPosts = await Promise.all(savedPosts.map(async sp => {
      const post = sp.post;
      if (!post) return null;
      
      const postData = post.toJSON();
      const author = postData.author;
      
      let avatar = null;
      if (author.role === 'recruiter') {
        const recruiterProfile = await RecruiterProfile.findOne({
          where: { userId: author.id },
          order: [['createdAt', 'DESC']],
          attributes: ['profilePicture', 'companyName', 'jobTitle']
        });
        if (recruiterProfile) {
          avatar = recruiterProfile.profilePicture || null;
          author.companyName = recruiterProfile.companyName;
          author.title = recruiterProfile.jobTitle;
        }
      } else {
        const profile = await Profile.findOne({
          where: { userId: author.id },
          order: [['createdAt', 'DESC']],
          attributes: ['profilePicture', 'headline', 'location']
        });
        if (profile) {
          avatar = profile.profilePicture || null;
          author.headline = profile.headline;
          author.location = profile.location;
        }
      }
      
      return {
        ...postData,
        savedAt: sp.createdAt,
        author: {
          ...author,
          name: `${author.firstName} ${author.lastName}`,
          avatar
        }
      };
    }));
    
    res.json({
      posts: formattedPosts.filter(p => p !== null),
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / parseInt(limit)),
        hasMore: offset + savedPosts.length < count
      }
    });
  } catch (error) {
    console.error('Error fetching saved posts:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/posts/check-saved
// @desc    Check if user has saved specific posts
// @access  Private
router.post('/check-saved', auth, async (req, res) => {
  try {
    const { SavedPost } = require('../models');
    const { postIds } = req.body;

    if (!postIds || !Array.isArray(postIds)) {
      return res.status(400).json({ message: 'postIds array is required' });
    }

    const saves = await SavedPost.findAll({
      where: {
        userId: req.user.id,
        postId: { [Op.in]: postIds }
      }
    });

    const savedPostIds = saves.map(s => s.postId);
    res.json({ savedPostIds });
  } catch (error) {
    console.error('Error checking saved posts:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/posts/ai/enhance
// @desc    AI-powered post enhancement
// @access  Private
router.post('/ai/enhance', auth, aiRateLimiter('post_enhance'), async (req, res) => {
  try {
    const { content, postType = 'update' } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Content is required for enhancement' });
    }

    console.log('🤖 [AI Enhancement] User:', req.user.id, '| Role:', req.user.role, '| PostType:', postType);
    
    const enhancedResult = await aiService.enhancePost(content, postType, req.user.role);
    
    // Record AI usage
    await recordAIUsage(req.user.id, 'post_enhance', { postType });
    
    console.log('✅ [AI Enhancement] Success | Engagement Score:', enhancedResult.predictedEngagement.score);
    res.json(enhancedResult);
  } catch (error) {
    console.error('❌ [AI Enhancement] Error:', error.message);
    res.status(500).json({ 
      message: 'Failed to enhance post with AI', 
      error: error.message 
    });
  }
});

// @route   POST /api/posts/ai/suggest
// @desc    AI-powered post suggestions
// @access  Private
router.post('/ai/suggest', auth, aiRateLimiter('post_enhance'), async (req, res) => {
  try {
    const { context } = req.body;
    const currentContent = context?.currentContent || '';
    
    console.log('🤖 [AI Suggestions] User:', req.user.id, '| Role:', req.user.role);
    
    const suggestions = await aiService.generatePostSuggestions(req.user.role, currentContent);
    
    // Record AI usage
    await recordAIUsage(req.user.id, 'post_enhance', { action: 'suggestions' });
    
    console.log('✅ [AI Suggestions] Generated', suggestions.topicIdeas.length, 'ideas');
    res.json(suggestions);
  } catch (error) {
    console.error('❌ [AI Suggestions] Error:', error.message);
    res.status(500).json({ 
      message: 'Failed to generate post suggestions', 
      error: error.message 
    });
  }
});

module.exports = router;
