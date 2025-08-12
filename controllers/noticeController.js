const Notice = require('../models/Notice');
const mongoose = require('mongoose');

class NoticeController {
  static async getAllNotices(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        status = 'published',
        category,
        priority,
        search,
        userId,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const filter = {
        isActive: true,
        status: status
      };

      // Add filters
      if (category && category !== 'all') filter.category = category;
      if (priority && priority !== 'all') filter.priority = priority;
      
      // Search functionality
      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { content: { $regex: search, $options: 'i' } },
          { authorName: { $regex: search, $options: 'i' } }
        ];
      }

      // Check for expired notices
      const now = new Date();
      filter.$or = [
        { expiryDate: null },
        { expiryDate: { $gt: now } }
      ];

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
      
      // If sorting by priority, add custom sort logic
      if (sortBy === 'priority') {
        sortOptions.isPinned = -1; // Pinned first
        sortOptions.priority = 1; // Then by priority
      } else {
        sortOptions.isPinned = -1; // Always show pinned first
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [notices, totalCount] = await Promise.all([
        Notice.find(filter)
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit))
          .populate('author', 'name email')
          .lean(),
        Notice.countDocuments(filter)
      ]);

      // Add user-specific data if userId provided
      if (userId) {
        notices.forEach(notice => {
          notice.isReadByUser = notice.readBy.some(
            read => read.userId.toString() === userId
          );
          notice.isLikedByUser = notice.likes.some(
            like => like.userId.toString() === userId
          );
        });
      }

      res.json({
        success: true,
        data: {
          notices,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / parseInt(limit)),
            totalCount,
            hasNext: skip + notices.length < totalCount,
            hasPrev: parseInt(page) > 1
          }
        }
      });
    } catch (error) {
      console.error('Error fetching notices:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch notices'
      });
    }
  }

  // Get single notice by ID
  static async getNoticeById(req, res) {
    try {
      const { id } = req.params;
      const { userId } = req.query;

      const notice = await Notice.findById(id)
        .populate('author', 'name email')
        .populate('comments.userId', 'name');

      if (!notice) {
        return res.status(404).json({
          success: false,
          error: 'Notice not found'
        });
      }

      // Increment view count
      await Notice.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });

      // Add user-specific data
      const noticeObj = notice.toObject();
      if (userId) {
        noticeObj.isReadByUser = notice.readBy.some(
          read => read.userId.toString() === userId
        );
        noticeObj.isLikedByUser = notice.likes.some(
          like => like.userId.toString() === userId
        );
      }

      res.json({
        success: true,
        data: noticeObj
      });
    } catch (error) {
      console.error('Error fetching notice:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch notice'
      });
    }
  }

  // Create new notice
  static async createNotice(req, res) {
    try {
      const {
        title,
        content,
        priority,
        category,
        status,
        isPinned,
        expiryDate,
        targetAudience,
        authorName
      } = req.body;

      const { userId } = req.user || req.body; // Assuming user from auth middleware

      const notice = new Notice({
        title,
        content,
        priority,
        category,
        author: userId,
        authorName,
        status,
        isPinned,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        targetAudience: targetAudience || ['all']
      });

      const savedNotice = await notice.save();
      await savedNotice.populate('author', 'name email');

      res.status(201).json({
        success: true,
        data: savedNotice,
        message: 'Notice created successfully'
      });
    } catch (error) {
      console.error('Error creating notice:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create notice'
      });
    }
  }

  // Update notice
  static async updateNotice(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Remove fields that shouldn't be updated directly
      delete updateData.readBy;
      delete updateData.likes;
      delete updateData.comments;
      delete updateData.viewCount;

      const notice = await Notice.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      ).populate('author', 'name email');

      if (!notice) {
        return res.status(404).json({
          success: false,
          error: 'Notice not found'
        });
      }

      res.json({
        success: true,
        data: notice,
        message: 'Notice updated successfully'
      });
    } catch (error) {
      console.error('Error updating notice:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update notice'
      });
    }
  }

  // Delete notice (soft delete)
  static async deleteNotice(req, res) {
    try {
      const { id } = req.params;

      const notice = await Notice.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true }
      );

      if (!notice) {
        return res.status(404).json({
          success: false,
          error: 'Notice not found'
        });
      }

      res.json({
        success: true,
        message: 'Notice deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting notice:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete notice'
      });
    }
  }


}

module.exports = NoticeController;