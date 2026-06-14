const { sessionRepo }  = require("../repositories/sessionRepo.js");

const sessionService = {

/*
*
*
*
* POST METHODS 
* 
* 
* 
*/
    // POST : create a board session and assign it a board and a questions based on params. Create UUID for sessionId
    /*
        boardId (UUID) : boardId what owns the session
        questions [(question)] : title of the session 

        ()-> sessionId (UUID) : return the UUID of the newly created session
    */ 
    createSession: async ({ boardId, questions }) => {
        const sessionId = crypto.randomUUID();

        await sessionRepo.createSession({
            boardId,
            sessionId,
            questions,
    });

        return { sessionId };
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

    // GET : returns a single instance of a session based on sessionId and boardId that owns the session
    /* 
        boardId (UUID) : what owns the session to find
        sessionId (UUID) : reference to the session to find
    */
    getSingleSession: async ({ boardId, sessionId }) => {
        return await sessionRepo.getSingleSession({ boardId, sessionId });
    },

    // GET : returns all sessions given a board
    /*
        boardId (UUID) : the board's sessions to return
    */
    getBoardSessions: async ({ boardId }) => {
        return await sessionRepo.getBoardSessions({ boardId });
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

    // PUT : update a sessions questions 
    /*
        boardId (UUID) : what owns the session to update
        sessionId (UUID) : the session to be updated
        questions [(question)] : updated questions for the session
    */
    updateSession: async({ boardId, sessionId, questions }) => {
        return await sessionRepo.updateSession({ boardId, sessionId, questions });
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

    // DELETE : delete a session given board that owns session and sessionId
    /*
        boardId (UUID) : what owns the session
        sessionId (UUID) : reference to the session to be deleted
    */
    deleteSession: async({ boardId, sessionId }) => {
        return await sessionRepo.deleteSession({ boardId, sessionId });
    },
};


module.exports = {
    sessionService
};