const mongoose = require("mongoose");

const dailySummarySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    dateKey: { type: String, required: true, index: true },
    activeSeconds: { type: Number, default: 0 },
    idleSeconds: { type: Number, default: 0 },
    breakSeconds: { type: Number, default: 0 },
    allowedBreakSeconds: { type: Number, default: 3600 },
    remainingBreakSeconds: { type: Number, default: 3600 },
    extraBreakSeconds: { type: Number, default: 0 },
    offlineSeconds: { type: Number, default: 0 },
    outsideShiftSeconds: { type: Number, default: 0 },
    outsideShiftConfirmedSeconds: { type: Number, default: 0 },
    outsideShiftNotTrackedSeconds: { type: Number, default: 0 },
    totalTrackedSeconds: { type: Number, default: 0 },
    requiredWorkSeconds: { type: Number, default: 28800 },
    overtimeSeconds: { type: Number, default: 0 },
    overtimeConfirmed: { type: Boolean, default: false },
    lateBySeconds: { type: Number, default: 0 },
    firstStartTime: Date,
    lastEndTime: Date,
    workMode: String,
    attendanceStatus: String,
    calendarStatus: String,
    calendarLabel: String,
    topApps: [{ name: String, durationSeconds: Number }],
    topDomains: [{ domain: String, durationSeconds: Number }],
    productivity: {
      productiveSeconds: { type: Number, default: 0 },
      neutralSeconds: { type: Number, default: 0 },
      unproductiveSeconds: { type: Number, default: 0 },
    },
    breakSummary: {
      lunchSeconds: { type: Number, default: 0 },
      namazSeconds: { type: Number, default: 0 },
      teaSeconds: { type: Number, default: 0 },
      personalSeconds: { type: Number, default: 0 },
      otherSeconds: { type: Number, default: 0 },
    },
    lastUpdatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

dailySummarySchema.index({ userId: 1, dateKey: 1 }, { unique: true });

module.exports = mongoose.model("MonitoringDailySummary", dailySummarySchema);
