const express = require("express");
const router = express.Router();

const {
  createTask,
  getTasks,
  assignTask,
  submitWork,
  removeSubmission,
  reviewSubmission,
  addComment,
  updateTask,
  deleteTask,
} = require("../controllers/taskController");

const { protect } = require("../middleware/authMiddleware");

// 🔐 protect all routes
router.use(protect);

// routes
router.post("/", createTask);
router.get("/", getTasks);

router.put("/assign", assignTask);
router.put("/submit", submitWork);
router.put("/review-submission", reviewSubmission);
router.post("/comment", addComment);
router.delete("/:id/submission", removeSubmission);
router.put("/:id", updateTask);
router.delete("/:id", deleteTask);

module.exports = router;
