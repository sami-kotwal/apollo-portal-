const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const {
  startSession,
  heartbeatSession,
  endSession,
  createActivity,
  getAdminOverview,
  getAdminRangeSummary,
  getMyMonitoringRange,
  getMyMonitoringSummary,
  validateMonitoringStop,
} = require("../controllers/monitoringController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

const protectKeepalive = async (req, res, next) => {
  try {
    const payload = JSON.parse(req.body || "{}");
    const token = payload.token;
    if (!token) return res.status(401).json({ message: "Not authorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("role tokenVersion");
    if (!user) return res.status(401).json({ message: "User session no longer exists" });

    const decodedVersion = Number(decoded.tokenVersion || 0);
    const currentVersion = Number(user.tokenVersion || 0);
    if (decodedVersion !== currentVersion) {
      return res.status(401).json({ message: "Session expired. Please log in again." });
    }

    delete payload.token;
    req.body = payload;
    req.user = {
      ...decoded,
      id: decoded.id,
      role: user.role,
      tokenVersion: currentVersion,
    };

    next();
  } catch {
    return res.status(401).json({ message: "Token failed" });
  }
};

router.post("/session/:id/heartbeat/keepalive", express.text({ type: "text/plain" }), protectKeepalive, heartbeatSession);

router.use(protect);

router.post("/session/start", startSession);
router.put("/session/:id/heartbeat", heartbeatSession);
router.put("/session/:id/end", endSession);
router.post("/session/stop/validate-pin", validateMonitoringStop);
router.post("/activity", createActivity);
router.get("/me/range", getMyMonitoringRange);
router.get("/me/summary", getMyMonitoringSummary);
router.get("/admin/range", getAdminRangeSummary);
router.get("/admin/overview", getAdminOverview);

module.exports = router;
