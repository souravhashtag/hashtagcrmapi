const Payroll = require('../models/Payroll');

exports.createPayroll = async (req, res) => {
  try {
    const payroll = new Payroll(req.body);
    const savedPayroll = await payroll.save();
    res.status(201).json(savedPayroll);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getAllPayrolls = async (req, res) => {
  try {
    const payrolls = await Payroll.find().populate('employeeId');
    res.json(payrolls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPayrollById = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id).populate('employeeId');
    if (!payroll) return res.status(404).json({ error: 'Payroll not found' });
    res.json(payroll);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updatePayroll = async (req, res) => {
  try {
    const updatedPayroll = await Payroll.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!updatedPayroll) return res.status(404).json({ error: 'Payroll not found' });
    res.json(updatedPayroll);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deletePayroll = async (req, res) => {
  try {
    const deletedPayroll = await Payroll.findByIdAndDelete(req.params.id);
    if (!deletedPayroll) return res.status(404).json({ error: 'Payroll not found' });
    res.json({ message: 'Payroll deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
