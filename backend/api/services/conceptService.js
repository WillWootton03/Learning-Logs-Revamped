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
    createConcept: async ({ boardId, question, answer, tags}) => {
        const conceptId = crypto.randomUUID();

        return conceptRepo.createConcept({
            boardId,
            conceptId,
            question,
            answer,
            tags,
        });
    },

    // POST : add a new tag to a board
    /* 
        boardId (UUID) : the board where the tag will live
        tagId (UUID) : reference to the created tag
        tagTitle (string) : identifier for the tag EX. Hard, Easy, Word, Greek History, German History, etc.

        ()-> tag (Record) : returns a record of the new tag
    */
    createTag: async ({ boardId, tagTitle }) => {
        const tagId = crypto.randomUUID();

        return conceptRepo.createTag(
            boardId,
            tagId,
            tagTitle,
        );
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
        return conceptRepo.getConcept(
            boardId,
            conceptId
        );
    },

    // GET : get a tag based on tagId
    /*
        boardId (UUID) : where the tag lives
        tagId (UUID) : actual tag

        ()-> tag (Record) : returns the found tag or null / undefined
    */
    getTag: async ({ boardId, tagId }) => {
        return conceptRepo.getTag(
            boardId,
            tagId,
        );
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
    updateConcept: async ({ boardId, conceptId, question, answer, tags }) => {
        return conceptRepo.updateConcept(
            boardId,
            conceptId,
            question,
            answer,
            tags,
        );
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
        return conceptRepo.deleteConcept(
            boardId,
            conceptId,
        );
    },

}

module.exports = {
    conceptService,
}