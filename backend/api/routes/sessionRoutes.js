const { sessionController } = require('../controllers/sessionController.js');
const { authMiddleware } = require('../../middleware/authMiddleware.js');
const express = require('express');

const router = express.Router({ mergeParams: true });       // needed to be able to get boardId


router
    .post('/', authMiddleware, sessionController.createSession)         // creates a new session
    .get('/', authMiddleware, sessionController.getBoardSessions)         // gets all sessions for a board
    .get('/:sessionId', authMiddleware, sessionController.getSingleSession) // gets a single session based on sessionId
    .put('/:sessionId', authMiddleware, sessionController.updateSession)    // update a session based on sessionId
    .delete('/:sessionId', authMiddleware, sessionController.deleteSession)    // delete a session based on sessionId
;

module.exports = router