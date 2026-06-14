const { boardRepo }  = require("../repositories/boardRepo.js");

const boardService = {
    createBoard: async (req) => {
        
        const userId = req.user.id;

        const { name } = req.body;

        const boardId = crypto.randomUUID();

        await boardRepo.createBoard(
            userId,
            boardId,
            name,
        );

        return { boardId };
    },

    getSingleBoard: async ( userId, boardId) =>{
        return await boardRepo.getBoard( userId, boardId );
    },

};


module.exports = {
    boardService
};