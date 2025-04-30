const express = require('express');
const router = express.Router();
const controller = require('../controllers/DesignationController');

router.post('/', controller.createDesignation);
router.get('/', controller.getAllDesignations);
router.get('/:id', controller.getDesignationById);
router.put('/:id', controller.updateDesignation);
router.delete('/:id', controller.deleteDesignation);

module.exports = router;
