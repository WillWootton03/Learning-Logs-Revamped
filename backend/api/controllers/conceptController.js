const { conceptService } = require('../services/conceptService.js');

const conceptController = {
/*
*
*
*
* POST METHODS 
* 
* 
* 
*/

    createConcept: async (req, res) => {
        try {
            const { boardId } = req.params;
            const { question, answer, tags } = req.body;

            const result = await conceptService.createConcept({ boardId, question, answer, tags });

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

    getSingleConcept: async (req, res) => {
        try{
            const { boardId, conceptId } = req.params;

            const result = await conceptService.getSingleConcept({ boardId, conceptId });

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

    getAllConcepts: async (req, res) => {
        try {
            const { boardId } = req.params;

            const result = await conceptService.getAllConcepts({ boardId });

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

    updateConcept: async (req, res) => {
        try {
            const { boardId, conceptId } = req.params;
            const { question, answer, tags, knownNum } = req.body;

            const result = await conceptService.updateConcept({ boardId, conceptId, question, answer, tags, knownNum });

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

    deleteConcept: async (req, res) => {
        try {
            const { boardId, conceptId } = req.params;

            const result = await conceptService.deleteConcept({ boardId, conceptId });

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
    conceptController,
}