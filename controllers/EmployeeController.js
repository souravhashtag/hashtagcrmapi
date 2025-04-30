const Employee = require('../models/Employee');

// Create new employee
exports.createEmployee = async (req, res) => {
  try {
    const employee = new Employee(req.body);
    const saved = await employee.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all employees
exports.getAllEmployees = async (req, res) => {
  try {
    const employees = await Employee.find()
      .populate('userId', 'name email')
      .populate('performanceReviews.reviewerId', 'name email');
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get employee by ID
exports.getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('performanceReviews.reviewerId', 'name email');
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update employee
exports.updateEmployee = async (req, res) => {
  try {
    const updated = await Employee.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Employee not found' });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete employee
exports.deleteEmployee = async (req, res) => {
  try {
    const deleted = await Employee.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Employee not found' });
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
