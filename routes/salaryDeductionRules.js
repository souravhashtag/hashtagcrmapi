const router = require('express').Router();
const user = require('../controllers/UserController'); // for verifyToken if you have it
const ctrl = require('../controllers/SalaryDeductionRuleController');




// Optional CRUD
router.post('/', user.verifyToken, ctrl.createRule);
router.get('/', user.verifyToken, ctrl.listRules);
router.post('/percent', user.verifyToken, ctrl.upsertPercent);
router.get('/:id', user.verifyToken, ctrl.getRule);
router.delete('/:id', user.verifyToken, ctrl.deleteRule);
router.patch('/:id/percent', user.verifyToken, ctrl.updatePercentById);



module.exports = router;
