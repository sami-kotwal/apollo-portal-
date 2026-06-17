const express = require("express");
const { createActivity, getAdminOverview } = require("../controllers/monitoringController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.post("/", createActivity);
router.get("/admin/overview", getAdminOverview);

module.exports = router;
