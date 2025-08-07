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

    // Parse dates
    const start = moment(startDate).startOf('day');
    const end = moment(endDate).startOf('day');
    
    // Validate date range
    if (end.isBefore(start)) {
      return res.status(400).json({
        success: false,
        message: 'End date cannot be before start date'
      });
    }

    // Check if it's a half day leave
    const halfDay = isHalfDay === true || isHalfDay === 'true' || isHalfDay === '1';
    
    // Calculate total days
    let totalDays;
    if (halfDay) {
      // For half day, start and end date should be the same
      if (!start.isSame(end, 'day')) {
        return res.status(400).json({
          success: false,
          message: 'Half day leave must have the same start and end date'
        });
      }
      totalDays = 0.5;
    } else {
      totalDays = end.diff(start, 'days') + 1;
    }

    // Check for overlapping leaves - comprehensive overlap detection
    const overlappingLeave = await Leave.findOne({
      employeeId: employee._id,
      status: { $in: ['pending', 'approved'] },
      $and: [
        {
          $or: [
            // Case 1: Existing leave starts before or on the requested start date
            // and ends after or on the requested start date
            {
              startDate: { $lte: start.toDate() },
              endDate: { $gte: start.toDate() }
            },
            // Case 2: Existing leave starts before or on the requested end date
            // and ends after or on the requested end date
            {
              startDate: { $lte: end.toDate() },
              endDate: { $gte: end.toDate() }
            },
            // Case 3: Existing leave is completely within the requested period
            {
              startDate: { $gte: start.toDate() },
              endDate: { $lte: end.toDate() }
            },
            // Case 4: Requested leave is completely within existing leave
            {
              startDate: { $lte: start.toDate() },
              endDate: { $gte: end.toDate() }
            }
          ]
        }
      ]
    });

    if (overlappingLeave) {
      // Format dates for better error message
      const existingStart = moment(overlappingLeave.startDate).format('YYYY-MM-DD');
      const existingEnd = moment(overlappingLeave.endDate).format('YYYY-MM-DD');
      
      return res.status(400).json({
        success: false,
        message: `Leave request conflicts with existing ${overlappingLeave.status} leave from ${existingStart} to ${existingEnd}`,
        conflictingLeave: {
          id: overlappingLeave._id,
          type: overlappingLeave.type,
          startDate: existingStart,
          endDate: existingEnd,
          status: overlappingLeave.status
        }
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

    // Create the leave request
    const leave = new Leave({
      employeeId: employee._id,
      type: type.toLowerCase(),
      startDate: start.toDate(),
      endDate: end.toDate(),
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
        employeeId = '',
        startDate = '',
        endDate = '',
        department = '',
        includeOwn = 'true', // New parameter to control if user sees their own leaves
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Find employeeId of logged-in user for reference
      const currentEmployee = await Employee.findOne({ userId: req.user.id }).select('_id');

      // Build query object
      const query = {};

      // UPDATED: Include or exclude current user's leaves based on parameter
      if (includeOwn === 'false' && currentEmployee) {
        query.employeeId = { $ne: currentEmployee._id };
      }

      // Filter by status
      if (status) {
        query.status = status;
      }

      // Filter by leave type
      if (type) {
        query.type = type;
      }

      // Filter by specific employee
      if (employeeId) {
        query.employeeId = employeeId;
      }

      // Filter by date range
      if (startDate || endDate) {
        query.$and = query.$and || [];
        
        if (startDate) {
          query.$and.push({
            startDate: { $gte: new Date(startDate) }
          });
        }
        
        if (endDate) {
          query.$and.push({
            endDate: { $lte: new Date(endDate) }
          });
        }
      }

      // Enhanced population with department info
      let leavesQuery = Leave.find(query)
        .populate([
          {
            path: 'employeeId',
            populate: {
              path: 'userId',
              select: 'firstName lastName email phone department role',
              populate: [
                { path: 'department', select: 'name code' },
                { path: 'role', select: 'name' }
              ]
            },
            select: 'employeeId joiningDate'
          },
          {
            path: 'approvedBy',
            select: 'firstName lastName email'
          }
        ]);

      // Apply sorting
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
      leavesQuery = leavesQuery.sort(sortOptions);

      // Get all leaves first (for accurate search)
      const allLeaves = await leavesQuery.exec();

      // Enhanced search functionality
      let filteredLeaves = allLeaves;
      if (search) {
        const searchLower = search.toLowerCase();
        
        filteredLeaves = allLeaves.filter(leave => {
          // Employee name search
          const employeeName = `${leave.employeeId?.userId?.firstName || ''} ${leave.employeeId?.userId?.lastName || ''}`.toLowerCase();
          
          // Employee ID search
          const empId = leave.employeeId?.employeeId?.toLowerCase() || '';
          
          // Email search
          const email = leave.employeeId?.userId?.email?.toLowerCase() || '';
          
          // Reason search
          const reason = leave.reason?.toLowerCase() || '';
          
          // Department search
          const departmentName = leave.employeeId?.userId?.department?.name?.toLowerCase() || '';
          
          // Role search
          const roleName = leave.employeeId?.userId?.role?.name?.toLowerCase() || '';
          
          // Leave type search
          const leaveType = leave.type?.toLowerCase() || '';
          
          // Status search
          const leaveStatus = leave.status?.toLowerCase() || '';

          return employeeName.includes(searchLower) ||
                 empId.includes(searchLower) ||
                 email.includes(searchLower) ||
                 reason.includes(searchLower) ||
                 departmentName.includes(searchLower) ||
                 roleName.includes(searchLower) ||
                 leaveType.includes(searchLower) ||
                 leaveStatus.includes(searchLower);
        });
      }

      // Filter by department if specified
      if (department) {
        filteredLeaves = filteredLeaves.filter(leave => 
          leave.employeeId?.userId?.department?.name?.toLowerCase().includes(department.toLowerCase()) ||
          leave.employeeId?.userId?.department?.code?.toLowerCase().includes(department.toLowerCase())
        );
      }

      // Apply pagination to filtered results
      const paginatedLeaves = filteredLeaves.slice(skip, skip + parseInt(limit));

      // Get total count for pagination (based on filtered results)
      const totalFilteredItems = filteredLeaves.length;
      const totalPages = Math.ceil(totalFilteredItems / parseInt(limit));

      // Get total count without filters for statistics
      const totalAllLeaves = await Leave.countDocuments({});
      const totalCurrentUserLeaves = currentEmployee ? await Leave.countDocuments({ employeeId: currentEmployee._id }) : 0;

      // Calculate statistics
      const statistics = {
        total: totalAllLeaves,
        currentUserLeaves: totalCurrentUserLeaves,
        otherUsersLeaves: totalAllLeaves - totalCurrentUserLeaves,
        pending: await Leave.countDocuments({ status: 'pending' }),
        approved: await Leave.countDocuments({ status: 'approved' }),
        rejected: await Leave.countDocuments({ status: 'rejected' }),
        cancelled: await Leave.countDocuments({ status: 'cancelled' })
      };

      res.status(200).json({
        success: true,
        data: paginatedLeaves,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: totalFilteredItems,
          itemsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        },
        filters: {
          search,
          status,
          type,
          employeeId,
          startDate,
          endDate,
          department,
          includeOwn: includeOwn === 'true',
          sortBy,
          sortOrder
        },
        statistics
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


       try {
        if (status === 'approved') {
          await emailService.sendLeaveApprovalNotification(
            updatedLeave,                    // leave object
            updatedLeave.employeeId,         // employee object  
            updatedLeave.approvedBy,         // approver object
            {                                // options
              notifyHR: true,
              additionalTo: [],
              cc: [],
              bcc: []
            }
          );
          console.log('✅ Leave approval email sent successfully');
        } else if (status === 'rejected') {
          await emailService.sendLeaveRejectionNotification(
            updatedLeave,                    // leave object
            updatedLeave.employeeId,         // employee object  
            updatedLeave.approvedBy,         // approver object
            {                                // options
              notifyHR: true,
              additionalTo: [],
              cc: [],
              bcc: []
            }
          );
          console.log('✅ Leave rejection email sent successfully');
        }
      } catch (emailError) {
        // Log email error but don't fail the response
        console.error('❌ Error sending email notification:', emailError);
        // You might want to save this error to a notification queue for retry
      }

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

      // Find the leave with detailed population
      const leave = await Leave.findById(id)
        .populate({
          path: 'employeeId',
          populate: {
            path: 'userId',
            select: 'firstName lastName email phone department role',
            populate: [
              { path: 'department', select: 'name' },
              { path: 'role', select: 'name' }
            ]
          }
        })
        .populate({
          path: 'approvedBy',
          select: 'firstName lastName email'
        });

      if (!leave) {
        return res.status(404).json({
          success: false,
          message: 'Leave not found'
        });
      }

      // Find employee to check ownership
      const employee = await Employee.findOne({ userId: req.user.id });
      if (!employee || !leave.employeeId._id.equals(employee._id)) {
        return res.status(403).json({
          success: false,
          message: 'You can only cancel your own leave requests'
        });
      }

      // Check if leave can be cancelled
      if (leave.status === 'approved') {
        return res.status(400).json({
          success: false,
          message: 'Approved leaves cannot be cancelled'
        });
      }

      if (leave.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: 'Leave is already cancelled'
        });
      }

      // Update leave status
      const updatedLeave = await Leave.findByIdAndUpdate(
        id,
        { 
          status: 'cancelled',
          updatedAt: new Date()
        },
        { new: true }
      ).populate([
        {
          path: 'employeeId',
          populate: {
            path: 'userId',
            select: 'firstName lastName email phone department role',
            populate: [
              { path: 'department', select: 'name' },
              { path: 'role', select: 'name' }
            ]
          }
        },
        {
          path: 'approvedBy',
          select: 'firstName lastName email'
        }
      ]);

      // Send email notifications
    //  await emailService.sendLeaveRejectionNotification(
    //     updatedLeave,                    // leave object
    //     updatedLeave.employeeId,         // employee object  
    //     updatedLeave.approvedBy,         // approver object
    //     {                                // options
    //       notifyHR: true,
    //       additionalTo: [],
    //       cc: [],
    //       bcc: []
    //     }
    //   );
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