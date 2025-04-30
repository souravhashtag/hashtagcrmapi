// routes/holidayRoutes.js
const express = require('express');
const router = express.Router();
const holidayController = require('../controllers/HolidayController');

router.post('/holidays', holidayController.createHoliday);
router.get('/holidays', holidayController.getAllHolidays);
router.get('/holidays/:id', holidayController.getHolidayById);
router.put('/holidays/:id', holidayController.updateHoliday);
router.delete('/holidays/:id', holidayController.deleteHoliday);

module.exports = router;
