const express = require('express');
const ctrl = require('../controllers/countryController');
const router = express.Router();

router.post('/', ctrl.createCountry);
router.get('/', ctrl.listCountries);
router.get('/:idOrCode', ctrl.getCountry);
router.patch('/:idOrCode', ctrl.updateCountry);
router.delete('/:idOrCode', ctrl.deleteCountry);

router.post('/:idOrCode/states', ctrl.addOrUpdateState);
router.delete('/:idOrCode/states/:stateKey', ctrl.removeState);

router.post('/bulk/upsert', ctrl.bulkUpsertCountries);

module.exports = router;
