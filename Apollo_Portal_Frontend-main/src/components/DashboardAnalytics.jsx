import { AlertTriangle, BarChart3, CalendarDays, CheckCircle2, Clock3, History, Timer, Users } from "lucide-react";
import TaskCard from "./TaskCard";
import { formatDuration, getCompletedDate, getTaskDurationMinutes } from "../utils/taskMetrics";
import MonitoringSummary from "./MonitoringSummary";
import { formatDateOnly } from "../utils/dateOnly";

const getId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value._id || value.id || null;
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const isSameDay = (dateValue, compareDate = new Date()) => {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  return startOfDay(date).getTime() === startOfDay(compareDate).getTime();
};

const isSameMonth = (dateValue, compareDate = new Date()) => {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  return date.getFullYear() === compareDate.getFullYear() && date.getMonth() === compareDate.getMonth();
};

const isOnTime = (task) => {
  if (task.status !== "completed" || !task.deadline) return false;
  return !isLate(task);
};

const isLate = (task) => {
  if (!task.deadline) return false;

  const deadline = new Date(task.deadline);
  deadline.setHours(23, 59, 59, 999);
  const compareDate = new Date(getCompletedDate(task) || Date.now());

  return compareDate.getTime() > deadline.getTime();
};

const getDeadlineTone = (task) => {
  if (!task.deadline || task.status === "completed") return null;

  const dueTime = new Date(task.deadline).getTime();
  const now = Date.now();
  const daysLeft = Math.ceil((dueTime - now) / 86400000);

  if (daysLeft < 0) return { label: "Overdue", className: "border-red-500/30 bg-red-500/10 text-red-200" };
  if (daysLeft <= 2) return { label: `Due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`, className: "border-amber-500/30 bg-amber-500/10 text-amber-100" };
  return null;
};

function MetricCard({ icon: Icon, label, value, detail, tone = "blue" }) {
  const tones = {
    blue: "border-blue-500/25 bg-blue-500/10 text-blue-300",
    green: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    amber: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    rose: "border-rose-500/25 bg-rose-500/10 text-rose-300",
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
        </div>
        <div className={`rounded-lg border p-3 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ value }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
      <div
        className="h-full rounded-full bg-gradient-to-r from-blue-500 via-emerald-400 to-amber-300 transition-all"
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}

export default function DashboardAnalytics({ title, subtitle, tasks = [], users = [], showPeople = false, mode = "team", showMonitoringSummary = false }) {
  const completed = tasks.filter((task) => task.status === "completed");
  const inProgress = tasks.filter((task) => task.status === "in-progress");
  const pending = tasks.filter((task) => task.status === "pending");
  const assigned = tasks.filter((task) => task.assignedTo);
  const waitingFeedback = tasks.filter((task) => task.submission || task.reviewSubmission);
  const completedToday = completed.filter((task) => isSameDay(getCompletedDate(task)));
  const completedThisMonth = completed.filter((task) => isSameMonth(getCompletedDate(task)));
  const onTime = completed.filter(isOnTime);
  const late = tasks.filter(isLate);
  const deadlineRisk = tasks.filter((task) => getDeadlineTone(task) || isLate(task));
  const completionRate = tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0;
  const averageMinutes = completed.length
    ? Math.round(completed.reduce((total, task) => total + getTaskDurationMinutes(task), 0) / completed.length)
    : 0;

  const assignedUserIds = new Set(tasks.map((task) => getId(task.assignedTo)).filter(Boolean));
  const visibleUsers = users.filter(
    (user) => user.role !== "admin" && user.role !== "expense_manager" && (assignedUserIds.has(user._id) || showPeople)
  );
  const dueSoon = tasks
    .filter((task) => getDeadlineTone(task))
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 4);

  const recentTasks = [...tasks]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, 4);

  const getUserStats = (user) => {
    const userTasks = tasks.filter((task) => getId(task.assignedTo) === user._id);
    const userCompleted = userTasks.filter((task) => task.status === "completed");
    const userRate = userTasks.length ? Math.round((userCompleted.length / userTasks.length) * 100) : 0;
    const avg = userCompleted.length
      ? Math.round(userCompleted.reduce((total, task) => total + getTaskDurationMinutes(task), 0) / userCompleted.length)
      : 0;

    return {
      total: userTasks.length,
      completed: userCompleted.length,
      inProgress: userTasks.filter((task) => task.status === "in-progress").length,
      onTime: userCompleted.filter(isOnTime).length,
      late: userTasks.filter(isLate).length,
      rate: userRate,
      avg,
    };
  };

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-300">Dashboard</p>
        <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">{title}</h1>
        <p className="mt-2 text-slate-400">{subtitle}</p>
      </div>

      {showMonitoringSummary && <MonitoringSummary tasks={tasks} />}

      {dueSoon.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
          <div className="mb-3 flex items-center gap-2 text-amber-100">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="font-bold">Deadline Alerts</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {dueSoon.map((task) => {
              const tone = getDeadlineTone(task);
              return (
                <div key={task._id} className={`rounded-lg border px-4 py-3 text-sm ${tone.className}`}>
                  <p className="font-semibold text-white">{task.title}</p>
                  <p className="mt-1">
                    {tone.label} - {formatDateOnly(task.deadline)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {mode === "pm" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={CalendarDays} label="Tasks Created" value={tasks.length} detail="total tasks opened by PM" tone="blue" />
          <MetricCard icon={Users} label="Assigned / Active" value={`${assigned.length} / ${inProgress.length}`} detail="assigned tasks and active work" tone="green" />
          <MetricCard icon={CheckCircle2} label="Awaiting Feedback" value={waitingFeedback.length} detail="submissions ready to review" tone="amber" />
          <MetricCard icon={AlertTriangle} label="Deadline Risk" value={deadlineRisk.length} detail="near deadline, late, or overdue" tone="rose" />
        </div>
      ) : !showMonitoringSummary ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={CheckCircle2} label="Daily Progress" value={completedToday.length} detail="tasks completed today" tone="green" />
          <MetricCard icon={CalendarDays} label="Monthly Progress" value={completedThisMonth.length} detail="tasks completed this month" tone="blue" />
          <MetricCard icon={Timer} label="Average Task Time" value={formatDuration(averageMinutes)} detail="based on completed tasks" tone="amber" />
          <MetricCard icon={AlertTriangle} label="On Time / Late" value={`${onTime.length} / ${late.length}`} detail="completed on time vs late or overdue" tone="rose" />
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg shadow-slate-950/20">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-400">{mode === "pm" ? "Task delivery overview" : "Overall completion"}</p>
              <h2 className="mt-1 text-2xl font-bold text-white">
                {mode === "pm" ? `${inProgress.length} active tasks` : `${completionRate}% complete`}
              </h2>
            </div>
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-blue-300">
              <BarChart3 className="h-6 w-6" />
            </div>
          </div>
          <ProgressBar value={completionRate} />
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-3">
              <p className="text-xs text-slate-500">Total</p>
              <p className="mt-1 text-xl font-bold text-white">{tasks.length}</p>
            </div>
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
              <p className="text-xs text-emerald-300">{mode === "pm" ? "Assigned" : "Completed"}</p>
              <p className="mt-1 text-xl font-bold text-emerald-200">{mode === "pm" ? assigned.length : completed.length}</p>
            </div>
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
              <p className="text-xs text-blue-300">{mode === "pm" ? "Pending" : "In Progress"}</p>
              <p className="mt-1 text-xl font-bold text-blue-200">{mode === "pm" ? pending.length : inProgress.length}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg shadow-slate-950/20">
          <div className="mb-4 flex items-center gap-2">
            <Clock3 className="h-5 w-5 text-blue-300" />
            <h2 className="text-xl font-bold text-white">Active Task Tracker</h2>
          </div>
          <div className="space-y-3">
            {inProgress.slice(0, 5).map((task) => (
              <div key={task._id} className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-white">{task.title}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {task.assignedTo?.name || "Unassigned"} - {formatDuration(getTaskDurationMinutes(task))}
                  </p>
                </div>
                {task.deadline && (
                  <span className="w-fit rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300">
                    Due {formatDateOnly(task.deadline)}
                  </span>
                )}
              </div>
            ))}
            {inProgress.length === 0 && <p className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">No active tasks right now.</p>}
          </div>
        </div>
      </div>

      {showPeople && visibleUsers.length > 0 && (
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg shadow-slate-950/20">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-300" />
            <h2 className="text-xl font-bold text-white">Individual Tracking</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {visibleUsers.map((user) => {
              const stats = getUserStats(user);

              return (
                <div key={user._id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-white">{user.name}</h3>
                      <p className="text-sm capitalize text-slate-500">{user.role?.replace("_", " ")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-white">{stats.rate}%</p>
                      <p className="text-xs text-slate-500">progress</p>
                    </div>
                  </div>
                  <ProgressBar value={stats.rate} />
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <span className="text-xs text-slate-400">Tasks: <b className="text-white">{stats.total}</b></span>
                    <span className="text-xs text-slate-400">Done: <b className="text-emerald-300">{stats.completed}</b></span>
                    <span className="text-xs text-slate-400">Active: <b className="text-blue-300">{stats.inProgress}</b></span>
                    <span className="text-xs text-slate-400">Late: <b className="text-red-300">{stats.late}</b></span>
                    <span className="text-xs text-slate-400">Avg: <b className="text-amber-300">{formatDuration(stats.avg)}</b></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-6">
        <div className="mb-4 flex items-center gap-2">
          <History className="h-5 w-5 text-blue-300" />
          <h2 className="text-xl font-bold text-white">Recent Task History</h2>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {recentTasks.map((task) => (
            <TaskCard key={task._id} task={task} />
          ))}
          {recentTasks.length === 0 && <p className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 text-center text-slate-400">No task history yet.</p>}
        </div>
      </div>
    </div>
  );
}
