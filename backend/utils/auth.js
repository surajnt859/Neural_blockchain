const jwt = require("jsonwebtoken");

function getJwtSecret() {
    const secret = process.env.JWT_SECRET ? process.env.JWT_SECRET.trim() : "";
    if (secret && secret.length >= 32 && !secret.includes("change-me") && !secret.startsWith("replace-with-")) {
        return secret;
    }

    if (process.env.NODE_ENV !== "production") {
        return "local-development-secret-change-before-deploying-2026";
    }

    throw new Error("JWT_SECRET must be configured with at least 32 characters in production.");
}

function signUserToken(user, options = {}) {
    return jwt.sign({
            sub: user.id,
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            walletAddress: user.walletAddress || null,
        },
        getJwtSecret(), { expiresIn: options.expiresIn || "7d", issuer: "neural-model-marketplace", audience: "marketplace-api" }
    );
}

function verifyUserToken(token) {
    return jwt.verify(token, getJwtSecret(), {
        issuer: "neural-model-marketplace",
        audience: "marketplace-api",
    });
}

module.exports = { getJwtSecret, signUserToken, verifyUserToken };