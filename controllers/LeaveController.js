const Leave = require("../models/Leave");
const Employee = require("../models/Employee");
const moment = require('moment');
const emailService = require("../services/emailService");

class LeaveController {
  // Create leave request
  static async createLeave(req, res) {
    try {
      const { type, startDate, endDate, reason, isHalfDay, emailOptions } = req.body;
      
      // Find employee by user ID
      const employee = await Employee.findOne({ userId: req.user.id }).populate('userId');
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee record not found'
        });
      }

      // Calculate total days
      const halfDay =
      isHalfDay === true ||           // if JSON posted boolean
      isHalfDay === 'true' ||         // or form-data posted "true"
      isHalfDay === '1';              // or you could support "1"/"0"

      // Calculate total days
      const start = moment(startDate);
      const end   = moment(endDate);
      let totalDays = end.diff(start, 'days') + 1;

      // Only override if really a half-day
      if (halfDay) {
        totalDays = 0.5;
      }

      // Check for overlapping leaves
      const overlappingLeave = await Leave.findOne({
        employeeId: employee._id,
        status: { $in: ['pending', 'approved'] },
        $or: [
          {
            startDate: { $lte: endDate },
            endDate: { $gte: startDate }
          }
        ]
      });

      if (overlappingLeave) {
        return res.status(400).json({
          success: false,
          message: 'Leave request overlaps with existing leave'
        });
      }

      // Handle file attachments if any
      let attachments = [];
      if (req.files && req.files.length > 0) {
        attachments = req.files.map(file => ({
          name: file.originalname,
          url: file.path,
          uploadedAt: new Date()
        }));
      }

      const leave = new Leave({
        employeeId: employee._id,
        type: type.toLowerCase(),
        startDate,
        endDate,
        totalDays,
        reason,
        attachments,
        status: 'pending'
      });

      await leave.save();
      await leave.populate([
        {
          path: 'employeeId',
          populate: {
            path: 'userId',
            select: 'firstName lastName email'
          }
        }
      ]);

      // Send email notifications
      try {
        // Parse email options from request body
        const emailNotificationOptions = emailOptions ? JSON.parse(emailOptions) : {};
        
        // Send leave application notification
        await emailService.sendLeaveApplicationNotification(
          leave,
          employee,
          {
            additionalTo: emailNotificationOptions.additionalTo || [],
            cc: emailNotificationOptions.cc || [],
            bcc: emailNotificationOptions.bcc || []
          }
        );
      } catch (emailError) {
        console.error('Email notification failed:', emailError);
        // Don't fail the request if email fails
      }

      res.status(201).json({
        success: true,
        message: 'Leave request submitted successfully',
        data: leave
      });
    } catch (error) {
      console.error('Error creating leave:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create leave request',
        error: error.message
      });
    }
  }

  // Get all leaves (HR view with filters and pagination)
  static async getAllLeaves(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        status = '',
        type = '',
        employeeId = ''
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      // Build query
      const query = {};
      
      if (status) {
        query.status = status;
      }
      
      if (type) {
        query.type = type;
      }
      
      if (employeeId) {
        query.employeeId = employeeId;
      }

      // Get leaves with pagination
      const leaves = await Leave.find(query)
        .populate([
          {
            path: 'employeeId',
            populate: {
              path: 'userId',
              select: 'firstName lastName email'
            }
          },
          {
            path: 'approvedBy',
            select: 'firstName lastName'
          }
        ])
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      // Filter by search if provided
      let filteredLeaves = leaves;
      if (search) {
        filteredLeaves = leaves.filter(leave => {
          const employeeName = `${leave.employeeId?.userId?.firstName || ''} ${leave.employeeId?.userId?.lastName || ''}`.toLowerCase();
          const employeeId = leave.employeeId?.employeeId?.toLowerCase() || '';
          const reason = leave.reason?.toLowerCase() || '';
          const searchLower = search.toLowerCase();
          
          return employeeName.includes(searchLower) || 
                 employeeId.includes(searchLower) || 
                 reason.includes(searchLower);
        });
      }

      const totalItems = await Leave.countDocuments(query);
      const totalPages = Math.ceil(totalItems / parseInt(limit));

      res.status(200).json({
        success: true,
        data: filteredLeaves,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems,
          itemsPerPage: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Error fetching leaves:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch leaves',
        error: error.message
      });
    }
  }

  // Get employee's own leaves
  static async getMyLeaves(req, res) {
    try {
      const { page = 1, limit = 10, status = '' } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Find employee by user ID
      const employee = await Employee.findOne({ userId: req.user.id });
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee record not found'
        });
      }

      const query = { employeeId: employee._id };
      if (status) {
        query.status = status;
      }

      const leaves = await Leave.find(query)
        .populate([
          {
            path: 'approvedBy',
            select: 'firstName lastName'
          }
        ])
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const totalItems = await Leave.countDocuments(query);
      const totalPages = Math.ceil(totalItems / parseInt(limit));

      res.status(200).json({
        success: true,
        data: leaves,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems,
          itemsPerPage: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Error fetching my leaves:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch your leaves',
        error: error.message
      });
    }
  }

  // Get leave by ID
  static async getLeaveById(req, res) {
    try {
      const { id } = req.params;
      
      const leave = await Leave.findById(id).populate([
        {
          path: 'employeeId',
          populate: {
            path: 'userId',
            select: 'firstName lastName email'
          }
        },
        {
          path: 'approvedBy',
          select: 'firstName lastName'
        }
      ]);

      if (!leave) {
        return res.status(404).json({
          success: false,
          message: 'Leave not found'
        });
      }

      res.status(200).json({
        success: true,
        data: leave
      });
    } catch (error) {
      console.error('Error fetching leave:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch leave',
        error: error.message
      });
    }
  }

  // Update leave status (approve/reject)
  static async updateLeaveStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, rejectionReason } = req.body;

      const leave = await Leave.findById(id);
      if (!leave) {
        return res.status(404).json({
          success: false,
          message: 'Leave not found'
        });
      }

      if (leave.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Only pending leaves can be updated'
        });
      }

      const updateData = {
        status,
        approvedBy: req.user.id,
        approvalDate: new Date()
      };

      if (status === 'rejected' && rejectionReason) {
        updateData.rejectionReason = rejectionReason;
      }

      const updatedLeave = await Leave.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
      ).populate([
        {
          path: 'employeeId',
          populate: {
            path: 'userId',
            select: 'firstName lastName email'
          }
        },
        {
          path: 'approvedBy',
          select: 'firstName lastName'
        }
      ]);

      res.status(200).json({
        success: true,
        message: `Leave ${status} successfully`,
        data: updatedLeave
      });
    } catch (error) {
      console.error('Error updating leave status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update leave status',
        error: error.message
      });
    }
  }

  // Cancel leave request
  static async cancelLeave(req, res) {
    try {
      const { id } = req.params;

      const leave = await Leave.findById(id);
      if (!leave) {
        return res.status(404).json({
          success: false,
          message: 'Leave not found'
        });
      }

      // Find employee to check ownership
      const employee = await Employee.findOne({ userId: req.user.id });
      if (!employee || !leave.employeeId.equals(employee._id)) {
        return res.status(403).json({
          success: false,
          message: 'You can only cancel your own leave requests'
        });
      }

      if (leave.status === 'approved') {
        return res.status(400).json({
          success: false,
          message: 'Approved leaves cannot be cancelled'
        });
      }

      const updatedLeave = await Leave.findByIdAndUpdate(
        id,
        { status: 'cancelled' },
        { new: true }
      ).populate([
        {
          path: 'approvedBy',
          select: 'firstName lastName'
        }
      ]);

      res.status(200).json({
        success: true,
        message: 'Leave cancelled successfully',
        data: updatedLeave
      });
    } catch (error) {
      console.error('Error cancelling leave:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel leave',
        error: error.message
      });
    }
  }

  // Delete leave request
  static async deleteLeave(req, res) {
    try {
      const { id } = req.params;

      const leave = await Leave.findById(id);
      if (!leave) {
        return res.status(404).json({
          success: false,
          message: 'Leave not found'
        });
      }

      await Leave.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: 'Leave deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting leave:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete leave',
        error: error.message
      });
    }
  }

  // Get leave statistics
 static async getLeaveStats(req, res) {
  try {
    const totalLeaves = await Leave.countDocuments();
    const pendingLeaves = await Leave.countDocuments({ status: 'pending' });
    const approvedLeaves = await Leave.countDocuments({ status: 'approved' });
    const rejectedLeaves = await Leave.countDocuments({ status: 'rejected' });
    const casualLeaves = await Leave.countDocuments({ type: 'casual' });
    const medicalLeaves = await Leave.countDocuments({ type: 'medical' });

    res.status(200).json({
      success: true,
      data: {
        totalLeaves,
        pendingLeaves,
        approvedLeaves,
        rejectedLeaves,
        casualLeaves,
        medicalLeaves
      }
    });
  } catch (error) {
    console.error('Error fetching leave stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leave statistics',
      error: error.message
    });
  }
}

// Get leave balance for employee
static async getLeaveBalance(req, res) {
  try {
    const { employeeId } = req.params;

    // Find employee
    const employee = employeeId
      ? await Employee.findById(employeeId)
      : await Employee.findOne({ userId: req.user.id });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31);

    // Default leave allocations
    const leaveAllocations = {
      casual: 9,
      medical: 9
    };

    // Function to calculate used leave by type - FIXED VERSION
    const getUsedLeaves = async (type) => {
      const result = await Leave.aggregate([
        {
          $match: {
            employeeId: employee._id,
            type,
            status: 'approved',
            startDate: { $lte: yearEnd },
            endDate: { $gte: yearStart }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalDays' }
          }
        }
      ]);
      
      // Return the exact sum without rounding to preserve decimal values (0.5, 1.5, etc.)
      return result[0]?.total || 0;
    };

    const casualTaken = await getUsedLeaves('casual');
    const medicalTaken = await getUsedLeaves('medical');

    // Calculate remaining leaves (can be negative if over-allocated)
    const casualRemaining = leaveAllocations.casual - casualTaken;
    const medicalRemaining = leaveAllocations.medical - medicalTaken;

    res.status(200).json({
      success: true,
      data: {
        casualLeaves: {
          total: leaveAllocations.casual,
          used: casualTaken,
          remaining: Math.max(0, casualRemaining) // Prevent negative display, but keep actual calculation
        },
        medicalLeaves: {
          total: leaveAllocations.medical,
          used: medicalTaken,
          remaining: Math.max(0, medicalRemaining) // Prevent negative display, but keep actual calculation
        },
        // Optional: Include raw remaining (can be negative) for internal logic
        _internal: {
          casualRemainingRaw: casualRemaining,
          medicalRemainingRaw: medicalRemaining
        }
      }
    });
  } catch (error) {
    console.error('Error fetching leave balance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leave balance',
      error: error.message
    });
  }
}

}

module.exports = LeaveController;