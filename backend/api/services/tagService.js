const { tagRepo } = require('../repositories/tagRepo.js');

const tagService = {

/*
*
*
*
* POST METHODS 
* 
* 
* 
*/

    // POST : create a tag and assign it a board and title. Create UUID for tagId
    /*
        boardId (UUID) : where the tag lives
        title (string) : what the tag defines
    */
    createTag: async ({ boardId, title }) => {
        
        const tagId = crypto.randomUUID();

        return await tagRepo.createTag({ 
            boardId, 
            tagId, 
            title 
        });
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
    // GET : returns a single tag based on UUID
    /*
        boardId (UUID) : the board where the tag lives
        tagId (UUID) : the reference for the tag to find
    */
    getSingleTag: async ({ boardId, tagId }) => {
        return await tagRepo.getSingleTag({ boardId, tagId });
    },

    // GET : returns all tags for a board
    /*
        boardId (UUID) : the board whos tags we are searching for
    */
    getAllTags: async ({ boardId }) => {
        return await tagRepo.getAllTags({ boardId });
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

    // PUT : update a tags details
    /*
        boardId (UUID) : where the tag lives
        tagId (UUID) : which tag to update
        title (string) : what to change the tag's title to
    */
    updateTag: async ({ boardId, tagId, title }) => {
        return await tagRepo.updateTag({ 
            boardId, 
            tagId, 
            title, 
        });
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

    // DELETE : deletes a tag
    /*
        boardId (UUID) : where the tag lives
        tagId (UUID) : what tag to delete
    */
    deleteTag: async ({boardId, tagId }) => {
        return await tagRepo.deleteTag({ boardId, tagId });
    },

};

module.exports = {
    tagService,
}