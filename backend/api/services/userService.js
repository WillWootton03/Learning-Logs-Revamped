const { userRepo } = require("../repositories/userRepo.js");

const argon2 = require("argon2");
const crypto = require("crypto");


const userService = {
    // CREATE : a new user based on email, name, and plaintext password and generate a UUID for userId, and passwordHash + salt for password
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
    
    // READ a user based on id
    getUser : async (userId) => {
        return userRepo.getUser({
            userId
        });
    },

    // Login a user by email and verify hashed password
    emailLogin : async ({ email, password }) => {
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
            user.passwordHash,
            password
        );

        // password incorrect
        if(!valid) {
            throw new Error("Invalid Login Credentials");
        }

        // destructure user and remove passwordHash from what is returned
        const { passwordHash, ...safeUser } = user;

        return safeUser;
    }
}

module.exports = {
    userService
};