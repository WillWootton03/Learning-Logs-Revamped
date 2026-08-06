var express = require('express');
// mergeParams keeps :boardId from the /boards/:boardId/concepts mount path
// visible inside this router — Express does not merge mount params by default.
var router = express.Router({ mergeParams: true });
var conceptController = require('../controllers/conceptController');
var tagController = require('../controllers/tagController');
var authenticate = require('../middleware/authenticate');

router.use(authenticate);

router.get('/', conceptController.list);
router.post('/', conceptController.create);
router.post('/import', conceptController.importMany);
router.delete('/', conceptController.removeAll);
router.get('/:conceptId', conceptController.getById);
router.put('/:conceptId', conceptController.update);
router.put('/:conceptId/learned', conceptController.setLearned);
router.delete('/:conceptId', conceptController.remove);

router.get('/:conceptId/tags', tagController.listConceptTags);
router.put('/:conceptId/tags', tagController.linkMany);
router.put('/:conceptId/tags/:tagId', tagController.linkConcept);
router.delete('/:conceptId/tags/:tagId', tagController.unlinkConcept);

module.exports = router;
