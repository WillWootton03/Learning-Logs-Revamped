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
        LOGIC FOR CONCEPTS
    *
    *
    * 
    */

    // POST : add a new concept to a board 
    /* 
        question : the question for the concetpt
        answer : the answer for the question
        tags : a list of tags to allow quick sorting for the tags based on topcis, dificulty etc.
        */
    createConcept: async ({ boardId, question, answer, tags }) => {
        const conceptId = crypto.randomUUID();

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
                    knownNum: 0,    // number of times a concept has been answered correctly in a row
                },
            })
        );
        return result.Item ?? null;
    },

    // GET : get a concept based on conceptId
    /*
        boardId : the board where the concept lives
        conceptId: the concept to get
    */
    getConcept: async ({boardId, conceptId}) => {
        const result = await db.send(
            new GetCommand({
                TableName = TABLE,
                Key : {
                    PK: keys.board(boardId),
                    SK: keys.concept(conceptId),
                },
            })
        );
        return result.Item;
    },

    // PUT : edit a concept based on values given 
    /*
        boardId: used for getting the concept
        conceptId : used for getting the concept

    if no value is given for the following, then no update happens
        question : updated string for question or undefined
        answer : updated string for answer or undefined
        tags : includes all tags for new concept, can remove or add entire array gets updated 
    */
    updateConcept: async ({ boardId, conceptId, question, answer, tags })  => {
        
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

    // DELETE : deletes a concept 
    /*
        boardId: where the concept lives
        conceptId: reference to concept
    */
    deleteConcept: async ({ boardId, conceptId }) => {
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
    },

    /* 
    *
    *
    * 
        LOGIC FOR TAGS
    *
    *
    * 
    */

    // POST : add a new tag to a board
    /* 
        boardId: the board where the tag will live
        tagTitle: identifier for the tag EX. Hard, Easy, Word, Greek History, German History, etc.
    */
    createTag: async ({ boardId, tagTitle }) => {
        const tagId = crypto.randomUUID();

        const result = await db.send(
            new PutCommand({
                TableName: TABLE,
                Item: {
                    PK: keys.board(boardId),
                    SK: keys.tag(tagId),
                    type: 'TAG',
                    title,
                },
            })
        );
        return result.Item ?? null;
    },

    // GET : get a tag based on tagId
    /*
        boardId : where the tag lives
        tagId : actual tag
    */
    getTag : async ({ boardId, tagId }) => {
        const result = await db.send(
            new GetCommand({
                TableName: TABLE,
                Key: {
                    PK: keys.board(boardId),
                    SK: keys.tag(tagId),
                },
            })
        );
        return result.Item;
    },

    // PUT : update a tag 
    /*
        boardId : where the tag lives
        tagId : reference to the tag
        title : definition of tag
    */
    updateTag: async ({ boardId, tagId, title }) => {
        const result = await db.send(
            new UpdateCommand({
                TableName: TABLE,
                Key: {
                    PK: keys.board(boardId),
                    SK: keys.tag(tagId),
                },
                UpdateExpression: "SET #title = :title",
                ExpressionAttributeNames : {
                    "#title" : "title",
                },
                ExpressionAttributeValues : {
                    ":title" : title,
                },
                ReturnValues: "ALL_NEW",
            })
        );
        return result.Attributes;
    },

    // DELETE : delete a tag given tagId
    /*
        boardId : where the tag lives
        tagId : reference to the specific tag
    */
    deleteTag: async ({ boardId, tagId }) => {
        await db.send(
            new DeleteCommand({
                TableName: TABLE,
                Key: {
                    PK: keys.board(boardId),
                    SK: keys.tag(tagId),
                },
                ConditionExpression : deleteConditionExists,
            })
        );
        return true;
    }
}

module.exports = {
    conceptRepo,
}