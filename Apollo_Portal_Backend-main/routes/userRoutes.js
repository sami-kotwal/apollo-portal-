const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const MonitoringSession = require("../models/MonitoringSession");
const MonitoringActivity = require("../models/MonitoringActivity");
const MonitoringDailySummary = require("../models/MonitoringDailySummary");
const MonitoringBreak = require("../models/MonitoringBreak");
const Task = require("../models/Task");
const CustomerRequest = require("../models/CustomerRequest");
const { protect } = require("../middleware/authMiddleware");
const {
  getAttendanceStatusForCalendarDay,
  getCalendarDay,
  getDateKeysBetween,
  loadHolidayMap,
} = require("../utils/workCalendar");

const MANAGED_ROLES = ["pm", "teamleader_dev", "teamleader_design", "developer", "designer", "expense_manager"];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }

  next();
};

const getDepartmentForRole = (role) => {
  if (role === "developer" || role === "teamleader_dev") return "development";
  if (role === "designer" || role === "teamleader_design") return "designing";
  return undefined;
};
const VALID_CUSTOMER_PACKAGE_IDS = new Set([
  "informative-basic",
  "informative-startup",
  "informative-professional",
  "ecommerce-startup",
  "ecommerce-professional",
  "ecommerce-business",
  "domain-email",
  "social-basic",
  "social-management",
  "branding-design",
]);
const getCustomerPackageId = (item) => (typeof item === "string" ? item : item?.packageId || item?.id || "");
const cleanCustomerPackages = (packages = []) =>
  Array.isArray(packages)
    ? packages.filter((item) => VALID_CUSTOMER_PACKAGE_IDS.has(getCustomerPackageId(item)))
    : [];

const sanitizeAttendance = (attendance = {}, existingAttendance = {}) => {
  const startTime = TIME_PATTERN.test(attendance.startTime || "") ? attendance.startTime : "09:00";
  const endTime = TIME_PATTERN.test(attendance.endTime || "") ? attendance.endTime : "17:00";
  const requiredHours = Math.min(24, Math.max(0.05, Number(attendance.requiredHours) || 8));
  const graceMinutes = Math.min(240, Math.max(0, Number(attendance.graceMinutes) || 0));
  const previousUpdatedAt = existingAttendance?.updatedAt || attendance.updatedAt || new Date();

  return {
    enabled: attendance.enabled !== undefined ? Boolean(attendance.enabled) : true,
    startTime,
    endTime,
    requiredHours,
    graceMinutes,
    allowEarlyWork: attendance.allowEarlyWork !== undefined ? Boolean(attendance.allowEarlyWork) : true,
    allowedBreakMinutes: Math.min(240, Math.max(0, Number(attendance.allowedBreakMinutes) || 60)),
    autoStartOvertime: attendance.autoStartOvertime !== undefined ? Boolean(attendance.autoStartOvertime) : false,
    updatedAt: previousUpdatedAt,
  };
};

const withAttendanceDefaults = (user) => {
  if (!user) return user;
  const plainUser = typeof user.toObject === "function" ? user.toObject() : user;
  return {
    ...plainUser,
    attendance: sanitizeAttendance(plainUser.attendance || {}, plainUser.attendance || {}),
  };
};

const addDaysToDateKey = (dateKey, days) => {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const getRangeFromQuery = (req) => {
  const today = new Date().toISOString().slice(0, 10);
  let from = DATE_KEY_PATTERN.test(req.query.from || "") ? req.query.from : today;
  let to = DATE_KEY_PATTERN.test(req.query.to || "") ? req.query.to : from;
  let fromTime = new Date(`${from}T00:00:00.000Z`).getTime();
  let toTime = new Date(`${to}T00:00:00.000Z`).getTime();
  if (fromTime > toTime) {
    [from, to] = [to, from];
    [fromTime, toTime] = [toTime, fromTime];
  }
  const rangeDays = Math.floor((toTime - fromTime) / 86400000) + 1;

  return { from, to, fromTime, toTime, rangeDays };
};

const sumDurationByKey = (items, keySelector, valueSelector = (item) => item.durationSeconds || 0) => {
  const totals = new Map();
  items.forEach((item) => {
    const key = keySelector(item) || "Unknown";
    totals.set(key, (totals.get(key) || 0) + (Number(valueSelector(item)) || 0));
  });
  return [...totals.entries()]
    .map(([name, durationSeconds]) => ({ name, durationSeconds }))
    .sort((a, b) => b.durationSeconds - a.durationSeconds);
};

const getBreakDurationSeconds = (item) => {
  if (!item) return 0;
  if (item.endedAt) {
    const storedSeconds = Math.max(0, Number(item.durationSeconds) || 0);
    const clockSeconds = Math.max(0, Math.floor((new Date(item.endedAt).getTime() - new Date(item.startedAt).getTime()) / 1000));
    return Math.max(storedSeconds, clockSeconds);
  }
  return Math.max(0, Math.floor((Date.now() - new Date(item.startedAt).getTime()) / 1000));
};

const sumBreaksByDate = (breaks = []) =>
  breaks.reduce((map, item) => {
    map.set(item.dateKey, (map.get(item.dateKey) || 0) + getBreakDurationSeconds(item));
    return map;
  }, new Map());

const BREAK_ACTIVITY_OR = [
  { title: /break\s*time/i },
  { windowTitle: /break\s*time/i },
  { appName: /break\s*time/i },
  { "raw.eventType": "break_time" },
  { "raw.breakType": { $exists: true } },
];

const sumBreakActivitiesByDate = (activities = []) =>
  activities.reduce((map, item) => {
    map.set(item.dateKey, (map.get(item.dateKey) || 0) + Math.max(0, Number(item.durationSeconds) || 0));
    return map;
  }, new Map());

const userQueryForRole = (role, userId) => {
  if (role === "admin") return { role: { $ne: "customer" } };
  if (role === "pm") return { role: { $nin: ["admin", "expense_manager", "customer"] } };
  if (role === "teamleader_dev") return { role: { $in: ["developer", "teamleader_dev"] } };
  if (role === "teamleader_design") return { role: { $in: ["designer", "teamleader_design"] } };
  return { _id: userId };
};

router.get("/", protect, async (req, res) => {
  const users = await User.find(userQueryForRole(req.user.role, req.user.id)).select("-password").sort({ createdAt: -1 });
  res.json(users.map(withAttendanceDefaults));
});

router.get("/customers", protect, adminOnly, async (req, res) => {
  const [customers, requestStats, customerRequests] = await Promise.all([
    User.find({ role: "customer" })
      .select("name email customerProfile createdAt updatedAt")
      .sort({ createdAt: -1 })
      .lean(),
    CustomerRequest.aggregate([
      {
        $group: {
          _id: "$customer",
          totalRequests: { $sum: 1 },
          openRequests: {
            $sum: {
              $cond: [{ $in: ["$status", ["completed", "closed"]] }, 0, 1],
            },
          },
          latestRequestAt: { $max: "$createdAt" },
        },
      },
    ]),
    CustomerRequest.find({ type: "domain" })
      .select("customer title status details createdAt updatedAt")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
  ]);

  const statsByCustomer = new Map(requestStats.map((item) => [item._id?.toString(), item]));
  const requestsByCustomer = customerRequests.reduce((acc, item) => {
    const key = item.customer?.toString();
    if (!key) return acc;
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key).push(item);
    return acc;
  }, new Map());
  res.json(
    customers.map((customer) => {
      const stats = statsByCustomer.get(customer._id.toString()) || {};
      return {
        ...customer,
        selectedPackages: cleanCustomerPackages(customer.customerProfile?.selectedPackages),
        totalRequests: stats.totalRequests || 0,
        openRequests: stats.openRequests || 0,
        latestRequestAt: stats.latestRequestAt || null,
        domainRequests: requestsByCustomer.get(customer._id.toString()) || [],
      };
    }),
  );
});

router.patch("/customer-requests/:id/domain-available", protect, adminOnly, async (req, res) => {
  const confirmedDomain = String(req.body?.confirmedDomain || "").trim();
  const notes = String(req.body?.notes || "").trim();
  if (!confirmedDomain) {
    return res.status(400).json({ message: "Confirmed domain is required" });
  }

  const request = await CustomerRequest.findOneAndUpdate(
    { _id: req.params.id, type: "domain" },
    {
      $set: {
        status: "domain_available",
        "details.confirmedDomain": confirmedDomain,
        "details.domainAvailabilityNotes": notes,
        "details.domainAvailableAt": new Date(),
      },
    },
    { returnDocument: "after" }
  );

  if (!request) return res.status(404).json({ message: "Domain request not found" });
  res.json(request);
});

router.get("/:id/profile", protect, adminOnly, async (req, res) => {
  try {
    const { from, to, fromTime, toTime, rangeDays } = getRangeFromQuery(req);
    const activityPage = Math.max(1, parseInt(req.query.activityPage || "1", 10) || 1);
    const activityLimit = Math.min(100, Math.max(15, parseInt(req.query.activityLimit || "20", 10) || 20));
    const activitySkip = (activityPage - 1) * activityLimit;
    if (rangeDays < 1 || rangeDays > 93 || Number.isNaN(fromTime) || Number.isNaN(toTime)) {
      return res.status(400).json({ message: "Date range must be between 1 and 93 days" });
    }

    const user = await User.findById(req.params.id).select("-password").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "admin") {
      return res.status(400).json({ message: "Admin profile is not available here" });
    }

    const rangeStart = new Date(`${from}T00:00:00.000Z`);
    const rangeEnd = new Date(`${to}T23:59:59.999Z`);
    const pmTimeOnlyProfile = user.role === "pm";
    const dateKeys = getDateKeysBetween(from, to);
    const activityQuery = { user: user._id, dateKey: { $gte: from, $lte: to } };
    const youtubeActivityQuery = {
      ...activityQuery,
      $or: [
        { type: "youtube" },
        { domain: /youtube\.com/i },
        { domain: /youtu\.be/i },
        { url: /youtube\.com|youtu\.be/i },
        { title: /\byoutube\b/i },
        { windowTitle: /\byoutube\b/i },
        { appName: /\byoutube\b/i },
        { "youtube.videoTitle": { $exists: true, $nin: ["", null] } },
      ],
    };
    const [summaries, activities, activityTotal, youtubeTotals, sessions, breaks, breakActivities, tasks, firstMonitoringSession, holidayMap] = await Promise.all([
      MonitoringDailySummary.find({ userId: user._id, dateKey: { $gte: from, $lte: to } }).sort({ dateKey: 1 }).lean(),
      pmTimeOnlyProfile
        ? Promise.resolve([])
        : MonitoringActivity.find(activityQuery)
            .sort({ startedAt: -1 })
            .skip(activitySkip)
            .limit(activityLimit)
            .lean(),
      pmTimeOnlyProfile ? Promise.resolve(0) : MonitoringActivity.countDocuments(activityQuery),
      pmTimeOnlyProfile
        ? Promise.resolve([])
        : MonitoringActivity.aggregate([
            { $match: youtubeActivityQuery },
            { $group: { _id: null, youtubeSeconds: { $sum: { $ifNull: ["$durationSeconds", 0] } } } },
          ]),
      MonitoringSession.find({ user: user._id, dateKey: { $gte: from, $lte: to } })
        .sort({ loginAt: 1 })
        .select("dateKey loginAt logoutAt lastSeenAt activeSeconds idleSeconds breakSeconds totalSeconds status workMode attendanceStatus lateMinutes stopReason")
        .lean(),
      MonitoringBreak.find({ user: user._id, dateKey: { $gte: from, $lte: to } }).lean(),
      pmTimeOnlyProfile
        ? Promise.resolve([])
        : MonitoringActivity.find({ ...activityQuery, $or: BREAK_ACTIVITY_OR })
            .select("dateKey durationSeconds title windowTitle appName raw")
            .lean(),
      Task.find({
        assignedTo: user._id,
        $or: [
          { createdAt: { $gte: rangeStart, $lte: rangeEnd } },
          { updatedAt: { $gte: rangeStart, $lte: rangeEnd } },
          { completedAt: { $gte: rangeStart, $lte: rangeEnd } },
        ],
      })
        .populate("createdBy assignedBy", "name email role")
        .sort({ createdAt: -1 })
        .lean(),
      MonitoringSession.findOne({ user: user._id })
        .sort({ dateKey: 1, loginAt: 1, createdAt: 1 })
        .select("dateKey")
        .lean(),
      loadHolidayMap(dateKeys),
    ]);

    const summaryByDate = new Map(summaries.map((item) => [item.dateKey, item]));
    const breakSecondsByDate = sumBreaksByDate(breaks);
    const breakActivitySecondsByDate = sumBreakActivitiesByDate(breakActivities);
    const sessionsByDate = sessions.reduce((map, session) => {
      if (!map.has(session.dateKey)) map.set(session.dateKey, []);
      map.get(session.dateKey).push(session);
      return map;
    }, new Map());
    const safeUser = withAttendanceDefaults(user);
    const requiredSeconds = (Number(safeUser.attendance?.requiredHours) || 8) * 3600;
    const monitoringStartKey = firstMonitoringSession?.dateKey || null;
    const days = [];

    for (let index = 0; index < rangeDays; index += 1) {
      const dateKey = addDaysToDateKey(from, index);
      const item = summaryByDate.get(dateKey);
      const daySessions = sessionsByDate.get(dateKey) || [];
      const sessionActiveSeconds = daySessions.reduce((total, session) => total + (Number(session.activeSeconds) || 0), 0);
      const summaryOvertimeSeconds = Number(item?.overtimeSeconds) || 0;
      const fallbackOvertimeSeconds = Math.max(0, sessionActiveSeconds - (Number(item?.requiredWorkSeconds) || requiredSeconds));
      const beforeMonitoringStarted = monitoringStartKey && dateKey < monitoringStartKey;
      const calendarDay = getCalendarDay(dateKey, holidayMap);
      const activeSeconds = item?.activeSeconds || 0;
      const baseAttendanceStatus = item?.attendanceStatus || (beforeMonitoringStarted || !monitoringStartKey ? "not_started" : "absent");
      days.push({
        dateKey,
        activeSeconds,
        idleSeconds: item?.idleSeconds || 0,
        breakSeconds: Math.max(
          Number(item?.breakSeconds) || 0,
          breakSecondsByDate.get(dateKey) || 0,
          breakActivitySecondsByDate.get(dateKey) || 0,
        ),
        offlineSeconds: item?.offlineSeconds || 0,
        outsideShiftSeconds: item?.outsideShiftSeconds || 0,
        totalTrackedSeconds: item?.totalTrackedSeconds || activeSeconds,
        requiredWorkSeconds: item?.requiredWorkSeconds || requiredSeconds,
        overtimeSeconds: summaryOvertimeSeconds || fallbackOvertimeSeconds,
        lateBySeconds: calendarDay.isNonWorkingDay ? 0 : item?.lateBySeconds || 0,
        attendanceStatus: getAttendanceStatusForCalendarDay(baseAttendanceStatus, activeSeconds, calendarDay),
        calendarStatus: calendarDay.status,
        calendarLabel: calendarDay.label,
        workMode: item?.workMode || null,
        firstStartTime: item?.firstStartTime || null,
        lastEndTime: item?.lastEndTime || null,
      });
    }

    const totals = days.reduce(
      (acc, day) => ({
        activeSeconds: acc.activeSeconds + day.activeSeconds,
        idleSeconds: acc.idleSeconds + day.idleSeconds,
        breakSeconds: acc.breakSeconds + day.breakSeconds,
        offlineSeconds: acc.offlineSeconds + day.offlineSeconds,
        outsideShiftSeconds: acc.outsideShiftSeconds + day.outsideShiftSeconds,
        totalTrackedSeconds: acc.totalTrackedSeconds + day.totalTrackedSeconds,
        requiredWorkSeconds: acc.requiredWorkSeconds + day.requiredWorkSeconds,
        overtimeSeconds: acc.overtimeSeconds + day.overtimeSeconds,
        lateBySeconds: acc.lateBySeconds + day.lateBySeconds,
        lateDays: acc.lateDays + (day.attendanceStatus === "late" ? 1 : 0),
        onTimeDays: acc.onTimeDays + (day.attendanceStatus === "on_time" ? 1 : 0),
        absentDays: acc.absentDays + (day.attendanceStatus === "absent" ? 1 : 0),
        presentDays: acc.presentDays + (day.totalTrackedSeconds > 0 ? 1 : 0),
      }),
      { activeSeconds: 0, idleSeconds: 0, breakSeconds: 0, offlineSeconds: 0, outsideShiftSeconds: 0, totalTrackedSeconds: 0, requiredWorkSeconds: 0, overtimeSeconds: 0, lateBySeconds: 0, lateDays: 0, onTimeDays: 0, absentDays: 0, presentDays: 0 },
    );
    totals.youtubeSeconds = youtubeTotals[0]?.youtubeSeconds || 0;

    const completedTasks = tasks.filter((task) => task.status === "completed");
    const taskDurations = completedTasks
      .map((task) => {
        const start = task.assignedAt || task.createdAt;
        if (!start || !task.completedAt) return 0;
        return Math.max(0, Math.floor((new Date(task.completedAt).getTime() - new Date(start).getTime()) / 1000));
      })
      .filter(Boolean);

    res.json({
      user: safeUser,
      range: { from, to, rangeDays },
      monitoring: {
        totals,
        progressPercent: Math.min(100, Math.round((totals.activeSeconds / (totals.requiredWorkSeconds || 1)) * 100)),
        topApps: sumDurationByKey(activities, (activity) => activity.appName || activity.raw?.appName).slice(0, 10),
        topDomains: sumDurationByKey(activities, (activity) => activity.domain || activity.appName || activity.type).slice(0, 10),
        productivity: activities.reduce(
          (acc, activity) => {
            const seconds = Number(activity.durationSeconds) || 0;
            if (activity.productivity === "work") acc.productiveSeconds += seconds;
            else if (activity.productivity === "non_work") acc.unproductiveSeconds += seconds;
            else acc.neutralSeconds += seconds;
            return acc;
          },
          { productiveSeconds: 0, neutralSeconds: 0, unproductiveSeconds: 0 },
        ),
        recentActivities: activities,
        activityPagination: {
          page: activityPage,
          limit: activityLimit,
          total: activityTotal,
          totalPages: Math.max(1, Math.ceil(activityTotal / activityLimit)),
        },
        sessions,
      },
      attendance: { totals, days },
      performance: {
        totalTasks: tasks.length,
        completedTasks: completedTasks.length,
        pendingTasks: tasks.filter((task) => task.status === "pending").length,
        inProgressTasks: tasks.filter((task) => task.status === "in-progress").length,
        completionRate: tasks.length ? Math.round((completedTasks.length / tasks.length) * 100) : 0,
        averageCompletionSeconds: taskDurations.length
          ? Math.round(taskDurations.reduce((total, seconds) => total + seconds, 0) / taskDurations.length)
          : 0,
        tasks: tasks.slice(0, 100),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/", protect, adminOnly, async (req, res) => {
  try {
    const { name, email, password, role, attendance } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Name, email, password, and role are required" });
    }

    if (role === "admin") {
      return res.status(400).json({ message: "Admin users cannot be created from this panel" });
    }
    if (!MANAGED_ROLES.includes(role)) {
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
      department: getDepartmentForRole(role),
      attendance: {
        ...sanitizeAttendance(attendance),
        updatedAt: new Date(),
      },
    });

    const safeUser = await User.findById(user._id).select("-password");
    res.status(201).json(safeUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/:id/attendance/reset", protect, adminOnly, async (req, res) => {
  try {
    const { dateKey } = req.body;
    const resetDateKey = DATE_KEY_PATTERN.test(dateKey || "") ? dateKey : new Date().toISOString().slice(0, 10);
    const user = await User.findById(req.params.id);

    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "admin") {
      return res.status(400).json({ message: "Admin attendance cannot be reset from this panel" });
    }

    const [sessionResult, activityResult, summaryResult] = await Promise.all([
      MonitoringSession.deleteMany({ user: user._id, dateKey: resetDateKey }),
      MonitoringActivity.deleteMany({ user: user._id, dateKey: resetDateKey }),
      MonitoringDailySummary.deleteMany({ userId: user._id, dateKey: resetDateKey }),
    ]);

    user.attendance = {
      ...sanitizeAttendance(user.attendance || {}, user.attendance || {}),
      updatedAt: new Date(),
    };
    await user.save();

    const safeUser = await User.findById(user._id).select("-password");

    res.json({
      message: "Attendance reset.",
      dateKey: resetDateKey,
      deletedSessions: sessionResult.deletedCount || 0,
      deletedActivities: activityResult.deletedCount || 0,
      deletedSummaries: summaryResult.deletedCount || 0,
      user: withAttendanceDefaults(safeUser),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/:id", protect, adminOnly, async (req, res) => {
  try {
    const { name, email, role, password, attendance } = req.body;
    const updates = {};
    const existingUser = await User.findById(req.params.id);

    if (!existingUser) return res.status(404).json({ message: "User not found" });

    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email.trim().toLowerCase();
    if (role !== undefined) {
      if (role === "admin") {
        return res.status(400).json({ message: "Users cannot be promoted to admin from this panel" });
      }
      if (!MANAGED_ROLES.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      updates.role = role;
      updates.department = getDepartmentForRole(role);
    }
    if (attendance !== undefined) {
      const nextAttendance = sanitizeAttendance(attendance, existingUser.attendance || {});
      const attendanceChanged = ["enabled", "startTime", "endTime", "requiredHours", "graceMinutes", "allowEarlyWork", "allowedBreakMinutes", "autoStartOvertime"].some(
        (key) => String(nextAttendance[key]) !== String(existingUser.attendance?.[key])
      );

      updates.attendance = {
        ...nextAttendance,
        updatedAt: attendanceChanged ? new Date() : nextAttendance.updatedAt,
      };
    }
    if (password) updates.password = await bcrypt.hash(password, 10);

    const emailChanged = updates.email !== undefined && updates.email !== existingUser.email;
    const passwordChanged = Boolean(password);
    if (emailChanged || passwordChanged) {
      updates.tokenVersion = Number(existingUser.tokenVersion || 0) + 1;
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      returnDocument: "after",
      runValidators: true,
    }).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Email already exists" });
    }

    res.status(500).json({ message: error.message });
  }
});

router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: "You cannot delete your own admin account" });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.role === "admin") {
      return res.status(400).json({ message: "Admin accounts cannot be deleted" });
    }

    await user.deleteOne();

    res.json({ message: "User deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
