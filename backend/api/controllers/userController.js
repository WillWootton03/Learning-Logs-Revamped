const { userService } = require("../services/userService.js");

const createUserController = async (req, res) => {
    
    try {
        const result = await userService.createUser(req.body);

        res
            .status(201)
            .json({
                success: true,
                data: result,
            });
    } catch (e) {
        res 
            .status(400)
            .json({
                success: false,
                error: e.message
            });
    }
};

const getUserByIdController = async (req, res) => {
    try {
        const result = await userService.getUserByEmail(req.params.userId);

        res
            .status(200)
            .json({
                sucess: true,
                data: result,
            });
    } catch (e) {
        res
            .status(400)
            .json({
                sucess: false,
                error: e.message
            });
    }
};

// DEBUG TESTING ONLY
const getUserByEmailController = async (req, res) => {
    try {

        const result = await userService.getUserByEmail(req.query.email);

        res
            .status(200)
            .json({
                success: true,
                data: result,
            });
    } catch (e) {
        res
            .status(400)
            .json({
                sucess:false,
                error: e.message,
            });
    }
};

const emailLoginController = async (req, res) => {
    const { email, password} = req.body;

    try {
        const result = await userService.emailLogin(email, password);

        res
            .status(200)
            .json({
                success: true,
                data: result,
            });
    } catch (e) {
        res
            .status(400)
            .json({
                success: false,
                error: e.message,
            });
    }
};

module.exports = {
    createUserController,
    getUserByIdController,
    emailLoginController,
    getUserByEmailController,
}