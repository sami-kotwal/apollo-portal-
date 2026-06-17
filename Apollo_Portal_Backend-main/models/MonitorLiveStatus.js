const mongoose = require("mongoose");

const monitorLiveStatusSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "MonitoringSession", index: true },
    deviceId: { type: String, required: true, index: true },
    dateKey: { type: String, required: true, index: true },
    currentApp: String,
    currentDomain: String,
    currentWindowTitle: String,
    currentBrowser: String,
    workMode: String,
    status: String,
    isIdle: { type: Boolean, default: false },
    isOnBreak: { type: Boolean, default: false },
    lastSeenAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

monitorLiveStatusSchema.index({ userId: 1, deviceId: 1 }, { unique: true });

module.exports = mongoose.model("MonitorLiveStatus", monitorLiveStatusSchema);
