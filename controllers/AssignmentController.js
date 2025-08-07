const EmployeeAssignment = require('../models/EmployeeAssignment');
const AssignmentHistory = require('../models/AssignmentHistory');
const Employee = require('../models/Employee');
const User = require('../models/User');
const Role = require('../models/Role');

class AssignmentController {
  // Assign employees to supervisor
  static async assignEmployees(req, res) {
    try {
      const { supervisorId } = req.params;
      const { employeeIds, reason } = req.body;
      
      // Get assignedBy from different possible sources
      const assignedBy = req.user.employeeId || req.user._id || req.user.id;

      console.log('Assignment Request:', {
        supervisorId,
        employeeIds,
        reason,
        assignedBy,
        userObject: req.user // Debug log to see user structure
      });

      if (!assignedBy) {
        return res.status(400).json({
          success: false,
          message: 'Missing assigned by information from authenticated user'
        });
      }

      // Find supervisor with proper population
      const supervisor = await Employee.findById(supervisorId)
        .populate({
          path: 'userId',
          populate: {
            path: 'role',
            model: 'Role',
            select: 'level name display_name'
          }
        });
      
      if (!supervisor) {
        return res.status(404).json({
          success: false,
          message: 'Supervisor not found'
        });
      }

      console.log('Supervisor found:', {
        id: supervisor._id,
        name: supervisor.userId.firstName + ' ' + supervisor.userId.lastName,
        role: supervisor.userId.role.name,
        level: supervisor.userId.role.level
      });

      // Validate employees to be assigned with proper population
      const employees = await Employee.find({
        _id: { $in: employeeIds }
      }).populate({
        path: 'userId',
        populate: {
          path: 'role',
          model: 'Role',
          select: 'level name display_name'
        }
      });

      // Filter only active employees
      const activeEmployees = employees.filter(emp => emp.userId.status === 'active');

      console.log('Employees found:', activeEmployees.length);
      console.log('Employee IDs requested:', employeeIds.length);

      if (activeEmployees.length !== employeeIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Some employees not found or inactive',
          found: activeEmployees.length,
          requested: employeeIds.length
        });
      }

      // Check role hierarchy - employees should have higher level numbers (lower in hierarchy)
      const invalidAssignments = activeEmployees.filter(emp => {
        console.log('Checking employee:', {
          name: emp.userId.firstName + ' ' + emp.userId.lastName,
          empLevel: emp.userId.role.level,
          supLevel: supervisor.userId.role.level,
          canAssign: emp.userId.role.level > supervisor.userId.role.level
        });
        return emp.userId.role.level <= supervisor.userId.role.level;
      });

      if (invalidAssignments.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot assign employees with equal or higher role levels',
          invalidEmployees: invalidAssignments.map(emp => ({
            id: emp._id,
            name: emp.userId.firstName + ' ' + emp.userId.lastName,
            role: emp.userId.role.display_name || emp.userId.role.name,
            level: emp.userId.role.level
          }))
        });
      }

      // Check for existing active assignments
      const existingAssignments = await EmployeeAssignment.find({
        subordinate: { $in: employeeIds },
        status: 'active'
      }).populate({
        path: 'supervisor',
        populate: {
          path: 'userId',
          select: 'firstName lastName'
        }
      });

      if (existingAssignments.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Some employees are already assigned to other supervisors',
          existingAssignments: existingAssignments.map(assignment => ({
            employeeId: assignment.subordinate,
            currentSupervisor: `${assignment.supervisor.userId.firstName} ${assignment.supervisor.userId.lastName}`
          }))
        });
      }

      // Create assignments
      const assignments = [];
      const historyRecords = [];

      for (const employeeId of employeeIds) {
        const assignment = new EmployeeAssignment({
          supervisor: supervisorId,
          subordinate: employeeId,
          assignedBy,
          status: 'active'
        });

        const savedAssignment = await assignment.save();
        assignments.push(savedAssignment);

        // Create history record
        historyRecords.push({
          assignmentId: savedAssignment._id,
          action: 'created',
          performedBy: assignedBy,
          newData: savedAssignment.toObject(),
          reason,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      }

      // Save history records
      await AssignmentHistory.insertMany(historyRecords);

      // Populate response data
      const populatedAssignments = await EmployeeAssignment.find({
        _id: { $in: assignments.map(a => a._id) }
      })
      .populate({
        path: 'supervisor',
        populate: {
          path: 'userId',
          select: 'firstName lastName'
        }
      })
      .populate({
        path: 'subordinate',
        populate: {
          path: 'userId',
          populate: {
            path: 'role',
            model: 'Role',
            select: 'name display_name level'
          }
        }
      })
      .populate({
        path: 'assignedBy',
        populate: {
          path: 'userId',
          select: 'firstName lastName'
        }
      });

      res.status(201).json({
        success: true,
        message: `Successfully assigned ${assignments.length} employee(s)`,
        data: populatedAssignments
      });

    } catch (error) {
      console.error('Error in assignEmployees:', error);
      res.status(500).json({
        success: false,
        message: 'Error assigning employees',
        error: error.message
      });
    }
  }

  // Unassign employee from supervisor
  static async unassignEmployee(req, res) {
    try {
      const { supervisorId } = req.params;
      const { employeeId, reason } = req.body;
      
      // Get performedBy from different possible sources
      const performedBy = req.user.employeeId || req.user._id || req.user.id;

      if (!performedBy) {
        return res.status(400).json({
          success: false,
          message: 'Missing performed by information from authenticated user'
        });
      }

      // Find active assignment
      const assignment = await EmployeeAssignment.findOne({
        supervisor: supervisorId,
        subordinate: employeeId,
        status: 'active'
      });

      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: 'Assignment not found'
        });
      }

      // Store previous data for history
      const previousData = assignment.toObject();

      // Update assignment status
      assignment.status = 'inactive';
      await assignment.save();

      // Create history record
      await AssignmentHistory.create({
        assignmentId: assignment._id,
        action: 'ended',
        performedBy,
        previousData,
        newData: assignment.toObject(),
        reason,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(200).json({
        success: true,
        message: 'Employee unassigned successfully',
        data: assignment
      });

    } catch (error) {
      console.error('Error in unassignEmployee:', error);
      res.status(500).json({
        success: false,
        message: 'Error unassigning employee',
        error: error.message
      });
    }
  }

  // Get assigned employees for a supervisor
  static async getAssignedEmployees(req, res) {
    console.log('Fetching assigned employees for supervisor:', req.params.supervisorId);
    try {
      const { supervisorId } = req.params;
      const { status = 'active', page = 1, limit = 10 } = req.query;
      const skip = (page - 1) * limit;

      const query = { supervisor: supervisorId };
      if (status !== 'all') query.status = status;

      const assignments = await EmployeeAssignment.find(query)
        .populate({
          path: 'subordinate',
          populate: {
            path: 'userId',
            populate: {
              path: 'role department',
              select: 'name display_name level'
            }
          }
        })
        .populate({
          path: 'assignedBy',
          populate: {
            path: 'userId',
            select: 'firstName lastName'
          }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await EmployeeAssignment.countDocuments(query);

      res.status(200).json({
        success: true,
        data: assignments,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total / limit),
          total_records: total,
          per_page: parseInt(limit)
        }
      });

    } catch (error) {
      console.error('Error in getAssignedEmployees:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching assigned employees',
        error: error.message
      });
    }
  }

  // Get available employees for assignment
  static async getAvailableEmployees(req, res) {
    try {
      const { supervisorId } = req.params;
      const { search = '' } = req.query;

      // Get supervisor's role level
      const supervisor = await Employee.findById(supervisorId)
        .populate({
          path: 'userId',
          populate: {
            path: 'role',
            select: 'level'
          }
        });

      if (!supervisor) {
        return res.status(404).json({
          success: false,
          message: 'Supervisor not found'
        });
      }

      // Find employees that are not currently assigned
      const assignedEmployeeIds = await EmployeeAssignment.distinct('subordinate', {
        status: 'active'
      });

      // Find all employees excluding already assigned ones and the supervisor
      const employees = await Employee.find({
        _id: { $nin: [...assignedEmployeeIds, supervisorId] }
      })
      .populate({
        path: 'userId',
        match: { status: 'active' }, // Only active users
        populate: {
          path: 'role',
          select: 'level name display_name'
        }
      });

      // Filter out employees where userId is null (inactive users)
      const activeEmployees = employees.filter(emp => emp.userId !== null);

      // Filter by role hierarchy (only lower level employees - higher level numbers)
      const availableEmployees = activeEmployees.filter(emp => 
        emp.userId.role.level > supervisor.userId.role.level
      );

      // Apply search filter
      let filteredEmployees = availableEmployees;
      if (search) {
        const searchRegex = new RegExp(search, 'i');
        filteredEmployees = availableEmployees.filter(emp =>
          searchRegex.test(emp.userId.firstName) ||
          searchRegex.test(emp.userId.lastName) ||
          searchRegex.test(emp.userId.email) ||
          searchRegex.test(emp.employeeId)
        );
      }

      res.status(200).json({
        success: true,
        data: filteredEmployees,
        count: filteredEmployees.length
      });

    } catch (error) {
      console.error('Error in getAvailableEmployees:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching available employees',
        error: error.message
      });
    }
  }

  // Transfer employee between supervisors
  static async transferEmployee(req, res) {
    try {
      const { employeeId } = req.params;
      const { fromSupervisorId, toSupervisorId, reason } = req.body;
      
      // Get performedBy from different possible sources
      const performedBy = req.user.employeeId || req.user._id || req.user.id;

      if (!performedBy) {
        return res.status(400).json({
          success: false,
          message: 'Missing performed by information from authenticated user'
        });
      }

      // Validate supervisors and employee
      const [fromSupervisor, toSupervisor, employee] = await Promise.all([
        Employee.findById(fromSupervisorId).populate({
          path: 'userId',
          populate: { path: 'role', select: 'level' }
        }),
        Employee.findById(toSupervisorId).populate({
          path: 'userId',
          populate: { path: 'role', select: 'level' }
        }),
        Employee.findById(employeeId).populate({
          path: 'userId',
          populate: { path: 'role', select: 'level' }
        })
      ]);

      if (!fromSupervisor || !toSupervisor || !employee) {
        return res.status(404).json({
          success: false,
          message: 'One or more parties not found'
        });
      }

      // Check if target supervisor can manage this employee
      if (employee.userId.role.level <= toSupervisor.userId.role.level) {
        return res.status(400).json({
          success: false,
          message: 'Cannot transfer to supervisor with equal or lower role level'
        });
      }

      // Find current assignment
      const currentAssignment = await EmployeeAssignment.findOne({
        supervisor: fromSupervisorId,
        subordinate: employeeId,
        status: 'active'
      });

      if (!currentAssignment) {
        return res.status(404).json({
          success: false,
          message: 'Current assignment not found'
        });
      }

      // Store previous data for history
      const previousData = currentAssignment.toObject();

      // End current assignment
      currentAssignment.status = 'transferred';
      await currentAssignment.save();

      // Create new assignment
      const newAssignment = new EmployeeAssignment({
        supervisor: toSupervisorId,
        subordinate: employeeId,
        assignedBy: performedBy,
        status: 'active'
      });

      await newAssignment.save();

      // Create history records
      const historyRecords = [
        {
          assignmentId: currentAssignment._id,
          action: 'transferred',
          performedBy,
          previousData,
          newData: currentAssignment.toObject(),
          reason,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        },
        {
          assignmentId: newAssignment._id,
          action: 'created',
          performedBy,
          newData: newAssignment.toObject(),
          reason,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      ];

      await AssignmentHistory.insertMany(historyRecords);

      const populatedNewAssignment = await EmployeeAssignment.findById(newAssignment._id)
        .populate({
          path: 'supervisor',
          populate: {
            path: 'userId',
            select: 'firstName lastName'
          }
        })
        .populate({
          path: 'subordinate',
          populate: {
            path: 'userId',
            select: 'firstName lastName'
          }
        })
        .populate({
          path: 'assignedBy',
          populate: {
            path: 'userId',
            select: 'firstName lastName'
          }
        });

      res.status(200).json({
        success: true,
        message: 'Employee transferred successfully',
        data: {
          newAssignment: populatedNewAssignment,
          previousAssignmentId: currentAssignment._id
        }
      });

    } catch (error) {
      console.error('Error in transferEmployee:', error);
      res.status(500).json({
        success: false,
        message: 'Error transferring employee',
        error: error.message
      });
    }
  }

  // Get assignment history
  static async getAssignmentHistory(req, res) {
    try {
      const { employeeId, supervisorId, page = 1, limit = 10 } = req.query;
      const skip = (page - 1) * limit;

      let query = {};
      if (employeeId || supervisorId) {
        const assignmentQuery = {};
        if (employeeId) assignmentQuery.subordinate = employeeId;
        if (supervisorId) assignmentQuery.supervisor = supervisorId;

        const assignmentIds = await EmployeeAssignment.distinct('_id', assignmentQuery);
        query.assignmentId = { $in: assignmentIds };
      }

      const history = await AssignmentHistory.find(query)
        .populate({
          path: 'assignmentId',
          populate: [
            {
              path: 'supervisor',
              populate: {
                path: 'userId',
                select: 'firstName lastName'
              }
            },
            {
              path: 'subordinate',
              populate: {
                path: 'userId',
                select: 'firstName lastName'
              }
            }
          ]
        })
        .populate({
          path: 'performedBy',
          populate: {
            path: 'userId',
            select: 'firstName lastName'
          }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await AssignmentHistory.countDocuments(query);

      res.status(200).json({
        success: true,
        data: history,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total / limit),
          total_records: total,
          per_page: parseInt(limit)
        }
      });

    } catch (error) {
      console.error('Error in getAssignmentHistory:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching assignment history',
        error: error.message
      });
    }
  }

  // Additional helper method to get supervisor's team overview
  static async getSupervisorTeamOverview(req, res) {
    try {
      const { supervisorId } = req.params;

      const supervisor = await Employee.findById(supervisorId)
        .populate({
          path: 'userId',
          select: 'firstName lastName email',
          populate: {
            path: 'role',
            select: 'name display_name level'
          }
        });

      if (!supervisor) {
        return res.status(404).json({
          success: false,
          message: 'Supervisor not found'
        });
      }

      // Get active assignments count
      const activeAssignments = await EmployeeAssignment.countDocuments({
        supervisor: supervisorId,
        status: 'active'
      });

      // Get total historical assignments
      const totalAssignments = await EmployeeAssignment.countDocuments({
        supervisor: supervisorId
      });

      // Get recent assignment activities
      const recentActivities = await AssignmentHistory.find({
        assignmentId: {
          $in: await EmployeeAssignment.distinct('_id', { supervisor: supervisorId })
        }
      })
      .populate({
        path: 'performedBy',
        populate: {
          path: 'userId',
          select: 'firstName lastName'
        }
      })
      .sort({ createdAt: -1 })
      .limit(5);

      res.status(200).json({
        success: true,
        data: {
          supervisor: {
            id: supervisor._id,
            name: `${supervisor.userId.firstName} ${supervisor.userId.lastName}`,
            email: supervisor.userId.email,
            role: supervisor.userId.role.display_name || supervisor.userId.role.name,
            level: supervisor.userId.role.level
          },
          teamStats: {
            activeAssignments,
            totalAssignments,
            availableForAssignment: 0 // This could be calculated if needed
          },
          recentActivities
        }
      });

    } catch (error) {
      console.error('Error in getSupervisorTeamOverview:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching supervisor team overview',
        error: error.message
      });
    }
  }
}

module.exports = AssignmentController;