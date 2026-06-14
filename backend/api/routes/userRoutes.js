const { createUserController, getUserByIdController, getUserByEmailController, emailLoginController } = require("../controllers/userController.js");
const express = require('express');

const router = express.Router();

router
    .post("/", createUserController)
    .post('/login', emailLoginController)
    .get("/:userId", getUserByIdController)
    .get("/", getUserByEmailController);

module.exports = router;