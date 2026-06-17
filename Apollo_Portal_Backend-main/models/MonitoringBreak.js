const mongoose = require("mongoose");

const monitoringBreakSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: "MonitoringSession", index: true },
    dateKey: { type: String, required: true, index: true },
    breakType: {
      type: String,
      enum: ["lunch", "namaz", "tea", "personal", "other"],
      required: true,
      index: true,
    },
    startedAt: { type: Date, required: true },
    endedAt: Date,
    durationSeconds: { type: Number, default: 0 },
  },
  { timestamps: true }
);

monitoringBreakSchema.index({ user: 1, dateKey: 1, startedAt: -1 });

module.exports = mongoose.model("MonitoringBreak", monitoringBreakSchema);
