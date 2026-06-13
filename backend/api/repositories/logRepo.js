const { QueryCommand, PutCommand, GetCommand, DeleteCommand, UpdateCommand} = require('@aws-sdk/lib-dynamodb');
const { db } =  require("../db/db.js");
const { keys } =  require("../db/keys.js");

const TABLE = 'LL-AppData';

const logRepo = {
    // POST : create a new log
    /*
        boardId : where the log lives
        text : text inside the log 
    */
    createLog: async ({ boardId, text }) => {

        // unique ID for the log
        const logId = crypto.randomUUID();

        const result = await db.send(
            new PutCommand({
                TableName: TABLE,
                Item: {
                    PK: keys.board(boardId),
                    SK: keys.log(logId),  
                    text,
                    createdAt : Date.now().toISOString()        // allows for sorting based on time created, ISO is a readable form
                },
            })
        );
        return result.Item ?? null;
    },

    // GET : get a log based on id
    /*
        boardId : where the log lives
        logId : reference to the log
    */
    getLog: async ({ boardId, logId }) => {
        const result = await db.send(
            new GetCommand({
                TableName: TABLE,
                Key: {
                    PK: keys.board(boardId),
                    SK: keys.log(logId),
                },
            })
        );
        return result.Item ?? null;
    },

    // PUT : edit a log's text and update createdAt
    /*
        boardId : where the log lives
        logId : reference to the log

        text : updated log text
    */
    updateLog: async ({ boardId, logId, text }) => {
        const result = await db.send(
            new UpdateCommand({
                TableName: TABLE,
                Key: {
                    PK: keys.board(boardId),
                    SK: keys.log(logId),
                },
                UpdateExpression: `SET #text = text, createdAt = :createdAt`,
                ExpressionAttributeNames: {
                    "#text" : "text",
                    "#createdAt" : "createdAt",
                },
                ExpressionAttributeValues : {
                    ":text" : text,
                    ":createdAt" : Date.now().toISOString(),
                },
                ReturnValues: "ALL_NEW",
            })
        );
        return result.Attributes;
    },

    // DELETE : delete a log
    /*
        boardId : where the log lives
        logId : reference to the log
    */
    deleteLog: async ({ boardId, logId }) => {
        await db.send(
            new DeleteCommand({
                TableName: TABLE,
                Key: {
                    PK: keys.board(boardId),
                    SK: keys.log(logId),
                },
                ConditionExpression : "attribute_exists(PK) AND attribute_exists(SK)",
            })
        );
        return true;
    },
}

module.exports = {
    logRepo
}