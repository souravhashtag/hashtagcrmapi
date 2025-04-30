const Leave = require("../models/Leave");

exports.createLeave = async (req, res) => {
  try {
    const leave = new Leave(req.body);
    const savedLeave = await leave.save();
    res.status(201).json(savedLeave);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getAllLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find().populate('employeeId approvedBy');
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getLeaveById = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id).populate('employeeId approvedBy');
    if (!leave) return res.status(404).json({ error: 'Leave not found' });
    res.json(leave);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateLeave = async (req, res) => {
  try {
    const updatedLeave = await Leave.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!updatedLeave) return res.status(404).json({ error: 'Leave not found' });
    res.json(updatedLeave);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteLeave = async (req, res) => {
  try {
    const deletedLeave = await Leave.findByIdAndDelete(req.params.id);
    if (!deletedLeave) return res.status(404).json({ error: 'Leave not found' });
    res.json({ message: 'Leave deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
