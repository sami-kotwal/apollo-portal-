const mongoose = require("mongoose");

const customerRequestSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["logo", "website", "domain", "email", "ticket"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["submitted", "reviewing", "in_progress", "domain_available", "terms_accepted", "completed", "closed"],
      default: "submitted",
      index: true,
    },
    priority: {
      type: String,
      enum: ["normal", "high", "urgent"],
      default: "normal",
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CustomerRequest", customerRequestSchema);
