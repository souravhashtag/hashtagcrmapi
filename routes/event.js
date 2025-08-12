const express = require("express");
const router = express.Router();
const EventController = require("../controllers/EventController");

const UserController = require("../controllers/UserController");
router.get('/:year/:month', UserController.verifyToken, EventController.getCalenderData);

module.exports = router;
