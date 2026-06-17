const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const os = require("os");
const User = require("../models/User");
const MonitoringSession = require("../models/MonitoringSession");
const MonitoringActivity = require("../models/MonitoringActivity");
const MonitorDevice = require("../models/MonitorDevice");
const MonitorHeartbeat = require("../models/MonitorHeartbeat");
const MonitorLiveStatus = require("../models/MonitorLiveStatus");
const MonitoringBreak = require("../models/MonitoringBreak");
const MonitoringDailySummary = require("../models/MonitoringDailySummary");
const ProductivityRule = require("../models/ProductivityRule");
const { emitMonitoringEvent } = require("../utils/socket");
const {
  getAttendanceStatusForCalendarDay,
  getCalendarDay,
  isWeeklyOffDateKey,
  loadHolidayMap,
} = require("../utils/workCalendar");

const ATTENDANCE_TIME_ZONE = "Asia/Karachi";
const HEARTBEAT_STALE_MS = 90 * 1000;
const MIDNIGHT_SHIFT_ROLLOVER_MINUTES = 6 * 60;
const PRODUCTIVITY_MAP = {
  productive: "work",
  neutral: "neutral",
  unproductive: "non_work",
  unknown: "neutral",
};

const DEFAULT_PRODUCTIVITY_RULES = [
  { type: "app", value: "code.exe", category: "productive" },
  { type: "app", value: "figma.exe", category: "productive" },
  { type: "app", value: "slack.exe", category: "productive" },
  { type: "app", value: "teams.exe", category: "productive" },
  { type: "domain", value: "github.com", category: "productive" },
  { type: "domain", value: "gitlab.com", category: "productive" },
  { type: "domain", value: "stackoverflow.com", category: "productive" },
  { type: "domain", value: "figma.com", category: "productive" },
  { type: "domain", value: "wordpress.org", category: "productive" },
  { type: "domain", value: "youtube.com", category: "neutral" },
  { type: "domain", value: "facebook.com", category: "unproductive" },
  { type: "domain", value: "instagram.com", category: "unproductive" },
  { type: "domain", value: "tiktok.com", category: "unproductive" },
  { type: "domain", value: "netflix.com", category: "unproductive" },
  { type: "domain", value: "hostinger.com", category: "productive" },
  { type: "domain", value: "chatgpt.com", category: "neutral" },

];

let seededRules = false;

const escapeRegex = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ATTENDANCE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
};

const addDaysToDateKey = (dateKey, days) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
};

const parseTimeToMinutes = (time = "09:00") => {
  const [hours = "9", minutes = "0"] = String(time).split(":");
  return Number(hours) * 60 + Number(minutes);
};

const getTimeZoneMinutes = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ATTENDANCE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  return hour * 60 + minute;
};

const getShiftDateKey = (user, date = new Date()) => {
  const calendarDateKey = getDateKey(date);
  const start = parseTimeToMinutes(user?.attendance?.startTime || "09:00");
  const end = parseTimeToMinutes(user?.attendance?.endTime || "17:00");
  const nowMinutes = getTimeZoneMinutes(date);

  if (end <= start && nowMinutes < Math.max(end, MIDNIGHT_SHIFT_ROLLOVER_MINUTES)) {
    return addDaysToDateKey(calendarDateKey, -1);
  }

  return calendarDateKey;
};

const zonedDateTime = (dateKey, time = "09:00") => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const minutes = parseTimeToMinutes(time);
  return new Date(
    Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60) -
      5 * 60 * 60 * 1000,
  );
};

const normalizeSeconds = (value) =>
  Math.min(12 * 60 * 60, Math.max(0, Math.floor(Number(value) || 0)));
const clampHeartbeatDeltas = (session, now, activeDeltaSeconds, idleDeltaSeconds, offlineDeltaSeconds) => {
  const lastSeenAt = session?.lastSeenAt ? new Date(session.lastSeenAt).getTime() : 0;
  const nowTime = now.getTime();
  if (!lastSeenAt || nowTime <= lastSeenAt) {
    return { activeDeltaSeconds: 0, idleDeltaSeconds: 0, offlineDeltaSeconds: 0 };
  }

  const maxDeltaSeconds = Math.max(0, Math.min(12 * 60 * 60, Math.ceil((nowTime - lastSeenAt) / 1000) + 2));
  const totalDeltaSeconds = activeDeltaSeconds + idleDeltaSeconds + offlineDeltaSeconds;
  if (totalDeltaSeconds <= maxDeltaSeconds) {
    return { activeDeltaSeconds, idleDeltaSeconds, offlineDeltaSeconds };
  }

  if (totalDeltaSeconds <= 0) {
    return { activeDeltaSeconds: 0, idleDeltaSeconds: 0, offlineDeltaSeconds: 0 };
  }

  const scale = maxDeltaSeconds / totalDeltaSeconds;
  return {
    activeDeltaSeconds: Math.floor(activeDeltaSeconds * scale),
    idleDeltaSeconds: Math.floor(idleDeltaSeconds * scale),
    offlineDeltaSeconds: Math.floor(offlineDeltaSeconds * scale),
  };
};
const normalizeText = (value = "") => String(value || "").trim();
const getAttendanceVersion = (user) =>
  user?.attendance?.updatedAt
    ? new Date(user.attendance.updatedAt).toISOString()
    : "";
const getSessionsForCurrentAttendance = (user, sessions = []) => {
  const attendanceVersion = getAttendanceVersion(user);
  if (!attendanceVersion) return sessions;
  const matchingSessions = sessions.filter(
    (session) =>
      session.attendanceUpdatedAt &&
      new Date(session.attendanceUpdatedAt).toISOString() === attendanceVersion,
  );
  return matchingSessions.length ? matchingSessions : sessions;
};

const createToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      role: user.role,
      tokenVersion: user.tokenVersion || 0,
      source: "desktop_monitor",
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.MONITOR_AGENT_TOKEN_TTL || "30d" },
  );

const machineHash = (payload = "") =>
  crypto.createHash("sha256").update(payload).digest("hex").slice(0, 32);

const buildDevicePayload = (req, userId) => {
  const deviceId = normalizeText(req.body.deviceId) || crypto.randomUUID();
  const deviceName =
    normalizeText(req.body.deviceName) ||
    normalizeText(req.body.hostName) ||
    os.hostname() ||
    "Employee device";
  const osName =
    normalizeText(req.body.os) || normalizeText(req.body.platform) || "Windows";
  const machineIdentifier =
    normalizeText(req.body.machineIdentifier) ||
    machineHash(`${deviceName}:${osName}:${userId}`);

  return { userId, deviceId, deviceName, os: osName, machineIdentifier };
};

const ensureDefaultRules = async () => {
  if (seededRules) return;
  seededRules = true;
  await Promise.all(
    DEFAULT_PRODUCTIVITY_RULES.map((rule) =>
      ProductivityRule.updateOne(
        { type: rule.type, value: rule.value },
        { $setOnInsert: rule },
        { upsert: true },
      ),
    ),
  );
};

const getProductivity = async ({ appName = "", domain = "", type = "" }) => {
  await ensureDefaultRules();
  const app = appName.toLowerCase();
  const host = domain.toLowerCase().replace(/^www\./, "");
  const rules = await ProductivityRule.find({}).lean();
  const match = rules.find((rule) => {
    if (rule.type === "app")
      return app === rule.value || app.includes(rule.value);
    return (
      host === rule.value ||
      host.endsWith(`.${rule.value}`) ||
      host.includes(rule.value)
    );
  });
  if (match) return PRODUCTIVITY_MAP[match.category] || "neutral";
  if (type === "youtube") return "neutral";
  return "neutral";
};

const getSessionEndAt = (session, fallback = new Date()) => {
  if (!session) return fallback;
  if (session.status === "offline" && (session.logoutAt || session.stoppedAt)) {
    return new Date(session.logoutAt || session.stoppedAt);
  }
  return new Date(session.lastSeenAt || fallback);
};

const getAttendanceArrivalAt = (sessions = [], shiftStartAt, fallback = new Date()) => {
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.loginAt || a.createdAt || 0) - new Date(b.loginAt || b.createdAt || 0),
  );
  const overlappingPreShiftSession = sorted.find((session) => {
    const startedAt = new Date(session.loginAt || session.createdAt || 0);
    const endedAt = getSessionEndAt(session, fallback);
    return startedAt.getTime() < shiftStartAt.getTime() && endedAt.getTime() >= shiftStartAt.getTime();
  });
  if (overlappingPreShiftSession) return shiftStartAt;

  const directArrival = sorted.find((session) => {
    const startedAt = new Date(session.loginAt || session.createdAt || 0);
    return startedAt.getTime() >= shiftStartAt.getTime();
  });

  return directArrival ? directArrival.loginAt || directArrival.createdAt : null;
};

const getShiftMetrics = (user, dateKey, actualStartTime, totalSeconds = 0, attendanceArrivalAtOverride = null) => {
  const attendance = user.attendance || {};
  const shiftStart = attendance.startTime || "09:00";
  const shiftEnd = attendance.endTime || "17:00";
  const requiredSeconds = (Number(attendance.requiredHours) || 8) * 3600;
  const graceSeconds = (Number(attendance.graceMinutes) || 0) * 60;
  const { shiftStartAt, shiftEndAt } = getShiftBounds(
    user,
    dateKey,
    actualStartTime ? new Date(actualStartTime) : new Date(),
  );

  const startedAt = actualStartTime ? new Date(actualStartTime) : null;
  const attendanceArrivalAt =
    attendanceArrivalAtOverride ||
    (startedAt && startedAt.getTime() >= shiftStartAt.getTime()
      ? startedAt
      : null);
  const lateBySeconds = startedAt
    ? Math.max(
        0,
        Math.floor(((attendanceArrivalAt || shiftStartAt).getTime() - shiftStartAt.getTime()) / 1000) -
          graceSeconds,
      )
    : 0;
  const shiftEnded = Date.now() >= shiftEndAt.getTime();
  const overtimeSeconds = Math.max(0, totalSeconds - requiredSeconds);
  const isWeeklyOff = isWeeklyOffDateKey(dateKey);
  const attendanceStatus = isWeeklyOff
    ? totalSeconds > 0 || attendanceArrivalAt
      ? "worked_on_holiday"
      : "off_day"
    : attendanceArrivalAt
      ? lateBySeconds > 0 ? "late" : "on_time"
      : "not_started";

  return {
    shiftStart,
    shiftEnd,
    requiredSeconds,
    lateBySeconds,
    lateMinutes: Math.floor(lateBySeconds / 60),
    overtimeSeconds,
    overtimeMinutes: Math.floor(overtimeSeconds / 60),
    attendanceStatus,
    attendanceArrivalAt,
  };
};

const getAllowedBreakSeconds = (user) =>
  (Number(user?.attendance?.allowedBreakMinutes) || 60) * 60;
const getShiftBounds = (user, dateKey, now = new Date()) => {
  const shiftStart = user?.attendance?.startTime || "09:00";
  const shiftEnd = user?.attendance?.endTime || "17:00";
  const shiftStartAt = zonedDateTime(dateKey, shiftStart);
  const shiftEndAt = zonedDateTime(dateKey, shiftEnd);
  const shiftStartMinutes = parseTimeToMinutes(shiftStart);
  const shiftEndMinutes = parseTimeToMinutes(shiftEnd);
  if (shiftEndMinutes <= shiftStartMinutes) {
    shiftEndAt.setUTCDate(shiftEndAt.getUTCDate() + 1);
  }
  return { shiftStartAt, shiftEndAt };
};
const isWithinShift = (user, dateKey, now = new Date()) => {
  const { shiftStartAt, shiftEndAt } = getShiftBounds(user, dateKey, now);
  return now >= shiftStartAt && now <= shiftEndAt;
};

const getWorkMode = ({
  now = new Date(),
  session,
  user,
  activeSeconds = 0,
  isIdle = false,
  isOnBreak = false,
}) => {
  if (isOnBreak) return "on_break";
  if (isIdle) return "idle";
  const dateKey = session?.dateKey || getShiftDateKey(user, now);
  const { shiftStartAt, shiftEndAt } = getShiftBounds(user, dateKey, now);
  const requiredSeconds = (Number(user?.attendance?.requiredHours) || 8) * 3600;
  if (
    (now < shiftStartAt || now > shiftEndAt) &&
    !session?.outsideShiftConfirmed &&
    session?.workMode === "outside_shift_not_tracking"
  ) {
    return "outside_shift_not_tracking";
  }
  if (now > shiftEndAt) {
    return session?.outsideShiftConfirmed ||
      session?.overtimeConfirmed ||
      user?.attendance?.autoStartOvertime
      ? "overtime"
      : "extended_regular";
  }
  if (activeSeconds >= requiredSeconds) {
    return session?.outsideShiftConfirmed ||
      session?.overtimeConfirmed ||
      user?.attendance?.autoStartOvertime
      ? "overtime"
      : "completed_waiting";
  }
  if (now < shiftStartAt) return "pre_shift";
  return "regular_shift";
};

const summarizeBreaks = async (userId, dateKey, allowedBreakSeconds) => {
  const breaks = await MonitoringBreak.find({ user: userId, dateKey }).lean();
  const breakActivities = await MonitoringActivity.find({
    user: userId,
    dateKey,
    $or: [
      { title: /break\s*time/i },
      { windowTitle: /break\s*time/i },
      { appName: /break\s*time/i },
      { "raw.eventType": "break_time" },
      { "raw.breakType": { $exists: true } },
    ],
  }).lean();
  const now = new Date();
  const byType = {
    lunchSeconds: 0,
    namazSeconds: 0,
    teaSeconds: 0,
    personalSeconds: 0,
    otherSeconds: 0,
  };
  let totalBreakSeconds = 0;
  const activityBreakSummary = {
    lunchSeconds: 0,
    namazSeconds: 0,
    teaSeconds: 0,
    personalSeconds: 0,
    otherSeconds: 0,
  };
  let activityBreakSeconds = 0;
  for (const item of breaks) {
    const durationSeconds = item.endedAt
      ? Number(item.durationSeconds) || 0
      : Math.max(0, Math.floor((now - new Date(item.startedAt)) / 1000));
    totalBreakSeconds += durationSeconds;
    const key = `${item.breakType}Seconds`;
    if (key in byType) byType[key] += durationSeconds;
  }
  for (const item of breakActivities) {
    const durationSeconds = Math.max(0, Number(item.durationSeconds) || 0);
    activityBreakSeconds += durationSeconds;
    const breakType = String(item.raw?.breakType || item.title?.replace(/.*break\s*time:\s*/i, "") || "other").toLowerCase();
    const key = `${breakType}Seconds`;
    if (key in activityBreakSummary) activityBreakSummary[key] += durationSeconds;
    else activityBreakSummary.otherSeconds += durationSeconds;
  }
  if (activityBreakSeconds > totalBreakSeconds) {
    totalBreakSeconds = activityBreakSeconds;
    Object.assign(byType, activityBreakSummary);
  }
  return {
    breaks,
    breakSummary: byType,
    totalBreakSeconds,
    allowedBreakSeconds,
    remainingBreakSeconds: Math.max(0, allowedBreakSeconds - totalBreakSeconds),
    extraBreakSeconds: Math.max(0, totalBreakSeconds - allowedBreakSeconds),
  };
};

const updateDailySummary = async ({ user, session, latestActivity = null }) => {
  if (!user || !session) return null;
  const sessions = await MonitoringSession.find({
    user: user._id || user.id,
    dateKey: session.dateKey,
  }).lean();
  const attendanceSessions = getSessionsForCurrentAttendance(user, sessions);
  const totals = attendanceSessions.reduce(
    (acc, item) => ({
      activeSeconds: acc.activeSeconds + (Number(item.activeSeconds) || 0),
      idleSeconds: acc.idleSeconds + (Number(item.idleSeconds) || 0),
      breakSeconds: acc.breakSeconds + (Number(item.breakSeconds) || 0),
      offlineSeconds: acc.offlineSeconds + (Number(item.offlineSeconds) || 0),
      outsideShiftSeconds:
        acc.outsideShiftSeconds + (Number(item.outsideShiftSeconds) || 0),
      outsideShiftConfirmedSeconds:
        acc.outsideShiftConfirmedSeconds +
        (Number(item.outsideShiftConfirmedSeconds) || 0),
      outsideShiftNotTrackedSeconds:
        acc.outsideShiftNotTrackedSeconds +
        (Number(item.outsideShiftNotTrackedSeconds) || 0),
      totalTrackedSeconds:
        acc.totalTrackedSeconds + (Number(item.activeSeconds) || 0),
    }),
    {
      activeSeconds: 0,
      idleSeconds: 0,
      breakSeconds: 0,
      offlineSeconds: 0,
      outsideShiftSeconds: 0,
      outsideShiftConfirmedSeconds: 0,
      outsideShiftNotTrackedSeconds: 0,
      totalTrackedSeconds: 0,
    },
  );
  const allowedBreakSeconds = getAllowedBreakSeconds(user);
  const breakData = await summarizeBreaks(
    user._id || user.id,
    session.dateKey,
    allowedBreakSeconds,
  );
  const requiredWorkSeconds =
    (Number(user.attendance?.requiredHours) || 8) * 3600;
  const { shiftStartAt } = getShiftBounds(user, session.dateKey, new Date());
  const attendanceArrivalAt = getAttendanceArrivalAt(
    attendanceSessions,
    shiftStartAt,
    new Date(),
  );
  const metrics = getShiftMetrics(
    user,
    session.dateKey,
    attendanceSessions[0]?.loginAt || session.loginAt,
    totals.activeSeconds,
    attendanceArrivalAt,
  );
  const calendarDay = getCalendarDay(session.dateKey, await loadHolidayMap([session.dateKey]));
  const attendanceStatus = getAttendanceStatusForCalendarDay(
    metrics.lateBySeconds > 0 ? "late" : metrics.attendanceStatus,
    totals.activeSeconds,
    calendarDay,
  );
  const activities = await MonitoringActivity.find({
    user: user._id || user.id,
    dateKey: session.dateKey,
  }).lean();
  const appMap = new Map();
  const domainMap = new Map();
  const productivity = {
    productiveSeconds: 0,
    neutralSeconds: 0,
    unproductiveSeconds: 0,
  };
  for (const activity of activities) {
    const duration = Number(activity.durationSeconds) || 0;
    if (activity.appName)
      appMap.set(
        activity.appName,
        (appMap.get(activity.appName) || 0) + duration,
      );
    if (activity.domain)
      domainMap.set(
        activity.domain,
        (domainMap.get(activity.domain) || 0) + duration,
      );
    if (activity.productivity === "work")
      productivity.productiveSeconds += duration;
    else if (activity.productivity === "non_work")
      productivity.unproductiveSeconds += duration;
    else productivity.neutralSeconds += duration;
  }
  return MonitoringDailySummary.findOneAndUpdate(
    { userId: user._id || user.id, dateKey: session.dateKey },
    {
      $set: {
        ...totals,
        breakSeconds: breakData.totalBreakSeconds,
        allowedBreakSeconds,
        remainingBreakSeconds: breakData.remainingBreakSeconds,
        extraBreakSeconds: breakData.extraBreakSeconds,
        requiredWorkSeconds,
        overtimeSeconds:
          attendanceSessions.some((item) => item.overtimeConfirmed) ||
          user.attendance?.autoStartOvertime
            ? Math.max(0, totals.activeSeconds - requiredWorkSeconds)
            : 0,
        overtimeConfirmed: attendanceSessions.some((item) => item.overtimeConfirmed),
        lateBySeconds: calendarDay.isNonWorkingDay ? 0 : metrics.lateBySeconds,
        firstStartTime: attendanceSessions
          .map((item) => item.loginAt)
          .filter(Boolean)
          .sort()[0],
        lastEndTime: attendanceSessions
          .map((item) => item.logoutAt || item.lastSeenAt)
          .filter(Boolean)
          .sort()
          .at(-1),
        workMode: session.workMode,
        attendanceStatus,
        calendarStatus: calendarDay.status,
        calendarLabel: calendarDay.label,
        topApps: [...appMap.entries()]
          .map(([name, durationSeconds]) => ({ name, durationSeconds }))
          .sort((a, b) => b.durationSeconds - a.durationSeconds)
          .slice(0, 8),
        topDomains: [...domainMap.entries()]
          .map(([domain, durationSeconds]) => ({ domain, durationSeconds }))
          .sort((a, b) => b.durationSeconds - a.durationSeconds)
          .slice(0, 8),
        productivity,
        breakSummary: breakData.breakSummary,
        lastUpdatedAt: new Date(),
      },
    },
    { upsert: true, returnDocument: "after" },
  );
};

const syncSessionMetrics = async (session, user) => {
  if (!session || !user) return session;
  const metrics = getShiftMetrics(
    user,
    session.dateKey,
    session.loginAt || session.createdAt,
    session.activeSeconds || 0,
    null,
  );
  const calendarDay = getCalendarDay(session.dateKey, await loadHolidayMap([session.dateKey]));
  const attendanceStatus = getAttendanceStatusForCalendarDay(
    metrics.attendanceStatus,
    Number(session.activeSeconds) || 0,
    calendarDay,
  );
  return MonitoringSession.findByIdAndUpdate(
    session._id,
    {
      $set: {
        shiftStart: metrics.shiftStart,
        shiftEnd: metrics.shiftEnd,
        requiredSeconds: metrics.requiredSeconds,
        workedMinutes: Math.floor((Number(session.activeSeconds) || 0) / 60),
        overtimeMinutes: metrics.overtimeMinutes,
        lateMinutes: calendarDay.isNonWorkingDay ? 0 : metrics.lateMinutes,
        attendanceStatus,
        workMode: getWorkMode({
          session,
          user,
          activeSeconds: Number(session.activeSeconds) || 0,
          isIdle: session.status === "idle",
          isOnBreak: session.status === "on_break",
        }),
      },
    },
    { returnDocument: "after" },
  );
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin")
    return res.status(403).json({ message: "Admin access required" });
  next();
};

exports.requireAdmin = requireAdmin;

exports.desktopLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ message: "Email and password are required" });

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({
      email: new RegExp(`^${escapeRegex(normalizedEmail)}$`, "i"),
    });
    if (!user) return res.status(400).json({ message: "Invalid email or password" });
    if (user.role === "admin" || user.role === "expense_manager" || user.role === "customer") {
      return res
        .status(403)
        .json({
          message:
            "Desktop monitoring login is only for tracked employee roles",
        });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid email or password" });

    const device = await MonitorDevice.findOneAndUpdate(
      { deviceId: buildDevicePayload(req, user._id).deviceId },
      {
        $set: {
          ...buildDevicePayload(req, user._id),
          lastSeenAt: new Date(),
          isActive: true,
        },
        $setOnInsert: { registeredAt: new Date() },
      },
      { upsert: true, returnDocument: "after" },
    );

    res.json({
      token: createToken(user),
      userId: user._id,
      role: user.role,
      deviceId: device.deviceId,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        attendance: user.attendance,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.registerDevice = async (req, res) => {
  try {
    const payload = buildDevicePayload(req, req.user.id);
    const device = await MonitorDevice.findOneAndUpdate(
      { deviceId: payload.deviceId },
      {
        $set: { ...payload, lastSeenAt: new Date(), isActive: true },
        $setOnInsert: { registeredAt: new Date() },
      },
      { upsert: true, returnDocument: "after" },
    );
    res.status(201).json(device);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.startSession = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "role department attendance",
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "admin" || user.role === "expense_manager" || user.role === "customer")
      return res.status(204).send();

    const now = new Date();
    let dateKey = getShiftDateKey(user, now);
    const deviceId =
      normalizeText(req.body.deviceId) ||
      normalizeText(req.body.instanceId) ||
      "unknown-device";
    const outsideShiftConfirmed = Boolean(req.body.outsideShiftConfirmed);
    const hasAfterShiftContinueFlag = Object.prototype.hasOwnProperty.call(
      req.body,
      "afterShiftContinueConfirmed",
    );
    const afterShiftContinueConfirmed = Boolean(req.body.afterShiftContinueConfirmed);
    let outsideShift = !isWithinShift(user, dateKey, now);
    let { shiftEndAt } = getShiftBounds(user, dateKey, now);

    if (outsideShift && now > shiftEndAt) {
      const endedShiftSession = await MonitoringSession.findOne({
        user: req.user.id,
        dateKey,
        stopReason: "shift_end",
      })
        .select("_id")
        .lean();

      if (
        endedShiftSession &&
        (!hasAfterShiftContinueFlag || !afterShiftContinueConfirmed)
      ) {
        dateKey = addDaysToDateKey(dateKey, 1);
        outsideShift = !isWithinShift(user, dateKey, now);
        ({ shiftEndAt } = getShiftBounds(user, dateKey, now));
      }
    }

    const staleCutoff = new Date(now.getTime() - HEARTBEAT_STALE_MS);

    await MonitoringSession.updateMany(
      {
        user: req.user.id,
        dateKey,
        status: { $in: ["online", "active", "on_break", "idle"] },
        lastSeenAt: { $lt: staleCutoff },
      },
      {
        $set: {
          status: "offline",
          logoutAt: staleCutoff,
          logoutTime: staleCutoff,
          stoppedAt: staleCutoff,
          stopReason: "heartbeat_timeout",
        },
      },
    );

    const metrics = getShiftMetrics(user, dateKey, now, 0);
    const existingSessions = await MonitoringSession.find({
      user: req.user.id,
      dateKey,
    }).lean();
    const attendanceSessions = getSessionsForCurrentAttendance(
      user,
      existingSessions,
    );
    const activeWorkedSeconds = attendanceSessions.reduce(
      (sum, item) => sum + (Number(item.activeSeconds) || 0),
      0,
    );
    const { shiftStartAt } = getShiftBounds(user, dateKey, now);
    const isBeforeShift = now < shiftStartAt;

    if (outsideShift && !outsideShiftConfirmed) {
      await MonitorDevice.updateOne(
        { deviceId },
        { $set: { userId: req.user.id, lastSeenAt: now, isActive: false } },
        { upsert: true },
      );
      await MonitorLiveStatus.findOneAndUpdate(
        { userId: req.user.id, deviceId },
        {
          $set: {
            sessionId: undefined,
            dateKey,
            isIdle: false,
            isOnBreak: false,
            status: "offline",
            workMode: "outside_shift_not_tracking",
            lastSeenAt: now,
          },
        },
        { upsert: true, returnDocument: "after" },
      );
      return res.status(200).json({
        monitoringStarted: false,
        reason: "outside_shift_confirmation_required",
        attendance: {
          enabled: user.attendance?.enabled !== false,
          startTime: user.attendance?.startTime || "09:00",
          endTime: user.attendance?.endTime || "17:00",
          requiredHours: Number(user.attendance?.requiredHours) || 8,
          graceMinutes: Number(user.attendance?.graceMinutes) || 0,
        },
      });
    }

    let session = await MonitoringSession.findOneAndUpdate(
      {
        user: req.user.id,
        dateKey,
        status: { $in: ["online", "active", "on_break", "idle"] },
        attendanceUpdatedAt: user.attendance?.updatedAt || undefined,
      },
      {
        $setOnInsert: {
          user: req.user.id,
          role: user.role,
          department: user.department,
          dateKey,
          deviceId,
          loginAt: now,
          loginTime: now,
          attendanceUpdatedAt: user.attendance?.updatedAt || now,
          activeSeconds: 0,
          idleSeconds: 0,
          totalSeconds: 0,
          outsideShiftConfirmed,
          overtimeConfirmed: Boolean(
            user.attendance?.autoStartOvertime ||
            (outsideShift &&
              outsideShiftConfirmed &&
              activeWorkedSeconds >= metrics.requiredSeconds),
          ),
        },
        $set: {
          shiftStart: metrics.shiftStart,
          shiftEnd: metrics.shiftEnd,
          requiredSeconds: metrics.requiredSeconds,
          allowedBreakSeconds: getAllowedBreakSeconds(user),
          lateMinutes: metrics.lateMinutes,
          attendanceStatus: metrics.attendanceStatus,
          lastSeenAt: now,
          status: "active",
          workMode: outsideShift
            ? outsideShiftConfirmed
              ? isBeforeShift
                ? "pre_shift"
                : activeWorkedSeconds >= metrics.requiredSeconds
                  ? "overtime"
                  : "extended_regular"
              : "outside_shift_not_tracking"
            : getWorkMode({
                now,
                session: { dateKey, outsideShiftConfirmed },
                user,
                activeSeconds: activeWorkedSeconds,
              }),
          stopReason: undefined,
          currentApp: req.body.currentApp,
          currentTitle: req.body.currentWindowTitle,
          userAgent: "ApolloMonitor Desktop Agent",
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    await MonitorDevice.updateOne(
      { deviceId },
      { $set: { userId: req.user.id, lastSeenAt: now, isActive: true } },
    );
    session = await syncSessionMetrics(session, user);
    const liveStatus = session.status;
    await MonitorLiveStatus.findOneAndUpdate(
      { userId: req.user.id, deviceId },
      {
        $set: {
          sessionId: session._id,
          dateKey: session.dateKey,
          currentApp: req.body.currentApp,
          currentWindowTitle: req.body.currentWindowTitle,
          isIdle: false,
          isOnBreak: false,
          status: liveStatus,
          workMode: session.workMode,
          lastSeenAt: now,
        },
      },
      { upsert: true, returnDocument: "after" },
    );
    await updateDailySummary({ user, session });
    emitMonitoringEvent("monitoring:online", {
      sessionId: session._id,
      userId: req.user.id,
      dateKey: session.dateKey,
      status: session.status,
      workMode: session.workMode,
      lastSeenAt: session.lastSeenAt,
    });
    res.status(201).json({
      ...session.toObject(),
      sessionId: session._id,
      requiredSeconds: metrics.requiredSeconds,
      lateBySeconds: metrics.lateBySeconds,
      deviceId,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.heartbeat = async (req, res) => {
  try {
    const now = req.body.timestamp ? new Date(req.body.timestamp) : new Date();
    const deviceId = normalizeText(req.body.deviceId) || "unknown-device";
    const sessionId = req.body.sessionId;
    let activeDeltaSeconds = normalizeSeconds(req.body.activeDeltaSeconds);
    let idleDeltaSeconds = normalizeSeconds(req.body.idleDeltaSeconds);
    let idleCorrectionSeconds = normalizeSeconds(req.body.idleCorrectionSeconds);
    const appName = normalizeText(req.body.currentApp || req.body.appName);
    const domain = normalizeText(req.body.currentDomain || req.body.domain);
    const windowTitle = normalizeText(
      req.body.currentWindowTitle ||
        req.body.currentTitle ||
        req.body.windowTitle,
    );
    const isIdle = Boolean(req.body.isIdle);
    const isOnBreak = Boolean(req.body.isOnBreak);
    let offlineDeltaSeconds = normalizeSeconds(req.body.offlineDeltaSeconds);

    const user = await User.findById(req.user.id).select(
      "attendance role department",
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    const pmTimeOnlyTracking = user.role === "pm";
    const trackedAppName = pmTimeOnlyTracking ? null : appName;
    const trackedDomain = pmTimeOnlyTracking ? null : domain;
    const trackedWindowTitle = pmTimeOnlyTracking ? null : windowTitle;
    const trackedBrowser = pmTimeOnlyTracking
      ? null
      : req.body.currentBrowser || req.body.browser;

    let session = sessionId
      ? await MonitoringSession.findOne({ _id: sessionId, user: req.user.id })
      : await MonitoringSession.findOne({
          user: req.user.id,
          dateKey: getShiftDateKey(user, now),
          status: { $in: ["online", "active", "on_break", "idle"] },
        }).sort({ lastSeenAt: -1 });

    if (!session) {
      req.body.deviceId = deviceId;
      return exports.startSession(req, res);
    }

    const clampedDeltas = clampHeartbeatDeltas(
      session,
      now,
      activeDeltaSeconds,
      idleDeltaSeconds,
      offlineDeltaSeconds,
    );
    activeDeltaSeconds = clampedDeltas.activeDeltaSeconds;
    idleDeltaSeconds = clampedDeltas.idleDeltaSeconds;
    offlineDeltaSeconds = clampedDeltas.offlineDeltaSeconds;
    const outsideShiftConfirmed = Boolean(
      req.body.outsideShiftConfirmed || session.outsideShiftConfirmed,
    );

    const productivity = pmTimeOnlyTracking
      ? { category: "neutral", source: "pm_time_only" }
      : await getProductivity({
          appName,
          domain,
          type: req.body.type,
        });
    const currentMode = getWorkMode({
      now,
      session: { ...session.toObject(), outsideShiftConfirmed },
      user,
      activeSeconds: Number(session.activeSeconds) || 0,
      isIdle,
      isOnBreak,
    });
    const outsideShift = !isWithinShift(user, session.dateKey, now);
    const preShiftDeltaSeconds =
      currentMode === "pre_shift" ? activeDeltaSeconds : 0;
    const countedActiveDeltaSeconds =
      currentMode === "pre_shift" && user.attendance?.allowEarlyWork === false
        ? 0
        : currentMode === "outside_shift_not_tracking"
          ? 0
          : currentMode === "completed_waiting" &&
              !session.overtimeConfirmed &&
              !user.attendance?.autoStartOvertime
            ? 0
            : activeDeltaSeconds;
    idleCorrectionSeconds = Math.min(
      idleCorrectionSeconds,
      Math.max(0, (Number(session.activeSeconds) || 0) + countedActiveDeltaSeconds),
    );

    session = await MonitoringSession.findByIdAndUpdate(
      session._id,
      {
        $inc: {
          activeSeconds: countedActiveDeltaSeconds - idleCorrectionSeconds,
          idleSeconds: idleDeltaSeconds + idleCorrectionSeconds,
          offlineSeconds: offlineDeltaSeconds,
          preShiftSeconds: preShiftDeltaSeconds,
          outsideShiftSeconds: outsideShift ? activeDeltaSeconds : 0,
          outsideShiftConfirmedSeconds:
            outsideShift && outsideShiftConfirmed
              ? countedActiveDeltaSeconds
              : 0,
          outsideShiftNotTrackedSeconds:
            currentMode === "outside_shift_not_tracking" ? activeDeltaSeconds : 0,
          totalSeconds: countedActiveDeltaSeconds - idleCorrectionSeconds,
        },
        $set: {
          currentApp: trackedAppName,
          currentBrowser: trackedBrowser,
          currentUrl: trackedDomain ? `https://${trackedDomain}` : null,
          currentTitle: trackedWindowTitle || trackedAppName || trackedDomain,
          lastSeenAt: now,
          status: isOnBreak ? "on_break" : isIdle ? "idle" : "active",
          workMode: getWorkMode({
            now,
            session: { ...session.toObject(), outsideShiftConfirmed },
            user,
            activeSeconds:
              (Number(session.activeSeconds) || 0) + countedActiveDeltaSeconds - idleCorrectionSeconds,
            isIdle,
            isOnBreak,
          }),
          outsideShiftConfirmed,
        },
      },
      { returnDocument: "after" },
    );
    const liveStatus = session.status;

    await Promise.all([
      MonitorDevice.updateOne(
        { deviceId },
        { $set: { userId: req.user.id, lastSeenAt: now, isActive: true } },
      ),
      MonitorLiveStatus.findOneAndUpdate(
        { userId: req.user.id, deviceId },
        {
          $set: {
            sessionId: session._id,
            dateKey: session.dateKey,
            currentApp: trackedAppName,
            currentDomain: trackedDomain,
            currentWindowTitle: trackedWindowTitle,
            currentBrowser: trackedBrowser,
            isIdle,
            isOnBreak,
            status: liveStatus,
            workMode: session.workMode,
            lastSeenAt: now,
          },
        },
        { upsert: true, returnDocument: "after" },
      ),
    ]);

    session = await syncSessionMetrics(session, user);
    await updateDailySummary({ user, session });
    emitMonitoringEvent("monitoring:heartbeat", {
      sessionId: session._id,
      userId: req.user.id,
      dateKey: session.dateKey,
      status: session.status,
      workMode: session.workMode,
      lastSeenAt: session.lastSeenAt,
    });
    res.json({ ...session.toObject(), sessionId: session._id, productivity });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.idleStart = async (req, res) => {
  req.body.isIdle = true;
  req.body.idleDeltaSeconds = 0;
  return exports.heartbeat(req, res);
};

exports.idleEnd = async (req, res) => {
  req.body.isIdle = false;
  req.body.idleDeltaSeconds = normalizeSeconds(req.body.durationSeconds);
  return exports.heartbeat(req, res);
};

exports.endSession = async (req, res) => {
  try {
    const now = new Date();
    const existing = await MonitoringSession.findOne({
      _id: req.body.sessionId || req.params.sessionId,
      user: req.user.id,
    });
    if (!existing)
      return res.status(404).json({ message: "Monitoring session not found" });
    if (existing.stoppedManually && existing.status === "offline")
      return res.json(existing);
    const session = await MonitoringSession.findOneAndUpdate(
      { _id: req.body.sessionId || req.params.sessionId, user: req.user.id },
      {
        $set: {
          logoutAt: now,
          logoutTime: now,
          lastSeenAt: now,
          status: req.body.finalStatus || "offline",
          workMode:
            req.body.finalStatus === "completed"
              ? "completed"
              : req.body.finalStatus === "completed_waiting"
                ? "completed_waiting"
                : "offline",
          stopReason: req.body.reason || "logout",
          stoppedAt: now,
        },
      },
      { returnDocument: "after" },
    );
    if (!session)
      return res.status(404).json({ message: "Monitoring session not found" });
    const user = await User.findById(req.user.id).select(
      "attendance role department",
    );
    await MonitorLiveStatus.updateMany(
      { userId: req.user.id },
      {
        $set: {
          status: session.status,
          workMode: session.workMode,
          isIdle: false,
          isOnBreak: false,
          lastSeenAt: now,
        },
      },
    );
    await updateDailySummary({ user, session });
    res.json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.overtimeStart = async (req, res) => exports.heartbeat(req, res);
exports.overtimeEnd = async (req, res) => exports.heartbeat(req, res);

exports.confirmOvertime = async (req, res) => {
  try {
    const session = await MonitoringSession.findOneAndUpdate(
      { _id: req.body.sessionId, user: req.user.id },
      {
        $set: {
          overtimeConfirmed: true,
          workMode: "overtime",
          status: "active",
        },
      },
      { returnDocument: "after" },
    );
    if (!session)
      return res.status(404).json({ message: "Monitoring session not found" });
    const user = await User.findById(req.user.id).select(
      "attendance role department",
    );
    await updateDailySummary({ user, session });
    res.json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.startBreak = async (req, res) => {
  try {
    const now = new Date();
    const session = await MonitoringSession.findOne({
      _id: req.body.sessionId,
      user: req.user.id,
    });
    if (!session)
      return res.status(404).json({ message: "Monitoring session not found" });
    const breakType = normalizeText(req.body.breakType).toLowerCase();
    if (!["lunch", "namaz", "tea", "personal", "other"].includes(breakType)) {
      return res.status(400).json({ message: "Invalid break type" });
    }
    const existing = await MonitoringBreak.findOne({
      user: req.user.id,
      dateKey: session.dateKey,
      endedAt: { $exists: false },
    });
    if (existing) return res.json(existing);
    const item = await MonitoringBreak.create({
      user: req.user.id,
      session: session._id,
      dateKey: session.dateKey,
      breakType,
      startedAt: now,
    });
    const updated = await MonitoringSession.findByIdAndUpdate(
      session._id,
      { $set: { status: "on_break", workMode: "on_break", lastSeenAt: now } },
      { returnDocument: "after" },
    );
    const user = await User.findById(req.user.id).select(
      "attendance role department",
    );
    await updateDailySummary({ user, session: updated });
    emitMonitoringEvent("monitoring:heartbeat", {
      sessionId: updated._id,
      userId: req.user.id,
      dateKey: updated.dateKey,
      status: updated.status,
      workMode: updated.workMode,
      lastSeenAt: updated.lastSeenAt,
    });
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.endBreak = async (req, res) => {
  try {
    const now = new Date();
    const item = await MonitoringBreak.findOne({
      user: req.user.id,
      endedAt: { $exists: false },
    }).sort({ startedAt: -1 });
    if (!item)
      return res.status(404).json({ message: "Active break not found" });
    const durationSeconds = Math.max(
      0,
      Math.floor((now - item.startedAt) / 1000),
    );
    item.endedAt = now;
    item.durationSeconds = durationSeconds;
    await item.save();
    const session = await MonitoringSession.findByIdAndUpdate(
      item.session,
      {
        $inc: { breakSeconds: durationSeconds },
        $set: { status: "active", lastSeenAt: now },
      },
      { returnDocument: "after" },
    );
    const user = await User.findById(req.user.id).select(
      "attendance role department",
    );
    session.workMode = getWorkMode({
      now,
      session,
      user,
      activeSeconds: session.activeSeconds,
    });
    await session.save();
    await updateDailySummary({ user, session });
    emitMonitoringEvent("monitoring:heartbeat", {
      sessionId: session._id,
      userId: req.user.id,
      dateKey: session.dateKey,
      status: session.status,
      workMode: session.workMode,
      lastSeenAt: session.lastSeenAt,
    });
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getLiveMonitoring = async (req, res) => {
  req.query.date = req.query.date || getDateKey();
  const { getAdminOverview } = require("./monitoringController");
  return getAdminOverview[1](req, res);
};

exports.getDailyMonitoring = async (req, res) =>
  exports.getLiveMonitoring(req, res);

exports.getUserMonitoring = async (req, res) => {
  try {
    const dateKey = req.query.date || getDateKey();
    const sessions = await MonitoringSession.find({ user: req.params.userId, dateKey })
      .populate("user", "name email role department")
      .sort({ loginAt: -1 });
    const userRole = sessions[0]?.user?.role || (await User.findById(req.params.userId).select("role"))?.role;
    const activities = userRole === "pm"
      ? []
      : await MonitoringActivity.find({ user: req.params.userId, dateKey })
          .sort({ startedAt: -1 })
          .limit(500);
    res.json({ dateKey, sessions, activities });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAttendance = async (req, res) => exports.getLiveMonitoring(req, res);
exports.getProductivitySummary = async (req, res) =>
  exports.getLiveMonitoring(req, res);
