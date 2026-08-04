var express = require('express');
var router = express.Router();
var quizSettingsController = require('../controllers/quizSettingsController');
var quizController = require('../controllers/quizController');
var authenticate = require('../middleware/authenticate');

router.use(authenticate);

router.get('/', quizSettingsController.list);
router.post('/', quizSettingsController.create);
router.get('/:quizSettingsId', quizSettingsController.getById);
router.put('/:quizSettingsId', quizSettingsController.update);
router.delete('/:quizSettingsId', quizSettingsController.remove);

// Manage the tag filter on a saved setting.
router.post('/:quizSettingsId/tags', quizSettingsController.addTags);
router.delete('/:quizSettingsId/tags', quizSettingsController.removeTags);

// Runs produced from a saved setting.
router.get('/:quizSettingsId/quizzes', quizController.listRunsBySettings);
router.post('/:quizSettingsId/quizzes', quizController.recordRunFromSettings);
router.get('/:quizSettingsId/quizzes/:quizId', quizController.getRunBreakdown);

module.exports = router;
