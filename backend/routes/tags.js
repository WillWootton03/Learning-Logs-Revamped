var express = require('express');
var router = express.Router();
var tagController = require('../controllers/tagController');
var authenticate = require('../middleware/authenticate');

router.use(authenticate);

router.get('/', tagController.list);
router.post('/', tagController.create);
router.get('/:tagId', tagController.getById);
router.put('/:tagId', tagController.update);
router.delete('/:tagId', tagController.remove);

module.exports = router;
