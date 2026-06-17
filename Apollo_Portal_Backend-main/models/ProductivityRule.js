const mongoose = require("mongoose");

const productivityRuleSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["app", "domain"],
      required: true,
      index: true,
    },
    value: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      enum: ["productive", "neutral", "unproductive", "unknown"],
      required: true,
      default: "unknown",
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

productivityRuleSchema.index({ type: 1, value: 1 }, { unique: true });

module.exports = mongoose.model("ProductivityRule", productivityRuleSchema);
