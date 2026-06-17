const MonitoringSession = require("../models/MonitoringSession");
const MonitoringActivity = require("../models/MonitoringActivity");
const MonitoringStopAttempt = require("../models/MonitoringStopAttempt");
const MonitorLiveStatus = require("../models/MonitorLiveStatus");
const MonitoringDailySummary = require("../models/MonitoringDailySummary");
const MonitoringBreak = require("../models/MonitoringBreak");
const User = require("../models/User");
const { emitMonitoringEvent } = require("../utils/socket");
const {
  getAttendanceStatusForCalendarDay,
  getCalendarDay,
  getDateKeysBetween,
  isWeeklyOffDateKey,
  loadHolidayMap,
} = require("../utils/workCalendar");

const getDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ATTENDANCE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
};
const NON_WORK_DOMAINS = ["youtube.com", "youtu.be", "facebook.com", "instagram.com", "tiktok.com", "netflix.com"];
const WORK_DOMAINS = ["github.com", "gitlab.com", "stackoverflow.com", "docs.google.com", "figma.com", "slack.com"];
const ATTENDANCE_TIME_ZONE = "Asia/Karachi";
const BROWSER_APPS = ["chrome", "msedge", "microsoftedge", "edge", "firefox", "brave", "brave-browser", "opera", "vivaldi"];
const ACTIVITY_MERGE_WINDOW_MS = 90 * 1000;
const HEARTBEAT_STALE_MS = 90 * 1000;
const MIDNIGHT_SHIFT_ROLLOVER_MINUTES = 6 * 60;
const BROWSER_TITLE_SUFFIXES = [
  "Google Chrome",
  "Chrome",
  "Microsoft Edge",
  "Edge",
  "Mozilla Firefox",
  "Firefox",
  "Brave",
  "Brave Browser",
  "Opera",
  "Vivaldi",
  "Personal",
  "Work",
  "Profile 1",
  "Profile 2",
];

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

const getBreakActivityDurationSeconds = (item) => Math.max(0, Number(item?.durationSeconds) || 0);

const sumBreakActivitiesByDate = (activities = []) =>
  activities.reduce((map, item) => {
    map.set(item.dateKey, (map.get(item.dateKey) || 0) + getBreakActivityDurationSeconds(item));
    return map;
  }, new Map());
const TITLE_SEPARATOR_PATTERN = "\\s+[-|\\u2013\\u2014]\\s+";

const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }

  next();
};

const skipAdminTracking = (req, res) => {
  if (req.user?.role === "admin" || req.user?.role === "expense_manager") {
    res.status(204).send();
    return true;
  }

  return false;
};

const emitSessionEvent = (event, session) => {
  if (!session) return;
  emitMonitoringEvent(event, {
    sessionId: session._id,
    userId: session.user?._id || session.user,
    dateKey: session.dateKey,
    status: session.status,
    stoppedManually: Boolean(session.stoppedManually),
    stopReason: session.stopReason,
    lastSeenAt: session.lastSeenAt,
  });
};

const monitoringBlockedPayload = (reason, shiftState, user) => ({
  monitoringStarted: false,
  reason,
  shiftState,
  attendance: {
    enabled: user?.attendance?.enabled !== false,
    startTime: user?.attendance?.startTime || "09:00",
    endTime: user?.attendance?.endTime || "17:00",
    requiredHours: Number(user?.attendance?.requiredHours) || 8,
  },
});

exports.adminOnly = adminOnly;

const getAttendanceVersion = (user) => {
  const value = user?.attendance?.updatedAt;
  return value ? new Date(value).toISOString() : "";
};

const getSessionsForCurrentAttendance = (user, sessions = []) => {
  const attendanceVersion = getAttendanceVersion(user);
  if (!attendanceVersion) return sessions;

  const matchingSessions = sessions.filter((session) => {
    const sessionVersion = session.attendanceUpdatedAt;
    return sessionVersion && new Date(sessionVersion).toISOString() === attendanceVersion;
  });

  return matchingSessions.length ? matchingSessions : sessions;
};

const getDailySessionTotals = (sessions = []) => sessions.reduce(
  (totals, session) => ({
    activeSeconds: totals.activeSeconds + Math.max(0, Number(session.activeSeconds) || 0),
    idleSeconds: totals.idleSeconds + Math.max(0, Number(session.idleSeconds) || 0),
    totalSeconds: totals.totalSeconds + Math.max(0, Number(session.activeSeconds) || 0),
  }),
  { activeSeconds: 0, idleSeconds: 0, totalSeconds: 0 }
);

const clampDeltaSeconds = (value) => Math.min(HEARTBEAT_STALE_MS / 1000, Math.max(0, Math.floor(Number(value) || 0)));

const attachDailyTotals = async (session, user) => {
  if (!session) return session;

  const sessions = await MonitoringSession.find({ user: session.user, dateKey: session.dateKey });
  const attendanceSessions = getSessionsForCurrentAttendance(user, sessions);
  const totals = getDailySessionTotals(attendanceSessions);
  const payload = typeof session.toObject === "function" ? session.toObject() : session;

  return {
    ...payload,
    dailyActiveSeconds: totals.activeSeconds,
    dailyIdleSeconds: totals.idleSeconds,
    dailyTotalSeconds: totals.totalSeconds,
  };
};

exports.startSession = async (req, res) => {
  try {
    if (skipAdminTracking(req, res)) return;

    const user = await User.findById(req.user.id).select("role department attendance");
    if (!user) return res.status(404).json({ message: "User not found" });

    const now = new Date();
    const dateKey = getShiftDateKey(user, now);
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
          logoutAt: staleCutoff,
          logoutTime: staleCutoff,
          lastSeenAt: staleCutoff,
          status: "offline",
          stopReason: "heartbeat_timeout",
          stoppedAt: staleCutoff,
        },
      }
    );

    let session = await MonitoringSession.findOneAndUpdate(
      {
        user: req.user.id,
        dateKey,
        status: "online",
      },
      {
        $setOnInsert: {
          user: req.user.id,
          role: user.role,
          department: user.department,
          dateKey,
          shiftStart: user.attendance?.startTime || "09:00",
          shiftEnd: user.attendance?.endTime || "17:00",
          attendanceUpdatedAt: user.attendance?.updatedAt || now,
          loginAt: now,
          loginTime: now,
          userAgent: req.headers["user-agent"],
        },
        $set: {
          lastSeenAt: now,
          logoutAt: undefined,
          status: "online",
        },
      },
      { returnDocument: "after", upsert: true }
    );

    session = await syncSessionAttendanceMetrics(session, user);
    emitSessionEvent("monitoring:online", session);
    res.status(201).json(await attachDailyTotals(session, user));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.heartbeatSession = async (req, res) => {
  try {
    if (skipAdminTracking(req, res)) return;

    const {
      currentUrl,
      currentTitle,
      currentApp,
      currentBrowser,
      portalPath,
    } = req.body;
    const now = new Date();
    const existingSession = await MonitoringSession.findOne({ _id: req.params.id, user: req.user.id });

    if (!existingSession) return res.status(404).json({ message: "Monitoring session not found" });

    const currentUser = await User.findById(req.user.id).select("attendance role department");
    const todayKey = getShiftDateKey(currentUser, now);
    const pmTimeOnlyTracking = currentUser?.role === "pm";
    const trackedCurrentUrl = pmTimeOnlyTracking ? null : currentUrl;
    const trackedCurrentTitle = pmTimeOnlyTracking ? null : currentTitle;
    const trackedCurrentApp = pmTimeOnlyTracking ? null : currentApp;
    const trackedCurrentBrowser = pmTimeOnlyTracking ? null : currentBrowser;
    const trackedPortalPath = pmTimeOnlyTracking ? null : portalPath;

    if (existingSession.status === "offline" && existingSession.stopReason === "logout") {
      return res.json(await attachDailyTotals(existingSession, currentUser));
    }

    if (existingSession.dateKey !== todayKey) {
      const closedSession = await MonitoringSession.findByIdAndUpdate(existingSession._id, {
        logoutAt: now,
        logoutTime: now,
        lastSeenAt: now,
        status: "offline",
        stopReason: "date_rollover",
        stoppedAt: now,
      }, { returnDocument: "after" });
      await syncSessionAttendanceMetrics(closedSession, currentUser);

      const user = await User.findById(req.user.id).select("role department");

      const newSession = await MonitoringSession.findOneAndUpdate(
        {
          user: req.user.id,
          dateKey: todayKey,
          status: "online",
        },
        {
          $setOnInsert: {
            user: req.user.id,
            role: user?.role || req.user.role,
            department: user?.department,
            dateKey: todayKey,
            shiftStart: currentUser?.attendance?.startTime || "09:00",
            shiftEnd: currentUser?.attendance?.endTime || "17:00",
            attendanceUpdatedAt: currentUser?.attendance?.updatedAt || now,
            loginAt: now,
            loginTime: now,
            userAgent: req.headers["user-agent"],
          },
          $set: {
            activeSeconds: 0,
            idleSeconds: 0,
            totalSeconds: 0,
            currentUrl: trackedCurrentUrl,
            currentTitle: trackedCurrentTitle,
            currentApp: trackedCurrentApp,
            currentBrowser: trackedCurrentBrowser,
            portalPath: trackedPortalPath,
            lastSeenAt: now,
            logoutAt: undefined,
            status: "online",
          },
        },
        { returnDocument: "after", upsert: true }
      );

      const syncedNewSession = await syncSessionAttendanceMetrics(newSession, currentUser);
      emitSessionEvent("monitoring:online", syncedNewSession);
      return res.json(await attachDailyTotals(syncedNewSession, currentUser));
    }

    const currentAttendanceVersion = getAttendanceVersion(currentUser);
    const sessionAttendanceVersion = existingSession.attendanceUpdatedAt
      ? new Date(existingSession.attendanceUpdatedAt).toISOString()
      : "";

    if (currentAttendanceVersion && sessionAttendanceVersion !== currentAttendanceVersion) {
      let resetSession = await MonitoringSession.findByIdAndUpdate(
        existingSession._id,
        {
          $set: {
            shiftStart: currentUser?.attendance?.startTime || "09:00",
            shiftEnd: currentUser?.attendance?.endTime || "17:00",
            attendanceUpdatedAt: currentUser.attendance.updatedAt,
            loginAt: now,
            loginTime: now,
            activeSeconds: 0,
            idleSeconds: 0,
            totalSeconds: 0,
            currentUrl: trackedCurrentUrl,
            currentTitle: trackedCurrentTitle,
            currentApp: trackedCurrentApp,
            currentBrowser: trackedCurrentBrowser,
            portalPath: trackedPortalPath,
            lastSeenAt: now,
            logoutAt: undefined,
            logoutTime: undefined,
            stoppedAt: undefined,
            status: "online",
          },
        },
        { returnDocument: "after" }
      );

      resetSession = await syncSessionAttendanceMetrics(resetSession, currentUser);
      emitSessionEvent("monitoring:heartbeat", resetSession);
      const resetPayload = await attachDailyTotals(resetSession, currentUser);
      return res.json({ ...resetPayload, timerReset: true });
    }

    const activeDeltaSeconds = clampDeltaSeconds(req.body.activeDeltaSeconds);
    const idleDeltaSeconds = clampDeltaSeconds(req.body.idleDeltaSeconds);
    const totalDeltaSeconds = activeDeltaSeconds + idleDeltaSeconds;

    let session = await MonitoringSession.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.user.id,
      },
      {
        $inc: {
          activeSeconds: activeDeltaSeconds,
          idleSeconds: idleDeltaSeconds,
          totalSeconds: totalDeltaSeconds,
        },
        $set: {
          currentUrl: trackedCurrentUrl,
          currentTitle: trackedCurrentTitle,
          currentApp: trackedCurrentApp,
          currentBrowser: trackedCurrentBrowser,
          portalPath: trackedPortalPath,
          lastSeenAt: now,
          status: "online",
        },
      },
      { returnDocument: "after" }
    );

    if (!session) return res.status(404).json({ message: "Monitoring session not found" });

    session = await syncSessionAttendanceMetrics(session, currentUser);
    emitSessionEvent("monitoring:heartbeat", session);
    res.json(await attachDailyTotals(session, currentUser));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.endSession = async (req, res) => {
  try {
    if (skipAdminTracking(req, res)) return;

    let session = await MonitoringSession.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.user.id,
      },
      {
        logoutAt: new Date(),
        logoutTime: new Date(),
        lastSeenAt: new Date(),
        status: "offline",
        stopReason: "logout",
        stoppedAt: new Date(),
      },
      { returnDocument: "after" }
    );

    if (!session) return res.status(404).json({ message: "Monitoring session not found" });

    const user = await User.findById(req.user.id).select("attendance role department createdAt");
    session = await syncSessionAttendanceMetrics(session, user);
    emitSessionEvent("monitoring:offline", session);
    res.json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getDomain = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
};

const getGoogleQuery = (url) => {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("google.")) return "";
    return parsed.searchParams.get("q") || "";
  } catch {
    return "";
  }
};

const getYouTubeVideoId = (url) => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.replace("/", "");
    if (!parsed.hostname.includes("youtube.com")) return "";
    return parsed.searchParams.get("v") || "";
  } catch {
    return "";
  }
};

const normalizeBrowserName = (value = "") => {
  const app = value.toLowerCase();
  if (app.includes("firefox")) return "Firefox";
  if (app.includes("brave")) return "Brave";
  if (app.includes("opera")) return "Opera";
  if (app.includes("vivaldi")) return "Vivaldi";
  if (app.includes("msedge") || app.includes("microsoftedge") || app.includes("edge")) return "Edge";
  if (app.includes("chrome")) return "Chrome";
  return "";
};

const isBrowserApp = (appName = "", browser = "") => {
  const value = `${appName} ${browser}`.toLowerCase();
  return BROWSER_APPS.some((browserName) => value.includes(browserName));
};

const inferGoogleQueryFromTitle = (title = "") => {
  const cleaned = normalizeWindowTitle(title);
  const patterns = [
    new RegExp(`^(.+?)${TITLE_SEPARATOR_PATTERN}Google Search(?:${TITLE_SEPARATOR_PATTERN}.+)?$`, "i"),
    new RegExp(`^(.+?)${TITLE_SEPARATOR_PATTERN}Google(?:${TITLE_SEPARATOR_PATTERN}.+)?$`, "i"),
    new RegExp(`^Google Search${TITLE_SEPARATOR_PATTERN}(.+?)(?:${TITLE_SEPARATOR_PATTERN}.+)?$`, "i"),
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    const query = match?.[1]?.trim();
    if (query && query.toLowerCase() !== "google") return query;
  }

  const match = cleaned.match(/^(.+?)\s+Google Search$/i);
  return match?.[1]?.trim() || "";
};

const inferYouTubeTitle = (title = "") => {
  const cleaned = normalizeWindowTitle(title);
  if (!/\byoutube\b/i.test(cleaned)) return "";
  const match = cleaned.match(new RegExp(`^(.+?)${TITLE_SEPARATOR_PATTERN}YouTube(?:${TITLE_SEPARATOR_PATTERN}.+)?$`, "i"));
  return stripTitleNoise(match?.[1]?.trim() || cleaned);
};

const stripTitleNoise = (title = "") => {
  return title
    .replace(/^\(\d+\)\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
};

const normalizeWindowTitle = (title = "") => {
  let cleaned = stripTitleNoise(title);
  cleaned = cleaned.replace(/\s+and\s+\d+\s+more\s+pages?\b/gi, "").trim();
  let changed = true;

  while (changed) {
    changed = false;
    for (const suffix of BROWSER_TITLE_SUFFIXES) {
      const nextTitle = cleaned.replace(new RegExp(`${TITLE_SEPARATOR_PATTERN}${suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), "").trim();
      if (nextTitle !== cleaned) {
        cleaned = nextTitle;
        changed = true;
      }
    }
  }

  cleaned = cleaned.replace(/\s+and\s+\d+\s+more\s+pages?\b/gi, "").trim();

  return stripTitleNoise(cleaned);
};

const getActivityDisplayTitle = (activity = {}) => {
  if (activity.type === "youtube") {
    const youtubeTitle = normalizeWindowTitle(activity.youtube?.videoTitle || "");
    if (youtubeTitle && youtubeTitle.toLowerCase() !== "youtube") return youtubeTitle;
    return normalizeWindowTitle(activity.title || activity.windowTitle || "YouTube video");
  }

  return normalizeWindowTitle(activity.title || activity.windowTitle || activity.appName || "Desktop activity");
};

const getActivityCanonicalKey = (activity = {}) => {
  const userId = activity.user?._id?.toString() || activity.user?.toString() || "unknown";
  const videoId = activity.youtube?.videoId;
  const title = getActivityDisplayTitle(activity).toLowerCase();
  return [userId, activity.type, videoId || title, activity.source].join("|");
};

const latestByCanonicalActivity = (activities = []) => {
  const latest = new Map();

  for (const activity of activities) {
    if (activity.type === "youtube" && getActivityDisplayTitle(activity).toLowerCase() === "youtube") {
      continue;
    }

    const key = getActivityCanonicalKey(activity);
    const existing = latest.get(key);
    const currentTime = new Date(activity.startedAt || activity.createdAt).getTime();
    const existingTime = existing ? new Date(existing.startedAt || existing.createdAt).getTime() : 0;

    if (!existing || currentTime >= existingTime) {
      latest.set(key, {
        ...activity,
        title: getActivityDisplayTitle(activity),
        youtube: activity.youtube
          ? {
              ...activity.youtube,
              videoTitle: getActivityDisplayTitle(activity),
            }
          : activity.youtube,
      });
    }
  }

  return [...latest.values()].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
};

const mergeActivitiesForOverview = (activities = []) => {
  const groups = new Map();

  for (const activityDoc of activities) {
    const activity = typeof activityDoc.toObject === "function" ? activityDoc.toObject() : activityDoc;
    const userId = activity.user?._id?.toString() || activity.user?.toString() || "unknown";
    const title = getActivityDisplayTitle(activity);
    const key = [userId, activity.dateKey, activity.type, title || activity.title, activity.source].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({
      ...activity,
      title: title || activity.title,
      youtube: activity.youtube
        ? {
            ...activity.youtube,
            videoTitle: title || normalizeWindowTitle(activity.youtube.videoTitle || activity.title),
          }
        : activity.youtube,
    });
  }

  const merged = [];

  for (const group of groups.values()) {
    const sorted = group.sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));

    for (const activity of sorted) {
      const previous = merged[merged.length - 1];
      const previousKey = previous
        ? [
            previous.user?._id?.toString() || previous.user?.toString() || "unknown",
            previous.dateKey,
            previous.type,
            previous.title,
            previous.source,
          ].join("|")
        : "";
      const currentKey = [
        activity.user?._id?.toString() || activity.user?.toString() || "unknown",
        activity.dateKey,
        activity.type,
        activity.title,
        activity.source,
      ].join("|");
      const previousEnd = previous ? new Date(previous.endedAt || previous.startedAt).getTime() : 0;
      const currentStart = new Date(activity.startedAt).getTime();

      if (previous && previousKey === currentKey && currentStart - previousEnd <= ACTIVITY_MERGE_WINDOW_MS) {
        previous.durationSeconds += activity.durationSeconds || 0;
        previous.endedAt = activity.endedAt || previous.endedAt;
        previous.startedAt = activity.startedAt;
        previous._id = activity._id;
        previous.raw = activity.raw || previous.raw;
      } else {
        merged.push({
          ...activity,
          durationSeconds: activity.durationSeconds || 0,
        });
      }
    }
  }

  return merged.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
};

const classifyProductivity = (domain, type) => {
  if (type === "youtube") return "non_work";
  if (NON_WORK_DOMAINS.some((item) => domain.includes(item))) return "non_work";
  if (WORK_DOMAINS.some((item) => domain.includes(item))) return "work";
  return "neutral";
};

const parseTimeToMinutes = (time = "09:00") => {
  const [hours = "9", minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
};

const zonedDateTime = (dateKey, time = "09:00") => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const minutes = parseTimeToMinutes(time);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - 5 * 60 * 60 * 1000);
};

const getShiftBounds = (dateKey, startTime = "09:00", endTime = "17:00") => {
  const shiftStartAt = zonedDateTime(dateKey, startTime);
  const shiftEndAt = zonedDateTime(dateKey, endTime);

  if (parseTimeToMinutes(endTime) <= parseTimeToMinutes(startTime)) {
    shiftEndAt.setUTCDate(shiftEndAt.getUTCDate() + 1);
  }

  return { shiftStartAt, shiftEndAt };
};

const addDaysToDateKey = (dateKey, days) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
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

const getAttendanceShiftBounds = (dateKey, startTime, endTime) =>
  getShiftBounds(dateKey, startTime, endTime);

const getSessionEndAt = (session, fallback = new Date()) => {
  if (!session) return fallback;
  if (session.status === "offline" && (session.logoutAt || session.stoppedAt)) {
    return new Date(session.logoutAt || session.stoppedAt);
  }
  return new Date(session.lastSeenAt || fallback);
};

const getSessionStartAt = (session) => new Date(session?.loginAt || session?.createdAt || 0).getTime();

const getSessionOvertimeSeconds = (targetSession, sessions = [], requiredSeconds = 0) => {
  if (!targetSession) return 0;

  let workedBeforeSession = 0;
  const targetId = targetSession._id?.toString();
  const sortedSessions = [...sessions].sort((a, b) => getSessionStartAt(a) - getSessionStartAt(b));

  for (const session of sortedSessions) {
    const sessionSeconds = Math.max(0, Number(session.activeSeconds) || 0);
    const isTarget = session._id?.toString() === targetId;

    if (isTarget) {
      const regularRemaining = Math.max(0, requiredSeconds - workedBeforeSession);
      return Math.max(0, sessionSeconds - regularRemaining);
    }

    workedBeforeSession += sessionSeconds;
  }

  return 0;
};

/**
 * FIXED ATTENDANCE METRICS CALCULATION
 * 
 * Properly separates:
 * - Regular worked hours (towards daily requirement)
 * - Overtime hours (after shift end, beyond requirement)
 * - Late arrival calculation (time after shift start + grace period)
 * - Actual time worked (for dashboard display)
 */
const calculateAttendanceMetrics = (
  user,
  sessions = [],
  dateKey,
  fallback = new Date()
) => {

  const attendanceSessions =
    getSessionsForCurrentAttendance(
      user,
      sessions
    );

  const settings = {
    enabled:
      user?.attendance?.enabled !== false,

    startTime:
      user?.attendance?.startTime || "09:00",

    endTime:
      user?.attendance?.endTime || "17:00",

    requiredHours:
      Number(
        user?.attendance?.requiredHours
      ) || 8,

    graceMinutes:
      Number(
        user?.attendance?.graceMinutes
      ) || 0,
  };

  const requiredSeconds =
    settings.requiredHours * 3600;

  const sortedSessions = [
    ...attendanceSessions,
  ].sort(
    (a, b) =>
      new Date(
        a.loginAt || a.createdAt
      ) -
      new Date(
        b.loginAt || b.createdAt
      )
  );

  const firstSession =
    sortedSessions[0] || null;

  const latestSession =
    sortedSessions[
      sortedSessions.length - 1
    ] || null;

  const firstLoginAt =
    firstSession?.loginAt ||
    firstSession?.createdAt ||
    null;

  const {
    shiftStartAt,
    shiftEndAt,
  } = getAttendanceShiftBounds(
    dateKey,
    settings.startTime,
    settings.endTime,
    firstLoginAt
  );

  // Only active work counts toward required shift hours. Idle time stays visible
  // in reports, but it must not mark an 8h shift as complete.
  const workedSeconds =
    attendanceSessions.reduce(
      (total, session) =>
        total +
        Math.max(
          0,
          Number(session.activeSeconds) || 0
        ),
      0
    );

  const currentTime =
    fallback.getTime();

  const shiftEnded =
    currentTime >=
    shiftEndAt.getTime();

  // IMPORTANT FIX
  // overtime only after:
  // 1. shift ended
  // 2. required hours completed

  let overtimeSeconds = 0;

  if (
    shiftEnded &&
    workedSeconds > requiredSeconds
  ) {
    overtimeSeconds =
      workedSeconds -
      requiredSeconds;
  }

  const regularWorkedSeconds =
    workedSeconds - overtimeSeconds;

  const shortfallSeconds =
    Math.max(
      0,
      requiredSeconds -
        regularWorkedSeconds
    );

  const completedRequiredHours =
    regularWorkedSeconds >=
    requiredSeconds;

  const lateCutoff = new Date(
    shiftStartAt.getTime() +
      settings.graceMinutes *
        60 *
        1000
  );

  const attendanceArrivalAt = (() => {
    if (!firstLoginAt || !settings.enabled) return null;

    const overlappingPreShiftSession = sortedSessions.find((session) => {
      const startedAt = new Date(session.loginAt || session.createdAt || 0);
      const endedAt = getSessionEndAt(session, fallback);
      return startedAt.getTime() < shiftStartAt.getTime() && endedAt.getTime() >= shiftStartAt.getTime();
    });
    if (overlappingPreShiftSession) return shiftStartAt;

    const directArrival = sortedSessions.find((session) => {
      const startedAt = new Date(session.loginAt || session.createdAt || 0);
      return startedAt.getTime() >= shiftStartAt.getTime();
    });

    return directArrival ? directArrival.loginAt || directArrival.createdAt : null;
  })();

  const lateMinutes =
    attendanceArrivalAt &&
    settings.enabled
      ? Math.max(
          0,
          Math.floor(
            (
              new Date(
                attendanceArrivalAt
              ).getTime() -
              lateCutoff.getTime()
            ) / 60000
          )
        )
      : 0;

  const leftEarly =
    Boolean(
      latestSession &&
        latestSession.status ===
          "offline" &&
        shortfallSeconds > 0
    );

  let status = "absent";
  let workStatus = "absent";
  const isWeeklyOff = isWeeklyOffDateKey(dateKey);

  if (!settings.enabled) {
    status = "disabled";
    workStatus = "disabled";
  } else if (firstSession) {

    if (!attendanceArrivalAt && currentTime < lateCutoff.getTime()) {
      status = "not_started";
    } else if (!attendanceArrivalAt) {
      status = "absent";
    } else {
      status =
        lateMinutes > 0
          ? "late"
          : "on_time";
    }

    if (overtimeSeconds > 0) {
      workStatus = "overtime";
    } else if (
      completedRequiredHours
    ) {
      workStatus = "complete";
    } else if (
      shiftEnded ||
      leftEarly
    ) {
      workStatus = "incomplete";
    } else {
      workStatus = "in_progress";
    }
  } else if (isWeeklyOff) {
    status = "off_day";
    workStatus = "off_day";
  }

  if (isWeeklyOff && firstSession) {
    status = "worked_on_holiday";
  }

  return {
    ...settings,

    shiftStartAt,
    shiftEndAt,

    requiredSeconds,

    workedSeconds,

    regularWorkedSeconds,

    overtimeSeconds,

    shortfallSeconds,

    completedRequiredHours,

    shiftEnded,

    leftEarly,

    workStatus,

    status,

    lateMinutes,

    firstLoginAt,

    attendanceArrivalAt,

    loginTime: firstLoginAt,

    logoutTime:
      latestSession?.logoutAt ||
      latestSession?.stoppedAt ||
      null,

    workedMinutes:
      Math.floor(workedSeconds / 60),

    overtimeMinutes:
      Math.floor(
        overtimeSeconds / 60
      ),
  };
};

const getShiftState = (startTime = "09:00", endTime = "17:00") => {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  const now = getTimeZoneMinutes(new Date());

  if (start === end) return "active";

  if (end > start) {
    if (now < start) return "before";
    if (now >= end) return "after";
    return "active";
  }

  if (now >= start || now < end) return "active";
  return "after";
};

const isShiftEndedForUser = (user, dateKey) => {
  const attendance = user?.attendance || {};
  if (attendance.enabled === false) return false;
  return hasShiftEnded(dateKey, attendance.startTime || "09:00", attendance.endTime || "17:00");
};

const getTimeZoneMinutes = (date) => {
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

const hasShiftEnded = (dateKey, startTime, endTime) => {
  const todayKey = getDateKey();
  if (dateKey < todayKey) return true;
  if (dateKey > todayKey) return false;
  return getShiftState(startTime, endTime) === "after";
};

const canContinueAfterShift = (session, dateKey) => {
  if (!session) return false;
  return session.dateKey === dateKey && Boolean(session.loginAt || session.createdAt);
};

const buildAttendanceStatus = (user, sessions, dateKey) => calculateAttendanceMetrics(user, sessions, dateKey);

const getOverviewDateKeyForUser = (user, requestedDateKey, currentDateKey, now = new Date()) => {
  return requestedDateKey;
};

/**
 * Sync session metrics with database
 * Called after every heartbeat to update:
 * - shiftStart, shiftEnd: Configured shift times
 * - loginTime, logoutTime: When user logged in/out
 * - workedMinutes: Total active time worked
 * - overtimeMinutes: Overtime worked (after shift end, beyond required)
 * - lateMinutes: How many minutes late the user arrived
 * - attendanceStatus: on_time, late, absent, disabled
 */
const syncSessionAttendanceMetrics = async (session, user, sessionsForDay = null) => {
  if (!session || !user) return session;

  const sessions = sessionsForDay || await MonitoringSession.find({ user: session.user, dateKey: session.dateKey });
  const metrics = calculateAttendanceMetrics(user, sessions, session.dateKey);
  const calendarDay = getCalendarDay(session.dateKey, await loadHolidayMap([session.dateKey]));
  const workedSeconds = sessions.reduce((total, item) => total + (Number(item.activeSeconds) || 0), 0);
  const attendanceStatus = getAttendanceStatusForCalendarDay(metrics.status, workedSeconds, calendarDay);
  const requiredSeconds = metrics.requiredHours * 60 * 60;
  const attendanceSessions = getSessionsForCurrentAttendance(user, sessions);
  const sessionOvertimeSeconds = getSessionOvertimeSeconds(session, attendanceSessions, requiredSeconds);

  return MonitoringSession.findByIdAndUpdate(
    session._id,
    {
      $set: {
        shiftStart: metrics.startTime,
        shiftEnd: metrics.endTime,
        loginTime: session.loginAt || session.createdAt,
        logoutTime: session.logoutAt || session.stoppedAt,
        workedMinutes: Math.floor((Number(session.activeSeconds) || 0) / 60),
        overtimeMinutes: Math.floor(sessionOvertimeSeconds / 60),
        lateMinutes: calendarDay.isNonWorkingDay ? 0 : metrics.lateMinutes,
        attendanceStatus,
      },
    },
    { returnDocument: "after" }
  );
};

exports.createActivity = async (req, res) => {
  try {
    if (skipAdminTracking(req, res)) return;
    if (req.user?.role === "pm") return res.status(204).send();

    const {
      sessionId,
      type,
      url,
      title,
      windowTitle,
      appName,
      browser,
      startedAt,
      endedAt,
      durationSeconds = 0,
      youtube = {},
      google = {},
      raw,
      agentRunId,
      clientActivityId,
    } = req.body;

    const normalizedTitle = normalizeWindowTitle(title || windowTitle || appName || "Desktop activity");
    if (!normalizedTitle && !url) return res.status(400).json({ message: "Activity title or URL is required" });

    const startDate = startedAt ? new Date(startedAt) : new Date();
    const safeDurationSeconds = Math.max(0, Number(durationSeconds) || 0);
    const source = req.body.source || "desktop_agent";
    const domain = url ? getDomain(url) : "";
    const googleQuery = google.query || (url ? getGoogleQuery(url) : inferGoogleQueryFromTitle(normalizedTitle));
    const videoId = url ? getYouTubeVideoId(url) : "";
    const youtubeTitle = normalizeWindowTitle(youtube.videoTitle || inferYouTubeTitle(normalizedTitle));
    const detectedBrowser = browser || normalizeBrowserName(appName);
    const detectedType = videoId || /\byoutube\b/i.test(normalizedTitle)
      ? "youtube"
      : googleQuery
        ? "google_search"
        : type || (isBrowserApp(appName, detectedBrowser) ? "browser_tab" : "application");
    const isGenericYouTubeActivity = detectedType === "youtube" && !videoId && (!youtubeTitle || youtubeTitle.toLowerCase() === "youtube");
    const isIgnoredBrowserActivity =
      detectedType === "browser_tab" &&
      ["new tab"].includes(normalizedTitle.toLowerCase());

    if (isGenericYouTubeActivity || isIgnoredBrowserActivity) {
      return res.status(204).send();
    }

    const activitySession = sessionId
      ? await MonitoringSession.findOne({ _id: sessionId, user: req.user.id }).select("dateKey")
      : null;
    const activityDateKey = activitySession?.dateKey || getDateKey(startDate);

    const activityPayload = {
      user: req.user.id,
      session: sessionId || undefined,
      dateKey: activityDateKey,
      type: detectedType,
      url: url || undefined,
      domain,
      title: normalizedTitle,
      windowTitle: windowTitle || normalizedTitle,
      appName,
      browser: detectedBrowser || undefined,
      agentRunId,
      clientActivityId,
      startedAt: startDate,
      endedAt: endedAt ? new Date(endedAt) : undefined,
      google: googleQuery ? { query: googleQuery } : undefined,
      youtube: detectedType === "youtube"
        ? {
            videoId: videoId || youtube.videoId,
            videoTitle: youtubeTitle || "YouTube video",
            category: youtube.category || "Uncategorized",
          }
        : undefined,
      productivity: classifyProductivity(domain, detectedType),
      source,
      raw,
    };

    if (clientActivityId) {
      const activity = await MonitoringActivity.findOneAndUpdate(
        {
          user: req.user.id,
          clientActivityId,
          source,
        },
        {
          $setOnInsert: {
            user: req.user.id,
            clientActivityId,
            startedAt: startDate,
            source,
          },
          $set: {
            session: activityPayload.session,
            dateKey: activityPayload.dateKey,
            type: activityPayload.type,
            url: activityPayload.url,
            domain: activityPayload.domain,
            title: activityPayload.title,
            windowTitle: activityPayload.windowTitle,
            appName: activityPayload.appName,
            browser: activityPayload.browser,
            agentRunId: activityPayload.agentRunId,
            endedAt: activityPayload.endedAt,
            durationSeconds: safeDurationSeconds,
            google: activityPayload.google,
            youtube: activityPayload.youtube,
            productivity: activityPayload.productivity,
            raw: activityPayload.raw,
          },
        },
        { returnDocument: "after", upsert: true }
      );

      emitMonitoringEvent("monitoring:activity", {
        activityId: activity._id,
        userId: activity.user,
        sessionId: activity.session,
        dateKey: activity.dateKey,
        type: activity.type,
        title: activity.title,
        durationSeconds: activity.durationSeconds,
      });
      return res.status(201).json(activity);
    }

    const recentActivity = await MonitoringActivity.findOne({
      user: req.user.id,
      session: sessionId || undefined,
      dateKey: activityDateKey,
      type: detectedType,
      title: normalizedTitle,
      source,
      endedAt: { $gte: new Date(startDate.getTime() - ACTIVITY_MERGE_WINDOW_MS) },
      ...(agentRunId ? { agentRunId } : {}),
    }).sort({ endedAt: -1, startedAt: -1 });

    const activity = recentActivity
      ? await MonitoringActivity.findByIdAndUpdate(
          recentActivity._id,
          {
            $set: {
              url: activityPayload.url,
              domain: activityPayload.domain,
              windowTitle: activityPayload.windowTitle,
              appName: activityPayload.appName,
              browser: activityPayload.browser,
              agentRunId: activityPayload.agentRunId,
              clientActivityId: activityPayload.clientActivityId,
              endedAt: activityPayload.endedAt,
              google: activityPayload.google,
              youtube: activityPayload.youtube,
              productivity: activityPayload.productivity,
              raw: activityPayload.raw,
            },
            $inc: {
              durationSeconds: safeDurationSeconds,
            },
          },
          { returnDocument: "after" }
        )
      : await MonitoringActivity.create({
          ...activityPayload,
          durationSeconds: safeDurationSeconds,
        });

    emitMonitoringEvent("monitoring:activity", {
      activityId: activity._id,
      userId: activity.user,
      sessionId: activity.session,
      dateKey: activity.dateKey,
      type: activity.type,
      title: activity.title,
      durationSeconds: activity.durationSeconds,
    });
    res.status(201).json(activity);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.validateMonitoringStop = async (req, res) => {
  try {
    if (skipAdminTracking(req, res)) return;

    const { pin, hostName, instanceId, appVersion } = req.body;
    const expectedPin = process.env.MONITORING_ADMIN_PIN || "35456";
    const success = String(pin || "") === String(expectedPin);
    const now = new Date();
    const dateKey = getDateKey(now);

    const attempt = await MonitoringStopAttempt.create({
      user: req.user.id,
      dateKey,
      success,
      reason: success ? "pin_valid" : "pin_invalid",
      hostName,
      instanceId,
      appVersion,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    emitMonitoringEvent("monitoring:stop_attempt", {
      attemptId: attempt._id,
      userId: req.user.id,
      dateKey,
      success,
      reason: attempt.reason,
    });

    if (!success) {
      return res.status(403).json({ message: "Invalid admin PIN" });
    }

    let session = await MonitoringSession.findOneAndUpdate(
      {
        user: req.user.id,
        status: { $in: ["online", "active", "on_break", "idle"] },
      },
      {
        $set: {
          status: "offline",
          logoutAt: now,
          logoutTime: now,
          lastSeenAt: now,
          stoppedAt: now,
          stoppedManually: true,
          stopReason: "manual_pin",
        },
      },
      { returnDocument: "after", sort: { lastSeenAt: -1 } }
    );

    if (session) {
      const user = await User.findById(req.user.id).select("attendance role department");
      session = await syncSessionAttendanceMetrics(session, user);
      emitSessionEvent("monitoring:stopped", session);
      emitSessionEvent("monitoring:offline", session);
    }

    await MonitorLiveStatus.updateMany(
      { userId: req.user.id },
      {
        $set: {
          status: "offline",
          workMode: "offline",
          isIdle: false,
          isOnBreak: false,
          lastSeenAt: now,
        },
      }
    );

    res.json({ message: "Monitoring stopped", allowed: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAdminOverview = [
  adminOnly,
  async (req, res) => {
    try {
      const now = new Date();
      const dateKey = req.query.date || getDateKey(now);
      const onlineWindow = Date.now() - HEARTBEAT_STALE_MS;
      const staleCutoff = new Date(onlineWindow);
      const currentDateKey = getDateKey(now);
      const users = await User.find({ role: { $nin: ["admin", "expense_manager", "customer"] } })
        .select("name email role department attendance")
        .sort({ name: 1 });
      const dateKeyByUserId = new Map(
        users.map((user) => [
          user._id.toString(),
          getOverviewDateKeyForUser(user, dateKey, currentDateKey, now),
        ])
      );
      let queryDateKeys = [...new Set(dateKeyByUserId.values())];

      const staleSessions = await MonitoringSession.find(
        {
          dateKey: { $in: queryDateKeys },
          status: { $in: ["online", "active", "on_break", "idle"] },
          lastSeenAt: { $lt: staleCutoff },
        }
      ).select("_id user dateKey status stoppedManually stopReason lastSeenAt");

      await MonitoringSession.updateMany(
        { _id: { $in: staleSessions.map((session) => session._id) } },
        {
          $set: {
            status: "offline",
            logoutAt: staleCutoff,
            logoutTime: staleCutoff,
            stoppedAt: staleCutoff,
            stopReason: "heartbeat_timeout",
          },
        }
      );

      staleSessions.forEach((session) => {
        session.status = "offline";
        session.stoppedAt = staleCutoff;
        session.stopReason = "heartbeat_timeout";
        emitSessionEvent("monitoring:offline", session);
      });

      const liveStatusQuery = dateKey === currentDateKey ? {} : { dateKey };
      const liveStatuses = await MonitorLiveStatus.find(liveStatusQuery)
        .sort({ lastSeenAt: -1 })
        .lean();
      queryDateKeys = [
        ...new Set([
          ...queryDateKeys,
          ...liveStatuses
            .filter(
              (item) =>
                ["online", "active", "on_break", "idle"].includes(item.status) &&
                new Date(item.lastSeenAt).getTime() >= onlineWindow,
            )
            .map((item) => item.dateKey)
            .filter(Boolean),
        ]),
      ];

      const [sessions, activityDocs, dailySummaries, breakDocs, breakActivityDocs] = await Promise.all([
        MonitoringSession.find({ dateKey: { $in: queryDateKeys } })
          .populate("user", "name email role department")
          .sort({ lastSeenAt: -1 }),
        MonitoringActivity.find({ dateKey: { $in: queryDateKeys } })
          .populate("user", "name email role department")
          .sort({ startedAt: -1 })
          .limit(300),
        MonitoringDailySummary.find({ dateKey: { $in: queryDateKeys } }).lean(),
        MonitoringBreak.find({ dateKey: { $in: queryDateKeys } }).lean(),
        MonitoringActivity.find({ dateKey: { $in: queryDateKeys }, $or: BREAK_ACTIVITY_OR })
          .select("user dateKey durationSeconds title windowTitle appName raw")
          .lean(),
      ]);
      const holidayMap = await loadHolidayMap(queryDateKeys);
      const activities = mergeActivitiesForOverview(activityDocs);
      const visibleActivities = latestByCanonicalActivity(activities);

      const getUserDateMapKey = (userId, itemDateKey) => `${userId}:${itemDateKey}`;

      const sessionsByUserDate = sessions.reduce((map, session) => {
        const userId = session.user?._id?.toString() || session.user?.toString();
        if (!userId) return map;
        const key = getUserDateMapKey(userId, session.dateKey);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(session);
        return map;
      }, new Map());
      const liveByUser = liveStatuses.reduce((map, item) => {
        const userId = item.userId?.toString();
        if (userId && !map.has(userId)) map.set(userId, item);
        return map;
      }, new Map());
      const summaryByUserDate = new Map(dailySummaries.map((item) => [getUserDateMapKey(item.userId.toString(), item.dateKey), item]));
      const breakSecondsByUserDate = breakDocs.reduce((map, item) => {
        const userId = item.user?.toString();
        if (!userId) return map;
        const key = getUserDateMapKey(userId, item.dateKey);
        map.set(key, (map.get(key) || 0) + getBreakDurationSeconds(item));
        return map;
      }, new Map());
      const breakActivitySecondsByUserDate = breakActivityDocs.reduce((map, item) => {
        const userId = item.user?._id?.toString() || item.user?.toString();
        if (!userId) return map;
        const key = getUserDateMapKey(userId, item.dateKey);
        map.set(key, (map.get(key) || 0) + getBreakActivityDurationSeconds(item));
        return map;
      }, new Map());
      const activitiesByUserDate = visibleActivities.reduce((map, activity) => {
        const userId = activity.user?._id?.toString() || activity.user?.toString();
        if (!userId) return map;
        const key = getUserDateMapKey(userId, activity.dateKey);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(activity);
        return map;
      }, new Map());

      const people = users.map((user) => {
        const basePersonDateKey = dateKeyByUserId.get(user._id.toString()) || dateKey;
        const live = liveByUser.get(user._id.toString());
        const isOnline = Boolean(
          live
          && ["online", "active", "on_break", "idle"].includes(live.status)
          && new Date(live.lastSeenAt).getTime() >= onlineWindow
        );
        const personDateKey =
          dateKey === currentDateKey && isOnline && live?.dateKey
            ? live.dateKey
            : basePersonDateKey;
        const userDateKey = getUserDateMapKey(user._id.toString(), personDateKey);
        const userSessions = sessionsByUserDate.get(userDateKey) || [];
        const attendanceSessions = getSessionsForCurrentAttendance(user, userSessions);
        const latest = userSessions[0] || null;
        const summary = summaryByUserDate.get(userDateKey);
        const userActivities = activitiesByUserDate.get(userDateKey) || [];
        const pmTimeOnlyPerson = user.role === "pm";
        const visibleUserActivities = pmTimeOnlyPerson ? [] : userActivities;
        const calendarDay = getCalendarDay(personDateKey, holidayMap);
        const endedForToday = Boolean(
          dateKey === currentDateKey
          && !isOnline
          && userSessions.some((session) =>
            session.stopReason === "shift_end" ||
            ["completed", "incomplete_shift", "completed_waiting"].includes(session.status)
          )
        );
        const actualBreakSeconds = Math.max(
          breakSecondsByUserDate.get(userDateKey) || 0,
          pmTimeOnlyPerson ? 0 : breakActivitySecondsByUserDate.get(userDateKey) || 0,
        );
        const breakSeconds = endedForToday
          ? 0
          : Math.max(Number(summary?.breakSeconds) || 0, actualBreakSeconds);
        const sessionActiveSeconds = attendanceSessions.reduce((total, session) => total + (session.activeSeconds || 0), 0);
        const sessionIdleSeconds = attendanceSessions.reduce((total, session) => total + (session.idleSeconds || 0), 0);
        const rawActiveSeconds = endedForToday
          ? 0
          : attendanceSessions.length
            ? sessionActiveSeconds
            : summary?.activeSeconds || 0;
        const rawIdleSeconds = endedForToday
          ? 0
          : attendanceSessions.length
            ? sessionIdleSeconds
            : summary?.idleSeconds || 0;
        const rawTotalSeconds = endedForToday
          ? 0
          : attendanceSessions.length
            ? sessionActiveSeconds
            : summary?.activeSeconds || 0;
        const attendance = endedForToday
          ? buildAttendanceStatus(user, [], dateKey)
          : buildAttendanceStatus(user, userSessions, personDateKey);
        const activeSeconds = rawActiveSeconds;
        const idleSeconds = rawIdleSeconds;
        const totalSeconds = rawTotalSeconds;
        const idleRateDenominator = activeSeconds + idleSeconds;
        const userActivityTotals = visibleUserActivities.reduce(
          (acc, activity) => {
            const durationSeconds = activity.durationSeconds || 0;
            if (activity.type === "youtube") acc.youtubeSeconds += durationSeconds;
            if (activity.type === "google_search") acc.googleSearches += 1;
            if (activity.productivity === "non_work") acc.nonWorkSeconds += durationSeconds;
            return acc;
          },
          { youtubeSeconds: 0, googleSearches: 0, nonWorkSeconds: 0 }
        );
        const monitoringStatus = live?.status === "offline"
          ? "offline"
          : isOnline
          ? live?.status === "on_break"
            ? "on_break"
          : live?.status === "idle"
              ? "idle"
              : "online"
          : endedForToday
            ? "ended_for_today"
          : latest?.stoppedManually
            ? "stopped_manually"
            : latest?.status === "offline"
              ? "offline"
            : latest
              ? "stopped"
              : "not_started";
        const lateBySeconds = calendarDay.isNonWorkingDay ? 0 : Math.max(
          0,
          endedForToday ? 0 : Number(summary?.lateBySeconds) || ((attendance.lateMinutes || 0) * 60),
        );
        const baseAttendanceStatus = lateBySeconds > 0
          ? "late"
          : endedForToday
            ? "not_started"
            : summary?.attendanceStatus || attendance.status || "absent";
        const attendanceStatus = getAttendanceStatusForCalendarDay(
          baseAttendanceStatus,
          activeSeconds,
          calendarDay,
        );
        const normalizedAttendance = {
          ...attendance,
          status: attendanceStatus,
          lateMinutes: Math.max(
            Number(attendance.lateMinutes) || 0,
            Math.floor(lateBySeconds / 60),
          ),
        };

        return {
          user,
          latestSession: isOnline && live
            ? {
                ...latest?.toObject?.(),
                ...live,
                currentTitle: pmTimeOnlyPerson ? null : live.currentWindowTitle,
                currentApp: pmTimeOnlyPerson ? null : live.currentApp,
                currentWindowTitle: pmTimeOnlyPerson ? null : live.currentWindowTitle,
                currentDomain: pmTimeOnlyPerson ? null : live.currentDomain,
                currentBrowser: pmTimeOnlyPerson ? null : live.currentBrowser,
              }
            : latest,
          activeSeconds,
          idleSeconds,
          totalSeconds,
          rawActiveSeconds,
          rawIdleSeconds,
          rawTotalSeconds,
          sessionCount: userSessions.length,
          isOnline,
          monitoringStatus,
          monitoringStopped: monitoringStatus === "stopped" || monitoringStatus === "stopped_manually" || monitoringStatus === "ended_for_today",
          monitoringStoppedManually: monitoringStatus === "stopped_manually",
          idleRate: idleRateDenominator ? Math.min(100, Math.round((idleSeconds / idleRateDenominator) * 100)) : 0,
          attendance: normalizedAttendance,
          dailyReport: {
            dateKey: personDateKey,
            activeSeconds,
            idleSeconds,
            breakSeconds,
            allowedBreakSeconds: summary?.allowedBreakSeconds || 3600,
            remainingBreakSeconds: endedForToday ? 3600 : Math.max(0, (summary?.allowedBreakSeconds || 3600) - breakSeconds),
            extraBreakSeconds: endedForToday ? 0 : Math.max(0, breakSeconds - (summary?.allowedBreakSeconds || 3600)),
            offlineSeconds: endedForToday ? 0 : summary?.offlineSeconds || 0,
            totalTrackedSeconds: totalSeconds,
            requiredWorkSeconds: summary?.requiredWorkSeconds || attendance.requiredSeconds || ((Number(user.attendance?.requiredHours) || 8) * 60 * 60),
            overtimeSeconds: summary?.overtimeSeconds || attendance.overtimeSeconds || 0,
            lateBySeconds,
            firstStartTime: endedForToday ? null : summary?.firstStartTime || attendance.firstLoginAt || latest?.loginAt || null,
            lastEndTime: endedForToday ? null : summary?.lastEndTime || latest?.logoutAt || latest?.lastSeenAt || null,
            workMode: endedForToday ? null : summary?.workMode || latest?.workMode || attendance.workStatus || null,
            attendanceStatus,
            calendarStatus: calendarDay.status,
            calendarLabel: calendarDay.label,
            topApps: pmTimeOnlyPerson ? [] : summary?.topApps || [],
            topDomains: pmTimeOnlyPerson ? [] : summary?.topDomains || [],
            productivity: pmTimeOnlyPerson ? {
              productiveSeconds: 0,
              neutralSeconds: activeSeconds,
              unproductiveSeconds: 0,
            } : summary?.productivity || {
              productiveSeconds: 0,
              neutralSeconds: activeSeconds,
              unproductiveSeconds: userActivityTotals.nonWorkSeconds,
            },
            breakSummary: summary?.breakSummary || {
              lunchSeconds: 0,
              namazSeconds: 0,
              teaSeconds: 0,
              personalSeconds: 0,
              otherSeconds: 0,
            },
            activityTotals: userActivityTotals,
            recentActivities: visibleUserActivities.slice(0, 12),
          },
        };
      });

      const totals = people.reduce(
        (acc, person) => ({
          activeSeconds: acc.activeSeconds + person.activeSeconds,
          idleSeconds: acc.idleSeconds + person.idleSeconds,
          totalSeconds: acc.totalSeconds + person.totalSeconds,
          onlineUsers: acc.onlineUsers + (person.isOnline ? 1 : 0),
          trackedUsers: acc.trackedUsers + (person.totalSeconds > 0 ? 1 : 0),
          monitoringStoppedUsers: acc.monitoringStoppedUsers + (person.monitoringStopped ? 1 : 0),
          monitoringStoppedManuallyUsers: acc.monitoringStoppedManuallyUsers + (person.monitoringStoppedManually ? 1 : 0),
        }),
        {
          activeSeconds: 0,
          idleSeconds: 0,
          totalSeconds: 0,
          onlineUsers: 0,
          trackedUsers: 0,
          monitoringStoppedUsers: 0,
          monitoringStoppedManuallyUsers: 0,
        }
      );

      const activityTotals = visibleActivities.reduce(
        (acc, activity) => {
          acc.totalActivities += 1;
          acc.durationSeconds += activity.durationSeconds || 0;
          if (activity.type === "youtube") acc.youtubeSeconds += activity.durationSeconds || 0;
          if (activity.type === "google_search") acc.googleSearches += 1;
          if (activity.productivity === "non_work") acc.nonWorkSeconds += activity.durationSeconds || 0;

          const domain = activity.domain || activity.appName || "unknown";
          acc.domainMap.set(domain, (acc.domainMap.get(domain) || 0) + (activity.durationSeconds || 0));

          return acc;
        },
        {
          totalActivities: 0,
          durationSeconds: 0,
          youtubeSeconds: 0,
          googleSearches: 0,
          nonWorkSeconds: 0,
          domainMap: new Map(),
        }
      );

      const topDomains = [...activityTotals.domainMap.entries()]
        .map(([domain, durationSeconds]) => ({ domain, durationSeconds }))
        .sort((a, b) => b.durationSeconds - a.durationSeconds)
        .slice(0, 8);

      res.json({
        dateKey,
        totals,
        people,
        recentSessions: sessions.slice(0, 12),
        activities: {
          totals: {
            totalActivities: activityTotals.totalActivities,
            durationSeconds: activityTotals.durationSeconds,
            youtubeSeconds: activityTotals.youtubeSeconds,
            googleSearches: activityTotals.googleSearches,
            nonWorkSeconds: activityTotals.nonWorkSeconds,
          },
          topDomains,
          recent: visibleActivities.slice(0, 25),
          youtube: visibleActivities.filter((activity) => activity.type === "youtube").slice(0, 20),
          googleSearches: visibleActivities.filter((activity) => activity.type === "google_search").slice(0, 20),
        },
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
];

exports.getAdminRangeSummary = [
  adminOnly,
  async (req, res) => {
    try {
      const from = req.query.from || getDateKey();
      const to = req.query.to || from;
      const fromTime = new Date(`${from}T00:00:00.000Z`).getTime();
      const toTime = new Date(`${to}T00:00:00.000Z`).getTime();
      const rangeDays = Math.floor((toTime - fromTime) / 86400000) + 1;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || rangeDays < 1) {
        return res.status(400).json({ message: "Invalid date range" });
      }
      if (rangeDays > 15) {
        return res.status(400).json({ message: "Date range cannot be more than 15 days" });
      }

      const dateKeys = getDateKeysBetween(from, to);
      const [users, summaries, holidayMap] = await Promise.all([
        User.find({ role: { $nin: ["admin", "expense_manager", "customer"] } }).select("name email role department attendance").sort({ name: 1 }).lean(),
        MonitoringDailySummary.find({ dateKey: { $gte: from, $lte: to } }).lean(),
        loadHolidayMap(dateKeys),
      ]);

      const summariesByUser = summaries.reduce((map, item) => {
        const userId = item.userId?.toString();
        if (!userId) return map;
        if (!map.has(userId)) map.set(userId, []);
        map.get(userId).push(item);
        return map;
      }, new Map());

      const people = users.map((user) => {
        const userSummaries = summariesByUser.get(user._id.toString()) || [];
        const byDate = new Map(userSummaries.map((item) => [item.dateKey, item]));
        const days = [];

        for (let index = 0; index < rangeDays; index += 1) {
          const dateKey = addDaysToDateKey(from, index);
          const item = byDate.get(dateKey);
          const calendarDay = getCalendarDay(dateKey, holidayMap);
          const activeSeconds = item?.activeSeconds || 0;
          const attendanceStatus = getAttendanceStatusForCalendarDay(
            item?.attendanceStatus || "absent",
            activeSeconds,
            calendarDay,
          );
          days.push({
            dateKey,
            activeSeconds,
            idleSeconds: item?.idleSeconds || 0,
            breakSeconds: item?.breakSeconds || 0,
            totalTrackedSeconds: activeSeconds,
            requiredWorkSeconds: item?.requiredWorkSeconds || ((Number(user.attendance?.requiredHours) || 8) * 60 * 60),
            overtimeSeconds: item?.overtimeSeconds || 0,
            lateBySeconds: calendarDay.isNonWorkingDay ? 0 : item?.lateBySeconds || 0,
            attendanceStatus,
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
            totalTrackedSeconds: acc.totalTrackedSeconds + day.totalTrackedSeconds,
            requiredWorkSeconds: acc.requiredWorkSeconds + day.requiredWorkSeconds,
            overtimeSeconds: acc.overtimeSeconds + day.overtimeSeconds,
            lateDays: acc.lateDays + (day.attendanceStatus === "late" ? 1 : 0),
            absentDays: acc.absentDays + (day.attendanceStatus === "absent" ? 1 : 0),
            onTimeDays: acc.onTimeDays + (day.attendanceStatus === "on_time" ? 1 : 0),
            workedDays: acc.workedDays + (day.activeSeconds > 0 ? 1 : 0),
          }),
          { activeSeconds: 0, idleSeconds: 0, breakSeconds: 0, totalTrackedSeconds: 0, requiredWorkSeconds: 0, overtimeSeconds: 0, lateDays: 0, absentDays: 0, onTimeDays: 0, workedDays: 0 },
        );

        return { user, totals, days };
      });

      const totals = people.reduce(
        (acc, person) => ({
          activeSeconds: acc.activeSeconds + person.totals.activeSeconds,
          idleSeconds: acc.idleSeconds + person.totals.idleSeconds,
          breakSeconds: acc.breakSeconds + person.totals.breakSeconds,
          totalTrackedSeconds: acc.totalTrackedSeconds + person.totals.totalTrackedSeconds,
          overtimeSeconds: acc.overtimeSeconds + person.totals.overtimeSeconds,
          lateDays: acc.lateDays + person.totals.lateDays,
          absentDays: acc.absentDays + person.totals.absentDays,
          onTimeDays: acc.onTimeDays + person.totals.onTimeDays,
          workedDays: acc.workedDays + person.totals.workedDays,
        }),
        { activeSeconds: 0, idleSeconds: 0, breakSeconds: 0, totalTrackedSeconds: 0, overtimeSeconds: 0, lateDays: 0, absentDays: 0, onTimeDays: 0, workedDays: 0 },
      );

      res.json({ from, to, rangeDays, totals, people });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
];

exports.getMyMonitoringSummary = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("attendance role department");
    if (!user) return res.status(404).json({ message: "User not found" });

    const now = new Date();
    const todayKey = getShiftDateKey(user, now);
    const monthPrefix = todayKey.slice(0, 7);
    const requiredSeconds = (Number(user.attendance?.requiredHours) || 8) * 60 * 60;
    const monthDateKeys = getDateKeysBetween(`${monthPrefix}-01`, `${monthPrefix}-31`);

    const [todaySummary, monthlySummaries, monthlyBreaks, monthlyBreakActivities, todaySessions, firstMonitoringSession, holidayMap] = await Promise.all([
      MonitoringDailySummary.findOne({ userId: req.user.id, dateKey: todayKey }).lean(),
      MonitoringDailySummary.find({
        userId: req.user.id,
        dateKey: { $gte: `${monthPrefix}-01`, $lte: `${monthPrefix}-31` },
      }).lean(),
      MonitoringBreak.find({
        user: req.user.id,
        dateKey: { $gte: `${monthPrefix}-01`, $lte: `${monthPrefix}-31` },
      }).lean(),
      MonitoringActivity.find({
        user: req.user.id,
        dateKey: { $gte: `${monthPrefix}-01`, $lte: `${monthPrefix}-31` },
        $or: BREAK_ACTIVITY_OR,
      })
        .select("dateKey durationSeconds title windowTitle appName raw")
        .lean(),
      MonitoringSession.find({ user: req.user.id, dateKey: todayKey })
        .select("activeSeconds")
        .lean(),
      MonitoringSession.findOne({ user: req.user.id })
        .sort({ dateKey: 1, loginAt: 1, createdAt: 1 })
        .select("dateKey")
        .lean(),
      loadHolidayMap(monthDateKeys),
    ]);

    const todayRequiredSeconds = todaySummary?.requiredWorkSeconds || requiredSeconds;
    const todayActiveSeconds = todaySummary?.activeSeconds || 0;
    const todayCalendarDay = getCalendarDay(todayKey, holidayMap);
    const todaySessionActiveSeconds = todaySessions.reduce((total, session) => total + (Number(session.activeSeconds) || 0), 0);
    const todayOvertimeSeconds = Number(todaySummary?.overtimeSeconds) || Math.max(0, todaySessionActiveSeconds - todayRequiredSeconds);
    const breakSecondsByDate = sumBreaksByDate(monthlyBreaks);
    const breakActivitySecondsByDate = sumBreakActivitiesByDate(monthlyBreakActivities);
    const todayBreakSeconds = Math.max(
      Number(todaySummary?.breakSeconds) || 0,
      breakSecondsByDate.get(todayKey) || 0,
      breakActivitySecondsByDate.get(todayKey) || 0,
    );
    const today = {
      dateKey: todayKey,
      activeSeconds: todayActiveSeconds,
      idleSeconds: todaySummary?.idleSeconds || 0,
      breakSeconds: todayBreakSeconds,
      offlineSeconds: todaySummary?.offlineSeconds || 0,
      totalTrackedSeconds: todayActiveSeconds,
      requiredWorkSeconds: todayRequiredSeconds,
      overtimeSeconds: todayOvertimeSeconds,
      attendanceStatus: getAttendanceStatusForCalendarDay(todaySummary?.attendanceStatus || "not_started", todayActiveSeconds, todayCalendarDay),
      calendarStatus: todayCalendarDay.status,
      calendarLabel: todayCalendarDay.label,
      workMode: todaySummary?.workMode || null,
      progressPercent: Math.min(100, Math.round((todayActiveSeconds / (todayRequiredSeconds || 1)) * 100)),
    };

    const summaryByDate = new Map(monthlySummaries.map((item) => [item.dateKey, item]));
    const monthStartKey = `${monthPrefix}-01`;
    const monitoringStartKey = firstMonitoringSession?.dateKey || todayKey;
    const monthlyFrom = monitoringStartKey > monthStartKey ? monitoringStartKey : monthStartKey;
    const monthlyRangeDays = Math.max(
      0,
      Math.floor(
        (new Date(`${todayKey}T00:00:00.000Z`).getTime() -
          new Date(`${monthlyFrom}T00:00:00.000Z`).getTime()) /
          86400000,
      ) + 1,
    );
    const monthlyDays = [];

    for (let index = 0; index < monthlyRangeDays; index += 1) {
      const dateKey = addDaysToDateKey(monthlyFrom, index);
      const item = summaryByDate.get(dateKey);
      const isPastDay = dateKey < todayKey;
      const shouldCountAbsentToday = dateKey === todayKey && isShiftEndedForUser(user, dateKey);
      const calendarDay = getCalendarDay(dateKey, holidayMap);
      const activeSeconds = item?.activeSeconds || 0;
      const baseAttendanceStatus = item?.attendanceStatus || (isPastDay || shouldCountAbsentToday ? "absent" : "not_started");
      monthlyDays.push({
        dateKey,
        activeSeconds,
        idleSeconds: item?.idleSeconds || 0,
        breakSeconds: Math.max(
          Number(item?.breakSeconds) || 0,
          breakSecondsByDate.get(dateKey) || 0,
          breakActivitySecondsByDate.get(dateKey) || 0,
        ),
        requiredWorkSeconds: item?.requiredWorkSeconds || requiredSeconds,
        attendanceStatus: getAttendanceStatusForCalendarDay(baseAttendanceStatus, activeSeconds, calendarDay),
        calendarStatus: calendarDay.status,
        calendarLabel: calendarDay.label,
      });
    }

    const monthly = monthlyDays.reduce(
      (totals, item) => ({
        activeSeconds: totals.activeSeconds + (Number(item.activeSeconds) || 0),
        idleSeconds: totals.idleSeconds + (Number(item.idleSeconds) || 0),
        breakSeconds: totals.breakSeconds + (Number(item.breakSeconds) || 0),
        totalTrackedSeconds: totals.totalTrackedSeconds + (Number(item.activeSeconds) || 0),
        requiredWorkSeconds: totals.requiredWorkSeconds + (Number(item.requiredWorkSeconds) || requiredSeconds),
        workedDays: totals.workedDays + ((Number(item.activeSeconds) || 0) > 0 ? 1 : 0),
        onTimeDays: totals.onTimeDays + (item.attendanceStatus === "on_time" ? 1 : 0),
        lateDays: totals.lateDays + (item.attendanceStatus === "late" ? 1 : 0),
        absentDays: totals.absentDays + (item.attendanceStatus === "absent" ? 1 : 0),
      }),
      { activeSeconds: 0, idleSeconds: 0, breakSeconds: 0, totalTrackedSeconds: 0, requiredWorkSeconds: 0, workedDays: 0, onTimeDays: 0, lateDays: 0, absentDays: 0 },
    );

    res.json({
      today,
      monthly: {
        ...monthly,
        monthKey: monthPrefix,
        progressPercent: Math.min(100, Math.round((monthly.activeSeconds / (monthly.requiredWorkSeconds || 1)) * 100)),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMyMonitoringRange = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("name email role department attendance");
    if (!user) return res.status(404).json({ message: "User not found" });

    const from = req.query.from || getShiftDateKey(user, new Date());
    const to = req.query.to || from;
    const fromTime = new Date(`${from}T00:00:00.000Z`).getTime();
    const toTime = new Date(`${to}T00:00:00.000Z`).getTime();
    const rangeDays = Math.floor((toTime - fromTime) / 86400000) + 1;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || rangeDays < 1) {
      return res.status(400).json({ message: "Invalid date range" });
    }
    if (rangeDays > 15) {
      return res.status(400).json({ message: "Date range cannot be more than 15 days" });
    }

    const dateKeys = getDateKeysBetween(from, to);
    const [summaries, breaks, breakActivities, sessions, firstMonitoringSession, holidayMap] = await Promise.all([
      MonitoringDailySummary.find({
        userId: req.user.id,
        dateKey: { $gte: from, $lte: to },
      }).lean(),
      MonitoringBreak.find({
        user: req.user.id,
        dateKey: { $gte: from, $lte: to },
      }).lean(),
      MonitoringActivity.find({
        user: req.user.id,
        dateKey: { $gte: from, $lte: to },
        $or: BREAK_ACTIVITY_OR,
      })
        .select("dateKey durationSeconds title windowTitle appName raw")
        .lean(),
      MonitoringSession.find({ user: req.user.id, dateKey: { $gte: from, $lte: to } })
        .select("dateKey activeSeconds")
        .lean(),
      MonitoringSession.findOne({ user: req.user.id })
        .sort({ dateKey: 1, loginAt: 1, createdAt: 1 })
        .select("dateKey")
        .lean(),
      loadHolidayMap(dateKeys),
    ]);
    const byDate = new Map(summaries.map((item) => [item.dateKey, item]));
    const sessionsByDate = sessions.reduce((acc, session) => {
      if (!acc.has(session.dateKey)) acc.set(session.dateKey, []);
      acc.get(session.dateKey).push(session);
      return acc;
    }, new Map());
    const breakSecondsByDate = sumBreaksByDate(breaks);
    const breakActivitySecondsByDate = sumBreakActivitiesByDate(breakActivities);
    const monitoringStartKey = firstMonitoringSession?.dateKey || null;

    const days = [];
    for (let index = 0; index < rangeDays; index += 1) {
      const dateKey = addDaysToDateKey(from, index);
      const item = byDate.get(dateKey);
      const requiredWorkSeconds = item?.requiredWorkSeconds || ((Number(user.attendance?.requiredHours) || 8) * 60 * 60);
      const sessionActiveSeconds = (sessionsByDate.get(dateKey) || []).reduce((total, session) => total + (Number(session.activeSeconds) || 0), 0);
      const summaryOvertimeSeconds = Number(item?.overtimeSeconds) || 0;
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
        totalTrackedSeconds: activeSeconds,
        requiredWorkSeconds,
        overtimeSeconds: summaryOvertimeSeconds || Math.max(0, sessionActiveSeconds - requiredWorkSeconds),
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
        totalTrackedSeconds: acc.totalTrackedSeconds + day.totalTrackedSeconds,
        overtimeSeconds: acc.overtimeSeconds + day.overtimeSeconds,
        lateDays: acc.lateDays + (day.attendanceStatus === "late" ? 1 : 0),
        absentDays: acc.absentDays + (day.attendanceStatus === "absent" ? 1 : 0),
        onTimeDays: acc.onTimeDays + (day.attendanceStatus === "on_time" ? 1 : 0),
        workedDays: acc.workedDays + (day.activeSeconds > 0 ? 1 : 0),
      }),
      { activeSeconds: 0, idleSeconds: 0, breakSeconds: 0, totalTrackedSeconds: 0, overtimeSeconds: 0, lateDays: 0, absentDays: 0, onTimeDays: 0, workedDays: 0 },
    );

    res.json({ from, to, rangeDays, user, totals, days });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
