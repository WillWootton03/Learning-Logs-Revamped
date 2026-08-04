var express = require('express');
var router = express.Router();
var userController = require('../controllers/userController');
var authenticate = require('../middleware/authenticate');

router.use(authenticate);

router.get('/me', userController.me);
router.put('/me', userController.update);
router.delete('/me', userController.remove);

module.exports = router;
