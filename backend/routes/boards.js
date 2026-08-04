var express = require('express');
var router = express.Router();
var boardController = require('../controllers/boardController');
var authenticate = require('../middleware/authenticate');

router.use(authenticate);

router.get('/', boardController.list);
router.post('/', boardController.create);
router.get('/:boardId', boardController.getById);
router.put('/:boardId', boardController.update);
router.delete('/:boardId', boardController.remove);

module.exports = router;
