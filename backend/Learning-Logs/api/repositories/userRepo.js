const { GetCommand, PutCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { TransactWriteCommand } = require( "@aws-sdk/lib-dynamodb");
const { db } = require( "../db/db.js");
const { keys } =  require("../db/keys.js");

const TABLE = "LL-AppData";

const userRepo = {
    // CREATE a new User and create an email item using TransactWriteCommand to allow O(1) db lookup by email
    createUser: async ({ userId, name, email, passwordHash }) => {
        return db.send(
            new TransactWriteCommand({
                TransactItems: [
                    {
                        // PUT command for the main user data
                        Put: {
                            TableName: TABLE,
                            Item: {
                                PK: `USER#${userId}`,
                                SK: "PROFILE",
                                email,
                                name,
                                passwordHash,
                                createdAt: Date.now(),
                            },
                            ConditionExpression: "attribute_not_exists(PK)",
                        },
                    },
                    {
                        // PUT command for the quick email lookup item
                        Put: {
                            TableName: TABLE,
                            Item : {
                                PK: `EMAIL#${email.toLowerCase()}`,
                                SK: "USER",
                                userId,
                            },
                            ConditionExpression: "attribute_not_exists(PK)",
                        },
                    },
                ],
            })
        );
    },

    // READ : a user based on userId 
    // RETURN : user item or null
    getUserById: async ( userId ) => {
        return db.send(
            new GetCommand({
                TableName : TABLE,
                Key: {
                    PK: `USER#${userId}`,
                    SK: "PROFILE",
                },
            })
        );
        return result.Item ?? null;   
    },

    // READ : a user based on email
    // RETURN : userId or null
    getUserByEmail : async (email) => {
        const result = await db.send(
            new GetCommand({
                TableName: TABLE,
                Key: {
                    PK: `EMAIL#${email}`,
                    SK: "USER",
                },
            })
        );
        return result.Item ?? null;     // returns found userId or null 
    },
}

module.exports = { 
    userRepo
};