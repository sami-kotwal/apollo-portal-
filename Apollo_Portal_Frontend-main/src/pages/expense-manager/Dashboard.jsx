import { Routes, Route } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import API from "../../services/api";
import Notifications from "../Notifications";
import ExpenseAnalytics from "../../components/ExpenseAnalytics";
import { formatMoney } from "../../utils/money";

const categories = ["Tea", "Cleaning", "Wifi Bills", "Generator Bills", "Others"];
const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);

function ExpenseForm({ form, setForm, onSubmit, saving, editingId, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 lg:grid-cols-6">
      <input
        value={form.title}
        onChange={(event) => setForm({ ...form, title: event.target.value })}
        className="rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
        placeholder="Expense title"
        required
      />
      <input
        type="number"
        min="0"
        value={form.amount}
        onChange={(event) => setForm({ ...form, amount: event.target.value })}
        className="rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
        placeholder="Amount"
        required
      />
      <select
        value={form.category}
        onChange={(event) => setForm({ ...form, category: event.target.value, otherDetails: event.target.value === "Others" ? form.otherDetails : "" })}
        className="rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
      >
        {categories.map((category) => (
          <option className="bg-white text-black" key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={form.date}
        onChange={(event) => setForm({ ...form, date: event.target.value })}
        className="rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
        required
      />
      <select
        value={form.paidFrom}
        onChange={(event) => setForm({ ...form, paidFrom: event.target.value })}
        className="rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
      >
        <option className="bg-white text-black" value="company_fund">Company Fund</option>
        <option className="bg-white text-black" value="personal">Personal Money</option>
      </select>
      <div className="flex gap-2">
        <button
          disabled={saving}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : editingId ? "Update" : "Add"}
        </button>
        {editingId && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-lg border border-slate-600 bg-slate-800/70 p-3 text-slate-300 transition hover:bg-slate-700 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <textarea
        value={form.notes}
        onChange={(event) => setForm({ ...form, notes: event.target.value })}
        className={`rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 ${form.category === "Others" ? "lg:col-span-4" : "lg:col-span-6"}`}
        placeholder="Notes"
        rows={3}
      />
      {form.category === "Others" && (
        <input
          value={form.otherDetails}
          onChange={(event) => setForm({ ...form, otherDetails: event.target.value })}
          className="rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 lg:col-span-2"
          placeholder="Please specify"
          required
        />
      )}
    </form>
  );
}

function ExpensesPage({ reportsOnly = false }) {
  const formPanelRef = useRef(null);
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedDate, setSelectedDate] = useState(today());
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [form, setForm] = useState({ title: "", amount: "", category: "Tea", otherDetails: "", date: today(), notes: "", paidFrom: "company_fund" });
  const [fundForm, setFundForm] = useState({ amount: "", addAmount: "", notes: "" });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [addingFund, setAddingFund] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    const [expenseRes, summaryRes] = await Promise.all([
      API.get(`/expenses?month=${selectedMonth}`),
      API.get(`/expenses/summary?date=${selectedDate}&month=${selectedMonth}`),
    ]);

    setExpenses(expenseRes.data);
    setSummary(summaryRes.data);
    setFundForm({
      amount: summaryRes.data?.fund?.amount ?? "",
      addAmount: "",
      notes: summaryRes.data?.fund?.notes || "",
    });
  }, [selectedDate, selectedMonth]);

  useEffect(() => {
    let ignore = false;

    Promise.all([
      API.get(`/expenses?month=${selectedMonth}`),
      API.get(`/expenses/summary?date=${selectedDate}&month=${selectedMonth}`),
    ])
      .then(([expenseRes, summaryRes]) => {
        if (ignore) return;
        setExpenses(expenseRes.data);
        setSummary(summaryRes.data);
        setFundForm({
          amount: summaryRes.data?.fund?.amount ?? "",
          addAmount: "",
          notes: summaryRes.data?.fund?.notes || "",
        });
      })
      .catch(() => {
        if (!ignore) setError("Could not load expenses");
      });

    return () => {
      ignore = true;
    };
  }, [selectedDate, selectedMonth]);

  const resetForm = () => {
    setForm({ title: "", amount: "", category: "Tea", otherDetails: "", date: today(), notes: "", paidFrom: "company_fund" });
    setEditingId(null);
  };

  const addFund = async (event) => {
    event.preventDefault();
    setAddingFund(true);
    setMessage("");
    setError("");

    try {
      await API.post("/expenses/fund/add", {
        month: selectedMonth,
        amount: fundForm.addAmount,
        notes: fundForm.notes,
      });
      setMessage("Company fund added successfully.");
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Could not add company fund");
    } finally {
      setAddingFund(false);
    }
  };

  const saveExpense = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const payload = {
        title: form.title.trim(),
        amount: Number(form.amount),
        category: form.category,
        otherDetails: form.category === "Others" ? form.otherDetails.trim() : "",
        date: form.date,
        notes: form.notes.trim(),
        paidFrom: form.paidFrom,
      };

      if (editingId) await API.put(`/expenses/${editingId}`, payload);
      else await API.post("/expenses", payload);
      setMessage(editingId ? "Expense updated successfully." : "Expense added successfully.");
      resetForm();
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save expense");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (expense) => {
    setEditingId(expense._id);
    setForm({
      title: expense.title || "",
      amount: expense.amount || "",
      category: expense.category || "Tea",
      otherDetails: expense.otherDetails || "",
      date: new Date(expense.date).toISOString().slice(0, 10),
      notes: expense.notes || "",
      paidFrom: expense.paidFrom || "company_fund",
    });
    setMessage("Editing expense. Update the form above and click Update.");
    window.setTimeout(() => {
      formPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const deleteExpense = async (expenseId) => {
    if (!window.confirm("Delete this expense?")) return;

    try {
      await API.delete(`/expenses/${expenseId}`);
      setMessage("Expense deleted successfully.");
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Could not delete expense");
    }
  };

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">{reportsOnly ? "Expense Reports" : "Office Expenses"}</h1>
          <p className="text-slate-400">{reportsOnly ? "Daily and monthly expense analytics." : "Add, edit, and manage office expenses."}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
          />
          <input
            type="month"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
      </div>

      {(message || error) && (
        <div className={`mb-5 rounded-lg border p-3 text-sm ${error ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}>
          {error || message}
        </div>
      )}

      {!reportsOnly && (
        <>
          <div className="mb-8 rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800 to-slate-900 p-6 shadow-lg">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-lg bg-emerald-600 p-2 text-white">
                <Save className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Monthly Company Fund</h2>
                <p className="text-sm text-slate-400">Add company-provided funds for this selected month. Each new fund entry adds to the remaining company fund.</p>
              </div>
            </div>
            <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
              <form onSubmit={addFund} className="rounded-lg border border-slate-700/60 bg-slate-950/30 p-4">
                <p className="mb-3 text-sm font-semibold text-white">Add More Company Fund</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                  <input
                    type="number"
                    min="1"
                    value={fundForm.addAmount}
                    onChange={(event) => setFundForm({ ...fundForm, addAmount: event.target.value })}
                    className="rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                    placeholder="Amount to add"
                    required
                  />
                  <button
                    disabled={addingFund}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                  >
                    <Plus className="h-4 w-4" />
                    {addingFund ? "Adding..." : "Add Fund"}
                  </button>
                </div>
              </form>

              <div className="rounded-lg border border-slate-700/60 bg-slate-950/30 p-4">
                <p className="text-sm font-semibold text-white">Current Company Fund</p>
                <p className="mt-2 text-3xl font-bold text-emerald-300">{formatMoney(summary?.fund?.amount || 0)}</p>
                <p className="mt-2 text-xs text-slate-500">Personal spending also reduces this remaining fund and is tracked as reimbursement due.</p>
              </div>
            </div>

            <input
              value={fundForm.notes}
              onChange={(event) => setFundForm({ ...fundForm, notes: event.target.value })}
              className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              placeholder="Fund notes"
            />
          </div>

          <div ref={formPanelRef} className="mb-8 rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800 to-slate-900 p-6 shadow-lg">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-lg bg-blue-600 p-2 text-white">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{editingId ? "Edit Expense" : "Add Expense"}</h2>
                <p className="text-sm text-slate-400">Track whether spending came from company fund or personal money.</p>
              </div>
            </div>
            <ExpenseForm form={form} setForm={setForm} onSubmit={saveExpense} saving={saving} editingId={editingId} onCancel={resetForm} />
          </div>
        </>
      )}

      <ExpenseAnalytics summary={summary} expenses={expenses} />

      <div className="mt-8 rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800 to-slate-900 shadow-lg">
        <div className="border-b border-slate-700/50 px-6 py-5">
          <h2 className="text-xl font-bold text-white">Expense Records</h2>
          <p className="mt-1 text-sm text-slate-400">All entries for the selected month.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-700/30">
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Title</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Category</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Amount</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Paid From</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Date</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Added By</th>
                {!reportsOnly && <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense._id} className="border-b border-slate-700/30 transition hover:bg-slate-700/20">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-white">{expense.title}</p>
                    {expense.notes && <p className="mt-1 text-xs text-slate-500">{expense.notes}</p>}
                  </td>
                  <td className="px-6 py-4 text-slate-300">
                    {expense.category === "Others" && expense.otherDetails ? `Others: ${expense.otherDetails}` : expense.category}
                  </td>
                  <td className="px-6 py-4 font-bold text-emerald-300">{formatMoney(expense.amount)}</td>
                  <td className="px-6 py-4 text-slate-300">{expense.paidFrom === "personal" ? "Personal Money" : "Company Fund"}</td>
                  <td className="px-6 py-4 text-slate-400">{new Date(expense.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-slate-400">{expense.createdBy?.name || "Expense Manager"}</td>
                  {!reportsOnly && (
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => startEdit(expense)} className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-2 text-blue-300 transition hover:bg-blue-500/20 hover:text-white">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => deleteExpense(expense._id)} className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-red-300 transition hover:bg-red-500/20 hover:text-white">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {expenses.length === 0 && <p className="p-6 text-center text-slate-400">No expenses found.</p>}
      </div>
    </div>
  );
}

export default function ExpenseManagerDashboard() {
  return (
    <DashboardLayout>
      <Routes>
        <Route index element={<ExpensesPage reportsOnly />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="reports" element={<ExpensesPage reportsOnly />} />
        <Route path="notifications" element={<Notifications />} />
      </Routes>
    </DashboardLayout>
  );
}
