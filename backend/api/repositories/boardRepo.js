const { PutCommand, QueryCommand, GetCommand, DeleteCommand, UpdateCommand } =  require("@aws-sdk/lib-dynamodb");
const { db } =  require("../db/db.js");
const { keys } =  require("../db/keys.js");

const TABLE = "LL-AppData";

const boardRepo = {

/*
*
*
*
* POST METHODS 
* 
* 
* 
*/

    //  POST:  a board given a userId, boardId, and name for the board and adds it to the AppData table
    /*
        userId (UUID) : who owns the board
        boardId (UUID) : reference to the board
        name (string) : what the board is titled
    */
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
        return result.Item ?? null;
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

    // GET : all boards for a user based on a userId
    /* 
        userId (UUID) : reference to the user who owns boards
        ()-> boards [(Board)]
    */
    getUserBoards: async ({ userId }) => {
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
        return result.Items ?? [];
    },

    // GET : a single board for user based on userId, and boardId
    /*
        userId (UUID) : reference to who owns the board
        boardId (UUID) : the board to find
        ()-> board (Board) : returns a board object
    */
    getBoard : async ({ userId, boardId }) => {
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

/*
*
*
*
* PUT METHODS 
* 
* 
* 
*/

    // PUT : updates a board based on boardID and userID based on name
    /*
        userId (UUID) : reference to user holding board
        boardID (UUID) : id for the board to be updated
        name (string) : updated name for the board
    */
    updateBoard : async ({ userId, boardId, name }) => {

        const result = await db.send(
            new UpdateCommand({
                TableName: TABLE,
                Key: {
                    PK: keys.user(userId),
                    SK: keys.board(boardId),
                },
                UpdateExpression: "SET #name = :name",
                ExpressionAttributeNames: {
                    "#name" : "name",    
                },
                ExpressionAttributeValues: {
                    ":name" : name,
                },
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

    // DELETE : deletes a board based on boardId
    /*
        userId (UUID) : who owns the board
        boardId (UUID) : board to be deleted
        ()-> success (boolean) : true if deleted
    */
    deleteBoard : async ({ userId, boardId }) => {
        const result = await db.send(
            new DeleteCommand({
                TableName: TABLE,
                Key: {
                    PK: keys.user(userId),
                    SK: keys.board(boardId),
                },
                ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
            })
        );
        return true;
    }
};

module.exports = {
    boardRepo
};