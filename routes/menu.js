const express = require('express');
const router = express.Router();

const MenuController = require('../controllers/MenuController');
const UserController = require("../controllers/UserController");


// router.post('/create', UserController.verifyToken, menuController.create);
// router.get('/list', UserController.verifyToken, menuController.list);
// router.get('/:id', UserController.verifyToken, menuController.getMenuById);
// router.put('/:id', UserController.verifyToken, menuController.update);
// router.delete('/:id', UserController.verifyToken, menuController.delete);
// module.exports = router;

router.get('/', UserController.verifyToken, MenuController.getAllMenus);

// Get menu tree structure
router.get('/tree', UserController.verifyToken, MenuController.getMenuTree);

// Get menu statistics
router.get('/stats', UserController.verifyToken, MenuController.getMenuStats);

// Get menu by ID
router.get('/:id', UserController.verifyToken, MenuController.getMenuById);

// Get breadcrumb for a menu
router.get('/:id/breadcrumb', UserController.verifyToken, MenuController.getBreadcrumb);

// Create new menu
router.post('/', UserController.verifyToken, MenuController.createMenu);

// Update menu
router.put('/:id', UserController.verifyToken, MenuController.updateMenu);

// Delete menu
router.delete('/:id', MenuController.deleteMenu);

module.exports = router;