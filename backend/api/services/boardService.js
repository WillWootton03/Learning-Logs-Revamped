const { boardRepo }  = require("../repositories/boardRepo.js");

const boardService = {
    createBoard: async (req) => {
        const userId = req.user.id;
        const { name } = req.body;

        const boardId = crypto.randomUUID();

        return boardRepo.createBoard({
            userId,
            boardId,
            name,
        });
    },

};

module.exports = {
    boardService
};