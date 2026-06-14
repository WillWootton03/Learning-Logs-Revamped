const { conceptRepo } = require('../repositories/conceptRepo.js');
const { jwt } = require('jsonwebtoken');

const argon2 = require("argon2");
const crypto = require("crypto");
const { lookupService } = require("dns");


const conceptService = {

/*
*
*
*
* POST METHODS 
* 
* 
* 
*/

    // POST : add a new concept to a board 
    /* 
        boardID (UUID) : where the concept lives 
        question (string) : the question for the concetpt
        answer (string) : the answer for the question
        tags [(string)] : a list of tags to allow quick sorting for the tags based on topcis, dificulty etc.

        ()-> concept (Record) : returns the instance of the new concept
    */
    createConcept: async ({ boardId, question, answer, tags }) => {
        const conceptId = crypto.randomUUID();

        return conceptRepo.createConcept({
            boardId,
            conceptId,
            question,
            answer,
            tags,
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

    // GET : get a concept based on conceptId
    /*
        boardId (UUID) : the board where the concept lives
        conceptId (UUID) : the concept to get

        ()-> concept (Record) : the found concept or null / undefined
    */
    getConcept: async ({ boardId, conceptId }) => {
        return conceptRepo.getConcept({
            boardId,
            conceptId
        });
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

    // PUT : edit a concept based on values given 
    /*
        boardId (UUID) : used for getting the concept
        conceptId (UUID) : used for getting the concept

        question (string) : updated string for question or undefined
        answer (string) : updated string for answer or undefined
        tags [(string)] : includes all tags for new concept, can remove or add entire array gets updated 

        ()-> concept (Record) : returns an instance of the updated concept
    */
    updateConcept: async ({ boardId, conceptId, question, answer, tags, knownNum }) => {
        return conceptRepo.updateConcept({
            boardId,
            conceptId,
            question,
            answer,
            tags,
            knownNum,
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

    // DELETE : deletes a concept 
    /*
        boardId (UUID) : where the concept lives
        conceptId (UUID) : reference to concept

        ()-> success (boolean) : returns true if record deleted 
    */
    deleteConcept: async ({ boardId, conceptId }) => {
        return conceptRepo.deleteConcept({
            boardId,
            conceptId,
        });
    },

}

module.exports = {
    conceptService,
}