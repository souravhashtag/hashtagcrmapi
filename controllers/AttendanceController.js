const Attendance = require('../models/Attendance');
const geoip = require('geoip-lite');
const { getUSDate,getUSDateString } = require('../utils/usDate');
const moment = require('moment-timezone');
class AttendanceController {
    static createAttendance = async (req, res) => {
      try {
        const pstNow = moment.tz('America/Los_Angeles');

        const pstMidnight = pstNow.clone().startOf('day');
         

        const clockInField = pstNow.toDate(); 
        const dateField = clockInField.toISOString().split('T')[0]; 
        const existing = await Attendance.findOne({
          userId: req.user.id,
          date: dateField
        });

        if (existing) {
          existing.clockOut = '';
          await existing.save();
          return res.status(200).json({ status: 200, message: 'Already clocked in today' });
        }

        const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
        const geo = geoip.lookup(ip);

        const record = new Attendance({
          userId: req.user.id,
          date: dateField,                              
          clockIn: clockInField,                        
          clockInUs: pstNow.format('MM/DD/YYYY hh:mm A z'), 
          clockOut: null,
          clockOutUs: null,
          status: 'present',
          location: geo ? JSON.stringify(geo) : null
        });

        await record.save();

        res.status(201).json({
          status: 200,
          message: 'Clocked in successfully',
          data: record
        });

      } catch (err) {
        console.error('Error clocking in:', err);
        res.status(500).json({
          status: 500,
          message: 'Error clocking in',
          error: err.message
        });
      }
    };
    static clockOutAttendance = async (req, res) => {
      try {
        const pstNow = moment.tz('America/Los_Angeles');
        
        const pstMidnight = pstNow.clone().startOf('day');
        const dateField = pstMidnight.toDate();

        const record = await Attendance.findOne({
          userId: req.user.id,
          date: dateField,
        });

        if (!record) {
          return res.status(404).json({
            status: 404, 
            message: 'Clock-in record not found'
          });
        }

        const clockOutField = pstNow.toDate();

        record.clockOut = clockOutField;
        record.clockOutUs = pstNow.format('MM/DD/YYYY hh:mm A z');
        record.calculateTotalHours();
        await record.save();

        res.status(200).json({
          status: 200,
          message: 'Clocked out successfully',
          data: record
        });
      } catch (err) {
        res.status(500).json({
          status: 500,
          message: 'Error clocking out',
          error: err.message
        });
      }
    };
    static getIndividualClockInData = async(req, res) => {       
        try {
            const pstNow = moment.tz('America/Los_Angeles');
            const pstMidnight = pstNow.clone().startOf('day');
            // const dateField = pstMidnight.toDate();
            const dateField = pstNow.toISOString().split('T')[0];
            const record = await Attendance.findOne({
                userId: req.user.id,
                clockOut: null
            }).sort({ clockIn: -1 });
            
            if (!record) {
                return res.status(404).json({
                    status: 404, 
                    message: 'Clock-in record not found' 
                });
            }
            
            res.status(200).json({ 
                status: 200, 
                message: 'Attendance Data', 
                data: record 
            });
        } catch (err) {
            res.status(500).json({
                status: 500, 
                message: 'Error clocking out', 
                error: err.message 
            });
        }
    }
    static takeaBreak = async(req, res) => {       
      try {
          const pstNow = moment.tz('America/Los_Angeles');
          const pstMidnight = pstNow.clone().startOf('day');
          const dateField = pstMidnight.toDate();
          
          const record = await Attendance.findOne({
              userId: req.user.id,
              date: dateField,
          });
          
          if (!record) {
              return res.status(404).json({
                  status: 404, 
                  message: 'No clock-in record found' 
              });
          }
          
          record.breaks.push({ start: pstNow.toDate() });
          
          await record.save();
          
          res.status(200).json({
              status: 200, 
              message: 'Break started', 
              data: record 
          });
      } catch (err) {
          res.status(500).json({
              status: 500, 
              message: 'Error starting break', 
              error: err.message 
          });
      }
  }
    static ResumeWork = async(req, res) => {         
      try {
          const pstNow = moment.tz('America/Los_Angeles');
          const pstMidnight = pstNow.clone().startOf('day');
          const dateField = pstMidnight.toDate();
          
          const record = await Attendance.findOne({
              userId: req.user.id,
              date: dateField,
          });
          
          if (!record || record.breaks.length === 0) {
              return res.status(404).json({
                  status: 404, 
                  message: 'No break found to resume' 
              });
          }
          
          const latestBreak = record.breaks[record.breaks.length - 1];
          if (!latestBreak.end) {
              latestBreak.end = pstNow.toDate();
              const breakDuration = (latestBreak.end - latestBreak.start) / 1000;
              
              record.totalBreakDuration += Math.floor(breakDuration);
          }
          
          await record.save();
          
          res.status(200).json({
              status: 200, 
              message: 'Break ended', 
              data: record 
          });
      } catch (err) {
          res.status(500).json({
              status: 500, 
              message: 'Error resuming work', 
              error: err.message 
          });
      }
  }
    static GeoLocation = (req, res) => {
        let ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
        console.log(ip)
        const geo = geoip.lookup(ip);
        console.log(geo)
    }
    static getAttendanceByDate = async (req, res) => {
      try {
        const { date } = req.params;
        
        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid date format. Use YYYY-MM-DD'
          });
        }
        
        const requestedDate = new Date(date + 'T00:00:00.000Z');
        
        if (isNaN(requestedDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid date format. Use YYYY-MM-DD'
          });
        }
        
        const startOfDay = new Date(requestedDate);
        startOfDay.setUTCHours(0, 0, 0, 0);
        
        const endOfDay = new Date(requestedDate);
        endOfDay.setUTCHours(23, 59, 59, 999);
        
        // First, let's check what attendance records exist
        const attendanceRecords = await Attendance.find({
          date: {
            $gte: startOfDay,
            $lte: endOfDay
          }
        });
        
        // console.log('Raw attendance records:', attendanceRecords.map(r => ({ 
        //   _id: r._id, 
        //   userId: r.userId,
        //   date: r.date,
        //   status: r.status
        // })));
        
        const attendance = await Attendance.find({
          date: {
            $gte: startOfDay,
            $lte: endOfDay
          }
        })
        .populate({
          path: 'userId',
          select: '_id firstName lastName email',          
        })
        .sort({ createdAt: -1 });
        console.log("attendance===>",attendance)
        const validAttendance = attendance.filter(record => {
          if (!record.userId) {
            //console.log('Found attendance record with null userId:', record._id);
            return false;
          }
          return true;
        });
        
        const summary = {
          date: date,
          totalRecords: validAttendance.length,
          totalRecordsIncludingNull: attendance.length,
          statusBreakdown: {}
        };
        
        // Calculate status breakdown
        validAttendance.forEach(record => {
          if (!summary.statusBreakdown[record.status]) {
            summary.statusBreakdown[record.status] = 0;
          }
          summary.statusBreakdown[record.status]++;
        });
        
        res.json({
          success: true,
          data: {
            attendance: validAttendance,
            summary
          }
        });
        
      } catch (error) {
        console.error('Error fetching attendance by date:', error);
        res.status(500).json({
          success: false,
          message: 'Error fetching attendance data',
          error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
      }
    };
}

module.exports = AttendanceController;




