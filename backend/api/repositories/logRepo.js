const { QueryCommand, PutCommand, GetCommand, DeleteCommand, UpdateCommand} = require('@aws-sdk/lib-dynamodb');
const { db } =  require("../db/db.js");
const { keys } =  require("../db/keys.js");

const TABLE = 'LL-AppData';

const logRepo = {
    // CREATE : create a new log
    /*
        boardId (UUID) : where the log lives
        logId (UUID) : reference to the log
        text (string) : what the main text of the log is
    */
    createLog: async ({ boardId, logId, text }) => {

        const result = await db.send(
            new PutCommand({
                TableName: TABLE,
                Item: {
                    PK: keys.board(boardId),
                    SK: keys.log(logId),  
                    type: "LOG",
                    text,
                    createdAt : Date.now()
                },
            })
        );
        return logId;
    },

    // READ : get a log based on id
    /*
        boardId (UUID) : where the log lives
        logId (UUID) : reference to the log
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

    // UPDATE : edit a log's text and update createdAt
    /*
        boardId (UUID) : where the log lives
        logId (UUID) : reference to the log

        text (string) : updated log text
    */
    updateLog: async ({ boardId, logId, text }) => {
        const result = await db.send(
            new UpdateCommand({
                TableName: TABLE,
                Key: {
                    PK: keys.board(boardId),
                    SK: keys.log(logId),
                },
                UpdateExpression: `SET #text = :t, #createdAt = :createdAt`,
                ExpressionAttributeNames: {
                    "#text": "text",
                    "#createdAt": "createdAt",
                },
                ExpressionAttributeValues: {
                    ":t": text,
                    ":createdAt": Date.now(),
                },
                ReturnValues: "ALL_NEW",
            })
        );
        return result.Attributes;
    },

    // DELETE : delete a log
    /*
        boardId (UUID) : where the log lives
        logId (UUID) : reference to the log
    */
    deleteLog: async ({ boardId, logId }) => {
        try {
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
        } catch (e) {
            if (e.name === "ConditionalCheckFailedException") {
                return null;
            }
            throw e;
        }
    },
}

module.exports = {
    logRepo
}