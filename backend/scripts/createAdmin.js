require("dotenv").config();
const bcrypt = require("bcryptjs");
const { connectDB } = require("../config/db");
const User = require("../models/User");

async function createAdmin() {
    const email = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.trim().toLowerCase() : "";
    const password = process.env.ADMIN_PASSWORD;
    const username = process.env.ADMIN_USERNAME ? process.env.ADMIN_USERNAME.trim() : "Marketplace Admin";

    if (!email || !password || password.length < 16) {
        throw new Error("Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 16 characters.");
    }

    await connectDB();
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.findOneAndUpdate({ email }, {
        $set: { username, passwordHash, role: "admin", updatedAt: new Date() },
        $setOnInsert: { id: `admin-${Date.now()}`, email, createdAt: new Date() },
    }, { upsert: true, new: true, runValidators: true });

    console.log(`Admin account ready: ${user.email}`);
    process.exit(0);
}

createAdmin().catch((err) => {
    console.error(`Could not create admin: ${err.message}`);
    process.exit(1);
});