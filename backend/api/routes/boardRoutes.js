const { boardController} = require('../controllers/boardController.js');
const { authMiddleware } = require('../../middleware/authMiddleware.js');
const express = require('express');

const conceptRouter = require('../routes/conceptRoutes');
const tagRouter = require('../routes/tagRoutes');
const logRouter = require('../routes/logRoutes');
const sessionRouter = require('../routes/sessionRoutes');

const router = express.Router();


router
    .post("/", authMiddleware, boardController.createBoard)               // creates a new board
    .get("/", authMiddleware, boardController.getUserBoards)              // returns all boards for req.user
    .get("/:boardId", authMiddleware, boardController.getSingleBoard)     // returns single board 
    .put("/:boardId", authMiddleware, boardController.updateBoard)        // updates a board given id
    .delete('/:boardId', authMiddleware, boardController.deleteBoard)     // deletes a board given id
    ;

router.use('/:boardId/concepts', conceptRouter);
router.use('/:boardId/tags', tagRouter);
router.use('/:boardId/logs', logRouter);
router.use('/:boardId/sessions', sessionRouter);
module.exports = router; 