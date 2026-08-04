var express = require('express');
var router = express.Router();
var authController = require('../controllers/authController');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refresh);
router.get('/google', authController.googleStart);
router.get('/google/callback', authController.googleCallback);

module.exports = router;
