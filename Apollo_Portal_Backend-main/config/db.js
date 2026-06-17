const mongoose = require("mongoose");
const dns = require("dns");

const connectDB = async () => {
  const mongoUri = (process.env.MONGO_URI || process.env.MONGODB_URI || "").trim();

  if (!mongoUri) {
    throw new Error("MONGO_URI is missing. Add it to Apollo_Portal_Backend-main/.env before starting the server.");
  }

  const dnsServers = (process.env.MONGO_DNS_SERVERS || "")
    .split(",")
    .map((server) => server.trim())
    .filter(Boolean);

  if (dnsServers.length > 0 && mongoUri.startsWith("mongodb+srv://")) {
    dns.setServers(dnsServers);
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    const dnsHint =
      error.code === "ENOTFOUND" || error.message.includes("ENOTFOUND")
        ? " Check your internet/DNS and confirm the MongoDB Atlas cluster connection string is current."
        : "";

    throw new Error(`MongoDB connection failed: ${error.message}.${dnsHint}`);
  }
};

module.exports = connectDB;
