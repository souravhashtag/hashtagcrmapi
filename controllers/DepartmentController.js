const Department = require('../models/Department');

exports.createDepartment = async (req, res) => {
  try {
    const department = new Department(req.body);
    const saved = await department.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getAllDepartments = async (req, res) => {
  try {
    const departments = await Department.find()
      .populate('manager', 'name email') // Adjust fields as needed
      .populate('members', 'name email');
    res.json(departments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getDepartmentById = async (req, res) => {
  try {
    const dept = await Department.findById(req.params.id)
      .populate('manager', 'name email')
      .populate('members', 'name email');
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    res.json(dept);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateDepartment = async (req, res) => {
  try {
    const updated = await Department.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Department not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    const deleted = await Department.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Department not found' });
    res.json({ message: 'Department deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
