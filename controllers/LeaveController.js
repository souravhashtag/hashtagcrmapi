const Leave = require("../models/Leave");
const Employee = require("../models/Employee");
const moment = require('moment');
const emailService = require("../services/emailService");
const LeaveType = require("../models/LeaveType");
const EventLogger = require("./EventController");

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

      // Parse and validate dates
      const start = moment(startDate).startOf('day');
      const end = moment(endDate).startOf('day');

      // Basic date validation
      if (!start.isValid() || !end.isValid()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format. Please use YYYY-MM-DD format'
        });
      }

      // Check if trying to create leave in the past (allow today)
      const today = moment().startOf('day');
      if (
        start.isBefore(today) &&
        req.body.type?.toLowerCase() !== 'medical'
      ) {
        return res.status(400).json({
          success: false,
          message: 'Cannot create leave requests for past dates'
        });
      }


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

      // ENHANCED OVERLAP DETECTION
      console.log(`🔍 Checking for overlaps: ${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')}`);

      // Find all existing leaves that could potentially overlap
      const existingLeaves = await Leave.find({
        employeeId: employee._id,
        status: { $in: ['pending', 'approved'] }, // Don't check against rejected/cancelled leaves
        $or: [
          // ANY part of the requested period overlaps with existing leaves
          {
            // Existing leave starts during requested period
            startDate: {
              $gte: start.toDate(),
              $lte: end.toDate()
            }
          },
          {
            // Existing leave ends during requested period  
            endDate: {
              $gte: start.toDate(),
              $lte: end.toDate()
            }
          },
          {
            // Existing leave completely encompasses requested period
            $and: [
              { startDate: { $lte: start.toDate() } },
              { endDate: { $gte: end.toDate() } }
            ]
          },
          {
            // Requested period completely encompasses existing leave
            $and: [
              { startDate: { $gte: start.toDate() } },
              { endDate: { $lte: end.toDate() } }
            ]
          }
        ]
      }).sort({ startDate: 1 });

      console.log(`📋 Found ${existingLeaves.length} potentially overlapping leaves`);

      // Additional validation: Check each existing leave for exact overlap
      const overlappingLeaves = existingLeaves.filter(existingLeave => {
        const existingStart = moment(existingLeave.startDate).startOf('day');
        const existingEnd = moment(existingLeave.endDate).startOf('day');

        console.log(`🔎 Checking against: ${existingStart.format('YYYY-MM-DD')} to ${existingEnd.format('YYYY-MM-DD')} (${existingLeave.status})`);

        // Check for any form of overlap
        const hasOverlap = (
          // Case 1: New leave starts during existing leave
          (start.isSameOrAfter(existingStart) && start.isSameOrBefore(existingEnd)) ||
          // Case 2: New leave ends during existing leave
          (end.isSameOrAfter(existingStart) && end.isSameOrBefore(existingEnd)) ||
          // Case 3: New leave completely encompasses existing leave
          (start.isSameOrBefore(existingStart) && end.isSameOrAfter(existingEnd)) ||
          // Case 4: Existing leave completely encompasses new leave
          (existingStart.isSameOrBefore(start) && existingEnd.isSameOrAfter(end))
        );

        if (hasOverlap) {
          console.log(`❌ OVERLAP DETECTED with leave: ${existingLeave._id}`);
        }

        return hasOverlap;
      });

      if (overlappingLeaves.length > 0) {
        const conflictingLeave = overlappingLeaves[0];
        const existingStart = moment(conflictingLeave.startDate).format('YYYY-MM-DD');
        const existingEnd = moment(conflictingLeave.endDate).format('YYYY-MM-DD');

        return res.status(400).json({
          success: false,
          message: `❌ Leave request conflicts with existing ${conflictingLeave.status} leave from ${existingStart} to ${existingEnd}. You cannot create overlapping leave requests.`,
          conflictingLeave: {
            id: conflictingLeave._id,
            type: conflictingLeave.type,
            startDate: existingStart,
            endDate: existingEnd,
            status: conflictingLeave.status,
            totalDays: conflictingLeave.totalDays,
            reason: conflictingLeave.reason
          },
          requestedPeriod: {
            startDate: start.format('YYYY-MM-DD'),
            endDate: end.format('YYYY-MM-DD'),
            totalDays: totalDays
          }
        });
      }

      console.log(`✅ No overlaps found. Creating leave request.`);

      // Additional business rule validations
      // await LeaveController.validateBusinessRules(employee, type, totalDays, start, end);

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
        status: 'pending',
        createdAt: new Date()
      });

      await leave.save();
      await leave.populate([
        {
          path: 'employeeId',
          populate: {
            path: 'userId',
            select: 'firstName lastName email department role',
            populate: [
              { path: 'department', select: 'name' },
              { path: 'role', select: 'name' }
            ]
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
            bcc: emailNotificationOptions.bcc || [],
            notifyHR: true,
            notifyManager: true
          }
        );

        // console.log('✅ Leave application email notification sent successfully');
      } catch (emailError) {
        console.error('❌ Email notification failed:', emailError);
        // Don't fail the request if email fails
      }

      res.status(201).json({
        success: true,
        message: '🎉 Leave request submitted successfully and notifications sent',
        data: leave,
        summary: {
          employeeName: `${employee.userId.firstName} ${employee.userId.lastName}`,
          leaveType: type,
          period: `${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')}`,
          totalDays: totalDays,
          status: 'pending'
        }
      });

    } catch (error) {
      console.error('❌ Error creating leave:', error);
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

      // Send email notifications
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

      // Log events for each date in the leave period
      try {
        const startDate = new Date(updatedLeave.startDate);
        const endDate = new Date(updatedLeave.endDate);

        // Normalize bounds to local midnight to avoid partial-day drift
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(0, 0, 0, 0);

        // Build date-only (UTC) objects for each day
        const dates = [];
        const cursor = new Date(start);
        while (cursor <= end) {
          // Create a UTC midnight date-only for the current day
          const eventDateUtc = new Date(Date.UTC(
            cursor.getFullYear(),
            cursor.getMonth(),
            cursor.getDate()
          ));
          dates.push(eventDateUtc);
          cursor.setDate(cursor.getDate() + 1);
        }

        // Log event for each date (pass Date object, not a string)
        const logPromises = dates.map(dateOnlyUtc => {
          return EventLogger.logEvent({
            event_date: dateOnlyUtc, // <-- actual Date, UTC midnight
            event_description: `Leave ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            event_type: "Leave",
            userId: updatedLeave.employeeId?.userId?._id, // optional
            refId: updatedLeave._id                       // optional, nice to link
          });
        });

        // Execute all logging operations
        await Promise.all(logPromises);
        console.log(`✅ Successfully logged ${dates.length} leave events for dates: ${dates.map(d => d.toISOString().split('T')[0]).join(', ')}`);

      } catch (logError) {
        console.error('❌ Error logging leave events:', logError);
        // Don't fail the response if logging fails
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

      // Get all leave types from LeaveType schema
      const leaveTypes = await LeaveType.find({});

      if (!leaveTypes || leaveTypes.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No leave types configured'
        });
      }

      // Function to calculate used leave by type 
      const getUsedLeaves = async (type) => {
        const result = await Leave.aggregate([
          {
            $match: {
              employeeId: employee._id,
              type,
              // count pending immediately; exclude rejected/cancelled
              status: { $in: ['approved', 'pending'] },
              startDate: { $lte: yearEnd },
              endDate: { $gte: yearStart },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$totalDays' },
            },
          },
        ]);

        return result[0]?.total || 0; // preserves 0.5, 1.5, etc.
      };


      // Calculate leave balances for each leave type
      const leaveBalances = {};
      const internalData = {};

      for (const leaveType of leaveTypes) {
        const typeName = leaveType.name.toLowerCase();
        const usedLeaves = await getUsedLeaves(typeName);
        const remainingLeaves = leaveType.leaveCount - usedLeaves;

        leaveBalances[`${typeName}Leaves`] = {
          total: leaveType.leaveCount,
          used: usedLeaves,
          remaining: Math.max(0, remainingLeaves), // Prevent negative display
          isPaidLeave: leaveType.ispaidLeave
        };

        // Store raw remaining for internal logic
        internalData[`${typeName}RemainingRaw`] = remainingLeaves;
      }

      res.status(200).json({
        success: true,
        data: {
          ...leaveBalances,
          // Optional: Include raw remaining (can be negative) for internal logic 
          _internal: internalData
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

  // Create leave type
  static async createLeaveType(req, res) {
    try {
      const { name, leaveCount, monthlyDays, ispaidLeave, carryforward } = req.body;

      // Validation
      if (!name || name.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Leave type name is required'
        });
      }

      // Check if leave type already exists (case-insensitive)
      const existingLeaveType = await LeaveType.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
      });

      if (existingLeaveType) {
        return res.status(400).json({
          success: false,
          message: 'Leave type with this name already exists'
        });
      }

      // Normalize monthlyDays
      let monthly = 0;
      if (monthlyDays !== undefined) {
        const parsed = parseFloat(monthlyDays);
        if (isNaN(parsed) || parsed < 0) {
          return res.status(400).json({
            success: false,
            message: 'Monthly days must be a non-negative number'
          });
        }
        if (parsed > 5) {
          return res.status(400).json({
            success: false,
            message: 'Monthly days cannot exceed 5'
          });
        }
        monthly = parsed;
      }

      // Auto calculate yearly from monthly if present
      const yearly = monthly > 0 ? monthly * 12 : (leaveCount || 0);

      // Create new leave type
      const leaveType = new LeaveType({
        name: name.trim(),
        monthlyDays: monthly,
        leaveCount: yearly,
        ispaidLeave: ispaidLeave === true || ispaidLeave === 'true' || ispaidLeave === '1',
        carryforward: carryforward === true || carryforward === 'true' || carryforward === '1'
      });

      await leaveType.save();

      res.status(201).json({
        success: true,
        message: 'Leave type created successfully',
        data: leaveType
      });
    } catch (error) {
      console.error('Error creating leave type:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create leave type',
        error: error.message
      });
    }
  }


  // Get all leave types with optional filters and pagination
  static async getAllLeaveTypes(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        isPaid = '', // Filter by paid/unpaid status
        sortBy = 'name',
        sortOrder = 'asc'
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Build query object
      const query = {};

      // Search functionality
      if (search) {
        query.name = { $regex: search, $options: 'i' };
      }

      // Filter by paid/unpaid status
      if (isPaid !== '') {
        query.ispaidLeave = isPaid === 'true' || isPaid === '1';
      }

      // Build sort options
      const sortOptions = {};
      const validSortFields = ['name', 'leaveCount', 'ispaidLeave', 'createdAt', 'updatedAt'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'name';
      sortOptions[sortField] = sortOrder === 'desc' ? -1 : 1;

      // Execute query with pagination
      const leaveTypes = await LeaveType.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit));

      // Get total count for pagination
      const totalItems = await LeaveType.countDocuments(query);
      const totalPages = Math.ceil(totalItems / parseInt(limit));

      // Calculate statistics
      const statistics = {
        total: await LeaveType.countDocuments(),
        paidLeaveTypes: await LeaveType.countDocuments({ ispaidLeave: true }),
        unpaidLeaveTypes: await LeaveType.countDocuments({ ispaidLeave: false }),
        averageLeaveCount: await LeaveType.aggregate([
          {
            $group: {
              _id: null,
              avgLeaveCount: { $avg: '$leaveCount' }
            }
          }
        ]).then(result => Math.round((result[0]?.avgLeaveCount || 0) * 100) / 100)
      };

      res.status(200).json({
        success: true,
        data: leaveTypes,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems,
          itemsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        },
        filters: {
          search,
          isPaid: isPaid !== '' ? (isPaid === 'true' || isPaid === '1') : null,
          sortBy: sortField,
          sortOrder
        },
        statistics
      });

    } catch (error) {
      console.error('Error fetching leave types:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch leave types',
        error: error.message
      });
    }
  }

  // Get leave type by ID
  static async getLeaveTypeById(req, res) {
    try {
      const { id } = req.params;

      const leaveType = await LeaveType.findById(id);

      if (!leaveType) {
        return res.status(404).json({
          success: false,
          message: 'Leave type not found'
        });
      }

      res.status(200).json({
        success: true,
        data: leaveType
      });

    } catch (error) {
      console.error('Error fetching leave type:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch leave type',
        error: error.message
      });
    }
  }

  // Update leave type
  static async updateLeaveType(req, res) {
    try {
      const { id } = req.params;
      const { name, leaveCount, ispaidLeave, carryforward } = req.body;
      // Update fields
      const updateData = {
        updatedAt: new Date()
      };

      if (carryforward !== undefined) {
        updateData.carryforward = carryforward === true || carryforward === 'true' || carryforward === '1';
      }

      const leaveType = await LeaveType.findById(id);
      if (!leaveType) {
        return res.status(404).json({
          success: false,
          message: 'Leave type not found'
        });
      }

      // Validation
      if (name && name.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Leave type name cannot be empty'
        });
      }

      // Check if another leave type with the same name exists (case-insensitive)
      if (name && name.trim() !== leaveType.name) {
        const existingLeaveType = await LeaveType.findOne({
          _id: { $ne: id },
          name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
        });

        if (existingLeaveType) {
          return res.status(400).json({
            success: false,
            message: 'Leave type with this name already exists'
          });
        }
      }

      // Validate leaveCount if provided
      if (leaveCount !== undefined && (isNaN(leaveCount) || leaveCount < 0)) {
        return res.status(400).json({
          success: false,
          message: 'Leave count must be a non-negative number'
        });
      }

      if (name) updateData.name = name.trim();
      if (leaveCount !== undefined) updateData.leaveCount = leaveCount;
      if (ispaidLeave !== undefined) updateData.ispaidLeave = ispaidLeave === true || ispaidLeave === 'true' || ispaidLeave === '1';

      const updatedLeaveType = await LeaveType.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
      );

      res.status(200).json({
        success: true,
        message: 'Leave type updated successfully',
        data: updatedLeaveType
      });

    } catch (error) {
      console.error('Error updating leave type:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update leave type',
        error: error.message
      });
    }
  }

  // Delete leave type
  static async deleteLeaveType(req, res) {
    try {
      const { id } = req.params;

      const leaveType = await LeaveType.findById(id);
      if (!leaveType) {
        return res.status(404).json({
          success: false,
          message: 'Leave type not found'
        });
      }

      // Optional: Check if leave type is being used in any leave requests
      // Uncomment the below code if you want to prevent deletion of leave types that are in use
      /*
      const Leave = require("../models/Leave");
      const leavesUsingType = await Leave.countDocuments({ type: leaveType.name.toLowerCase() });
      
      if (leavesUsingType > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete leave type. It is currently being used in ${leavesUsingType} leave request(s).`,
          data: {
            leaveType: leaveType.name,
            usageCount: leavesUsingType
          }
        });
      }
      */

      await LeaveType.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: 'Leave type deleted successfully',
        data: {
          deletedLeaveType: leaveType.name
        }
      });

    } catch (error) {
      console.error('Error deleting leave type:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete leave type',
        error: error.message
      });
    }
  }

  // Get active leave types (for dropdowns/selects)
  static async getActiveLeaveTypes(req, res) {
    try {
      const leaveTypes = await LeaveType.find()
        .select('name leaveCount ispaidLeave carryforward')
        .sort({ name: 1 });

      // Transform for frontend use
      const formattedLeaveTypes = leaveTypes.map(type => ({
        id: type._id,
        name: type.name.toLowerCase(),
        displayName: type.name,
        leaveCount: type.leaveCount,
        isPaid: type.ispaidLeave,
        carryforward: type.carryforward,
        color: getLeaveTypeColor(type.name)
      }));

      res.status(200).json({
        success: true,
        data: {
          leaveTypes: formattedLeaveTypes
        }
      });

    } catch (error) {
      console.error('Error fetching active leave types:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch active leave types',
        error: error.message
      });
    }
  }
}

module.exports = LeaveController;