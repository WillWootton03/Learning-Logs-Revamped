const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    try {

        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res
                .status(401)
                .json({
                    success: false,
                    error: "No token provided",
                });
        }

        const token = authHeader.split(" ")[1];
        if(!token) {
            return res
                .status(401)
                .json({
                    success: false,
                    error: "Invalid token",
                });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // attach decoded token to request
        req.user = {
            id: decoded.userId,
        };

        next();
    } catch (e) {
        return res
            .status(401)
            .json({
                success: false,
                error: e.message,
            })
    }
}

module.exports = {
    authMiddleware,
}