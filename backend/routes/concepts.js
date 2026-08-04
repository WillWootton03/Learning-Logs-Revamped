var express = require('express');
var router = express.Router();
var conceptController = require('../controllers/conceptController');
var tagController = require('../controllers/tagController');
var authenticate = require('../middleware/authenticate');

router.use(authenticate);

router.get('/', conceptController.list);
router.post('/', conceptController.create);
router.get('/:conceptId', conceptController.getById);
router.put('/:conceptId', conceptController.update);
router.delete('/:conceptId', conceptController.remove);

router.get('/:conceptId/tags', tagController.listConceptTags);
router.put('/:conceptId/tags/:tagId', tagController.linkConcept);
router.delete('/:conceptId/tags/:tagId', tagController.unlinkConcept);

module.exports = router;
