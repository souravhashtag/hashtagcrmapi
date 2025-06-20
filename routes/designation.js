const express = require('express');
const router = express.Router();
const controller = require('../controllers/DesignationController');
const UserController = require("../controllers/UserController");

router.post('/', UserController.verifyToken, controller.createDesignation);
router.get('/', UserController.verifyToken, controller.getAllDesignations);
router.get('/:id', UserController.verifyToken, controller.getDesignationById);
router.put('/:id', UserController.verifyToken, controller.updateDesignation);
router.delete('/:id', UserController.verifyToken, controller.deleteDesignation);

module.exports = router;
