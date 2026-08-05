var express = require('express');
// mergeParams keeps :boardId from the /boards/:boardId/quizzes mount path
// visible inside this router — Express does not merge mount params by default.
var router = express.Router({ mergeParams: true });
var quizController = require('../controllers/quizController');
var authenticate = require('../middleware/authenticate');

router.use(authenticate);

router.get('/', quizController.listRuns);
router.post('/', quizController.recordRun);
router.post('/generate', quizController.generateQuestions);
router.get('/:quizId', quizController.getRunBreakdown);

module.exports = router;
