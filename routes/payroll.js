const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/PayrollController');

// Create payroll
router.post('/', payrollController.createPayroll);

// Get all payrolls
router.get('/', payrollController.getAllPayrolls);

// Get payroll by ID
router.get('/:id', payrollController.getPayrollById);

// Update payroll
router.put('/:id', payrollController.updatePayroll);

// Delete payroll
router.delete('/:id', payrollController.deletePayroll);

module.exports = router;
