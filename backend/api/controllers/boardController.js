const { boardService } = require("../services/boardService.js");

const createBoardController = async (req, res) => {
    try {
        const result = await boardService.createBoard(req);

        res
            .status(201)
            .json({
                sucess: true,
                data: result,
            });
    } catch (e) {
        res
            .status(500)
            .json({
                staus: false,
                error: e.message
            });
    }
};

const getSingleBoardController = async (req, res) => {
    try {
        const userId = req.user.id;
        const { boardId } = req.params;

        const result = await boardService.getSingleBoard(userId, boardId);

        res
            .status(201)
            .json({
                sucess: true,
                data: result,
            });
    } catch (e) {
        res
            .status(500)
            .json({
                staus: false,
                error: e.message
            });
    }
}




module.exports = { 
    createBoardController,
    getSingleBoardController,
};