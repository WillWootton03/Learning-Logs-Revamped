const { createUserController, getUserController, emailLoginController } = require("../controllers/userController.js");
const express = require('express');

const router = express.Router();

router
    .post("/", createUserController)
    .post('/login', emailLoginController)
    .get("/:userId", getUserController);

module.exports = router;