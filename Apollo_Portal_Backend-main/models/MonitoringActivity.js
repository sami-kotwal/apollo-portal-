const mongoose = require("mongoose");

const monitoringActivitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MonitoringSession",
    },
    dateKey: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["application", "website", "browser_tab", "youtube", "google_search"],
      required: true,
      index: true,
    },
    url: {
      type: String,
    },
    domain: {
      type: String,
      index: true,
    },
    category: {
      type: String,
      enum: ["productive", "neutral", "unproductive", "unknown"],
    },
    appName: {
      type: String,
      index: true,
    },
    windowTitle: {
      type: String,
    },
    browser: {
      type: String,
    },
    agentRunId: {
      type: String,
      index: true,
    },
    clientActivityId: {
      type: String,
      index: true,
    },
    title: {
      type: String,
    },
    startedAt: {
      type: Date,
      required: true,
    },
    endedAt: {
      type: Date,
    },
    durationSeconds: {
      type: Number,
      default: 0,
    },
    isIdle: {
      type: Boolean,
      default: false,
      index: true,
    },
    google: {
      query: String,
    },
    youtube: {
      videoId: String,
      videoTitle: String,
      category: {
        type: String,
        default: "Uncategorized",
      },
    },
    productivity: {
      type: String,
      enum: ["work", "neutral", "non_work"],
      default: "neutral",
      index: true,
    },
    source: {
      type: String,
      enum: ["portal", "desktop_agent"],
      default: "desktop_agent",
    },
    raw: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

monitoringActivitySchema.index({ user: 1, dateKey: 1, startedAt: -1 });

module.exports = mongoose.model("MonitoringActivity", monitoringActivitySchema);
