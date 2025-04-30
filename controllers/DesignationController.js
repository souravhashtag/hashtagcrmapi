const Designation = require('../models/Designation');

// Create
exports.createDesignation = async (req, res) => {
  try {
    const designation = new Designation(req.body);
    const saved = await designation.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all
exports.getAllDesignations = async (req, res) => {
  try {
    const list = await Designation.find().populate('department', 'name');
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get by ID
exports.getDesignationById = async (req, res) => {
  try {
    const item = await Designation.findById(req.params.id).populate('department', 'name');
    if (!item) return res.status(404).json({ error: 'Designation not found' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update
exports.updateDesignation = async (req, res) => {
  try {
    const updated = await Designation.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Designation not found' });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete
exports.deleteDesignation = async (req, res) => {
  try {
    const deleted = await Designation.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Designation not found' });
    res.json({ message: 'Designation deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
