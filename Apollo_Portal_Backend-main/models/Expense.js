const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    category: {
      type: String,
      enum: ["Tea", "Cleaning", "Wifi Bills", "Generator Bills", "Others"],
      required: true,
    },
    otherDetails: {
      type: String,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    paidFrom: {
      type: String,
      enum: ["company_fund", "personal"],
      default: "company_fund",
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Expense", expenseSchema);
