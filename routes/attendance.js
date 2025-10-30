const express = require('express');
const router = express.Router();
const AttendanceController = require("../controllers/AttendanceController");
const UserController = require("../controllers/UserController.js");


router.post('/create', UserController.verifyToken, AttendanceController.createAttendance);
router.post('/clock-out', UserController.verifyToken, AttendanceController.clockOutAttendance);
router.get('/get-individual-attendance', UserController.verifyToken, AttendanceController.getIndividualClockInData);
router.get('/take-a-break', UserController.verifyToken, AttendanceController.takeaBreak);
router.get('/resume-work', UserController.verifyToken, AttendanceController.ResumeWork);
router.get('/geo-location', AttendanceController.GeoLocation);
router.get('/date/:date',  UserController.verifyToken,   AttendanceController.getAttendanceByDate);
router.get('/get-attendance-by-date-range/:employeeId', UserController.verifyToken, AttendanceController.getAttendanceByDateRange);  
router.get('/check-missed-clockout', UserController.verifyToken, AttendanceController.checkMissedClockOut);
router.post('/manual-clockout', UserController.verifyToken, AttendanceController.manualClockOut);

module.exports = router;
