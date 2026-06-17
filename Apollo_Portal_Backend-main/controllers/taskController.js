const Task = require("../models/Task");
const User = require("../models/User");
const { createNotification } = require("../utills/Notify");

const getActorName = async (userId) => {
  const user = await User.findById(userId).select("name");
  return user?.name || "A team member";
};

const isDeadlineNear = (deadline) => {
  if (!deadline) return false;

  const dueTime = new Date(deadline).getTime();
  if (Number.isNaN(dueTime)) return false;

  const now = Date.now();
  const twoDays = 2 * 24 * 60 * 60 * 1000;

  return dueTime >= now && dueTime - now <= twoDays;
};

const formatDeadline = (deadline) => {
  if (!deadline) return "";

  const raw = String(deadline);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const dateKey = match ? `${match[1]}-${match[2]}-${match[3]}` : new Date(deadline).toISOString().slice(0, 10);
  const [year, month, day] = dateKey.split("-");

  return `${month}/${day}/${year}`;
};

const isPmOrAdmin = (role) => role === "admin" || role === "pm";
const teamLeaderDepartment = (role) => {
  if (role === "teamleader_dev") return "development";
  if (role === "teamleader_design") return "designing";
  return null;
};

const canAccessTask = (task, user) => {
  if (isPmOrAdmin(user.role)) return true;
  if (teamLeaderDepartment(user.role) === task.department) return true;
  return task.assignedTo?.toString() === user.id || task.createdBy?.toString() === user.id;
};


// 🔹 CREATE TASK
const taskNotification = (task, action, metadata = {}) => ({
  entityType: "task",
  entityId: task._id,
  action,
  metadata: {
    taskTitle: task.title,
    department: task.department,
    ...metadata,
  },
});

exports.createTask = async (req, res) => {
  try {
    const { title, description, department, services, media, deadline } = req.body;

    if (!isPmOrAdmin(req.user.role)) {
      return res.status(403).json({ message: "Only PM or admin can create tasks" });
    }

    if (!["development", "designing"].includes(department)) {
      return res.status(400).json({ message: "Invalid task department" });
    }

    const task = await Task.create({
      title,
      description,
      department,
      services,
      media,
      deadline,
      createdBy: req.user.id,
    });

    const teamLeaderRole = department === "development" ? "teamleader_dev" : "teamleader_design";
    const teamLeaders = await User.find({ role: teamLeaderRole }).select("_id");
    const actorName = await getActorName(req.user.id);

    await Promise.all(
      teamLeaders.map((leader) =>
        createNotification(
          leader._id,
          `${actorName} created a new ${department === "development" ? "development" : "design"} task: ${title}${
            deadline ? ` (deadline: ${formatDeadline(deadline)})` : ""
          }`,
          taskNotification(task, "task_created", { actorId: req.user.id })
        )
      )
    );

    if (isDeadlineNear(deadline)) {
      await Promise.all(
        teamLeaders.map((leader) =>
          createNotification(
            leader._id,
            `Deadline alert: ${title} is due on ${formatDeadline(deadline)}`,
            taskNotification(task, "deadline_alert", { actorId: req.user.id })
          )
        )
      );
    }

    res.status(201).json(task);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// 🔹 GET TASKS
exports.getTasks = async (req, res) => {
  try {
    const user = req.user;
    let tasks;

    if (user.role === "admin" || user.role === "pm") {
      tasks = await Task.find()
        .sort({ createdAt: -1, _id: -1 })
        .populate("assignedTo", "name")
        .populate("assignedBy", "name")
        .populate("createdBy", "name")
        .populate("takeBackHistory.takenFrom", "name role")
        .populate("takeBackHistory.takenBy", "name role");
    }

    else if (user.role === "teamleader_dev") {
      tasks = await Task.find({ department: "development" })
        .sort({ createdAt: -1, _id: -1 })
        .populate("assignedTo", "name")
        .populate("assignedBy", "name")
        .populate("createdBy", "name")
        .populate("takeBackHistory.takenFrom", "name role")
        .populate("takeBackHistory.takenBy", "name role");
    }

    else if (user.role === "teamleader_design") {
      tasks = await Task.find({ department: "designing" })
        .sort({ createdAt: -1, _id: -1 })
        .populate("assignedTo", "name")
        .populate("assignedBy", "name")
        .populate("createdBy", "name")
        .populate("takeBackHistory.takenFrom", "name role")
        .populate("takeBackHistory.takenBy", "name role");
    }

    else {
      tasks = await Task.find({ assignedTo: user.id })
        .sort({ createdAt: -1, _id: -1 })
        .populate("assignedTo", "name")
        .populate("assignedBy", "name")
        .populate("createdBy", "name")
        .populate("takeBackHistory.takenFrom", "name role")
        .populate("takeBackHistory.takenBy", "name role");
    }

    res.json(tasks);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// 🔹 ASSIGN TASK
exports.assignTask = async (req, res) => {
  try {
    const { taskId, userId } = req.body;

    const task = await Task.findById(taskId);

    if (!task) return res.status(404).json({ message: "Task not found" });

    const previousAssignedTo = task.assignedTo?.toString();
    const isTeamLeader = req.user.role === "teamleader_dev" || req.user.role === "teamleader_design";
    const leaderDepartment = teamLeaderDepartment(req.user.role);
    const canAssign =
      isPmOrAdmin(req.user.role) ||
      (isTeamLeader && leaderDepartment === task.department);

    if (!canAssign) {
      return res.status(403).json({ message: "Not allowed to assign this task" });
    }

    const assignee = await User.findById(userId).select("role department");
    if (!assignee) return res.status(404).json({ message: "Assignee not found" });
    if (
      task.department === "development" &&
      !["developer", "teamleader_dev"].includes(assignee.role)
    ) {
      return res.status(400).json({ message: "Assignee must be in development" });
    }
    if (
      task.department === "designing" &&
      !["designer", "teamleader_design"].includes(assignee.role)
    ) {
      return res.status(400).json({ message: "Assignee must be in designing" });
    }

    const isTakingBack = isTeamLeader && previousAssignedTo && previousAssignedTo !== req.user.id && userId === req.user.id;

    if (isTakingBack) {
      task.takeBackHistory.push({
        takenFrom: previousAssignedTo,
        takenBy: req.user.id,
      });

      task.reviewSubmission = undefined;
      task.reviewStatus = "none";
      task.reviewComment = "";
      task.reviewedBy = undefined;
      task.reviewedAt = undefined;
    }

    task.assignedTo = userId;
    task.assignedBy = req.user.id;
    task.status = "in-progress";
    task.assignedAt = new Date();

    await task.save();

    // 🔔 NOTIFY ASSIGNED USER
    const actorName = await getActorName(req.user.id);
    await createNotification(
      userId,
      isTakingBack
        ? `${actorName} took back task: ${task.title}`
        : `${actorName} assigned you a task: ${task.title}${task.deadline ? ` (due ${formatDeadline(task.deadline)})` : ""}`,
      taskNotification(task, isTakingBack ? "task_taken_back" : "task_assigned", { actorId: req.user.id })
    );

    if (isTakingBack) {
      await createNotification(
        previousAssignedTo,
        `${actorName} took back task: ${task.title}`,
        taskNotification(task, "task_taken_back", { actorId: req.user.id })
      );
    }

    if (isDeadlineNear(task.deadline)) {
      await createNotification(
        userId,
        `Deadline alert: ${task.title} is due on ${formatDeadline(task.deadline)}`,
        taskNotification(task, "deadline_alert", { actorId: req.user.id })
      );
      if (task.assignedBy) {
        await createNotification(
          task.assignedBy,
          `Deadline alert: ${task.title} is due on ${formatDeadline(task.deadline)}`,
          taskNotification(task, "deadline_alert", { actorId: req.user.id })
        );
      }
    }

    res.json(task);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// 🔹 SUBMIT WORK
exports.submitWork = async (req, res) => {
  try {
    const { taskId, submission, message } = req.body;
    const submissionMessage = message?.trim();

    const task = await Task.findById(taskId);

    if (!task) return res.status(404).json({ message: "Task not found" });
    if (!submission) return res.status(400).json({ message: "Submission link is required" });

    const isContributor = req.user.role === "developer" || req.user.role === "designer";
    const isTeamLeader = req.user.role === "teamleader_dev" || req.user.role === "teamleader_design";
    const isAssignedUser = task.assignedTo?.toString() === req.user.id;

    if (isContributor) {
      if (!isAssignedUser) {
        return res.status(403).json({ message: "You can only submit your assigned task" });
      }

      if (task.reviewStatus === "approved") {
        const hadFinalSubmission = Boolean(task.submission);
        const actorName = await getActorName(req.user.id);

        task.submission = submission;
        task.submissionMessage = submissionMessage;
        task.status = "completed";
        task.completedAt = new Date();

        await task.save();

        await createNotification(
          task.createdBy,
          hadFinalSubmission
            ? `${actorName} updated the submitted work after your feedback`
            : `${actorName} submitted approved work: ${task.title}`,
          taskNotification(task, "pm_submission", { actorId: req.user.id })
        );
        if (task.assignedBy) {
          await createNotification(
            task.assignedBy,
            `${actorName} uploaded approved work: ${task.title}`,
            taskNotification(task, "pm_submission", { actorId: req.user.id })
          );
        }

        return res.json(task);
      }

      task.reviewSubmission = submission;
      task.reviewSubmissionMessage = submissionMessage;
      task.reviewStatus = "pending";
      task.reviewComment = "";
      task.reviewedBy = undefined;
      task.reviewedAt = undefined;

      await task.save();

      const actorName = await getActorName(req.user.id);
      if (task.assignedBy) {
        await createNotification(
          task.assignedBy,
          `${actorName} submitted task for your review: ${task.title}`,
          taskNotification(task, "review_submitted", { actorId: req.user.id })
        );
      }

      return res.json(task);
    }

    if (isTeamLeader && !isAssignedUser) {
      return res.status(403).json({ message: "You can only upload your own assigned task directly" });
    }

    const hadFinalSubmission = Boolean(task.submission);
    const actorName = await getActorName(req.user.id);

    task.submission = submission;
    task.submissionMessage = submissionMessage;
    task.status = "completed";
    task.completedAt = new Date();

    await task.save();

    // 🔔 NOTIFY PM + TEAM LEADER
    await createNotification(
      task.createdBy,
      hadFinalSubmission
        ? `${actorName} updated the submitted work after your feedback`
        : `${actorName} submitted completed work: ${task.title}`,
      taskNotification(task, "pm_submission", { actorId: req.user.id })
    );
    if (task.assignedBy) {
      await createNotification(
        task.assignedBy,
        `${actorName} completed task: ${task.title}`,
        taskNotification(task, "task_completed", { actorId: req.user.id })
      );
    }

    res.json(task);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// REMOVE OWN SUBMISSION
exports.removeSubmission = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) return res.status(404).json({ message: "Task not found" });

    const isAssignedUser = task.assignedTo?.toString() === req.user.id;
    const canManageSubmission =
      isAssignedUser ||
      req.user.role === "admin" ||
      req.user.role === "pm";

    if (!canManageSubmission) {
      return res.status(403).json({ message: "Not allowed to remove this submission" });
    }

    if (task.submission) {
      task.submission = undefined;
      task.submissionMessage = undefined;
      task.status = "in-progress";
      task.completedAt = undefined;
    } else if (task.reviewSubmission) {
      task.reviewSubmission = undefined;
      task.reviewSubmissionMessage = undefined;
      task.reviewStatus = "none";
      task.reviewComment = "";
      task.reviewedBy = undefined;
      task.reviewedAt = undefined;
    }

    await task.save();

    res.json(task);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// TEAM LEADER REVIEW
exports.reviewSubmission = async (req, res) => {
  try {
    const { taskId, decision, comment } = req.body;

    const task = await Task.findById(taskId);

    if (!task) return res.status(404).json({ message: "Task not found" });
    if (!task.reviewSubmission) return res.status(400).json({ message: "No review submission found" });

    const canReviewDevelopment = req.user.role === "teamleader_dev" && task.department === "development";
    const canReviewDesign = req.user.role === "teamleader_design" && task.department === "designing";

    if (!canReviewDevelopment && !canReviewDesign) {
      return res.status(403).json({ message: "Not allowed to review this task" });
    }

    if (decision !== "approved" && decision !== "changes_requested") {
      return res.status(400).json({ message: "Invalid review decision" });
    }

    const reviewText = comment || (decision === "approved" ? "You can upload now" : "Changes requested");

    task.reviewStatus = decision;
    task.reviewComment = reviewText;
    task.reviewedBy = req.user.id;
    task.reviewedAt = new Date();

    task.comments.push({
      text: reviewText,
      by: req.user.id,
    });

    await task.save();
    const actorName = await getActorName(req.user.id);

    if (task.assignedTo) {
      await createNotification(
        task.assignedTo,
        decision === "approved"
          ? `${actorName} approved your task: ${task.title}. You can upload now.`
          : `${actorName} requested changes on task: ${task.title}`,
        taskNotification(task, decision === "approved" ? "review_approved" : "changes_requested", { actorId: req.user.id })
      );
    }

    res.json(task);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// 🔹 COMMENT
exports.addComment = async (req, res) => {
  try {
    const { taskId, text } = req.body;

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });
    if (!canAccessTask(task, req.user)) {
      return res.status(403).json({ message: "Not allowed to comment on this task" });
    }
    if (!text || !String(text).trim()) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    const commentText = String(text).trim();
    const isPmFeedback = isPmOrAdmin(req.user.role) && task.submission;

    task.comments.push({
      text: commentText,
      by: req.user.id,
    });

    if (isPmFeedback) {
      task.status = "in-progress";
      task.completedAt = undefined;
    }

    await task.save();

    // 🔔 NOTIFY ASSIGNED USER
    const recipients = new Set(
      [task.assignedTo, task.assignedBy]
        .filter(Boolean)
        .map((userId) => userId.toString())
        .filter((userId) => userId !== req.user.id)
    );
    const actorName = await getActorName(req.user.id);
    const message = isPmFeedback
      ? `${actorName} requested revision for "${task.title}": ${commentText}`
      : `${actorName} commented on task "${task.title}": ${commentText}`;

    await Promise.all(
      [...recipients].map((userId) =>
        createNotification(
          userId,
          message,
          taskNotification(task, isPmFeedback ? "revision_requested" : "comment_added", { actorId: req.user.id })
        )
      )
    );

    res.json(task);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE TASK
exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) return res.status(404).json({ message: "Task not found" });
    if (!isPmOrAdmin(req.user.role)) {
      return res.status(403).json({ message: "Only PM or admin can edit tasks" });
    }

    const { title, description, department, services, media, deadline } = req.body;

    if (department && !["development", "designing"].includes(department)) {
      return res.status(400).json({ message: "Invalid task department" });
    }

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (department !== undefined) task.department = department;
    if (services !== undefined) task.services = Array.isArray(services) ? services : [];
    if (media !== undefined) task.media = Array.isArray(media) ? media : [];
    if (deadline !== undefined) task.deadline = deadline || undefined;

    await task.save();

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// DELETE TASK
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) return res.status(404).json({ message: "Task not found" });

    const isAdmin = req.user.role === "admin";
    const isPm = req.user.role === "pm";
    const isCreator = task.createdBy?.toString() === req.user.id;

    if (!isAdmin && !isPm && !isCreator) {
      return res.status(403).json({ message: "Not allowed to delete this task" });
    }

    await task.deleteOne();

    res.json({ message: "Task deleted" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
