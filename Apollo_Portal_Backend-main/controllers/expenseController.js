const Expense = require("../models/Expense");
const ExpenseFund = require("../models/ExpenseFund");

const EXPENSE_CATEGORIES = ["Tea", "Cleaning", "Wifi Bills", "Generator Bills", "Others"];

const canViewExpenses = (role) => role === "admin" || role === "expense_manager";
const canManageExpenses = (role) => role === "expense_manager";

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const getMonthKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const parsePaidFrom = (value) => {
  if (value === undefined || value === null || value === "") return "company_fund";
  if (value === "company_fund" || value === "personal") return value;
  return null;
};

exports.getExpenseCategories = (req, res) => {
  res.json(EXPENSE_CATEGORIES);
};

exports.getExpenses = async (req, res) => {
  try {
    if (!canViewExpenses(req.user.role)) {
      return res.status(403).json({ message: "Expense access required" });
    }

    const { date, month, category } = req.query;
    const filter = {};

    if (category) filter.category = category;

    if (date) {
      const selected = new Date(date);
      filter.date = {
        $gte: startOfDay(selected),
        $lt: new Date(startOfDay(selected).getTime() + 24 * 60 * 60 * 1000),
      };
    } else if (month) {
      const selected = new Date(`${month}-01`);
      filter.date = {
        $gte: startOfMonth(selected),
        $lt: new Date(selected.getFullYear(), selected.getMonth() + 1, 1),
      };
    }

    const expenses = await Expense.find(filter)
      .populate("createdBy", "name role")
      .sort({ date: -1, createdAt: -1 });

    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createExpense = async (req, res) => {
  try {
    if (!canManageExpenses(req.user.role)) {
      return res.status(403).json({ message: "Expense manager access required" });
    }

    const { title, amount, category, otherDetails, date, notes, paidFrom } = req.body;

    if (!title || amount === undefined || !category || !date) {
      return res.status(400).json({ message: "Title, amount, category, and date are required" });
    }

    if (!EXPENSE_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: "Invalid expense category" });
    }

    if (category === "Others" && !otherDetails?.trim()) {
      return res.status(400).json({ message: "Please specify the other expense type" });
    }

    const paidFromValue = parsePaidFrom(paidFrom);
    if (!paidFromValue) {
      return res.status(400).json({ message: "Invalid payment source" });
    }

    const expense = await Expense.create({
      title,
      amount: Number(amount),
      category,
      otherDetails: category === "Others" ? otherDetails.trim() : undefined,
      date,
      notes,
      paidFrom: paidFromValue,
      createdBy: req.user.id,
    });

    const populated = await Expense.findById(expense._id).populate("createdBy", "name role");
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateExpense = async (req, res) => {
  try {
    if (!canManageExpenses(req.user.role)) {
      return res.status(403).json({ message: "Expense manager access required" });
    }

    const updates = {};
    const { title, amount, category, otherDetails, date, notes, paidFrom } = req.body;

    if (title !== undefined) updates.title = title;
    if (amount !== undefined) updates.amount = Number(amount);
    if (date !== undefined) updates.date = date;
    if (notes !== undefined) updates.notes = notes;
    if (paidFrom !== undefined) {
      const paidFromValue = parsePaidFrom(paidFrom);
      if (!paidFromValue) {
        return res.status(400).json({ message: "Invalid payment source" });
      }
      updates.paidFrom = paidFromValue;
    }
    if (category !== undefined) {
      if (!EXPENSE_CATEGORIES.includes(category)) {
        return res.status(400).json({ message: "Invalid expense category" });
      }
      updates.category = category;
    }
    if (otherDetails !== undefined) updates.otherDetails = otherDetails?.trim();

    const existing = await Expense.findById(req.params.id).select("category otherDetails");
    if (!existing) return res.status(404).json({ message: "Expense not found" });

    const nextCategory = updates.category || existing.category;
    if (nextCategory === "Others" && !updates.otherDetails && !existing.otherDetails) {
      return res.status(400).json({ message: "Please specify the other expense type" });
    }

    const updateOperation = { $set: updates };
    if (nextCategory !== "Others") {
      delete updates.otherDetails;
      updateOperation.$unset = { otherDetails: "" };
    }

    const expense = await Expense.findByIdAndUpdate(req.params.id, updateOperation, {
      returnDocument: "after",
      runValidators: true,
    }).populate("createdBy", "name role");

    if (!expense) return res.status(404).json({ message: "Expense not found" });

    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    if (!canManageExpenses(req.user.role)) {
      return res.status(403).json({ message: "Expense manager access required" });
    }

    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });

    await expense.deleteOne();
    res.json({ message: "Expense deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getExpenseFund = async (req, res) => {
  try {
    if (!canViewExpenses(req.user.role)) {
      return res.status(403).json({ message: "Expense access required" });
    }

    const selectedMonth = req.query.month ? new Date(`${req.query.month}-01`) : new Date();
    const monthKey = getMonthKey(selectedMonth);
    const fund = await ExpenseFund.findOne({ monthKey }).populate("updatedBy", "name role");

    res.json(fund || { monthKey, amount: 0, notes: "" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.upsertExpenseFund = async (req, res) => {
  try {
    if (!canManageExpenses(req.user.role)) {
      return res.status(403).json({ message: "Expense manager access required" });
    }

    const { month, amount, notes } = req.body;
    if (!month || amount === undefined) {
      return res.status(400).json({ message: "Month and fund amount are required" });
    }

    const selectedMonth = new Date(`${month}-01`);
    if (Number.isNaN(selectedMonth.getTime())) {
      return res.status(400).json({ message: "Invalid month" });
    }

    const fundAmount = Number(amount);
    if (!Number.isFinite(fundAmount) || fundAmount < 0) {
      return res.status(400).json({ message: "Fund amount must be zero or greater" });
    }

    const fund = await ExpenseFund.findOneAndUpdate(
      { monthKey: getMonthKey(selectedMonth) },
      {
        amount: fundAmount,
        notes,
        updatedBy: req.user.id,
      },
      {
        returnDocument: "after",
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    ).populate("updatedBy", "name role");

    res.json(fund);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addExpenseFund = async (req, res) => {
  try {
    if (!canManageExpenses(req.user.role)) {
      return res.status(403).json({ message: "Expense manager access required" });
    }

    const { month, amount, notes } = req.body;
    if (!month || amount === undefined) {
      return res.status(400).json({ message: "Month and add amount are required" });
    }

    const selectedMonth = new Date(`${month}-01`);
    if (Number.isNaN(selectedMonth.getTime())) {
      return res.status(400).json({ message: "Invalid month" });
    }

    const addAmount = Number(amount);
    if (!Number.isFinite(addAmount) || addAmount <= 0) {
      return res.status(400).json({ message: "Add amount must be greater than zero" });
    }

    const monthKey = getMonthKey(selectedMonth);
    const existingFund = await ExpenseFund.findOne({ monthKey });
    const nextNotes = notes?.trim()
      ? [existingFund?.notes, notes.trim()].filter(Boolean).join("\n")
      : existingFund?.notes;

    const fund = await ExpenseFund.findOneAndUpdate(
      { monthKey },
      {
        $inc: { amount: addAmount },
        $set: {
          notes: nextNotes,
          updatedBy: req.user.id,
        },
      },
      {
        returnDocument: "after",
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    ).populate("updatedBy", "name role");

    res.json(fund);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getExpenseSummary = async (req, res) => {
  try {
    if (!canViewExpenses(req.user.role)) {
      return res.status(403).json({ message: "Expense access required" });
    }

    const now = new Date();
    const selectedDate = req.query.date ? new Date(req.query.date) : now;
    const selectedMonth = req.query.month ? new Date(`${req.query.month}-01`) : now;
    const dayStart = startOfDay(selectedDate);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1);
    const monthKey = getMonthKey(selectedMonth);

    const [daily, monthly, byCategory, byPaymentSource, fund] = await Promise.all([
      Expense.aggregate([
        { $match: { date: { $gte: dayStart, $lt: dayEnd } } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Expense.aggregate([
        { $match: { date: { $gte: monthStart, $lt: monthEnd } } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Expense.aggregate([
        { $match: { date: { $gte: monthStart, $lt: monthEnd } } },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: ["$category", "Others"] },
                { $concat: ["Others: ", { $ifNull: ["$otherDetails", "Unspecified"] }] },
                "$category",
              ],
            },
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
      ]),
      Expense.aggregate([
        { $match: { date: { $gte: monthStart, $lt: monthEnd } } },
        {
          $group: {
            _id: { $ifNull: ["$paidFrom", "company_fund"] },
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      ExpenseFund.findOne({ monthKey }).populate("updatedBy", "name role"),
    ]);

    const companySpent = byPaymentSource.find((item) => item._id === "company_fund")?.total || 0;
    const personalPaid = byPaymentSource.find((item) => item._id === "personal")?.total || 0;
    const totalSpentAgainstFund = companySpent + personalPaid;
    const fundAmount = fund?.amount || 0;

    res.json({
      daily: daily[0] || { total: 0, count: 0 },
      monthly: monthly[0] || { total: 0, count: 0 },
      byCategory,
      byPaymentSource,
      fund: fund || { monthKey, amount: 0, notes: "" },
      companySpent,
      personalPaid,
      spentAgainstFund: totalSpentAgainstFund,
      remainingFund: Math.max(fundAmount - totalSpentAgainstFund, 0),
      overBudget: Math.max(totalSpentAgainstFund - fundAmount, 0),
      reimbursementDue: personalPaid,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
