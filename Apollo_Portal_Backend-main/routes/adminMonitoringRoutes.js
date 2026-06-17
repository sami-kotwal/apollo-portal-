const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const monitor = require("../controllers/monitorAgentController");

const router = express.Router();

router.use(protect);
router.use(monitor.requireAdmin);

router.get("/monitoring/live", monitor.getLiveMonitoring);
router.get("/monitoring/daily", monitor.getDailyMonitoring);
router.get("/monitoring/user/:userId", monitor.getUserMonitoring);
router.get("/attendance", monitor.getAttendance);
router.get("/productivity-summary", monitor.getProductivitySummary);

module.exports = router;
