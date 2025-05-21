const express = require("express");
const UserController = require("../controllers/UserController.js");
const multer = require("multer");
const upload = require("../config/screen-shot-multer.js")

const router = express.Router();
router.post("/login", UserController.login);
router.post("/screenshotupload", UserController.verifyToken,upload.single("image"), UserController.ScreenShotUpload);
router.get("/getscreenshot", UserController.verifyToken, UserController.GetScreenShot);

module.exports = router;