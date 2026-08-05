var express = require('express');
// mergeParams keeps :boardId from the /boards/:boardId/tags mount path
// visible inside this router — Express does not merge mount params by default.
var router = express.Router({ mergeParams: true });
var tagController = require('../controllers/tagController');
var authenticate = require('../middleware/authenticate');

router.use(authenticate);

router.get('/', tagController.list);
router.post('/', tagController.create);
router.post('/bulk', tagController.createMany);
router.get('/:tagId', tagController.getById);
router.put('/:tagId', tagController.update);
router.delete('/:tagId', tagController.remove);

module.exports = router;
