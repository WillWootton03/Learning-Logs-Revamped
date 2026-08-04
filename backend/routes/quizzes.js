var express = require('express');
var router = express.Router();
var quizController = require('../controllers/quizController');
var authenticate = require('../middleware/authenticate');

router.use(authenticate);

router.get('/', quizController.listRuns);
router.post('/', quizController.recordRun);
router.post('/generate', quizController.generateQuestions);
router.get('/:quizId', quizController.getRunBreakdown);

module.exports = router;
