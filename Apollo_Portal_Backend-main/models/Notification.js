const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  message: String,
  entityType: {
    type: String,
    enum: ["task", "comment", "system", null],
    default: null,
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  action: String,
  metadata: {
    type: mongoose.Schema.Types.Mixed,
  },
  read: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

module.exports = mongoose.model("Notification", notificationSchema);
