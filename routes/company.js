// routes/company.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/CompanyController');
const UserController = require('../controllers/UserController');

// Basic company management
router.get('/', UserController.verifyToken, controller.getCompanyDetails);
router.post('/initialize', UserController.verifyToken, controller.initializeCompany);
router.put('/', UserController.verifyToken, controller.updateCompanyInfo);
router.get('/exists', controller.checkCompanyExists);

// Settings management
router.put('/ceo-talk', UserController.verifyToken, controller.updateCeoTalkMessage);
router.put('/address', UserController.verifyToken, controller.updateAddress);
router.put('/contact', UserController.verifyToken, controller.updateContactInfo);
router.put('/sender', UserController.verifyToken, controller.updateSender);

// Recipients management
router.post('/recipients', UserController.verifyToken, controller.addRecipient);
router.delete('/recipients/:recipientId', UserController.verifyToken, controller.removeRecipient);

// Leave management
router.get('/leave-allocation', UserController.verifyToken, controller.getLeaveAllocation);
router.get('/leave-allocations', UserController.verifyToken, controller.getAllLeaveAllocations);
router.put('/leave-allocation', UserController.verifyToken, controller.updateLeaveAllocation);

// Analytics
router.get('/stats', UserController.verifyToken, controller.getCompanyStats);

module.exports = router;