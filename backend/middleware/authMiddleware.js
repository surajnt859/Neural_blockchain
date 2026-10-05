const { verifyUserToken } = require("../utils/auth");

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // "Bearer <token>"

    if (!token) {
        return res.status(401).json({ error: "Access denied. No token provided." });
    }

    try {
        const decoded = verifyUserToken(token);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: "Invalid or expired token. Please log in again." });
    }
};

const optionalAuth = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (token) {
        try {
            const decoded = verifyUserToken(token);
            req.user = decoded;
        } catch (err) {
            // Ignored for optional auth
        }
    }
    next();
};

module.exports = authMiddleware;
module.exports.optionalAuth = optionalAuth;
module.exports.requireRole = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ error: "You do not have permission to perform this action." });
    }
    next();
};