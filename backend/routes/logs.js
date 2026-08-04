var express = require('express');
var router = express.Router();
var logController = require('../controllers/logController');
var authenticate = require('../middleware/authenticate');

router.use(authenticate);

router.get('/', logController.list);
router.post('/', logController.create);
router.get('/:logId', logController.getById);
router.put('/:logId', logController.update);
router.delete('/:logId', logController.remove);

module.exports = router;
