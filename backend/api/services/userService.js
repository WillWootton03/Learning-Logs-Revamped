const { userRepo } = require("../repositories/userRepo.js");
const  jwt  = require('jsonwebtoken');

const argon2 = require("argon2");
const crypto = require("crypto");
const { lookupService } = require("dns");


const userService = {

/*
*
*
*
* POST METHODS 
* 
* 
* 
*/

    // POST : a new user based on email, name, and plaintext password and generate a UUID for userId, and passwordHash + salt for password
    /*
        email (string) : the email to contact or sign in with for user
        name (string) : profile identifier by name
        password (string) : plaintext password must be hashed before being sent anywhere

    ()-> data (metadata) : returns metadata for the request
    */
    createUser : async ({ email, name, password }) => {
        const userId = crypto.randomUUID();     // random UUID for userId
        const passwordHash = await argon2.hash(password);   // hashes password, and has built in salting 

        return userRepo.createUser({
            userId,
            name,
            email,
            passwordHash,
        });
    },

    
    // POST : login a user by email and verify hashed password
    /*
        email (string) : the email for a specific user
        password (string) : plaintext password to check against stored users hashedPassword

        ()-> userId (UUID) : the id for the user after being signed in
        ()-> token (Token) : a JWT token for validation valid for 7 days
    */
    emailLogin : async ( email, password ) => {

        // get userId from email
        const lookup = await userRepo.getUserByEmail(email);

        // verify if user with that email in DB
        if (!lookup) {
            throw new Error("Invalid Login Credentials");
        }
        
        // if userId found get user
        const user = await userRepo.getUserById(lookup.userId);

        // verify user found
        if(!user){
            throw new Error("User not found");
        }
        // verify password matches hashed password in user
        const valid = await argon2.verify(
            user.Item.passwordHash,
            password
        );

        // password incorrect
        if(!valid) {
            throw new Error("Invalid Login Credentials");
        }

        const token = jwt.sign(
            {
                userId: lookup.userId,
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d",
            }
        );

        return {
            userId: lookup.userId,
            token
        };
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
    
    // GET : a user based on id
    /*
        userId (UUID) : the reference to the user

        ()-> user (record) : returns the object for a user
    */
    getUserById : async (userId) => {
        return userRepo.getUser({
            userId
        });
    },

    // GET : return a user based on email
    /*
        email (string) : the email to find the user with

        ()-> userId (UUID) : returns the data for a userId
    */
    getUserByEmail: async (email) => {
        return userRepo.getUserByEmail(email);
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

    // PUT : update a user based on parameters
    /*
        userId (UUID) : reference to the user

    if no value is given for the following, then no update happens    
        email (string) : updated email for the users account
        name (string) : updated users name
        passwordHash (string) : updated hashed value for the users password

    ()-> user (Record) : returns the updated user
    */
    updateUser: async ({ userId, email, name, plaintextPassword}) => {

        // create new hashed password if in params
        if (plaintextPassword !== undefined){
            const passwordHash = await argon2.hash(plaintextPassword);
        }

        return userRepo.updateUser(
            userId,
            email,
            name,
            passwordHash ?? undefined,      // needs verification in case no plaintextPassword is not given
        );
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

        ()-> success (bool) : returns true if user record deleted
    */
    deleteUser: async ({ userId }) => {
        return userRepo.deleteUser(
            userId,
        );
    },

}

module.exports = {
    userService
};