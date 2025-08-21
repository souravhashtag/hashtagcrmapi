const express = require('express');
const ctrl = require('../controllers/PayrollController');
const router = express.Router();

router.post('/', ctrl.createPayroll);
router.get('/', ctrl.listPayrolls);
router.get('/:id', ctrl.getPayroll);
router.patch('/:id', ctrl.updatePayroll);
router.delete('/:id', ctrl.deletePayroll);

// extras
router.patch('/:id/status', ctrl.setPaymentStatus);
router.post('/:id/recalculate', ctrl.recalculateTotals);

module.exports = router;
