const express = require('express');
const router = express.Router();
const NoticeController = require('../controllers/noticeController');

// Public routes
router.get('/', NoticeController.getAllNotices);
router.get('/:id', NoticeController.getNoticeById);

router.post('/', NoticeController.createNotice);
router.put('/:id', NoticeController.updateNotice);
router.delete('/:id', NoticeController.deleteNotice);

module.exports = router;