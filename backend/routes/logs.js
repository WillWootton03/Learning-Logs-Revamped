var express = require('express');
// mergeParams keeps :boardId from the /boards/:boardId/logs mount path
// visible inside this router — Express does not merge mount params by default.
var router = express.Router({ mergeParams: true });
var logController = require('../controllers/logController');
var authenticate = require('../middleware/authenticate');

router.use(authenticate);

router.get('/', logController.list);
router.post('/', logController.create);
router.get('/:logId', logController.getById);
router.put('/:logId', logController.update);
router.delete('/:logId', logController.remove);

module.exports = router;
