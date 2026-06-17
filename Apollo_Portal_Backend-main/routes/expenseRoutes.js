const express = require("express");
const {
  getExpenseCategories,
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseSummary,
  getExpenseFund,
  upsertExpenseFund,
  addExpenseFund,
} = require("../controllers/expenseController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get("/categories", getExpenseCategories);
router.get("/summary", getExpenseSummary);
router.get("/fund", getExpenseFund);
router.post("/fund/add", addExpenseFund);
router.put("/fund", upsertExpenseFund);
router.get("/", getExpenses);
router.post("/", createExpense);
router.put("/:id", updateExpense);
router.delete("/:id", deleteExpense);

module.exports = router;
