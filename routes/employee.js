const express = require('express');
const router = express.Router();
const controller = require('../controllers/employeeController');

// Create
router.post('/', controller.createEmployee);

// Read All
router.get('/', controller.getAllEmployees);

// Read One
router.get('/:id', controller.getEmployeeById);

// Update
router.put('/:id', controller.updateEmployee);

// Delete
router.delete('/:id', controller.deleteEmployee);

module.exports = router;
