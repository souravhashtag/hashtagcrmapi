const express = require('express');
const ctrl = require('../controllers/PayrollController');
const UserController = require('../controllers/UserController');
const router = express.Router();

router.post('/', ctrl.createPayroll);
router.get('/', ctrl.listPayrolls);

// Generate auto payslip
router.post('/generate', ctrl.generateForAllEmployees);

router.get('/my', UserController.verifyToken, ctrl.listMyPayrolls);
router.get('/my/:id', UserController.verifyToken, ctrl.getMyPayroll);

router.get('/:id', ctrl.getPayroll);
router.patch('/:id', ctrl.updatePayroll);
router.delete('/:id', ctrl.deletePayroll);

// extras
router.patch('/:id/status', ctrl.setPaymentStatus);
router.post('/:id/recalculate', ctrl.recalculateTotals);

module.exports = router;
