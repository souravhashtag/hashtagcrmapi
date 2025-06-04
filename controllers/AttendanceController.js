const Attendance = require('../models/Attendance');
const geoip = require('geoip-lite');

class AttendanceController {
    static createAttendance = async (req, res) => {
        try {
          // const { employeeId, location } = req.body;
          const today = new Date().toISOString().split('T')[0];

          const existing = await Attendance.findOne({
            employeeId:req.user.id,
            date: new Date(today),
          });

          if (existing) {
            existing.clockOut = '';
            await existing.save();
            return res.status(200).json({status:200, message: 'Already clocked in today' });
          }
          let ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
          const geo = geoip.lookup(ip);
          console.log("geo",geo);
          const record = new Attendance({
            employeeId:req.user.id,
            date: new Date(today),
            clockIn: new Date(),
            clockOut:null,
            status: 'present',
            location:geo
          });

          await record.save();
          res.status(201).json({status:200, message: 'Clocked in successfully', data: record });
        } catch (err) {
          res.status(500).json({status:500, message: 'Error clocking in', error: err.message });
        }
    };
    static clockOutAttendance = async(req, res) => {
        try {
          const today = new Date().toISOString().split('T')[0];

          const record = await Attendance.findOne({
            employeeId:req.user.id,
            date: new Date(today),
          });

          if (!record) {
            return res.status(404).json({status:404, message: 'Clock-in record not found' });
          }

          record.clockOut = new Date();
          record.calculateTotalHours();
          await record.save();

          res.status(200).json({status:200, message: 'Clocked out successfully', data: record });
        } catch (err) {
          res.status(500).json({status:500, message: 'Error clocking out', error: err.message });
        }
    }
    static getIndividualClockInData = async(req, res) => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const record = await Attendance.findOne({
            employeeId:req.user.id,
            date: new Date(today),
          });
          if (!record) {
            return res.status(404).json({status:404, message: 'Clock-in record not found' });
          }
          res.status(200).json({ status:200, message: 'Attendance Data', data: record });
      } catch (err) {
        res.status(500).json({status:500, message: 'Error clocking out', error: err.message });
      }
    }
    static takeaBreak = async(req, res) => {
      try {
        const today = new Date().toISOString().split('T')[0];

        const record = await Attendance.findOne({
          employeeId:req.user.id,
          date: new Date(today),
        });

        if (!record) {
          return res.status(404).json({status:404, message: 'No clock-in record found' });
        }

        record.breaks.push({ start: new Date() }); 
        await record.save();

        res.status(200).json({status:200, message: 'Break started', data: record });
      } catch (err) {
        res.status(500).json({status:500, message: 'Error starting break', error: err.message });
      }
    }
    static ResumeWork = async(req, res) => {
        try {
          const today = new Date().toISOString().split('T')[0];

          const record = await Attendance.findOne({
            employeeId:req.user.id,
            date: new Date(today),
          });

          if (!record || record.breaks.length === 0) {
            return res.status(404).json({status:404, message: 'No break found to resume' });
          }

          const latestBreak = record.breaks[record.breaks.length - 1];
          if (!latestBreak.end) {
            latestBreak.end = new Date();
            const breakDuration = (latestBreak.end - latestBreak.start) / 1000; 
            record.totalBreakDuration += Math.floor(breakDuration);
          }

          await record.save();

          res.status(200).json({status:200, message: 'Break ended', data: record });
        } catch (err) {
          res.status(500).json({status:500, message: 'Error resuming work', error: err.message });
        }
    }
    static GeoLocation = (req, res) => {
        let ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
        console.log(ip)
        const geo = geoip.lookup(ip);
        console.log(geo)
    }
}

module.exports = AttendanceController;




