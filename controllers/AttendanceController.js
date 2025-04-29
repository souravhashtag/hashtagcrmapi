const Attendance = require('../models/Attendance');

// Create attendance
exports.createAttendance = async (req, res) => {
  try {
    const attendance = new Attendance(req.body);
    const saved = await attendance.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get all attendances
exports.getAllAttendances = async (req, res) => {
  try {
    const attendances = await Attendance.find().populate('employeeId');
    res.json(attendances);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get attendance by ID
exports.getAttendanceById = async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id).populate('employeeId');
    if (!attendance) return res.status(404).json({ error: 'Not found' });
    res.json(attendance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update attendance
exports.updateAttendance = async (req, res) => {
  try {
    const updated = await Attendance.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Delete attendance
exports.deleteAttendance = async (req, res) => {
  try {
    await Attendance.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
