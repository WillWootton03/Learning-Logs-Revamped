const { createBoardController } = require('../controllers/boardController.js');
const express = require('express');

const router = express.Router();


router
    .post("/boards", createBoardController);

module.exports = router; 