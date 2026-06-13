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
            .status(401)
            .json({
                success: false,
                error: e.message
            });
    }
};

const getUserController = async (req, res) => {
    try {
        const result = await userService.getUser(req.params.userId);

        res
            .status(201)
            .json({
                sucess: true,
                data: result,
            });
    } catch (e) {
        res
            .status(401)
            .json({
                sucess: false,
                error: e.message
            });
    }
};

const emailLoginController = async (req, res) => {
    try {
        const result = await userService.emailLogin(req.body);

        res
            .status(201)
            .json({
                success: true,
                data: result,
            });
    } catch (e) {
        res
            .status(401)
            .json({
                success: false,
                error: e.message,
            });
    }
};

module.exports = {
    createUserController,
    getUserController,
    emailLoginController,
}