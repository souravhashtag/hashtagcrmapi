// controllers/holidayController.js
const Holiday = require('../models/Holiday');

// Create new holiday
exports.createHoliday = async (req, res) => {
  try {
    const holiday = new Holiday(req.body);
    const savedHoliday = await holiday.save();
    res.status(201).json(savedHoliday);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get all holidays
exports.getAllHolidays = async (req, res) => {
  try {
    const holidays = await Holiday.find().sort({ date: 1 });
    res.status(200).json(holidays);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get single holiday by ID
exports.getHolidayById = async (req, res) => {
  try {
    const holiday = await Holiday.findById(req.params.id);
    if (!holiday) return res.status(404).json({ message: 'Holiday not found' });
    res.json(holiday);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update holiday
exports.updateHoliday = async (req, res) => {
  try {
    const updatedHoliday = await Holiday.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedHoliday) return res.status(404).json({ message: 'Holiday not found' });
    res.json(updatedHoliday);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Delete holiday
exports.deleteHoliday = async (req, res) => {
  try {
    const deleted = await Holiday.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Holiday not found' });
    res.json({ message: 'Holiday deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
