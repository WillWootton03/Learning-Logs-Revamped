const { boardRepo }  = require("../repositories/boardRepo.js");

const boardService = {

/*
*
*
*
* POST METHODS 
* 
* 
* 
*/
    // POST : create a user board and assign it a user and a name based on params. Create UUID for boardId
    /*
        userId (UUID) : userId who owns the board
        name (string) : title of the board 

        ()-> boardId (UUID) : return the UUID of the newly created board
    */ 
    createBoard: async ({ userId, name }) => {

        const boardId = crypto.randomUUID();

        await boardRepo.createBoard(
            userId,
            boardId,
            name,
        );

        return { boardId };
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

    // GET : returns a single instance of a board based on boardId and userId of who owns the board
    /* 
        userId (UUID) : who owns the board to find
        boardId (UUID) : reference to the board to find
    */
    getSingleBoard: async ({ userId, boardId }) => {
        return await boardRepo.getBoard( userId, boardId );
    },

    // GET : returns all boards given a user
    /*
        userId (UUID) : the user who's boards to return
    */
    getUserBoards: async ({ userId }) => {
        return await boardRepo.getUserBoards(userId);
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

    // PUT : update a boards name 
    /*
        userId (UUID) : who owns the board to update
        boardId (UUID) : the board to be updated
        name (string) : updated name for the board
    */
    updateBoard: async({ userId, boardId, name }) => {
        return await boardRepo.updateBoard(userId, boardId, name);
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

    // DELETE : delete a board given user who owns board and boardId
    /*
        userId (UUID) : who owns the board
        boardId (UUID) : reference to the board to be deleted
    */
    deleteBoard: async({ userId, boardId }) => {
        return await boardRepo.deleteBoard(userId, boardId);
    },
};


module.exports = {
    boardService
};