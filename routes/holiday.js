const express = require('express');
const router = express.Router();
const holidayController = require('../controllers/HolidayController');
const UserController = require('../controllers/UserController');

router.post('/', UserController.verifyToken, holidayController.createHoliday);
router.get('/', holidayController.getAllHolidays);
router.get('/:id', holidayController.getHolidayById);
router.put('/:id', UserController.verifyToken, holidayController.updateHoliday);
router.delete('/:id', UserController.verifyToken, holidayController.deleteHoliday);

module.exports = router;
