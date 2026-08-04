var express = require('express');
var router = express.Router();
var userController = require('../controllers/userController');
var authenticate = require('../middleware/authenticate');

router.use(authenticate);

router.get('/me', userController.me);
router.get('/:id', userController.getById);
router.put('/:id', userController.update);
router.delete('/:id', userController.remove);

module.exports = router;
