const express = require('express');
const router = express.Router();
const rosterController = require('../controllers/RosterController');
const UserController = require('../controllers/UserController');

router.get('/week/:year/:weekNumber', UserController.verifyToken, rosterController.getWeekRoster);

router.get('/employee/:employeeId', UserController.verifyToken, rosterController.getEmployeeRoster);

router.get('/stats/:year/:weekNumber', UserController.verifyToken, rosterController.getRosterStats);

router.get('/rosterforallemployee/:employeeId', UserController.verifyToken, rosterController.getRosterforallEmployee); 

router.post('/', UserController.verifyToken, rosterController.addRoster);

router.post('/bulk', UserController.verifyToken, rosterController.bulkAddRoster);

router.post('/copy', UserController.verifyToken, rosterController.copyFromPreviousWeek);

router.put('/:id', UserController.verifyToken, rosterController.updateRoster);

router.delete('/:id', UserController.verifyToken, rosterController.deleteRoster); 

module.exports = router; 