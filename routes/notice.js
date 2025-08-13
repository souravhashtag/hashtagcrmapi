const express = require('express');
const router = express.Router();
const NoticeController = require('../controllers/noticeController');
const UserController = require("../controllers/UserController");
// Public routes
router.get('/', UserController.verifyToken, NoticeController.getAllNotices);
router.get('/:id', UserController.verifyToken, NoticeController.getNoticeById);

router.post('/', UserController.verifyToken, NoticeController.createNotice);
router.put('/:id', UserController.verifyToken, NoticeController.updateNotice);
router.delete('/:id', UserController.verifyToken, NoticeController.deleteNotice);

module.exports = router;