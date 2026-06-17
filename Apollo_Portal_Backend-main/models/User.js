const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    tokenVersion: {
      type: Number,
      default: 0,
      min: 0,
    },
    role: {
      type: String,
      enum: [
        "admin",
        "pm",
        "teamleader_dev",
        "teamleader_design",
        "developer",
        "designer",
        "expense_manager",
        "customer",
      ],
      required: true,
    },
    department: {
      type: String,
      enum: ["development", "designing"],
    },
    attendance: {
      enabled: {
        type: Boolean,
        default: true,
      },
      startTime: {
        type: String,
        default: "09:00",
      },
      endTime: {
        type: String,
        default: "17:00",
      },
      requiredHours: {
        type: Number,
        default: 8,
        min: 0.05,
      },
      graceMinutes: {
        type: Number,
        default: 0,
        min: 0,
      },
      allowEarlyWork: {
        type: Boolean,
        default: true,
      },
      allowedBreakMinutes: {
        type: Number,
        default: 60,
        min: 0,
      },
      autoStartOvertime: {
        type: Boolean,
        default: false,
      },
      updatedAt: {
        type: Date,
        default: Date.now,
      },
    },
    customerProfile: {
      companyName: {
        type: String,
        default: "",
      },
      phone: {
        type: String,
        default: "",
      },
      selectedPackages: {
        type: [mongoose.Schema.Types.Mixed],
        default: [],
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
