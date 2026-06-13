const { PutCommand, QueryCommand } =  require("@aws-sdk/lib-dynamodb");
const { db } =  require("../db/db.js");
const { keys } =  require("../db/keys.js");

const TABLE = "LL-AppData";

const boardRepo = {
    // POST :  a board given a userId, boardId, and name for the board and adds it to the AppData table
    createBoard: async ({ userId, boardId, name }) => {
        return db.send(
            new PutCommand({
                TableName: TABLE,
                Item: {
                    PK: keys.user(userId),
                    SK: keys.board(boardId),
                    name,
                    type: "BOARD",
                },
            })
        );
    },

    // GET : all boards for a user based on a userId
    // RETURN : list of all boards associated with a user or null
    getUserBoards: async (userId) => {
        const result = await db.send(
            new QueryCommand({
                TableName: TABLE,
                KeyConditionExpression : "PK  = :pk AND begins_with(SK, :sk)",
                ExpressionAttributeValues: {
                    ":pk" : keys.user(userId),
                    ":sk" : "BOARD#",
                },
            })
        );
        return result.Items ?? null;
    },

    // GET : a single board for user based on userId, and boardId
    // RETURN : a found board or null
    getBoard : async (userId, boardId) => {
        const result = await db.send(
            new GetCommand({
                TableName: TABLE,
                Key: {
                    PK: keys.user(userId),
                    SK: keys.board(boardId),
                },
            })
        );
        return result.Item ?? null;
    },
};

module.exports = {
    boardRepo
};