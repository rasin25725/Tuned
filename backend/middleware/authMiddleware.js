const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "No token provided"
        });
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
        return res.status(401).json({
            message: "No token provided"
        });
    }

    try {
        // Pin the algorithm so tokens signed any other way are rejected
        const decoded = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: ["HS256"]
        });

        req.user = decoded;

        next();
    } catch (error) {
        return res.status(401).json({
            message:
                error.name === "TokenExpiredError"
                    ? "Token expired"
                    : "Invalid token"
        });
    }
};

module.exports = authMiddleware;