const { QueryCommand, PutCommand, GetCommand} = require('@aws-sdk/client-dynamodb');
const { db } =  require("../db/db.js");
const { keys } =  require("../db/keys.js");

const TABLE = 'LL-AppData';

const conceptRepo = {
    // GET : return all concepts for a board

    // POST : add a new concept to a board 
    /* 
        question : the question for the concetpt
        answer : the answer for the question
        tags : a list of tags to allow quick sorting for the tags based on topcis, dificulty etc.
        kownNum : the number of times a concept has been answered correctly in a row
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
                    knownNum: 0,
                },
            })
        );
        return result.Item ?? null;
    },

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
    }

    // PUT : edit a board based on values given 

}