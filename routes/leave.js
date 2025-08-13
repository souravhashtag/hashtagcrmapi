const express = require('express');
const router = express.Router();
const LeaveController = require("../controllers/LeaveController");
const UserController = require("../controllers/UserController");
const upload = require('../config/document');

// Apply authentication middleware to all routes
router.use(UserController.verifyToken);

// Create a leave request (with file upload support)
router.post('/', upload.array('attachments', 5), LeaveController.createLeave);

// Get all leaves (HR view with filters and pagination)
router.get('/', LeaveController.getAllLeaves);

// Get employee's own leaves
router.get('/my-leaves', LeaveController.getMyLeaves);

// Get leave statistics
// router.get('/stats', LeaveController.getLeaveStats);

// Get leave balance (for logged-in user)
router.get('/balance', LeaveController.getLeaveBalance);

// // Get leave balance for specific employee (HR use)
// router.get('/balance/:employeeId', LeaveController.getLeaveBalance);

// Leave type management routes
router.post('/type', LeaveController.createLeaveType);
router.get('/type', LeaveController.getAllLeaveTypes);
router.put('/type/:id', LeaveController.updateLeaveType);
router.delete('/type/:id', LeaveController.deleteLeaveType);


// // Get single leave by ID
router.get('/:id', LeaveController.getLeaveById);

// // Update leave status (approve/reject)
router.patch('/:id/status', LeaveController.updateLeaveStatus);

// // Cancel leave request
router.patch('/:id/cancel', LeaveController.cancelLeave);

// // Update leave (full update)
// router.put('/:id', upload.array('attachments', 5), LeaveController.updateLeave);

// Delete leave
router.delete('/:id', LeaveController.deleteLeave);

module.exports = router;