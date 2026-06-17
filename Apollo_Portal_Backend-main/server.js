const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const taskRoutes = require("./routes/taskRoutes");
const userRoutes = require("./routes/userRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const monitoringRoutes = require("./routes/monitoringRoutes");
const monitorAgentRoutes = require("./routes/monitorAgentRoutes");
const adminMonitoringRoutes = require("./routes/adminMonitoringRoutes");
const activityRoutes = require("./routes/activityRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const customerRoutes = require("./routes/customerRoutes");
const workCalendarRoutes = require("./routes/workCalendarRoutes");
const User = require("./models/User");
const { initSocket } = require("./utils/socket");

dotenv.config({ path: path.resolve(__dirname, ".env"), quiet: true });

const app = express();

const allowedOrigins = (process.env.CLIENT_URL || process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .map((origin) => origin.replace(/\/+$/, ""))
  .filter(Boolean);
const allowLocalOrigins = process.env.ALLOW_LOCAL_ORIGINS === "true" || process.env.NODE_ENV !== "production";
const isLocalOrigin = (origin = "") => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
const isExtensionOrigin = (origin = "") => /^chrome-extension:\/\//.test(origin);
const corsOriginAllowed = (origin = "") => !origin || allowedOrigins.includes(origin) || (allowLocalOrigins && isLocalOrigin(origin));
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (corsOriginAllowed(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  },
});

initSocket(io);

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Socket authentication required"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("role tokenVersion");
    if (!user) return next(new Error("Socket user not found"));
    if (Number(decoded.tokenVersion || 0) !== Number(user.tokenVersion || 0)) {
      return next(new Error("Socket session expired"));
    }

    socket.user = { id: decoded.id, role: user.role };
    return next();
  } catch (error) {
    return next(new Error("Socket authentication failed"));
  }
});

io.on("connection", (socket) => {
  socket.join(`user:${socket.user.id}`);

  socket.on("admin:join-monitoring", () => {
    if (socket.user.role !== "admin") return;
    socket.join("admin-monitoring");
  });
});

app.use(cors({
  origin: (origin, callback) => {
    if (corsOriginAllowed(origin)) {
      return callback(null, true);
    }

    if (!isExtensionOrigin(origin)) {
      console.warn(`Blocked by CORS. Origin: ${origin}. Allowed: ${allowedOrigins.join(", ")}`);
    }
    return callback(null, false);
  },
  credentials: true,
}));

app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.use((req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: "Database is not connected. Please try again shortly." });
  }

  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/monitoring", monitoringRoutes);
app.use("/api/monitor", monitorAgentRoutes);
app.use("/api/admin", adminMonitoringRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/work-calendar", workCalendarRoutes);

app.get("/", (req, res) => {
  res.send("API is running...");
});

const PORT = process.env.PORT || 5000;

app.use((error, req, res, next) => {
  console.error(`Request failed: ${error.message}`);
  res.status(500).json({ message: "Server error" });
});

const startServer = async () => {
  try {
    await connectDB();

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
};

startServer();
