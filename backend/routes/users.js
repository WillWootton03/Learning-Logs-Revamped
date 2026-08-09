var express = require('express');
var router = express.Router();
var userController = require('../controllers/userController');
var quizController = require('../controllers/quizController');
var authenticate = require('../middleware/authenticate');

router.use(authenticate);

router.get('/me', userController.me);
router.put('/me', userController.update);
router.put('/me/password', userController.changePassword);
router.delete('/me', userController.remove);
// Every quiz run across the user's boards — the activity log feed.
router.get('/me/runs', quizController.listAllRuns);

module.exports = router;
