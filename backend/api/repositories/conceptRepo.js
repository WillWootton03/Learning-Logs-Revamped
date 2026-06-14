const { QueryCommand, PutCommand, GetCommand, UpdateCommand, DeleteCommand} = require('@aws-sdk/lib-dynamodb');

const { db } =  require("../db/db.js");
const { keys } =  require("../db/keys.js");

const TABLE = 'LL-AppData';

const deleteConditionExists = "attribute_exists(PK) AND attribute_exists(SK)";


const conceptRepo = {

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
        boardId (UUID) : where the concept lives 
        conceptId (UUID) : reference to the concept 
        question (string) : the question for the concetpt
        answer (string) : the answer for the question
        tags [(Tag)] : a list of tags to allow quick sorting for the tags based on topcis, dificulty etc.
    */
    createConcept: async ({ boardId, conceptId, question, answer, tags }) => {

        console.log(boardId, conceptId, question, answer, tags);

        const result = await db.send(
            new PutCommand({
                TableName: TABLE,
                Item: {
                    PK: keys.board(boardId),
                    SK: keys.concept(conceptId),
                    type: "CONCEPT",
                    question,
                    answer,
                    tags,
                    knownNum: 0,    // number of times a concept has been answered correctly in a row init at 0
                },
            })
        );
        return conceptId;
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
    */
    getSingleConcept: async ({ boardId, conceptId }) => {
        const result = await db.send(
            new GetCommand({
                TableName: TABLE,
                Key : {
                    PK: keys.board(boardId),
                    SK: keys.concept(conceptId),
                },
            })
        );
        return result.Item;
    },

    // GET : get all concepts for a board
    /*
        boardId (UUID) : the board to return all concepts for
    */

    
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

    if no value is given for the following, then no update happens
        question (string) : updated string for question or undefined
        answer (string) : updated string for answer or undefined
        tags [(string)] : includes all tags for new concept, can remove or add entire array gets updated 
    */
    updateConcept: async ({ boardId, conceptId, question, answer, tags, knownNum })  => {
        
        const updates =[];
        const names = {};
        const values = {};

        // Checks if questions was included in post request
        if (question !== undefined) {
            updates.push("#question = :question");
            names["#question"] = "question";
            values[":question"] = question;
        }

        // 
        if (answer !== undefined) {
            updates.push("#answer = :answer");
            names["#answer"] = "answer";
            values[":answer"] = answer;
        }

        if (tags !== undefined) {
            updates.push("#tags = :tags");
            names["#tags"] = "tags";
            values[":tags"] = tags;
        }

        if (knownNum !== undefined) {
            updates.push("#knownNum = :knownNum");
            names["#knownNum"] = "knownNum";
            values[":knownNum"] = knownNum;
        }

        const result = db.send(
            new UpdateCommand({ 
                TableName: TABLE, 
                Key: {
                    PK: keys.board(boardId),
                    SK: keys.concept(conceptId),
                },
                UpdateExpression: `SET ${updates.join(", ")}`,
                ExpressionAttributeNames: names,
                ExpressionAttributeValues: values,
                ReturnValues: "ALL_NEW",
            })
        );
        return result.Attributes;
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
    */
    deleteConcept: async ({ boardId, conceptId }) => {
        try {
        await db.send(
            new DeleteCommand({
                TableName: TABLE,
                Key: {
                    PK: keys.board(boardId),
                    SK: keys.concept(conceptId),
                },
                ConditionExpression : deleteConditionExists
            })
        );
        return true;
        } catch (e) {
            if (e.name === "ConditionalCheckFailedException") {
            return null;
            }
        throw e;
        }
    },

}

module.exports = {
    conceptRepo,
}