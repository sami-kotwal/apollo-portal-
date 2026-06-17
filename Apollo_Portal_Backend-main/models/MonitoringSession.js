const mongoose = require("mongoose");

const monitoringSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      required: true,
    },
    department: {
      type: String,
    },
    dateKey: {
      type: String,
      required: true,
      index: true,
    },
    deviceId: {
      type: String,
      index: true,
    },
    shiftStart: {
      type: String,
    },
    shiftEnd: {
      type: String,
    },
    attendanceUpdatedAt: {
      type: Date,
    },
    loginTime: {
      type: Date,
    },
    logoutTime: {
      type: Date,
    },
    workedMinutes: {
      type: Number,
      default: 0,
    },
    overtimeMinutes: {
      type: Number,
      default: 0,
    },
    lateMinutes: {
      type: Number,
      default: 0,
    },
    attendanceStatus: {
      type: String,
      enum: ["not_started", "on_time", "late", "absent", "disabled", "off_day", "holiday", "worked_on_holiday"],
      default: "not_started",
      index: true,
    },
    loginAt: {
      type: Date,
      default: Date.now,
    },
    logoutAt: {
      type: Date,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    activeSeconds: {
      type: Number,
      default: 0,
    },
    idleSeconds: {
      type: Number,
      default: 0,
    },
    breakSeconds: {
      type: Number,
      default: 0,
    },
    offlineSeconds: {
      type: Number,
      default: 0,
    },
    preShiftSeconds: {
      type: Number,
      default: 0,
    },
    outsideShiftSeconds: {
      type: Number,
      default: 0,
    },
    outsideShiftConfirmedSeconds: {
      type: Number,
      default: 0,
    },
    outsideShiftNotTrackedSeconds: {
      type: Number,
      default: 0,
    },
    totalSeconds: {
      type: Number,
      default: 0,
    },
    requiredSeconds: {
      type: Number,
      default: 0,
    },
    allowedBreakSeconds: {
      type: Number,
      default: 3600,
    },
    workMode: {
      type: String,
      enum: [
        "pre_shift",
        "regular_shift",
        "extended_regular",
        "overtime",
        "on_break",
        "idle",
        "offline",
        "completed",
        "outside_shift",
        "outside_shift_not_tracking",
        "completed_waiting",
        "after_shift_not_tracking",
      ],
      default: "regular_shift",
      index: true,
    },
    status: {
      type: String,
      enum: ["online", "active", "on_break", "idle", "offline", "completed", "incomplete_shift", "completed_waiting"],
      default: "online",
      index: true,
    },
    stoppedManually: {
      type: Boolean,
      default: false,
      index: true,
    },
    stopReason: {
      type: String,
      enum: ["manual_pin", "heartbeat_timeout", "logout", "shift_end", "date_rollover", "switch_user"],
    },
    stoppedAt: {
      type: Date,
    },
    outsideShiftConfirmed: {
      type: Boolean,
      default: false,
    },
    overtimeConfirmed: {
      type: Boolean,
      default: false,
    },
    overtimePromptShownAt: Date,
    outsideShiftPromptShownAt: Date,
    currentUrl: {
      type: String,
    },
    currentTitle: {
      type: String,
    },
    currentApp: {
      type: String,
    },
    currentBrowser: {
      type: String,
    },
    portalPath: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  { timestamps: true }
);

monitoringSessionSchema.index({ user: 1, dateKey: 1, status: 1 });

module.exports = mongoose.model("MonitoringSession", monitoringSessionSchema);
