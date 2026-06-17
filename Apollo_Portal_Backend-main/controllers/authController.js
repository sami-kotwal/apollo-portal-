const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const ALLOWED_REGISTER_ROLES = ["pm", "teamleader_dev", "teamleader_design", "developer", "designer", "expense_manager"];
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const loginAttempts = new Map();

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const defaultAttendance = (attendance = {}) => ({
  enabled: attendance.enabled !== undefined ? Boolean(attendance.enabled) : true,
  startTime: attendance.startTime || "09:00",
  endTime: attendance.endTime || "17:00",
  requiredHours: Number(attendance.requiredHours) || 8,
  graceMinutes: Number(attendance.graceMinutes) || 0,
  allowEarlyWork: attendance.allowEarlyWork !== undefined ? Boolean(attendance.allowEarlyWork) : true,
  allowedBreakMinutes: Number(attendance.allowedBreakMinutes) || 60,
  autoStartOvertime: attendance.autoStartOvertime !== undefined ? Boolean(attendance.autoStartOvertime) : false,
  updatedAt: attendance.updatedAt || null,
});


// 🔐 REGISTER (ADMIN ONLY — for now open)
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, role, department } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Name, email, password, and role are required" });
    }
    if (!ALLOWED_REGISTER_ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role,
      department,
    });

    const safeUser = await User.findById(user._id).select("-password");

    res.status(201).json({
      message: "User created",
      user: safeUser,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// 🔐 LOGIN (ALL USERS)
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const attemptKey = `${req.ip}:${normalizedEmail}`;
    const attempt = loginAttempts.get(attemptKey) || { count: 0, firstAt: Date.now() };
    if (Date.now() - attempt.firstAt > LOGIN_WINDOW_MS) {
      attempt.count = 0;
      attempt.firstAt = Date.now();
    }
    if (attempt.count >= LOGIN_MAX_ATTEMPTS) {
      return res.status(429).json({ message: "Too many login attempts. Please try again later." });
    }

    const user = await User.findOne({
      email: new RegExp(`^${escapeRegex(normalizedEmail)}$`, "i"),
    });

    if (!user) {
      loginAttempts.set(attemptKey, { ...attempt, count: attempt.count + 1 });
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      loginAttempts.set(attemptKey, { ...attempt, count: attempt.count + 1 });
      return res.status(400).json({ message: "Invalid email or password" });
    }

    loginAttempts.delete(attemptKey);

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        tokenVersion: user.tokenVersion || 0,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        customerProfile: user.customerProfile,
        attendance: defaultAttendance(user.attendance),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const payload = user.toObject();
    res.json({
      user: {
        ...payload,
        attendance: defaultAttendance(payload.attendance),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.registerCustomer = async (req, res) => {
  try {
    const { name, email, password, companyName, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "customer",
      customerProfile: {
        companyName: companyName?.trim() || "",
        phone: phone?.trim() || "",
      },
    });

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        tokenVersion: user.tokenVersion || 0,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        customerProfile: user.customerProfile,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    if (!req.body?.email) {
      return res.status(400).json({ message: "Email is required" });
    }

    res.json({
      message: "If this email exists, our support team will send password reset instructions.",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
