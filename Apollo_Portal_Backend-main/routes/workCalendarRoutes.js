const express = require("express");
const WorkCalendarHoliday = require("../models/WorkCalendarHoliday");
const { protect } = require("../middleware/authMiddleware");
const { getDateKeysBetween, getCalendarDay, loadHolidayMap } = require("../utils/workCalendar");

const router = express.Router();
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

router.use(protect, adminOnly);

router.get("/", async (req, res) => {
  try {
    const from = req.query.from || new Date().toISOString().slice(0, 10);
    const to = req.query.to || from;
    if (!DATE_KEY_PATTERN.test(from) || !DATE_KEY_PATTERN.test(to) || from > to) {
      return res.status(400).json({ message: "Invalid date range" });
    }

    const dateKeys = getDateKeysBetween(from, to);
    const holidayMap = await loadHolidayMap(dateKeys);
    const days = dateKeys.map((dateKey) => ({
      dateKey,
      ...getCalendarDay(dateKey, holidayMap),
    }));

    res.json({
      weeklyOffDays: ["Saturday", "Sunday"],
      holidays: [...holidayMap.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey)),
      days,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/holidays", async (req, res) => {
  try {
    const dateKey = String(req.body.dateKey || "").trim();
    const name = String(req.body.name || "").trim();

    if (!DATE_KEY_PATTERN.test(dateKey)) {
      return res.status(400).json({ message: "Valid holiday date is required" });
    }
    if (!name) {
      return res.status(400).json({ message: "Holiday name is required" });
    }

    const holiday = await WorkCalendarHoliday.findOneAndUpdate(
      { dateKey },
      {
        $set: {
          name,
          appliesTo: "all",
          updatedBy: req.user.id,
        },
        $setOnInsert: {
          createdBy: req.user.id,
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    res.status(201).json(holiday);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete("/holidays/:dateKey", async (req, res) => {
  try {
    const dateKey = String(req.params.dateKey || "").trim();
    if (!DATE_KEY_PATTERN.test(dateKey)) {
      return res.status(400).json({ message: "Valid holiday date is required" });
    }

    await WorkCalendarHoliday.deleteOne({ dateKey });
    res.json({ message: "Holiday removed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
