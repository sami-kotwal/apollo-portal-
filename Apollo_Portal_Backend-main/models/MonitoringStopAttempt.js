const mongoose = require("mongoose");

const monitoringStopAttemptSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    dateKey: {
      type: String,
      required: true,
      index: true,
    },
    success: {
      type: Boolean,
      required: true,
      index: true,
    },
    reason: {
      type: String,
      enum: ["pin_valid", "pin_invalid"],
      required: true,
    },
    hostName: String,
    instanceId: String,
    appVersion: String,
    ipAddress: String,
    userAgent: String,
  },
  { timestamps: true }
);

monitoringStopAttemptSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("MonitoringStopAttempt", monitoringStopAttemptSchema);
