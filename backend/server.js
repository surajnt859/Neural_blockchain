const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const { connectDB } = require("./config/db");
const authRoutes = require("./routes/auth");
const modelsRoutes = require("./routes/models");
const ipfsRoutes = require("./routes/ipfs");
const governanceRoutes = require("./routes/governance");
const leaderboardRoutes = require("./routes/leaderboard");
const dashboardRoutes = require("./routes/dashboard");
const apiGatewayRoutes = require("./routes/apiGateway");
const bountiesRoutes = require("./routes/bounties");
const adminRoutes = require("./routes/admin");

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:4173",
    ...(process.env.ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean),
];

const sanitizeInput = (value) => {
    if (Array.isArray(value)) return value.map((entry) => sanitizeInput(entry));
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).map(([key, entry]) => [key, sanitizeInput(entry)])
        );
    }
    if (typeof value === "string") return value.trim();
    return value;
};

app.set("trust proxy", 1);
app.use(helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
}));
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please slow down and try again later." },
}));
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use((req, res, next) => {
    if (req.body && typeof req.body === "object") {
        req.body = sanitizeInput(req.body);
    }
    next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/models", modelsRoutes);
app.use("/api/ipfs", ipfsRoutes);
app.use("/api/governance", governanceRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/bounties", bountiesRoutes);
app.use("/api/v1", apiGatewayRoutes);
app.use("/api/admin", adminRoutes);

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        status: "OK",
        message: "AI Model Marketplace API is running 🚀",
        timestamp: new Date().toISOString(),
    });
});

const path = require("path");
const fs = require("fs");

// Serve built frontend in production (All-in-One single service deployment)
const frontendDistPath = path.join(__dirname, "../frontend/dist");
if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));
    app.get("*", (req, res, next) => {
        if (req.path.startsWith("/api/")) {
            return next();
        }
        res.sendFile(path.join(frontendDistPath, "index.html"));
    });
}

// 404 handler for API routes
app.use((req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Error handler
app.use((err, req, res, next) => {
    console.error("Server Error:", err.message);

    if (err.message === "Not allowed by CORS") {
        return res.status(403).json({ error: "Origin not allowed." });
    }

    res.status(500).json({ error: "Internal server error" });
});

// Start server with MongoDB connection
connectDB().then(() => {
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`🚀 Backend running at http://0.0.0.0:${PORT}`);
        console.log(`📋 Health check: http://0.0.0.0:${PORT}/api/health`);
    });
}).catch((error) => {
    console.error("Failed to start server:", error.message);
    process.exit(1);
});