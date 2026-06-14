const { tagController } = require('../controllers/tagController.js');
const { authMiddleware } = require('../../middleware/authMiddleware.js');
const express = require('express');

const router = express.Router({ mergeParams: true });       // needed to be able to get boardId


router
    .post('/', authMiddleware, tagController.createTag)         // creates a new tag
    .get('/', authMiddleware, tagController.getAllTags)         // gets all tags for a board
    .get('/:tagId', authMiddleware, tagController.getSingleTag) // gets a single tag based on tagId
    .put('/:tagId', authMiddleware, tagController.updateTag)    // update a tag based on tagId
    .delete('/:tagId', authMiddleware, tagController.deleteTag)    // delete a tag based on tagId
;

module.exports = router