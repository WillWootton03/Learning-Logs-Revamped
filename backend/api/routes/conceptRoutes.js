const { conceptController } = require('../controllers/conceptController.js');
const { authMiddleware } = require('../../middleware/authMiddleware.js');
const express = require('express');

const router = express.Router({ mergeParams: true });       // needed to be able to get boardId


router
    .post('/', authMiddleware, conceptController.createConcept)         // creates a new concept
    .get('/', authMiddleware, conceptController.getAllConcepts)         // gets all concepts for a board
    .get('/:conceptId', authMiddleware, conceptController.getSingleConcept) // gets a single concept based on conceptId
    .put('/:conceptId', authMiddleware, conceptController.updateConcept)    // update a concept based on conceptId
    .delete('/:conceptId', authMiddleware, conceptController.deleteConcept)    // delete a concept based on conceptId
;

module.exports = router