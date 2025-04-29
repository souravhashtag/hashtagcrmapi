const express = require('express');
const router = express.Router();
const AttendanceController = require("../controllers/AttendanceController");


router.post('/', AttendanceController.createAttendance);
router.get('/', AttendanceController.getAllAttendances);
router.get('/:id', AttendanceController.getAttendanceById);
router.put('/:id', AttendanceController.updateAttendance);
router.delete('/:id', AttendanceController.deleteAttendance);

module.exports = router;
