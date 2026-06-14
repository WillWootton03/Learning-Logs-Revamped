const { createBoardController, getSingleBoardController } = require('../controllers/boardController.js');
const { authMiddleware } = require('../../middleware/authMiddleware.js');
const express = require('express');

const router = express.Router();


router
    .post("/", authMiddleware, createBoardController)
    .get("/:boardId", authMiddleware, getSingleBoardController);

module.exports = router; 