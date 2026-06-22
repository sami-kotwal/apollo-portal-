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
      clientStatus: {
        type: String,
        enum: ["active", "retention", "payment_due", "upsell"],
        default: "active",
      },
      trackingStatusColor: {
        type: String,
        enum: ["", "green", "yellow", "red"],
        default: "",
      },
      paymentReceiveDate: {
        type: String,
        default: "",
        match: [/^$|^\d{4}-\d{2}-\d{2}$/, "Payment receive date must use YYYY-MM-DD"],
      },
      paymentStatus: {
        type: String,
        enum: ["", "pending", "payment_due", "follow_up", "collected"],
        default: "",
      },
      paymentFollowUpHistory: {
        type: [
          {
            reminderKey: {
              type: String,
              required: true,
            },
            type: {
              type: String,
              enum: ["payment_details_updated", "payment_reminder", "payment_due_today"],
              required: true,
            },
            paymentReceiveDate: {
              type: String,
              default: "",
            },
            paymentStatus: {
              type: String,
              enum: ["", "pending", "payment_due", "follow_up", "collected"],
              default: "",
            },
            message: {
              type: String,
              default: "",
            },
            actor: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "User",
              default: null,
            },
            createdAt: {
              type: Date,
              default: Date.now,
            },
          },
        ],
        default: [],
      },
      profileImage: {
        type: String,
        default: "",
      },
      screenshotImage: {
        type: String,
        default: "",
      },
      screenshots: {
        type: [String],
        default: [],
      },
      callRecordingLinks: {
        type: [String],
        default: [],
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
