const { boardService } = require("../services/boardService.js");

const createBoardController = async (req, res) => {
    try {
        const result = await boardService.createBoard(req);

        res
            .status(200)
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





module.exports = { 
    createBoardController
};