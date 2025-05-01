const PerformanceRecord = require('../models/Performance');

// Create a new performance record
exports.createPerformanceRecord = async (req, res) => {
  try {
    const newRecord = new PerformanceRecord(req.body);
    const savedRecord = await newRecord.save();
    res.status(201).json(savedRecord);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all performance records
exports.getAllPerformanceRecords = async (req, res) => {
  try {
    const records = await PerformanceRecord.find().populate('employeeId reviewerId');
    res.status(200).json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get a performance record by ID
exports.getPerformanceRecordById = async (req, res) => {
  try {
    const record = await PerformanceRecord.findById(req.params.id).populate('employeeId reviewerId');
    if (!record) return res.status(404).json({ error: 'Record not found' });
    res.status(200).json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update a performance record
exports.updatePerformanceRecord = async (req, res) => {
  try {
    const updatedRecord = await PerformanceRecord.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updatedRecord) return res.status(404).json({ error: 'Record not found' });
    res.status(200).json(updatedRecord);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete a performance record
exports.deletePerformanceRecord = async (req, res) => {
  try {
    const deletedRecord = await PerformanceRecord.findByIdAndDelete(req.params.id);
    if (!deletedRecord) return res.status(404).json({ error: 'Record not found' });
    res.status(200).json({ message: 'Record deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
