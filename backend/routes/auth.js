const express = require("express");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const User = require("../models/User");
const { signUserToken } = require("../utils/auth");

const router = express.Router();
const USERS_FILE = path.join(__dirname, "../data/users.json");

function readFallbackUsers() {
    try {
        return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
    } catch {
        return [];
    }
}

function toUserRecord(user) {
    if (!user) return null;
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        passwordHash: user.passwordHash || user.password,
        walletAddress: user.walletAddress || null,
        role: user.role || "buyer",
        isSellerVerified: Boolean(user.isSellerVerified),
        createdAt: user.createdAt || new Date(),
    };
}

async function findUserByEmail(email) {
    try {
        const user = await User.findOne({ email });
        if (user) return toUserRecord(user);
    } catch (error) {
        console.warn("Mongo user lookup unavailable; using local user store:", error.message);
    }
    return readFallbackUsers().find((user) => user.email === email) || null;
}

async function saveUser(user) {
    try {
        const document = new User(user);
        await document.save();
        return toUserRecord(document);
    } catch (error) {
        console.warn("Mongo user save unavailable; using local user store:", error.message);
        const users = readFallbackUsers().filter((entry) => entry.email !== user.email);
        users.push({...user, password: user.passwordHash });
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        return toUserRecord(user);
    }
}

const normalizeEmail = (value) => typeof value === "string" ? value.trim().toLowerCase() : "";
const normalizeUsername = (value) => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

// POST /api/auth/register
router.post("/register", async(req, res) => {
    try {
        const rawUsername = normalizeUsername(req.body.username);
        const email = normalizeEmail(req.body.email);
        const password = typeof req.body.password === "string" ? req.body.password.trim() : "";
        const walletAddress = req.body.walletAddress || null;

        if (!rawUsername || !email || !password) {
            return res.status(400).json({ error: "Username, email, and password are required." });
        }

        if (rawUsername.length < 3 || rawUsername.length > 30) {
            return res.status(400).json({ error: "Username must be between 3 and 30 characters." });
        }

        if (!/[a-zA-Z]/.test(rawUsername)) {
            return res.status(400).json({ error: "Username must contain at least one letter." });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: "Please provide a valid email address." });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: "Password must be at least 8 characters long." });
        }

        const existingUser = await findUserByEmail(email);
        if (existingUser) {
            return res.status(409).json({ error: "Email already registered." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            id: Date.now().toString(),
            username: rawUsername,
            email,
            passwordHash: hashedPassword,
            walletAddress: walletAddress || null,
            role: "buyer",
            isSellerVerified: false,
            createdAt: new Date(),
        });

        const savedUser = await saveUser({
            id: newUser.id,
            username: rawUsername,
            email,
            passwordHash: hashedPassword,
            walletAddress: walletAddress || null,
            role: "buyer",
            isSellerVerified: false,
            createdAt: new Date(),
        });

        const token = signUserToken(savedUser);

        res.status(201).json({
            message: "Registration successful!",
            token,
            user: { id: savedUser.id, username: rawUsername, email, walletAddress: savedUser.walletAddress, role: savedUser.role },
        });
    } catch (err) {
        console.error("Registration error:", err.message);
        res.status(500).json({ error: "Server error during registration." });
    }
});

// POST /api/auth/login
router.post("/login", async(req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const password = typeof req.body.password === "string" ? req.body.password.trim() : "";

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required." });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: "Please provide a valid email address." });
        }

        const user = await findUserByEmail(email);
        if (!user) return res.status(401).json({ error: "Invalid credentials." });

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return res.status(401).json({ error: "Invalid credentials." });

        const token = signUserToken(user);

        return res.json({
            message: "Login successful.",
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                walletAddress: user.walletAddress,
                role: user.role,
            },
        });
    } catch (err) {
        console.error("Login error:", err.message);
        return res.status(500).json({ error: "Server error during login." });
    }
});

// POST /api/auth/demo-login — 1-click instant developer / demo access
router.post("/demo-login", async(req, res) => {
    try {
        const demoEmail = "developer@gmail.com";
        let user = await findUserByEmail(demoEmail);

        if (!user) {
            const hashedPassword = await bcrypt.hash("Password123!", 10);
            user = {
                id: `demo-${Date.now()}`,
                username: "DemoDeveloper",
                email: demoEmail,
                passwordHash: hashedPassword,
                walletAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
                role: "creator",
                isSellerVerified: true,
                createdAt: new Date(),
            };
            user = await saveUser(user);
        }

        const token = signUserToken(user, { expiresIn: "30d" });

        res.json({
            message: "Instant developer login successful!",
            token,
            user: { id: user.id, username: user.username, email: user.email, walletAddress: user.walletAddress, role: user.role },
        });
    } catch (err) {
        console.error("Demo login error:", err.message);
        res.status(500).json({ error: "Server error during demo login." });
    }
});

module.exports = router;