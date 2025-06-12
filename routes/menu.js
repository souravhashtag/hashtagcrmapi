const express = require('express');
const router = express.Router();

const menuController = require('../controllers/MenuController');
const UserController = require("../controllers/UserController");


router.post('/create', UserController.verifyToken, menuController.create);
router.get('/list', UserController.verifyToken, menuController.list);
router.get('/:id', UserController.verifyToken, menuController.getMenuById);
router.put('/:id', UserController.verifyToken, menuController.update);
router.delete('/:id', UserController.verifyToken, menuController.delete);
module.exports = router;