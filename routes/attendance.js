const express = require('express');
const router = express.Router();
const AttendanceController = require("../controllers/AttendanceController");
const UserController = require("../controllers/UserController.js");


router.post('/create', UserController.verifyToken, AttendanceController.createAttendance);
router.post('/clock-out', UserController.verifyToken, AttendanceController.clockOutAttendance);
router.get('/get-individual-attendance', UserController.verifyToken, AttendanceController.getIndividualClockInData);
router.get('/take-a-break', UserController.verifyToken, AttendanceController.takeaBreak);
router.get('/resume-work', UserController.verifyToken, AttendanceController.ResumeWork);


module.exports = router;
