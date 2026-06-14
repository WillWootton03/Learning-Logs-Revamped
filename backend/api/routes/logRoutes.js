const { logController } = require('../controllers/logController.js');
const { authMiddleware } = require('../../middleware/authMiddleware.js');
const express = require('express');

const router = express.Router({ mergeParams: true });       // needed to be able to get boardId


router
    .post('/', authMiddleware, logController.createLog)         // creates a new log
    .get('/', authMiddleware, logController.getAllLogs)         // gets all logs for a board
    .get('/:logId', authMiddleware, logController.getSingleLog) // gets a single log based on logId
    .put('/:logId', authMiddleware, logController.updateLog)    // update a log based on logId
    .delete('/:logId', authMiddleware, logController.deleteLog)    // delete a log based on logId
;

module.exports = router