const Roster = require('../models/Roster');
const Employee = require('../models/Employee');
const { validationResult } = require('express-validator');

// Helper function to get week number
const getWeekNumber = (date) => {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};

// Helper function to get week start and end dates
const getWeekDates = (year, weekNumber) => {
  const firstDayOfYear = new Date(year, 0, 1);
  const daysToFirstMonday = (8 - firstDayOfYear.getDay()) % 7;
  const firstMonday = new Date(year, 0, 1 + daysToFirstMonday);
  
  const weekStart = new Date(firstMonday);
  weekStart.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  
  return { weekStart, weekEnd };
};

// Helper function to format datetime string
const formatDateTime = (date, time) => {
  if (!date || !time || time === 'OFF') return 'OFF';
  
  const formattedDate = date.toLocaleDateString('en-GB'); // DD-MM-YYYY format
  return `${formattedDate} ${time}`;
};

const RosterController = {
  
  // GET: Get roster for a specific week
  getWeekRoster: async (req, res) => {
    try {
      const { year, weekNumber } = req.params;
      
      if (!year || !weekNumber) {
        return res.status(400).json({
          success: false,
          message: 'Year and week number are required'
        });
      }
      
      const roster = await Roster.find({
        year: parseInt(year),
        week_number: parseInt(weekNumber)
      })
      .populate({
        path: 'employee_id',
        populate: {
          path: 'userId',
          select: 'name email role department'
        }
      })
      .populate('created_by', 'name email')
      .sort({ 'employee_id.employeeId': 1 });
      
      // Transform data for table display
      const rosterTable = roster.map(r => ({
        _id: r._id,
        employee: {
          _id: r.employee_id._id,
          employeeId: r.employee_id.employeeId,
          name: r.employee_id.userId.name,
          department: r.employee_id.userId.department,
          role: r.employee_id.userId.role
        },
        schedule: {
          sunday: r.getDayDisplay('sunday'),
          monday: r.getDayDisplay('monday'),
          tuesday: r.getDayDisplay('tuesday'),
          wednesday: r.getDayDisplay('wednesday'),
          thursday: r.getDayDisplay('thursday'),
          friday: r.getDayDisplay('friday'),
          saturday: r.getDayDisplay('saturday')
        },
        totalHours: r.calculateTotalHours(),
        workingDays: r.getWorkingDays(),
        status: r.status,
        notes: r.notes
      }));
      
      res.status(200).json({
        success: true,
        data: rosterTable,
        weekInfo: {
          year: parseInt(year),
          weekNumber: parseInt(weekNumber),
          ...getWeekDates(parseInt(year), parseInt(weekNumber))
        }
      });
      
    } catch (error) {
      console.error('Error fetching week roster:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch roster',
        error: error.message
      });
    }
  },
  
  // GET: Get single employee roster
  getEmployeeRoster: async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { startDate, endDate } = req.query;
      
      if (!employeeId) {
        return res.status(400).json({
          success: false,
          message: 'Employee ID is required'
        });
      }
      let query = { };
      if(employeeId!="all"){
        query = { employee_id: employeeId };
      }
      
      if (startDate && endDate) {
        query.week_start_date = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }
      
      const roster = await Roster.find(query)
        .populate({
          path: 'employee_id',
          populate: {
            path: 'userId',
            select: 'name email'
          }
        })
        .sort({ week_start_date: 1 });
      
      res.status(200).json({
        success: true,
        data: roster
      });
      
    } catch (error) {
      console.error('Error fetching employee roster:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch employee roster',
        error: error.message
      });
    }
  },
  getRosterforallEmployee: async (req, res) => { 
    try {
      const { employeeId } = req.params;
      const { startDate, endDate } = req.query;

      // Validate required fields
      if (!employeeId) {
        return res.status(400).json({
          success: false,
          message: 'Employee ID is required'
        });
      }

      // Validate dates
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format. Please use YYYY-MM-DD'
        });
      }

      // Build query
      let query = {
        week_end_date: { $gte: start },
        week_start_date: { $lte: end },
      };

      if (employeeId !== "all") {
        query["employee_id._id"] = employeeId; 
      }

      // Fetch roster
      const roster = await Roster.find(query)
        .populate({
          path: 'employee_id',
          populate: {
            path: 'userId',
            select: 'firstName lastName email employeeId'
          }
        })
        .sort({ week_start_date: 1 });

      const dayMap = {
        0: "sunday",
        1: "monday",
        2: "tuesday",
        3: "wednesday",
        4: "thursday",
        5: "friday",
        6: "saturday"
      };

      // Group data by employee
      const rosterWithDates = {};

      roster.forEach((ros) => {
        const empId = ros.employee_id._id.toString();

        if (!rosterWithDates[empId]) {
          rosterWithDates[empId] = {
            employee: ros.employee_id,
            week_start_date: ros.week_start_date,
            week_end_date: ros.week_end_date,
            user: ros.employee_id.userId,
            roster: {}
          };
        }

        let current = new Date(ros.week_start_date);
        const last = new Date(ros.week_end_date);

        while (current <= last) {
          const yyyy = current.getFullYear();
          const mm = String(current.getMonth() + 1).padStart(2, '0');
          const dd = String(current.getDate()).padStart(2, '0');
          const dateStr = `${yyyy}-${mm}-${dd}`;

          const dayName = dayMap[current.getDay()];

          rosterWithDates[empId].roster[dateStr] = {
            start_time: ros[dayName]?.start_time || null,
            end_time: ros[dayName]?.end_time || null
          };

          current.setDate(current.getDate() + 1);
        }
      });

      res.status(200).json({
        success: true,
        data: Object.values(rosterWithDates)
      });

    } catch (error) {
      console.error('Error fetching employee roster:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch employee roster',
        error: error.message
      });
    }
  },
  
  // POST: Add single employee roster
  addRoster: async (req, res) => {

    try {
    //   const errors = validationResult(req);
    //   if (!errors.isEmpty()) {
    //     return res.status(400).json({
    //       success: false,
    //       message: 'Validation failed',
    //       errors: errors.array()
    //     });
    //   }
      
      const {
        employee_id,
        year,
        week_number,
        week_start_date,
        week_end_date,
        sunday,
        monday,
        tuesday,
        wednesday,
        thursday,
        friday,
        saturday,
        notes,
        status = 'draft'
      } = req.body;
      
      const existingRoster = await Roster.findOne({
        employee_id,
        year,
        week_number
      });
      
      if (existingRoster) {
        return res.status(409).json({
          success: false,
          message: 'Roster already exists for this employee and week'
        });
      }
      
      // Verify employee exists
      const employee = await Employee.findById(employee_id);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }
      
      const newRoster = new Roster({
        employee_id,
        year,
        week_number,
        week_start_date: new Date(week_start_date),
        week_end_date: new Date(week_end_date),
        sunday: sunday || { start_time: 'OFF', end_time: 'OFF' },
        monday: monday || { start_time: 'OFF', end_time: 'OFF' },
        tuesday: tuesday || { start_time: 'OFF', end_time: 'OFF' },
        wednesday: wednesday || { start_time: 'OFF', end_time: 'OFF' },
        thursday: thursday || { start_time: 'OFF', end_time: 'OFF' },
        friday: friday || { start_time: 'OFF', end_time: 'OFF' },
        saturday: saturday || { start_time: 'OFF', end_time: 'OFF' },
        notes,
        status,
        created_by: req.user.id
      });
      
      // Calculate total hours before saving
      newRoster.total_hours = newRoster.calculateTotalHours();
      
      await newRoster.save();
      
      // Populate and return the created roster
      const populatedRoster = await Roster.findById(newRoster._id)
        .populate({
          path: 'employee_id',
          populate: {
            path: 'userId',
            select: 'name email'
          }
        })
        .populate('created_by', 'name email');
      
      res.status(201).json({
        success: true,
        message: 'Roster created successfully',
        data: populatedRoster
      });
      
    } catch (error) {
      console.error('Error creating roster:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create roster',
        error: error.message
      });
    }
  },
  
  // PUT: Update roster
  updateRoster: async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const roster = await Roster.findById(id);
      if (!roster) {
        return res.status(404).json({
          success: false,
          message: 'Roster not found'
        });
      }
      
      // Update fields
      Object.keys(updateData).forEach(key => {
        if (key !== '_id' && key !== 'employee_id' && key !== 'createdAt' && key !== 'updatedAt') {
          roster[key] = updateData[key];
        }
      });
      
      // Recalculate total hours
      roster.total_hours = roster.calculateTotalHours();
      
      await roster.save();
      
      const populatedRoster = await Roster.findById(roster._id)
        .populate({
          path: 'employee_id',
          populate: {
            path: 'userId',
            select: 'name email'
          }
        })
        .populate('created_by', 'name email');
      
      res.status(200).json({
        success: true,
        message: 'Roster updated successfully',
        data: populatedRoster
      });
      
    } catch (error) {
      console.error('Error updating roster:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update roster',
        error: error.message
      });
    }
  },
  
  // POST: Bulk add multiple employee rosters
  bulkAddRoster: async (req, res) => {
    try {
      const {
        employees, // Array of employee IDs
        year,
        week_number,
        week_start_date,
        week_end_date,
        defaultSchedule, // Default schedule to apply to all employees
        individualSchedules = {} // Individual schedules for specific employees
      } = req.body;
      
      if (!employees || !Array.isArray(employees) || employees.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Employees array is required'
        });
      }
      
      // Verify all employees exist
      const existingEmployees = await Employee.find({
        _id: { $in: employees }
      });
      
      if (existingEmployees.length !== employees.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more employees not found'
        });
      }
      
      // Check for existing rosters
      const existingRosters = await Roster.find({
        employee_id: { $in: employees },
        year,
        week_number
      });
      
      if (existingRosters.length > 0) {
        const existingEmployeeIds = existingRosters.map(r => r.employee_id.toString());
        return res.status(409).json({
          success: false,
          message: 'Roster already exists for some employees in this week',
          existingEmployees: existingEmployeeIds
        });
      }
      
      const rosterData = employees.map(employeeId => {
        // Use individual schedule if provided, otherwise use default
        const schedule = individualSchedules[employeeId] || defaultSchedule;
        
        return {
          employee_id: employeeId,
          year,
          week_number,
          week_start_date: new Date(week_start_date),
          week_end_date: new Date(week_end_date),
          sunday: schedule?.sunday || { start_time: 'OFF', end_time: 'OFF' },
          monday: schedule?.monday || { start_time: 'OFF', end_time: 'OFF' },
          tuesday: schedule?.tuesday || { start_time: 'OFF', end_time: 'OFF' },
          wednesday: schedule?.wednesday || { start_time: 'OFF', end_time: 'OFF' },
          thursday: schedule?.thursday || { start_time: 'OFF', end_time: 'OFF' },
          friday: schedule?.friday || { start_time: 'OFF', end_time: 'OFF' },
          saturday: schedule?.saturday || { start_time: 'OFF', end_time: 'OFF' },
          notes: schedule?.notes || null,
          status: schedule?.status || 'draft',
          total_hours: 0, // Will be calculated after insert
          created_by: req.user.id
        };
      });
      
      // Bulk insert
      const createdRosters = await Roster.insertMany(rosterData);
      
      // Calculate total hours for each roster
      const updatePromises = createdRosters.map(async (roster) => {
        const rosterDoc = await Roster.findById(roster._id);
        rosterDoc.total_hours = rosterDoc.calculateTotalHours();
        return rosterDoc.save();
      });
      
      await Promise.all(updatePromises);
      
      // Fetch populated data
      const populatedRosters = await Roster.find({
        _id: { $in: createdRosters.map(r => r._id) }
      })
      .populate({
        path: 'employee_id',
        populate: {
          path: 'userId',
          select: 'name email'
        }
      })
      .populate('created_by', 'name email')
      .sort({ 'employee_id.employeeId': 1 });
      
      res.status(201).json({
        success: true,
        message: `Successfully created ${createdRosters.length} rosters`,
        data: populatedRosters,
        count: createdRosters.length
      });
      
    } catch (error) {
      console.error('Error bulk creating rosters:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create bulk rosters',
        error: error.message
      });
    }
  },
  
  // POST: Copy roster from previous week
  copyFromPreviousWeek: async (req, res) => {
    try {
      const {
        fromYear,
        fromWeekNumber, 
        toYear,
        toWeekNumber,
        employees = [] // Optional: specific employees, if empty copies all
      } = req.body;
      
      // Get source rosters
      let query = {
        year: fromYear,
        week_number: fromWeekNumber 
      };
      
      if (employees.length > 0) {
        query.employee_id = { $in: employees }; 
      }
      
      const sourceRosters = await Roster.find(query);
      
      if (sourceRosters.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No rosters found for the specified week'
        });
      }
      
      // Check if target week rosters already exist
      const existingTargetRosters = await Roster.find({
        year: toYear,
        week_number: toWeekNumber,
        employee_id: { $in: sourceRosters.map(r => r.employee_id) }
      });
      
      if (existingTargetRosters.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Rosters already exist for some employees in target week'
        });
      }
      
      // Get target week dates
      const { weekStart, weekEnd } = getWeekDates(toYear, toWeekNumber);
      
      // Create new rosters based on source
      const newRosterData = sourceRosters.map(sourceRoster => ({
        employee_id: sourceRoster.employee_id,
        year: toYear,
        week_number: toWeekNumber,
        week_start_date: weekStart,
        week_end_date: weekEnd,
        sunday: { ...sourceRoster.sunday },
        monday: { ...sourceRoster.monday },
        tuesday: { ...sourceRoster.tuesday },
        wednesday: { ...sourceRoster.wednesday },
        thursday: { ...sourceRoster.thursday },
        friday: { ...sourceRoster.friday },
        saturday: { ...sourceRoster.saturday },
        notes: sourceRoster.notes,
        status: 'draft', // Reset to draft
        created_by: req.user.id
      }));
      
      const createdRosters = await Roster.insertMany(newRosterData);
      
      // Calculate total hours
      const updatePromises = createdRosters.map(async (roster) => {
        const rosterDoc = await Roster.findById(roster._id);
        rosterDoc.total_hours = rosterDoc.calculateTotalHours();
        return rosterDoc.save();
      });
      
      await Promise.all(updatePromises);
      
      res.status(201).json({
        success: true,
        message: `Successfully copied ${createdRosters.length} rosters`,
        data: createdRosters,
        count: createdRosters.length
      });
      
    } catch (error) {
      console.error('Error copying rosters:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to copy rosters',
        error: error.message
      });
    }
  },
  
  // DELETE: Delete roster
  deleteRoster: async (req, res) => {
    try {
      const { id } = req.params;
      
      const roster = await Roster.findById(id);
      if (!roster) {
        return res.status(404).json({
          success: false,
          message: 'Roster not found'
        });
      }
      
      await Roster.findByIdAndDelete(id);
      
      res.status(200).json({
        success: true,
        message: 'Roster deleted successfully'
      });
      
    } catch (error) {
      console.error('Error deleting roster:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete roster',
        error: error.message
      });
    }
  },
  
  // GET: Get roster statistics
  getRosterStats: async (req, res) => {
    try {
      const { year, weekNumber } = req.params;
      
      const rosters = await Roster.find({
        year: parseInt(year),
        week_number: parseInt(weekNumber)
      }).populate('employee_id', 'userId');
      
      const stats = {
        totalEmployees: rosters.length,
        totalHours: rosters.reduce((sum, r) => sum + (r.total_hours || 0), 0),
        averageHours: 0,
        statusBreakdown: {
          draft: 0,
          published: 0,
          approved: 0
        },
        overnightShifts: 0
      };
      
      rosters.forEach(roster => {
        stats.statusBreakdown[roster.status]++;
        
        // Check for overnight shifts
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        // const hasOvernightShift = days.some(day => roster.isOvernightShift(day));
        // if (hasOvernightShift) {
        //   stats.overnightShifts++;
        // }
      });
      
      stats.averageHours = stats.totalEmployees > 0 ? stats.totalHours / stats.totalEmployees : 0;
      
      res.status(200).json({
        success: true,
        data: stats
      });
      
    } catch (error) {
      console.error('Error fetching roster stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch roster statistics',
        error: error.message
      });
    }
  }
};

module.exports = RosterController;