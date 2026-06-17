const mongoose = require("mongoose");

const expenseFundSchema = new mongoose.Schema(
  {
    monthKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: /^\d{4}-\d{2}$/,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ExpenseFund", expenseFundSchema);
