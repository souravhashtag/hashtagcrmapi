const express = require('express');
const router = express.Router();
const controller = require('../controllers/EmployeeController');

router.post('/', controller.createEmployee);
router.get('/', controller.getAllEmployees);
router.get('/:id', controller.getEmployeeById);
router.put('/:id', controller.updateEmployee);
router.delete('/:id', controller.deleteEmployee);
module.exports = router;
