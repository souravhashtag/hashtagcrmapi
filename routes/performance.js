const express = require('express');
const router = express.Router();
const performanceController = require('../controllers/PerformanceController');

router.post('/', performanceController.createPerformanceRecord);
router.get('/', performanceController.getAllPerformanceRecords);
router.get('/:id', performanceController.getPerformanceRecordById);
router.put('/:id', performanceController.updatePerformanceRecord);
router.delete('/:id', performanceController.deletePerformanceRecord);

module.exports = router;
