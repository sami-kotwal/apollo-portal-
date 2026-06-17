const mongoose = require("mongoose");

const monitorDeviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    deviceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    deviceName: {
      type: String,
      required: true,
    },
    os: {
      type: String,
    },
    machineIdentifier: {
      type: String,
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

monitorDeviceSchema.index({ userId: 1, isActive: 1 });

module.exports = mongoose.model("MonitorDevice", monitorDeviceSchema);
