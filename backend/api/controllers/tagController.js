const { tagService } = require('../services/tagService.js');

const tagController = {
/*
*
*
*
* POST METHODS 
* 
* 
* 
*/

    createTag: async (req, res) => {
        try {
            const { boardId } = req.params;
            const { title } = req.body;

            const result = await tagService.createTag({ boardId, title });

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

    getSingleTag: async (req, res) => {
        try{
            const { boardId, tagId } = req.params;

            const result = await tagService.getSingleTag({ boardId, tagId });

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

    getAllTags: async (req, res) => {
        try {
            const { boardId } = req.params;

            const result = await tagService.getAllTags({ boardId });

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

    updateTag: async (req, res) => {
        try {
            const { boardId, tagId } = req.params;
            const { title } = req.body;

            const result = await tagService.updateTag({ boardId, tagId, title });

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

    deleteTag: async (req, res) => {
        try {
            const { boardId, tagId } = req.params;

            const result = await tagService.deleteTag({ boardId, tagId });

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
    tagController,
}