const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },

    description: {
      type: String,
    },
    services:[
      {
        type: String,
      }
    ],
    media: [
      {
        type: String,
      }
    ],

    // PM who created task
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // department (development / designing)
    department: {
      type: String,
      enum: ["development", "designing"],
      required: true,
    },

    // assigned by team leader
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // assigned to dev/designer/teamleader
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    status: {
      type: String,
      enum: ["pending", "in-progress", "completed"],
      default: "pending",
    },

    deadline: {
      type: Date,
    },

    assignedAt: {
      type: Date,
    },

    completedAt: {
      type: Date,
    },

    submission: {
      type: String, // link for now
    },

    submissionMessage: {
      type: String,
      trim: true,
    },

    reviewSubmission: {
      type: String,
    },

    reviewSubmissionMessage: {
      type: String,
      trim: true,
    },

    reviewStatus: {
      type: String,
      enum: ["none", "pending", "changes_requested", "approved"],
      default: "none",
    },

    reviewComment: {
      type: String,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    reviewedAt: {
      type: Date,
    },

    takeBackHistory: [
      {
        takenFrom: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        takenBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        date: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    comments: [
      {
        text: String,
        by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        date: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", taskSchema);
