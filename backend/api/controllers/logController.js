const { logService } = require('../services/logService.js');

const logController = {
/*
*
*
*
* POST METHODS 
* 
* 
* 
*/

    createLog: async (req, res) => {
        try {
            const { boardId } = req.params;
            const { text } = req.body;

            const result = await logService.createLog({ boardId, text });

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

    getSingleLog: async (req, res) => {
        try{
            const { boardId, logId } = req.params;

            const result = await logService.getSingleLog({ boardId, logId });

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

    getAllLogs: async (req, res) => {
        try {
            const { boardId } = req.params;

            const result = await logService.getAllLogs({ boardId });

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

    updateLog: async (req, res) => {
        try {
            const { boardId, logId } = req.params;
            const { text } = req.body;

            const result = await logService.updateLog({ boardId, logId, text });

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

    deleteLog: async (req, res) => {
        try {
            const { boardId, logId } = req.params;

            const result = await logService.deleteLog({ boardId, logId });

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

};

module.exports = {
    logController,
}