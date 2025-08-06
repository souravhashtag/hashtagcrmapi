const express = require('express');
const router = express.Router();
const AssignmentController = require('../controllers/AssignmentController');
const UserController = require('../controllers/UserController');

// Assignment operations
router.post('/:supervisorId/assign', UserController.verifyToken, AssignmentController.assignEmployees);
router.delete('/:supervisorId/unassign', UserController.verifyToken, AssignmentController.unassignEmployee);
router.get('/:supervisorId/assigned', UserController.verifyToken, AssignmentController.getAssignedEmployees);
router.get('/:supervisorId/available-for-assignment', UserController.verifyToken, AssignmentController.getAvailableEmployees);

// Transfer operations
router.put('/:employeeId/transfer', UserController.verifyToken, AssignmentController.transferEmployee);

// History and reporting
router.get('/assignment-history', UserController.verifyToken, AssignmentController.getAssignmentHistory);

module.exports = router;