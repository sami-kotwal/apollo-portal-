const router = require("express").Router();
const Notification = require("../models/Notification");
const Task = require("../models/Task");
const { protect } = require("../middleware/authMiddleware");

const idsEqual = (left, right) => left && right && left.toString() === right.toString();

const getName = (user, fallback = "A team member") => user?.name || user?.email || fallback;

const minutesBetween = (left, right) => {
  if (!left || !right) return Number.POSITIVE_INFINITY;
  return Math.abs(new Date(left).getTime() - new Date(right).getTime()) / 60000;
};

const closestTask = (tasks, notification, predicate, dateSelector) => {
  const matches = tasks
    .filter(predicate)
    .map((task) => ({
      task,
      distance: minutesBetween(notification.createdAt, dateSelector(task)),
    }))
    .sort((a, b) => a.distance - b.distance);

  return matches[0]?.task || null;
};

const taskPayload = (notification, task, displayMessage, action = "task_activity") => ({
  ...notification,
  message: displayMessage || notification.message,
  displayMessage: displayMessage || notification.message,
  entityType: "task",
  entityId: task?._id,
  action: notification.action || action,
  metadata: {
    ...(notification.metadata || {}),
    ...(task ? { taskTitle: task.title } : {}),
    inferredLink: !notification.entityId,
  },
});

const isTaskMessage = (message) =>
  /\b(task|deadline|revision|comment|approved|changes|submitted|assigned|completed|uploaded)\b/i.test(message);

const inferTaskLink = (notification, tasks = []) => {
  if (notification.entityType === "task" && notification.entityId) {
    return {
      ...notification,
      displayMessage: notification.message,
    };
  }

  const message = String(notification.message || "").toLowerCase();
  const matchedTask = tasks.find((task) => {
    const title = String(task.title || "").trim();
    return title && message.includes(title.toLowerCase());
  });

  if (matchedTask) {
    return taskPayload(notification, matchedTask, null);
  }

  const assignedTask = closestTask(
    tasks,
    notification,
    (task) => idsEqual(task.assignedTo?._id || task.assignedTo, notification.user),
    (task) => task.assignedAt || task.createdAt,
  );
  if (/you have been assigned a task/i.test(notification.message || "") && assignedTask) {
    return taskPayload(
      notification,
      assignedTask,
      `${getName(assignedTask.assignedBy)} assigned you a task: ${assignedTask.title}`,
      "task_assigned",
    );
  }

  const reviewedTask = closestTask(
    tasks,
    notification,
    (task) => idsEqual(task.assignedTo?._id || task.assignedTo, notification.user) && task.reviewedAt,
    (task) => task.reviewedAt,
  );
  if (/team leader approved your task/i.test(notification.message || "") && reviewedTask) {
    return taskPayload(
      notification,
      reviewedTask,
      `${getName(reviewedTask.reviewedBy)} approved your task: ${reviewedTask.title}. You can upload now.`,
      "review_approved",
    );
  }
  if (/team leader requested changes/i.test(notification.message || "") && reviewedTask) {
    return taskPayload(
      notification,
      reviewedTask,
      `${getName(reviewedTask.reviewedBy)} requested changes on task: ${reviewedTask.title}`,
      "changes_requested",
    );
  }

  const submittedForReviewTask = closestTask(
    tasks,
    notification,
    (task) => idsEqual(task.assignedBy?._id || task.assignedBy, notification.user) && task.reviewSubmission,
    (task) => task.updatedAt,
  );
  if (/task submitted for team leader review/i.test(notification.message || "") && submittedForReviewTask) {
    return taskPayload(
      notification,
      submittedForReviewTask,
      `${getName(submittedForReviewTask.assignedTo)} submitted task for your review: ${submittedForReviewTask.title}`,
      "review_submitted",
    );
  }

  const completedTask = closestTask(
    tasks,
    notification,
    (task) =>
      (idsEqual(task.assignedBy?._id || task.assignedBy, notification.user) ||
        idsEqual(task.createdBy?._id || task.createdBy, notification.user)) &&
      task.completedAt,
    (task) => task.completedAt,
  );
  if (/(approved task has been uploaded|task completed)/i.test(notification.message || "") && completedTask) {
    return taskPayload(
      notification,
      completedTask,
      `${getName(completedTask.assignedTo)} completed task: ${completedTask.title}`,
      "task_completed",
    );
  }

  if (isTaskMessage(notification.message || "")) {
    return taskPayload(notification, null, null);
  }

  return {
    ...notification,
    displayMessage: notification.message,
  };
};

router.get("/", protect, async (req, res) => {
  const data = await Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).lean();
  const needsInference = data.some((notification) => !notification.entityId && notification.message);

  if (!needsInference) return res.json(data);

  const tasks = await Task.find({
    $or: [
      { assignedTo: req.user.id },
      { assignedBy: req.user.id },
      { createdBy: req.user.id },
    ],
  })
    .select("_id title assignedTo assignedBy createdBy assignedAt reviewedBy reviewedAt reviewSubmission completedAt updatedAt createdAt")
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("createdBy", "name email")
    .populate("reviewedBy", "name email")
    .lean();

  const sortedTasks = tasks.sort((a, b) => String(b.title || "").length - String(a.title || "").length);
  res.json(data.map((notification) => inferTaskLink(notification, sortedTasks)));
});

router.put("/:id/read", protect, async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    { read: true },
    { returnDocument: "after" }
  );

  if (!notification) return res.status(404).json({ message: "Notification not found" });

  res.json(notification);
});

router.put("/read-all", protect, async (req, res) => {
  await Notification.updateMany({ user: req.user.id, read: false }, { read: true });
  res.json({ message: "Notifications marked as read" });
});

router.delete("/:id", protect, async (req, res) => {
  const notification = await Notification.findOneAndDelete({
    _id: req.params.id,
    user: req.user.id,
  });

  if (!notification) return res.status(404).json({ message: "Notification not found" });

  res.json({ message: "Notification deleted" });
});

module.exports = router;
