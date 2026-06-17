const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const monitor = require("../controllers/monitorAgentController");

const router = express.Router();

router.post("/auth/login", monitor.desktopLogin);

router.use(protect);

router.post("/device/register", monitor.registerDevice);
router.post("/session/start", monitor.startSession);
router.post("/heartbeat", monitor.heartbeat);
router.post("/break/start", monitor.startBreak);
router.post("/break/end", monitor.endBreak);
router.post("/idle/start", monitor.idleStart);
router.post("/idle/end", monitor.idleEnd);
router.post("/session/end", monitor.endSession);
router.post("/overtime/start", monitor.overtimeStart);
router.post("/overtime/end", monitor.overtimeEnd);
router.post("/overtime/confirm", monitor.confirmOvertime);

module.exports = router;
