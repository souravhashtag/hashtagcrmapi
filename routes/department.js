const express = require('express');
const router = express.Router();
const controller = require('../controllers/DepartmentController');

// Create
router.post('/', controller.createDepartment);

// Get all
router.get('/', controller.getAllDepartments);

// Get by ID
router.get('/:id', controller.getDepartmentById);

// Update
router.put('/:id', controller.updateDepartment);

// Delete
router.delete('/:id', controller.deleteDepartment);

module.exports = router;
