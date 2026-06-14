const { logRepo }  = require("../repositories/logRepo.js");

const logService = {

/*
*
*
*
* POST METHODS 
* 
* 
* 
*/
    // POST : create a board log and assign it a board and a text based on params. Create UUID for logId
    /*
        boardId (UUID) : boardId what owns the log
        text (string) : title of the log 

        ()-> logId (UUID) : return the UUID of the newly created log
    */ 
    createLog: async ({ boardId, text }) => {

        const logId = crypto.randomUUID();

        await logRepo.createLog({
            boardId,
            logId,
            text,
    });

        return { logId };
    },

/*
*
*
*
* GET METHODS 
* 
* 
* 
*/

    // GET : returns a single instance of a log based on logId and boardId that owns the log
    /* 
        boardId (UUID) : what owns the log to find
        logId (UUID) : reference to the log to find
    */
    getSingleLog: async ({ boardId, logId }) => {
        return await logRepo.getLog({ boardId, logId });
    },

    // GET : returns all logs given a board
    /*
        boardId (UUID) : the board's logs to return
    */
    getBoardLogs: async (boardId) => {
        return await logRepo.getBoardLogs({ boardId });
    },

/*
*
*
*
* PUT METHODS 
* 
* 
* 
*/

    // PUT : update a logs text 
    /*
        boardId (UUID) : what owns the log to update
        logId (UUID) : the log to be updated
        text (string) : updated text for the log
    */
    updateLog: async({ boardId, logId, text }) => {
        return await logRepo.updateLog({ boardId, logId, text });
    },

/*
*
*
*
* DELETE METHODS 
* 
* 
* 
*/

    // DELETE : delete a log given board that owns log and logId
    /*
        boardId (UUID) : what owns the log
        logId (UUID) : reference to the log to be deleted
    */
    deleteLog: async({ boardId, logId }) => {
        return await logRepo.deleteLog({ boardId, logId });
    },
};


module.exports = {
    logService
};