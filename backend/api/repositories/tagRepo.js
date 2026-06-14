const { QueryCommand, PutCommand, GetCommand, UpdateCommand, DeleteCommand} = require('@aws-sdk/lib-dynamodb');

const { db } =  require("../db/db.js");
const { keys } =  require("../db/keys.js");

const TABLE = 'LL-AppData';

const deleteConditionExists = "attribute_exists(PK) AND attribute_exists(SK)";

const tagRepo = {

/*
*
*
*
* POST METHODS 
* 
* 
* 
*/

    // CREATE : add a new tag to a board
    /* 
        boardId (UUID) : the board where the tag will live
        tagId (UUID) : reference to the created tag
        title (string) : identifier for the tag EX. Hard, Easy, Word, Greek History, German History, etc.
    */
    createTag: async ({ boardId, tagId, title }) => {
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
        return tagId;
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

    // GET : get a tag based on tagId
    /*
        boardId (UUID) : where the tag lives
        tagId (UUID) : actual tag

        ()-> tag (Tag) : returns a single tag item or null
    */
    getSingleTag : async ({ boardId, tagId }) => {
        const result = await db.send(
            new GetCommand({
                TableName: TABLE,
                Key: {
                    PK: keys.board(boardId),
                    SK: keys.tag(tagId),
                },
            })
        );
        return result.Item ?? null;
    },

    // GET : get all tags for a board
    /*
        boardId (UUID) : board to get all tags for

        ()-> tags [(Tag)] : returns a list of all tag objects in a board
    */
    getAllTags: async ({ boardId }) => {
        const result = await db.send(
            new QueryCommand({
                TableName: TABLE,
                KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
                ExpressionAttributeValues: {
                    ":pk" : keys.board(boardId),
                    ":sk" : "TAG#"
                }
            })
        );
        return result.Items ?? [];
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

    // UPDATE : update a tag 
    /*
        boardId (UUID) : where the tag lives
        tagId (UUID) : reference to the tag
        title (string) : definition of tag
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
        return result.Attributes ?? null;
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

    // DELETE : delete a tag given tagId
    /*
        boardId (UUID) : where the tag lives
        tagId (UUID) : reference to the specific tag
    */
    deleteTag: async ({ boardId, tagId }) => {
        try {
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
        } catch (e) {
            if (e.name === "ConditionalCheckFailedException") {
                return null;
                }
            throw e;
        }
    }
}

module.exports = {
    tagRepo,
}