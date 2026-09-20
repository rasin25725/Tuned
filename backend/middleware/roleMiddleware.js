const roleMiddleware = (...allowedRoles) => {
    return (req, res, next) => {
        // Guard: must run after authMiddleware
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                message: "Access denied"
            });
        }

        next();
    };
};

module.exports = roleMiddleware;