const mongoose = require("mongoose");

mongoose.set("bufferCommands", false);

let isConnected = false;

const connectDB = async() => {
    if (isConnected) {
        console.log("✅ Using existing MongoDB connection");
        return;
    }

    try {
        const mongoUri = process.env.MONGODB_URI;

        if (!mongoUri || mongoUri.includes("<db_username>") || mongoUri.includes("<db_password>")) {
            console.warn("⚠️ MongoDB URI not configured or contains placeholder. Running in resilient local fallback mode.");
            return;
        }

        console.log("🔗 Connecting to MongoDB Atlas...");
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });

        isConnected = true;
        console.log("✅ MongoDB Atlas connected successfully");
        return mongoose.connection;
    } catch (error) {
        console.warn("⚠️ MongoDB connection notice:", error.message, "- running in fallback persistence mode.");
    }
};

const disconnectDB = async() => {
    if (isConnected) {
        await mongoose.disconnect();
        isConnected = false;
        console.log("✅ MongoDB disconnected");
    }
};

module.exports = { connectDB, disconnectDB };