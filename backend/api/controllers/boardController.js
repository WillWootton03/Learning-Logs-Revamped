const { boardService } = require("../services/boardService.js");

const boardController = {

/*
*
*
*
* POST METHODS 
* 
* 
* 
*/

    createBoard: async (req, res) => {
        try {
            const userId = req.user.id;
            const { name } = req.body;

            const result = await boardService.createBoard({ userId, name });

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

    getSingleBoard: async (req, res) => {
        try {
            const userId = req.user.id;
            const { boardId } = req.params;

            const result = await boardService.getSingleBoard({ userId, boardId });

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
    },

    getUserBoards: async (req, res) => {
        try {
            const userId = req.user.id;

            const result = await boardService.getUserBoards({ userId });

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

    updateBoard: async (req, res) => {
        try {
            const userId = req.user.id;
            const { boardId } = req.params;
            const { name } = req.body;

            const result = await boardService.updateBoard({ userId, boardId, name });

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

    deleteBoard: async (req, res) => {
        try {
            const userId = req.user.id;
            const { boardId } = req.params;

            console.log(userId, boardId);

            const result = await boardService.deleteBoard({ userId, boardId });
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
    },
}



module.exports = { 
boardController
};