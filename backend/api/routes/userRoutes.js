const { authMiddleware } = require("../../middleware/authMiddleware.js");
const { userController } = require("../controllers/userController.js");
const express = require('express');

const router = express.Router();

router
    .post("/", userController.createUser)                   // Create a user
    .post('/login', userController.emailLogin)              // login the user using email and password
    .get("/:userId", userController.getUserById)            // return user from userID
    .get("/:email", userController.getUserByEmail)         // DEBUG return userId based on email
    ;

module.exports = router;