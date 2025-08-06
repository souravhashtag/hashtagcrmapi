const express = require('express');
const router = express.Router();
const roleController = require("../controllers/RoleController");
const UserController = require("../controllers/UserController");

router.post('/', UserController.verifyToken, roleController.createRole);
router.get('/list', UserController.verifyToken, roleController.getAllRoles);
router.get('/:id', UserController.verifyToken, roleController.getRoleById);
router.put('/:id', UserController.verifyToken, roleController.updateRole);
router.delete('/:id', UserController.verifyToken, roleController.deleteRole);

router.post('/:id/assign', UserController.verifyToken, roleController.assignRoleToUser);
router.post('/:id/unassign', UserController.verifyToken, roleController.unassignRoleFromUser);
router.get('/:id/users', UserController.verifyToken, roleController.getRoleUsers);


router.get('/hierarchy/tree', UserController.verifyToken, roleController.getHierarchyTree);
router.get('/hierarchy/flat', UserController.verifyToken, roleController.getFlatHierarchy);
router.get('/hierarchy/stats', UserController.verifyToken, roleController.getRoleStats);

// Individual role hierarchy operations - ADD THESE!
router.get('/:id/children', UserController.verifyToken, roleController.getRoleChildren);
router.get('/:id/ancestors', UserController.verifyToken, roleController.getRoleAncestors);
router.get('/:id/descendants', UserController.verifyToken, roleController.getRoleDescendants);

// Role movement and validation - ADD THESE!
router.put('/:id/move', UserController.verifyToken, roleController.moveRole);
router.get('/validate-hierarchy', UserController.verifyToken, roleController.validateRoleHierarchy);

// Level-based queries - ADD THESE!
router.get('/level/:level', UserController.verifyToken, roleController.getRolesByLevel);
module.exports = router;
