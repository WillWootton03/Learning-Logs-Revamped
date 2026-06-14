const { userService } = require("../services/userService.js");

const userController = {

/*
*
*
*
* POST METHODS 
* 
* 
* 
*/

    createUser: async (req, res) => {
        try {
            const { email, name, password } = req.body;
            const result = await userService.createUser(email, name, password);

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

    getUserById: async (req, res) => {
        try {
            const userId = req.params.userId;
            const result = await userService.getUserByEmail({ userId });

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
    },

    // DEBUG TESTING ONLY
    getUserByEmail: async (req, res) => {
        try {
            const email = req.params.email;
            const result = await userService.getUserByEmail({ email });

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
    },

    emailLogin: async (req, res) => {
        try {
            const { email, password} = req.body;
            const result = await userService.emailLogin({ email, password });

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

/*
*
*
*
* DELETE METHODS 
* 
* 
* 
*/

}

module.exports = {
    userController,
}