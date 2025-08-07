const express = require('express');
//const upload = require("../config/profile-image-upload")
const document = require("../config/document")
const router = express.Router();
const controller = require('../controllers/EmployeeController');
const UserController = require("../controllers/UserController");
router.get('/get-birthday-list', UserController.verifyToken, controller.getBirthdayList);
router.get('/get-employee-profile', UserController.verifyToken, controller.getEmployeeProfileById);
router.get('/new-members', controller.getNewMembers);
router.get('/new-members/:year/:month', controller.getNewMembersByMonth);
router.post('/', UserController.verifyToken,document.any(), controller.createEmployee);
router.get('/', UserController.verifyToken, controller.getAllEmployees);
router.get('/:id', UserController.verifyToken, controller.getEmployeeById);
router.put('/:id', UserController.verifyToken,document.any(), controller.updateEmployee);
router.delete('/:id', UserController.verifyToken, controller.deleteEmployee);
module.exports = router;



