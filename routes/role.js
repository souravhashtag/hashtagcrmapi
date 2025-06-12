const express = require('express');
const router = express.Router();
const roleController = require("../controllers/RoleController");
const UserController = require("../controllers/UserController");

router.post('/', UserController.verifyToken, roleController.createRole);
router.get('/list', UserController.verifyToken, roleController.getAllRoles);
router.get('/:id', UserController.verifyToken, roleController.getRoleById);
router.put('/:id', UserController.verifyToken, roleController.updateRole);
router.delete('/:id', UserController.verifyToken, roleController.deleteRole);

module.exports = router;
