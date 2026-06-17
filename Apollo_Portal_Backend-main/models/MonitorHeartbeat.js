const mongoose = require("mongoose");

const monitorHeartbeatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MonitoringSession",
      index: true,
    },
    deviceId: {
      type: String,
      required: true,
      index: true,
    },
    currentApp: String,
    currentDomain: String,
    currentWindowTitle: String,
    isIdle: {
      type: Boolean,
      default: false,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

monitorHeartbeatSchema.index({ userId: 1, timestamp: -1 });
monitorHeartbeatSchema.index({ timestamp: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

module.exports = mongoose.model("MonitorHeartbeat", monitorHeartbeatSchema);
