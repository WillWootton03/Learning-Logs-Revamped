const { GetCommand, PutCommand, QueryCommand, UpdateCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { TransactWriteCommand } = require( "@aws-sdk/lib-dynamodb");
const { db } = require( "../db/db.js");
const { keys } =  require("../db/keys.js");

const TABLE = "LL-AppData";

const userRepo = {

/*
*
*
*
* POST METHODS 
* 
* 
* 
*/

    // POST : creates a new user entry 
    /*
        userId (UUID) : reference to the user
        name (string) : the name for the profile
        email (string) : email to contact the user or sign in
        passwordHash (string) : hashed version of users plaintext password
    */
    createUser: async ({ userId, name, email, passwordHash }) => {
        return await db.send(
            new TransactWriteCommand({
                TransactItems: [
                    {
                        // PUT command for the main user data
                        Put: {
                            TableName: TABLE,
                            Item: {
                                PK: keys.user(userId),
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

/*
*
*
*
* GET METHODS 
* 
* 
* 
*/

    // GET : a user based on userId 
    /* 
        userId (UUID) : reference to the user
    */
    getUserById: async ({ userId }) => {
        return await db.send(
            new GetCommand({
                TableName : TABLE,
                Key: {
                    PK: keys.user(userId),
                    SK: "PROFILE",
                },
            })
        );
        return result.Item ?? null;   
    },

    // GET : a user based on email
    /*
        email (string) : what the users email is
    */
    getUserByEmail : async ({ email }) => {
        const result = await db.send(
            new GetCommand({
                TableName: TABLE,
                Key: {
                    PK: `EMAIL#${email.toLowerCase()}`,
                    SK: "USER",
                },
            })
        );
        return result.Item ?? null;     // returns found userId or null 
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

    // PUT : update some value for the user by userId
    /*
        userId (UUID) : reference to the user

    if no value is given for the following, then no update happens    
        email (string) : updated email for the users account
        name (string) : updated users name
        passwordHash (string) : updated hashed value for the users password
    */
    updateUser : async({ userId, email, name, passwordHash }) => {
        const updates = [];
        const names = {};
        const values = {};

        // checks if email was updated adds to command
        if (email !== undefined) {
            updates.push("#email = :email");
            names["#email"] = "email";
            values[":email"] = email;
        }

        // checks if name was updated adds to command
        if (name !== undefined) {
            updates.push("#name = :name");
            names["#name"] = "name";
            values[":name"] = name;
        }

        // checks if passwordHash was updated adds to command
        if (passwordHash !== undefined) {
            updates.push("#passwordHash = :passwordHash");
            names["#passwordHash"] = "passwordHash";
            values[":passwordHash"] = passwordHash;
        }

        const result = await db.send(
            new UpdateCommand({
                TableName: TABLE,
                Key: {
                    PK: keys.user(userId),
                    SK: "PROFILE",
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

    // DELETE : delete a user from the database based on userId
    /*
        userId (UUID) : reference to the user to delete
    */
    deleteUser: async ({ userId }) => {
        await db.send(
            new DeleteCommand({
                TableName: TABLE,
                Key: {
                    PK: keys.user(userId),
                    SK: "PROFILE"
                },
                ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
            })
        );
        return true;
    },
}

module.exports = { 
    userRepo
};