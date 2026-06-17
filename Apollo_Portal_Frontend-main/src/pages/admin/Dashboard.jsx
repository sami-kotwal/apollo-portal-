import { Routes, Route } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";
import {
  Users,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  TrendingUp,
  Plus,
  Trash2,
  Save,
  Pencil,
  X,
  Activity,
  Clock3,
  TimerReset,
  Wifi,
  CalendarDays,
} from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import API from "../../services/api";
import TaskCard from "../../components/TaskCard";
import Notifications from "../Notifications";
import ExpenseAnalytics from "../../components/ExpenseAnalytics";
import TaskStatusFilter, { filterTasksByStatus } from "../../components/TaskStatusFilter";
import { formatMoney } from "../../utils/money";
import { getStoredToken } from "../../utils/authStorage";
import { formatDateOnly } from "../../utils/dateOnly";

const formatSeconds = (seconds = 0) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes === 0 && secs > 0) return `${secs}s`;
  return `${minutes}m`;
};

const formatLastSeen = (dateValue) => {
  if (!dateValue) return "Not seen today";

  const secondsAgo = Math.max(0, Math.floor((Date.now() - new Date(dateValue).getTime()) / 1000));
  if (secondsAgo < 60) return "Just now";
  if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
  const date = new Date(dateValue);
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startSeen = new Date(date);
  startSeen.setHours(0, 0, 0, 0);
  const dayDiff = Math.floor((startToday.getTime() - startSeen.getTime()) / 86400000);
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (dayDiff === 0) return time;
  if (dayDiff === 1) return `Yesterday ${time}`;
  return `${date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} ${time}`;
};

const formatDateTime = (dateValue) => {
  if (!dateValue) return "Not recorded";
  return new Date(dateValue).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const attendanceTone = {
  on_time: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  late: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  absent: "border-red-500/30 bg-red-500/10 text-red-300",
  off_day: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  holiday: "border-purple-500/30 bg-purple-500/10 text-purple-300",
  worked_on_holiday: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  disabled: "border-slate-600 bg-slate-800/70 text-slate-400",
};

const workStatusTone = {
  complete: "text-emerald-300",
  overtime: "text-blue-300",
  in_progress: "text-slate-400",
  incomplete: "text-red-300",
  left_early: "text-red-300",
  absent: "text-red-300",
  disabled: "text-slate-500",
};

const getRequiredSeconds = (person) => person?.attendance?.requiredSeconds || ((Number(person?.attendance?.requiredHours) || 8) * 60 * 60);
const getSocketBaseUrl = () => (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "");
const getLocalDateKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDateKeyDaysAgo = (daysAgo) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const PROFILE_PAGE_SIZE = 20;

function ProfileStat({ label, value, tone = "text-white" }) {
  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-950/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function ProfileSectionToggle({ section, label, openSections, setOpenSections }) {
  const isOpen = openSections[section];
  return (
    <button
      type="button"
      onClick={() => setOpenSections((current) => ({ ...current, [section]: !current[section] }))}
      className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-200 transition hover:bg-blue-500/20 hover:text-white"
    >
      {isOpen ? `Hide ${label}` : `See ${label}`}
    </button>
  );
}

function ProfilePaginationBar({ label, page, totalPages, total, onPageChange, disabled = false, placement = "top" }) {
  return (
    <div className={`flex flex-col gap-3 bg-slate-900 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${placement === "bottom" ? "border-t border-slate-800" : "border-b border-slate-800"}`}>
      <p className="text-sm font-semibold text-slate-300">
        {label} page {page} of {totalPages}
        <span className="ml-2 text-xs font-normal text-slate-500">({total} records in selected dates)</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1 || disabled}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-blue-500/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= totalPages || disabled}
          onClick={() => onPageChange(page + 1)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-blue-500/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function UserProfileModal({ profile, loading, error, from, to, activityPage, onActivityPageChange, onFromChange, onToChange, onPreset, onReload, onClose }) {
  const [attendancePage, setAttendancePage] = useState(1);
  const [taskPage, setTaskPage] = useState(1);
  const [openSections, setOpenSections] = useState({
    attendance: false,
    task: false,
    performance: false,
    monitoring: false,
  });

  if (!profile && !loading && !error) return null;

  const user = profile?.user || {};
  const monitoring = profile?.monitoring || {};
  const attendance = profile?.attendance || {};
  const performance = profile?.performance || {};
  const attendanceTotals = attendance?.totals || {};
  const monitoringTotals = monitoring?.totals || {};
  const dayRows = [...(attendance?.days || [])].reverse();
  const taskRows = performance?.tasks || [];
  const activityRows = monitoring?.recentActivities || [];
  const activityPagination = monitoring?.activityPagination || { page: activityPage || 1, totalPages: 1, total: activityRows.length, limit: PROFILE_PAGE_SIZE };
  const attendanceTotalPages = Math.max(1, Math.ceil(dayRows.length / PROFILE_PAGE_SIZE));
  const taskTotalPages = Math.max(1, Math.ceil(taskRows.length / PROFILE_PAGE_SIZE));
  const attendanceRows = dayRows.slice((attendancePage - 1) * PROFILE_PAGE_SIZE, attendancePage * PROFILE_PAGE_SIZE);
  const pagedTaskRows = taskRows.slice((taskPage - 1) * PROFILE_PAGE_SIZE, taskPage * PROFILE_PAGE_SIZE);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-slate-800 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-300">Employee Profile</p>
            <h2 className="mt-1 text-2xl font-bold text-white">{user.name || "Loading user..."}</h2>
            <p className="mt-1 text-sm text-slate-400">
              {user.email || ""} {user.role ? `- ${user.role.replace("_", " ")}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[
              ["15 days", 14],
              ["30 days", 29],
              ["60 days", 59],
              ["90 days", 89],
            ].map(([label, days]) => (
              <button
                key={label}
                type="button"
                onClick={() => onPreset(days)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-blue-500/50 hover:text-white"
              >
                {label}
              </button>
            ))}
            <input
              type="date"
              value={from}
              onChange={(event) => onFromChange(event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
            <input
              type="date"
              value={to}
              onChange={(event) => onToChange(event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={onReload}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Load
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:text-white"
              title="Close profile"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-5">
          {loading && <p className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-slate-300">Loading employee profile...</p>}
          {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</p>}

          {profile && (
            <div className="space-y-6">
              <section>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-lg font-bold text-white">Attendance</h3>
                  <ProfileSectionToggle openSections={openSections} setOpenSections={setOpenSections} section="attendance" label="Attendance" />
                </div>
                {openSections.attendance && (
                  <>
                    <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                      <ProfileStat label="Present Days" value={attendanceTotals.presentDays || 0} tone="text-emerald-300" />
                      <ProfileStat label="On Time" value={attendanceTotals.onTimeDays || 0} tone="text-emerald-300" />
                      <ProfileStat label="Late" value={attendanceTotals.lateDays || 0} tone="text-amber-300" />
                      <ProfileStat label="Absent" value={attendanceTotals.absentDays || 0} tone="text-red-300" />
                    </div>
                    <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
                      <ProfilePaginationBar label="Attendance" page={attendancePage} totalPages={attendanceTotalPages} total={dayRows.length} onPageChange={setAttendancePage} disabled={loading} />
                      <table className="w-full text-sm">
                        <thead className="bg-slate-900 text-slate-400">
                          <tr>
                            <th className="px-4 py-3 text-left">Date</th>
                            <th className="px-4 py-3 text-left">Status</th>
                            <th className="px-4 py-3 text-left">Login</th>
                            <th className="px-4 py-3 text-left">Logout</th>
                            <th className="px-4 py-3 text-left">Active</th>
                            <th className="px-4 py-3 text-left">Idle</th>
                            <th className="px-4 py-3 text-left">Break</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attendanceRows.map((day) => (
                            <tr key={day.dateKey} className="border-t border-slate-800 text-slate-300">
                              <td className="px-4 py-3 text-white">{day.dateKey}</td>
                              <td className="px-4 py-3 capitalize">{day.attendanceStatus?.replace("_", " ")}</td>
                              <td className="px-4 py-3">{day.firstStartTime ? formatDateTime(day.firstStartTime) : "Not recorded"}</td>
                              <td className="px-4 py-3">{day.lastEndTime ? formatDateTime(day.lastEndTime) : "Not recorded"}</td>
                              <td className="px-4 py-3">{formatSeconds(day.activeSeconds)}</td>
                              <td className="px-4 py-3">{formatSeconds(day.idleSeconds)}</td>
                              <td className="px-4 py-3">{formatSeconds(day.breakSeconds)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>

              <section>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-lg font-bold text-white">Task</h3>
                  <ProfileSectionToggle openSections={openSections} setOpenSections={setOpenSections} section="task" label="Task" />
                </div>
                {openSections.task && (
                  <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800">
                    <ProfilePaginationBar label="Task" page={taskPage} totalPages={taskTotalPages} total={taskRows.length} onPageChange={setTaskPage} disabled={loading} />
                    <table className="w-full text-sm">
                      <thead className="bg-slate-900 text-slate-400">
                        <tr>
                          <th className="px-4 py-3 text-left">Task</th>
                          <th className="px-4 py-3 text-left">Status</th>
                          <th className="px-4 py-3 text-left">Priority</th>
                          <th className="px-4 py-3 text-left">Deadline</th>
                          <th className="px-4 py-3 text-left">Created By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedTaskRows.map((task) => (
                          <tr key={task._id} className="border-t border-slate-800 text-slate-300">
                            <td className="max-w-sm px-4 py-3">
                              <p className="font-semibold text-white">{task.title || "Untitled task"}</p>
                              {task.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{task.description}</p>}
                            </td>
                            <td className="px-4 py-3 capitalize">{task.status?.replace("-", " ") || "pending"}</td>
                            <td className="px-4 py-3 capitalize">{task.priority || "normal"}</td>
                            <td className="px-4 py-3">{task.deadline ? formatDateOnly(task.deadline) : "Not set"}</td>
                            <td className="px-4 py-3">{task.createdBy?.name || task.assignedBy?.name || "Not recorded"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {taskRows.length === 0 && <p className="p-4 text-center text-slate-400">No tasks found for this range.</p>}
                  </div>
                )}
              </section>

              <section>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-lg font-bold text-white">Performance</h3>
                  <ProfileSectionToggle openSections={openSections} setOpenSections={setOpenSections} section="performance" label="Performance" />
                </div>
                {openSections.performance && (
                  <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
                    <ProfileStat label="Total Tasks" value={performance.totalTasks || 0} />
                    <ProfileStat label="Completed" value={performance.completedTasks || 0} tone="text-emerald-300" />
                    <ProfileStat label="In Progress" value={performance.inProgressTasks || 0} tone="text-blue-300" />
                    <ProfileStat label="Pending" value={performance.pendingTasks || 0} tone="text-amber-300" />
                    <ProfileStat label="Avg Complete Time" value={formatSeconds(performance.averageCompletionSeconds)} />
                  </div>
                )}
              </section>

              <section>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-lg font-bold text-white">Monitoring</h3>
                  <ProfileSectionToggle openSections={openSections} setOpenSections={setOpenSections} section="monitoring" label="Monitoring" />
                </div>
                {openSections.monitoring && (
                  <>
                    <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
                      <ProfileStat label="Active" value={formatSeconds(monitoringTotals.activeSeconds)} />
                      <ProfileStat label="Idle" value={formatSeconds(monitoringTotals.idleSeconds)} tone="text-amber-300" />
                      <ProfileStat label="Break" value={formatSeconds(monitoringTotals.breakSeconds)} tone="text-blue-300" />
                      <ProfileStat label="Overtime" value={formatSeconds(monitoringTotals.overtimeSeconds)} tone="text-emerald-300" />
                      <ProfileStat label="YouTube Time" value={formatSeconds(monitoringTotals.youtubeSeconds)} tone="text-red-300" />
                    </div>
                    <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-900 text-slate-400">
                          <tr>
                            <th className="px-4 py-3 text-left">Time</th>
                            <th className="px-4 py-3 text-left">App / Domain</th>
                            <th className="px-4 py-3 text-left">Window</th>
                            <th className="px-4 py-3 text-left">Type</th>
                            <th className="px-4 py-3 text-left">Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activityRows.map((activity) => (
                            <tr key={activity._id} className="border-t border-slate-800 text-slate-300">
                              <td className="px-4 py-3">{formatDateTime(activity.startedAt)}</td>
                              <td className="px-4 py-3 text-white">{activity.domain || activity.appName || "Unknown"}</td>
                              <td className="max-w-md truncate px-4 py-3">{activity.windowTitle || activity.title || "No title"}</td>
                              <td className="px-4 py-3 capitalize">{activity.type?.replace("_", " ")}</td>
                              <td className="px-4 py-3">{formatSeconds(activity.durationSeconds)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {activityRows.length === 0 && <p className="p-4 text-center text-slate-400">No activity found for this range.</p>}
                      <ProfilePaginationBar
                        label="Activity"
                        page={activityPagination.page || 1}
                        totalPages={activityPagination.totalPages || 1}
                        total={activityPagination.total || 0}
                        onPageChange={onActivityPageChange}
                        disabled={loading}
                        placement="bottom"
                      />
                    </div>
                  </>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminHome() {
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    let ignore = false;

    Promise.all([API.get("/tasks"), API.get("/users")]).then(([taskRes, userRes]) => {
      if (ignore) return;
      setTasks(taskRes.data);
      setUsers(userRes.data);
    });

    return () => {
      ignore = true;
    };
  }, []);

  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const inProgressTasks = tasks.filter((t) => t.status === "in-progress").length;
  const activeTasks = tasks.filter((t) => t.status === "in-progress" && t.assignedTo).slice(0, 6);

  const stats = [
    { label: "Total Users", value: users.length, icon: Users, color: "from-blue-600 to-cyan-600" },
    { label: "Total Tasks", value: tasks.length, icon: Briefcase, color: "from-purple-600 to-pink-600" },
    { label: "Completed", value: completedTasks, icon: CheckCircle2, color: "from-green-600 to-emerald-600" },
    { label: "In Progress", value: inProgressTasks, icon: AlertCircle, color: "from-orange-600 to-red-600" },
  ];

  return (
    <div>
      {/* Page Title */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Admin Dashboard</h1>
        <p className="text-slate-400">Welcome back! Here's your system overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-xl p-6 shadow-lg hover:shadow-xl hover:shadow-purple-500/20 transition duration-300 group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 bg-gradient-to-br ${stat.color} rounded-lg group-hover:scale-110 transition duration-300`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <TrendingUp className="w-5 h-5 text-green-400 opacity-0 group-hover:opacity-100 transition" />
              </div>
              <p className="text-slate-400 text-sm mb-1">{stat.label}</p>
              <h3 className="text-4xl font-bold text-white group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-purple-400 group-hover:to-blue-400 group-hover:bg-clip-text transition">
                {stat.value}
              </h3>
            </div>
          );
        })}
      </div>

      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-4">Active Task Assignments</h2>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {activeTasks.map((task) => (
            <div key={task._id} className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/20">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-white">{task.title}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {task.assignedTo?.name || "Unassigned"} - {task.department}
                  </p>
                </div>
                {task.deadline && (
                  <span className="w-fit rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-200">
                    Due {formatDateOnly(task.deadline)}
                  </span>
                )}
              </div>
            </div>
          ))}
          {activeTasks.length === 0 && (
            <p className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 text-center text-slate-400">
              No assigned active tasks right now.
            </p>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Recent Tasks</h2>
        <div className="space-y-4">
          {tasks.slice(0, 3).map((task) => (
            <TaskCard key={task._id} task={task} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [monitoringPeople, setMonitoringPeople] = useState([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "developer",
  });
  const [saving, setSaving] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    role: "developer",
  });
  const [passwordUserId, setPasswordUserId] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [profileUserId, setProfileUserId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileFrom, setProfileFrom] = useState(() => getDateKeyDaysAgo(14));
  const [profileTo, setProfileTo] = useState(getLocalDateKey);
  const [profileActivityPage, setProfileActivityPage] = useState(1);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const roles = [
    { label: "Project Manager", value: "pm" },
    { label: "Development Team Leader", value: "teamleader_dev" },
    { label: "Design Team Leader", value: "teamleader_design" },
    { label: "Developer", value: "developer" },
    { label: "Designer", value: "designer" },
    { label: "Expense Manager", value: "expense_manager" },
  ];

  const fetchUsers = useCallback(async () => {
    const [userRes, overviewRes] = await Promise.all([API.get("/users"), API.get(`/monitoring/admin/overview?date=${getLocalDateKey()}`)]);
    setUsers(userRes.data.filter((user) => user.role !== "admin" && user.role !== "customer"));
    setMonitoringPeople(overviewRes.data?.people || []);
  }, []);

  useEffect(() => {
    let ignore = false;

    Promise.all([API.get("/users"), API.get(`/monitoring/admin/overview?date=${getLocalDateKey()}`)]).then(([userRes, overviewRes]) => {
      if (ignore) return;
      setUsers(userRes.data.filter((user) => user.role !== "admin" && user.role !== "customer"));
      setMonitoringPeople(overviewRes.data?.people || []);
    });

    return () => {
      ignore = true;
    };
  }, []);

  const createUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      await API.post("/users", form);
      setForm({
        name: "",
        email: "",
        password: "",
        role: "developer",
      });
      setMessage("User added successfully.");
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Could not add user");
    } finally {
      setSaving(false);
    }
  };

  const updateUser = async (userId, updates) => {
    setMessage("");
    setError("");

    try {
      await API.put(`/users/${userId}`, updates);
      setMessage("User updated successfully.");
      fetchUsers();
      return true;
    } catch (err) {
      setError(err.response?.data?.message || "Could not update user");
      return false;
    }
  };

  const startEdit = (user) => {
    setEditingUserId(user._id);
    setEditForm({
      name: user.name || "",
      email: user.email || "",
      role: user.role || "developer",
    });
    setMessage("");
    setError("");
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setEditForm({
      name: "",
      email: "",
      role: "developer",
    });
  };

  const saveEdit = async (userId) => {
    const updated = await updateUser(userId, editForm);
    if (updated) cancelEdit();
  };

  const savePassword = async (userId) => {
    if (!newPassword || newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    const updated = await updateUser(userId, { password: newPassword });
    if (updated) {
      setPasswordUserId(null);
      setNewPassword("");
      setMessage("Password changed successfully. User must log in again.");
    }
  };

  const loadUserProfile = useCallback(async (userId = profileUserId, from = profileFrom, to = profileTo, activityPage = profileActivityPage) => {
    if (!userId) return;
    setProfileLoading(true);
    setProfileError("");

    try {
      const res = await API.get(`/users/${userId}/profile?from=${from}&to=${to}&activityPage=${activityPage}&activityLimit=${PROFILE_PAGE_SIZE}`);
      setProfile(res.data);
      setProfileUserId(userId);
    } catch (err) {
      setProfileError(err.response?.data?.message || "Could not load employee profile");
    } finally {
      setProfileLoading(false);
    }
  }, [profileActivityPage, profileFrom, profileTo, profileUserId]);

  const openProfile = (user) => {
    setProfile(null);
    setProfileError("");
    setProfileUserId(user._id);
    setProfileActivityPage(1);
    loadUserProfile(user._id, profileFrom, profileTo, 1);
  };

  const closeProfile = () => {
    setProfileUserId(null);
    setProfile(null);
    setProfileError("");
  };

  const setProfilePreset = (daysAgo) => {
    const nextFrom = getDateKeyDaysAgo(daysAgo);
    const nextTo = getLocalDateKey();
    setProfileFrom(nextFrom);
    setProfileTo(nextTo);
    setProfileActivityPage(1);
    loadUserProfile(profileUserId, nextFrom, nextTo, 1);
  };

  const setProfileActivityPageAndLoad = (nextPage) => {
    setProfileActivityPage(nextPage);
    loadUserProfile(profileUserId, profileFrom, profileTo, nextPage);
  };

  const deleteUser = async (userId) => {
    const confirmed = window.confirm("Delete this user from the database?");
    if (!confirmed) return;

    setMessage("");
    setError("");

    try {
      await API.delete(`/users/${userId}`);
      setMessage("User deleted successfully.");
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Could not delete user");
    }
  };

  const getRoleColor = (role) => {
    const colors = {
      admin: "bg-red-500/10 text-red-300 border-red-500/30",
      pm: "bg-blue-500/10 text-blue-300 border-blue-500/30",
      developer: "bg-purple-500/10 text-purple-300 border-purple-500/30",
      designer: "bg-pink-500/10 text-pink-300 border-pink-500/30",
      teamleader_dev: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
      teamleader_design: "bg-rose-500/10 text-rose-300 border-rose-500/30",
    };
    return colors[role] || "bg-slate-500/10 text-slate-300 border-slate-500/30";
  };

  const monitoringByUserId = new Map(monitoringPeople.map((person) => [person.user?._id, person]));

  return (
    <div>
      <h1 className="text-4xl font-bold text-white mb-2">All Users</h1>
      <p className="text-slate-400 mb-8">Add team members, change roles, and manage user records</p>

      {(message || error) && (
        <div
          className={`mb-5 rounded-lg border p-3 text-sm ${
            error
              ? "border-red-500/30 bg-red-500/10 text-red-200"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="mb-8 rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800 to-slate-900 p-6 shadow-lg">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-lg bg-blue-600 p-2 text-white">
            <Plus className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Add New User</h2>
            <p className="text-sm text-slate-400">Create a user record with login access.</p>
          </div>
        </div>

        <form onSubmit={createUser} className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            placeholder="Full name"
            required
          />
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            placeholder="Email address"
            required
          />
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            placeholder="Password"
            required
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
          >
            {roles.map((role) => (
              <option className="bg-white text-black" key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
          <button
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60 lg:col-span-4"
          >
            <Save className="h-4 w-4" />
            {saving ? "Adding..." : "Add User"}
          </button>
        </form>
      </div>

      <UserProfileModal
        key={`${profileUserId || "profile"}-${profileFrom}-${profileTo}`}
        profile={profile}
        loading={profileLoading}
        error={profileError}
        from={profileFrom}
        to={profileTo}
        activityPage={profileActivityPage}
        onActivityPageChange={setProfileActivityPageAndLoad}
        onFromChange={setProfileFrom}
        onToChange={setProfileTo}
        onPreset={setProfilePreset}
        onReload={() => {
          setProfileActivityPage(1);
          loadUserProfile(profileUserId, profileFrom, profileTo, 1);
        }}
        onClose={closeProfile}
      />

      <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-700/50 border-b border-slate-700/50">
                <th className="px-6 py-4 text-left text-slate-300 font-semibold text-sm">Name</th>
                <th className="px-6 py-4 text-left text-slate-300 font-semibold text-sm">Email</th>
                <th className="px-6 py-4 text-left text-slate-300 font-semibold text-sm">Role</th>
                <th className="px-6 py-4 text-left text-slate-300 font-semibold text-sm">Overtime</th>
                <th className="px-6 py-4 text-right text-slate-300 font-semibold text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition">
                  <td className="px-6 py-4 text-white font-medium">
                    {editingUserId === user._id ? (
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full min-w-44 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                        placeholder="Full name"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => openProfile(user)}
                        className="font-semibold text-white underline-offset-4 transition hover:text-blue-300 hover:underline"
                        title="Open employee profile"
                      >
                        {user.name}
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-sm">
                    {editingUserId === user._id ? (
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="w-full min-w-56 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                        placeholder="Email address"
                      />
                    ) : (
                      user.email
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editingUserId === user._id ? (
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                        className="min-w-56 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                      >
                        {roles.map((role) => (
                          <option className="bg-white text-black" key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`inline-block rounded-full border px-3 py-1.5 text-xs font-bold capitalize ${getRoleColor(
                          user.role
                        )}`}
                      >
                        {user.role.replace("_", " ")}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-emerald-300">
                    {formatSeconds(monitoringByUserId.get(user._id)?.dailyReport?.overtimeSeconds)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      {editingUserId === user._id ? (
                        <>
                          <button
                            onClick={() => saveEdit(user._id)}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 hover:text-white"
                            title="Save changes"
                          >
                            <Save className="h-4 w-4" />
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-600 bg-slate-800/70 p-2 text-slate-300 transition hover:bg-slate-700 hover:text-white"
                            title="Cancel edit"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          {passwordUserId === user._id ? (
                            <div className="flex flex-wrap justify-end gap-2">
                              <input
                                type="password"
                                value={newPassword}
                                onChange={(event) => setNewPassword(event.target.value)}
                                className="w-44 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                placeholder="New password"
                              />
                              <button
                                onClick={() => savePassword(user._id)}
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 hover:text-white"
                                title="Save password"
                              >
                                <Save className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setPasswordUserId(null);
                                  setNewPassword("");
                                }}
                                className="inline-flex items-center justify-center rounded-lg border border-slate-600 bg-slate-800/70 p-2 text-slate-300 transition hover:bg-slate-700 hover:text-white"
                                title="Cancel password change"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => openProfile(user)}
                                className="inline-flex items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-2 text-cyan-300 transition hover:bg-cyan-500/20 hover:text-white"
                                title="View profile"
                              >
                                <Users className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setPasswordUserId(user._id);
                                  setNewPassword("");
                                }}
                                className="inline-flex items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-amber-300 transition hover:bg-amber-500/20 hover:text-white"
                                title="Change password"
                              >
                                <AlertCircle className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => startEdit(user)}
                                className="inline-flex items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/10 p-2 text-blue-300 transition hover:bg-blue-500/20 hover:text-white"
                                title="Edit user"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => deleteUser(user._id)}
                                className="inline-flex items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-red-300 transition hover:bg-red-500/20 hover:text-white"
                                title="Delete user"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [domainForms, setDomainForms] = useState({});
  const [savingDomainRequest, setSavingDomainRequest] = useState("");

  const loadCustomers = useCallback(() => {
    setLoading(true);
    return API.get("/users/customers")
      .then((res) => {
        setCustomers(res.data || []);
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Could not load customers");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let ignore = false;

    API.get("/users/customers")
      .then((res) => {
        if (!ignore) setCustomers(res.data || []);
      })
      .catch((err) => {
        if (!ignore) setError(err.response?.data?.message || "Could not load customers");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const updateDomainForm = (requestId, key, value) => {
    setDomainForms((current) => ({
      ...current,
      [requestId]: {
        ...(current[requestId] || {}),
        [key]: value,
      },
    }));
  };

  const markDomainAvailable = async (requestId) => {
    const form = domainForms[requestId] || {};
    if (!form.confirmedDomain?.trim()) {
      setError("Confirmed domain is required");
      return;
    }
    setSavingDomainRequest(requestId);
    setError("");
    try {
      await API.patch(`/users/customer-requests/${requestId}/domain-available`, {
        confirmedDomain: form.confirmedDomain,
        notes: form.notes || "",
      });
      await loadCustomers();
    } catch (err) {
      setError(err.response?.data?.message || "Could not mark domain as available");
    } finally {
      setSavingDomainRequest("");
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Customers</h1>
        <p className="text-slate-400">Registered customer accounts, selected packages, and request activity.</p>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
          <p className="text-sm text-slate-400">Registered customers</p>
          <p className="mt-2 text-3xl font-bold text-white">{customers.length}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
          <p className="text-sm text-slate-400">Open requests</p>
          <p className="mt-2 text-3xl font-bold text-white">{customers.reduce((total, item) => total + (item.openRequests || 0), 0)}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
          <p className="text-sm text-slate-400">Selected packages</p>
          <p className="mt-2 text-3xl font-bold text-white">{customers.reduce((total, item) => total + (item.selectedPackages?.length || 0), 0)}</p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Company</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Packages</th>
                <th className="px-4 py-3 font-semibold">Requests</th>
                <th className="px-4 py-3 font-semibold">Registered</th>
                <th className="px-4 py-3 font-semibold">Last Request</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading customers...</td>
                </tr>
              )}
              {!loading && customers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">No customers registered yet.</td>
                </tr>
              )}
              {!loading && customers.map((customer) => (
                <tr key={customer._id} className="text-slate-300 transition hover:bg-slate-800/50">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-white">{customer.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{customer.email}</p>
                  </td>
                  <td className="px-4 py-4">{customer.customerProfile?.companyName || "Not added"}</td>
                  <td className="px-4 py-4">{customer.customerProfile?.phone || "Not added"}</td>
                  <td className="px-4 py-4">
                    {customer.selectedPackages?.length ? (
                      <div className="flex max-w-xs flex-wrap gap-1.5">
                        {customer.selectedPackages.map((item) => {
                          const packageId = typeof item === "string" ? item : item?.packageId || item?.id || "";
                          const billingCycle = typeof item === "string" ? "" : item?.billingCycle || "";
                          const price = typeof item === "string" ? "" : item?.price || "";
                          return (
                          <span key={`${packageId}-${billingCycle || "legacy"}`} className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-200">
                            {packageId.replaceAll("-", " ")}
                            {billingCycle && <span className="text-blue-300"> - {billingCycle.replace("_", " ")} {price && `(${price})`}</span>}
                          </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-slate-500">None selected</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-semibold text-white">{customer.totalRequests || 0} total</p>
                    <p className="mt-1 text-xs text-slate-500">{customer.openRequests || 0} open</p>
                    {customer.domainRequests?.length > 0 && (
                      <div className="mt-3 space-y-3">
                        {customer.domainRequests.map((request) => (
                          <div key={request._id} className="rounded-lg border border-slate-700 bg-slate-950/50 p-3">
                            <div className="flex flex-col gap-1">
                              <p className="text-xs font-semibold text-white">{request.title}</p>
                              <p className="text-[0.7rem] capitalize text-slate-500">{request.status.replace("_", " ")}</p>
                              {request.details?.confirmedDomain && (
                                <p className="text-[0.7rem] text-blue-200">Confirmed: {request.details.confirmedDomain}</p>
                              )}
                            </div>
                            {!["domain_available", "terms_accepted", "completed", "closed"].includes(request.status) && (
                              <div className="mt-3 space-y-2">
                                <input
                                  value={domainForms[request._id]?.confirmedDomain || ""}
                                  onChange={(event) => updateDomainForm(request._id, "confirmedDomain", event.target.value)}
                                  placeholder="confirmed-domain.com"
                                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                                />
                                <input
                                  value={domainForms[request._id]?.notes || ""}
                                  onChange={(event) => updateDomainForm(request._id, "notes", event.target.value)}
                                  placeholder="Optional note"
                                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => markDomainAvailable(request._id)}
                                  disabled={savingDomainRequest === request._id}
                                  className="w-full rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                                >
                                  {savingDomainRequest === request._id ? "Saving..." : "Mark domain available"}
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">{customer.createdAt ? formatDateOnly(customer.createdAt) : "Not recorded"}</td>
                  <td className="px-4 py-4">{customer.latestRequestAt ? formatDateOnly(customer.latestRequestAt) : "No requests"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AdminCreateTask() {
  const [form, setForm] = useState({
    title: "",
    description: "",
    department: "development",
    deadline: "",
  });
  const [services, setServices] = useState([]);
  const [media, setMedia] = useState([]);
  const [serviceInput, setServiceInput] = useState("");
  const [mediaInput, setMediaInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const addService = () => {
    const value = serviceInput.trim();
    if (!value) return;
    setServices((current) => [...current, value]);
    setServiceInput("");
  };
  const addMedia = () => {
    const value = mediaInput.trim();
    if (!value) return;
    setMedia((current) => [...current, value]);
    setMediaInput("");
  };

  const createTask = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await API.post("/tasks", {
        ...form,
        services,
        media,
      });
      setMessage("Task created successfully. Team leaders have been notified.");
      setForm({ title: "", description: "", department: "development", deadline: "" });
      setServices([]);
      setMedia([]);
    } catch (err) {
      setError(err.response?.data?.message || "Could not create task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="text-4xl font-bold text-white mb-2">Create Task</h1>
      <p className="text-slate-400 mb-8">Admins can create tasks for development or design team leaders, the same way PMs do.</p>

      {message && <div className="mb-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</div>}
      {error && <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

      <form onSubmit={createTask} className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg shadow-slate-950/20">
        <div className="grid gap-5 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-slate-200">Task Title</span>
            <input
              value={form.title}
              onChange={(event) => update("title", event.target.value)}
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-blue-500"
              placeholder="Enter task title"
            />
          </label>
          <label className="md:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-slate-200">Task Description</span>
            <textarea
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
              required
              rows={5}
              className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-blue-500"
              placeholder="Describe what needs to be done..."
            />
          </label>
          <label>
            <span className="mb-2 block text-sm font-semibold text-slate-200">Department</span>
            <select
              value={form.department}
              onChange={(event) => update("department", event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-blue-500"
            >
              <option value="development">Development</option>
              <option value="designing">Design</option>
            </select>
          </label>
          <label>
            <span className="mb-2 block text-sm font-semibold text-slate-200">Deadline</span>
            <input
              type="date"
              value={form.deadline}
              onChange={(event) => update("deadline", event.target.value)}
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-blue-500"
            />
          </label>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div>
            <span className="mb-2 block text-sm font-semibold text-slate-200">Services Required</span>
            <div className="flex gap-2">
              <input
                value={serviceInput}
                onChange={(event) => setServiceInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addService();
                  }
                }}
                className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-blue-500"
                placeholder="Frontend, Backend, UI..."
              />
              <button type="button" onClick={addService} className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500">Add</button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {services.map((item, index) => (
                <span key={`${item}-${index}`} className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-200">
                  {item}
                  <button type="button" onClick={() => setServices((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-2 block text-sm font-semibold text-slate-200">Media / References</span>
            <div className="flex gap-2">
              <input
                value={mediaInput}
                onChange={(event) => setMediaInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addMedia();
                  }
                }}
                className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-blue-500"
                placeholder="Paste media/reference link"
              />
              <button type="button" onClick={addMedia} className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500">Add</button>
            </div>
            <div className="mt-3 space-y-2">
              {media.map((item, index) => (
                <div key={`${item}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-300">
                  <span className="truncate">{item}</span>
                  <button type="button" onClick={() => setMedia((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-slate-500 hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <button disabled={saving} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60">
          <Plus className="h-4 w-4" />
          {saving ? "Creating..." : "Create Task"}
        </button>
      </form>
    </div>
  );
}

function AdminTasks() {
  const [tasks, setTasks] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    department: "development",
    deadline: "",
    services: "",
    media: "",
  });

  const fetchTasks = async () => {
    const res = await API.get("/tasks");
    setTasks(res.data);
  };

  useEffect(() => {
    let ignore = false;

    API.get("/tasks")
      .then((res) => {
        if (!ignore) setTasks(res.data);
      })
      .catch((err) => {
        if (!ignore) setError(err.response?.data?.message || "Could not load tasks");
      });

    return () => {
      ignore = true;
    };
  }, []);

  const splitList = (value) =>
    String(value || "")
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);

  const startEdit = (task) => {
    setEditingTaskId(task._id);
    setEditForm({
      title: task.title || "",
      description: task.description || "",
      department: task.department || "development",
      deadline: task.deadline ? new Date(task.deadline).toISOString().slice(0, 10) : "",
      services: (task.services || []).join(", "),
      media: (task.media || []).join("\n"),
    });
    setMessage("");
    setError("");
  };

  const cancelEdit = () => {
    setEditingTaskId(null);
    setEditForm({
      title: "",
      description: "",
      department: "development",
      deadline: "",
      services: "",
      media: "",
    });
  };

  const saveTask = async (taskId) => {
    setMessage("");
    setError("");
    try {
      await API.put(`/tasks/${taskId}`, {
        title: editForm.title,
        description: editForm.description,
        department: editForm.department,
        deadline: editForm.deadline,
        services: splitList(editForm.services),
        media: splitList(editForm.media),
      });
      setMessage("Task updated successfully.");
      cancelEdit();
      await fetchTasks();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update task");
    }
  };

  const deleteTask = async (taskId) => {
    const confirmed = window.confirm("Delete this task? It will no longer be visible to assigned team leaders or team members.");
    if (!confirmed) return;

    setMessage("");
    setError("");
    try {
      await API.delete(`/tasks/${taskId}`);
      setMessage("Task deleted successfully.");
      await fetchTasks();
    } catch (err) {
      setError(err.response?.data?.message || "Could not delete task");
    }
  };

  return (
    <div>
      <h1 className="text-4xl font-bold text-white mb-2">All Tasks</h1>
      <p className="text-slate-400 mb-8">View and manage all system tasks</p>

      {(message || error) && (
        <div className={`mb-5 rounded-lg border p-3 text-sm ${error ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}>
          {error || message}
        </div>
      )}

      <TaskStatusFilter value={statusFilter} onChange={setStatusFilter} tasks={tasks} />

      <div className="space-y-4">
        {filterTasksByStatus(tasks, statusFilter).map((task) => (
          <TaskCard key={task._id} task={task}>
            {editingTaskId === task._id ? (
              <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-950/50 p-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-200">Title</span>
                  <input
                    value={editForm.title}
                    onChange={(event) => setEditForm({ ...editForm, title: event.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-blue-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-200">Description</span>
                  <textarea
                    value={editForm.description}
                    onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
                    rows={4}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-blue-500"
                  />
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-200">Department</span>
                    <select
                      value={editForm.department}
                      onChange={(event) => setEditForm({ ...editForm, department: event.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-blue-500"
                    >
                      <option value="development">Development</option>
                      <option value="designing">Designing</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-200">Deadline</span>
                    <input
                      type="date"
                      value={editForm.deadline}
                      onChange={(event) => setEditForm({ ...editForm, deadline: event.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-blue-500"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-200">Services</span>
                  <input
                    value={editForm.services}
                    onChange={(event) => setEditForm({ ...editForm, services: event.target.value })}
                    placeholder="Website, Dashboard, API"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-blue-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-200">Media Links</span>
                  <textarea
                    value={editForm.media}
                    onChange={(event) => setEditForm({ ...editForm, media: event.target.value })}
                    placeholder="One link per line"
                    rows={3}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-blue-500"
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={cancelEdit}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => saveTask(task._id)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 hover:text-white"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => startEdit(task)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/20 hover:text-white"
                >
                  <Pencil className="h-4 w-4" />
                  Edit Task
                </button>
                <button
                  onClick={() => deleteTask(task._id)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 hover:text-white"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Task
                </button>
              </div>
            )}
          </TaskCard>
        ))}
      </div>
    </div>
  );
}

function AdminPerformance() {
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    let ignore = false;

    Promise.all([API.get("/tasks"), API.get("/users")]).then(([taskRes, userRes]) => {
      if (ignore) return;
      setTasks(taskRes.data);
      setUsers(userRes.data);
    });

    return () => {
      ignore = true;
    };
  }, []);

  const completed = tasks.filter((t) => t.status === "completed").length;
  const inProgress = tasks.filter((t) => t.status === "in-progress").length;
  const pending = tasks.filter((t) => t.status === "pending").length;
  const total = tasks.length;

  const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;
  const performanceUsers = users.filter((user) => user.role !== "admin");

  const getAssignedUserId = (task) => {
    if (!task.assignedTo) return null;
    if (typeof task.assignedTo === "string") return task.assignedTo;
    return task.assignedTo._id || task.assignedTo.id || null;
  };

  const getUserPerformance = (userId) => {
    const assignedTasks = tasks.filter((task) => getAssignedUserId(task) === userId);
    const userCompleted = assignedTasks.filter((task) => task.status === "completed").length;
    const userInProgress = assignedTasks.filter((task) => task.status === "in-progress").length;
    const rate = assignedTasks.length > 0 ? Math.round((userCompleted / assignedTasks.length) * 100) : 0;

    return {
      total: assignedTasks.length,
      completed: userCompleted,
      inProgress: userInProgress,
      rate,
    };
  };

  return (
    <div>
      <h1 className="text-4xl font-bold text-white mb-2">Performance Metrics</h1>
      <p className="text-slate-400 mb-8">System performance and task statistics</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-xl p-6 shadow-lg">
          <p className="text-slate-400 text-sm mb-2">Completion Rate</p>
          <h3 className="text-4xl font-bold text-white mb-2">{completionRate}%</h3>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-600/20 to-slate-900 border border-emerald-500/30 rounded-xl p-6 shadow-lg">
          <p className="text-slate-400 text-sm mb-2">Completed Tasks</p>
          <h3 className="text-4xl font-bold text-emerald-400">{completed}</h3>
        </div>

        <div className="bg-gradient-to-br from-blue-600/20 to-slate-900 border border-blue-500/30 rounded-xl p-6 shadow-lg">
          <p className="text-slate-400 text-sm mb-2">In Progress</p>
          <h3 className="text-4xl font-bold text-blue-400">{inProgress}</h3>
        </div>

        <div className="bg-gradient-to-br from-orange-600/20 to-slate-900 border border-orange-500/30 rounded-xl p-6 shadow-lg">
          <p className="text-slate-400 text-sm mb-2">Pending Tasks</p>
          <h3 className="text-4xl font-bold text-orange-400">{pending}</h3>
        </div>
      </div>

      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Individual Performance</h2>
          <p className="mt-1 text-sm text-slate-400">Assigned task progress for each team member</p>
        </div>
        <span className="hidden rounded-full border border-slate-700 bg-slate-800/70 px-3 py-1 text-xs font-semibold text-slate-300 sm:inline-block">
          {performanceUsers.length} users
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {performanceUsers.map((user) => {
          const userStats = getUserPerformance(user._id);

          return (
            <div
              key={user._id}
              className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800 to-slate-900 p-5 shadow-lg"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white shadow-lg shadow-blue-600/20">
                    {user.name?.charAt(0) || "U"}
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{user.name}</h3>
                    <p className="text-sm capitalize text-slate-400">{user.role?.replace("_", " ")}</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-2xl font-bold text-white">{userStats.rate}%</p>
                  <p className="text-xs text-slate-500">completion</p>
                </div>
              </div>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${userStats.rate}%` }}
                ></div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-3">
                  <p className="text-xs text-slate-500">Assigned</p>
                  <p className="mt-1 text-xl font-bold text-white">{userStats.total}</p>
                </div>
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
                  <p className="text-xs text-emerald-300/80">Completed</p>
                  <p className="mt-1 text-xl font-bold text-emerald-300">{userStats.completed}</p>
                </div>
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
                  <p className="text-xs text-blue-300/80">In Progress</p>
                  <p className="mt-1 text-xl font-bold text-blue-300">{userStats.inProgress}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedDate, setSelectedDate] = useState(getLocalDateKey);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [error, setError] = useState("");

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
      })
      .catch(() => {
        if (!ignore) setError("Could not load expense reports");
      });

    return () => {
      ignore = true;
    };
  }, [selectedDate, selectedMonth]);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Expense Reports</h1>
          <p className="text-slate-400">Daily and monthly office expenses added by Expense Manager.</p>
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

      {error && <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

      <ExpenseAnalytics summary={summary} expenses={expenses} />

      <div className="mt-8 rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800 to-slate-900 shadow-lg">
        <div className="border-b border-slate-700/50 px-6 py-5">
          <h2 className="text-xl font-bold text-white">All Expense Records</h2>
          <p className="mt-1 text-sm text-slate-400">Read-only expense entries for the selected month.</p>
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

function AdminAttendance() {
  const [users, setUsers] = useState([]);
  const [overview, setOverview] = useState(null);
  const [selectedDate, setSelectedDate] = useState(getLocalDateKey);
  const [editing, setEditing] = useState({});
  const [resetting, setResetting] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fetchAttendance = useCallback(async () => {
    const [userRes, overviewRes] = await Promise.all([
      API.get("/users"),
      API.get(`/monitoring/admin/overview?date=${selectedDate}`),
    ]);

    setUsers(userRes.data.filter((user) => user.role !== "admin" && user.role !== "expense_manager"));
    setOverview(overviewRes.data);
  }, [selectedDate]);

  useEffect(() => {
    let ignore = false;
    let refreshQueued = false;

    Promise.all([API.get("/users"), API.get(`/monitoring/admin/overview?date=${selectedDate}`)])
      .then(([userRes, overviewRes]) => {
        if (ignore) return;
        setUsers(userRes.data.filter((user) => user.role !== "admin" && user.role !== "expense_manager"));
        setOverview(overviewRes.data);
      })
      .catch(() => {
        if (!ignore) setError("Could not load attendance data");
      });

    const token = getStoredToken();
    const socket = token
      ? io(getSocketBaseUrl(), {
          auth: { token },
          transports: ["websocket", "polling"],
        })
      : null;

    const queueLiveRefresh = () => {
      if (ignore || refreshQueued) return;
      refreshQueued = true;
      window.setTimeout(async () => {
        refreshQueued = false;
        if (ignore) return;
        try {
          await fetchAttendance();
        } catch {
          if (!ignore) setError("Could not load attendance data");
        }
      }, 500);
    };

    if (socket) {
      socket.on("connect", () => socket.emit("admin:join-monitoring"));
      [
        "monitoring:heartbeat",
        "monitoring:online",
        "monitoring:offline",
        "monitoring:stopped",
      ].forEach((eventName) => socket.on(eventName, queueLiveRefresh));
    }

    return () => {
      ignore = true;
      socket?.disconnect();
    };
  }, [fetchAttendance, selectedDate]);

  const peopleByUser = new Map((overview?.people || []).map((person) => [person.user?._id, person]));

  const updateDraft = (userId, key, value) => {
    const currentUser = users.find((user) => user._id === userId);
    const current = editing[userId] || currentUser?.attendance || {};
    setEditing({
      ...editing,
      [userId]: {
        enabled: current.enabled !== false,
        startTime: current.startTime || "09:00",
        endTime: current.endTime || "17:00",
        requiredHours: current.requiredHours || 8,
        graceMinutes: current.graceMinutes || 0,
        allowEarlyWork: current.allowEarlyWork !== false,
        allowedBreakMinutes: current.allowedBreakMinutes ?? 60,
        autoStartOvertime: current.autoStartOvertime === true,
        [key]: value,
      },
    });
  };

  const saveAttendance = async (userId) => {
    setMessage("");
    setError("");

    const currentUser = users.find((user) => user._id === userId);
    const attendance = editing[userId] || currentUser?.attendance || {
      enabled: true,
      startTime: "09:00",
      endTime: "17:00",
      requiredHours: 8,
      graceMinutes: 0,
      allowEarlyWork: true,
      allowedBreakMinutes: 60,
      autoStartOvertime: false,
    };

    try {
      await API.put(`/users/${userId}`, { attendance });
      setMessage("Attendance settings updated.");
      setEditing((current) => {
        const next = { ...current };
        delete next[userId];
        return next;
      });
      await fetchAttendance();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update attendance settings");
    }
  };

  const resetAttendance = async (userId) => {
    const currentUser = users.find((user) => user._id === userId);
    const confirmed = window.confirm(
      `Reset ${currentUser?.name || "this employee"} for ${selectedDate}? This clears worked time, overtime, status, and activity records for that date.`
    );

    if (!confirmed) return;

    setMessage("");
    setError("");
    setResetting((current) => ({ ...current, [userId]: true }));

    try {
      await API.post(`/users/${userId}/attendance/reset`, { dateKey: selectedDate });
      setMessage("Attendance timer reset. The employee timer will start fresh on the next login/session refresh.");
      await fetchAttendance();
    } catch (err) {
      setError(err.response?.data?.message || "Could not reset attendance timer");
    } finally {
      setResetting((current) => {
        const next = { ...current };
        delete next[userId];
        return next;
      });
    }
  };

  const counts = (overview?.people || []).reduce(
    (acc, person) => {
      const status = person.attendance?.status;
      if (status === "on_time") acc.onTime += 1;
      if (status === "late") acc.late += 1;
      if (status === "absent") acc.absent += 1;
      if ((person.attendance?.overtimeSeconds || 0) > 0) acc.overtime += 1;
      if ((person.attendance?.shortfallSeconds || 0) > 0 && ["incomplete", "left_early"].includes(person.attendance?.workStatus)) acc.incomplete += 1;
      return acc;
    },
    { onTime: 0, late: 0, absent: 0, overtime: 0, incomplete: 0 }
  );

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Attendance Management</h1>
          <p className="text-slate-400">Set flexible employee schedules and track late logins, daily hours, and overtime.</p>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(event) => setSelectedDate(event.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
        />
      </div>

      {(message || error) && (
        <div className={`mb-5 rounded-lg border p-3 text-sm ${error ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}>
          {error || message}
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-5">
        {[
          ["On Time", counts.onTime, "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"],
          ["Late", counts.late, "border-amber-500/30 bg-amber-500/10 text-amber-300"],
          ["Absent", counts.absent, "border-red-500/30 bg-red-500/10 text-red-300"],
          ["Incomplete", counts.incomplete, "border-red-500/30 bg-red-500/10 text-red-300"],
          ["Overtime", counts.overtime, "border-blue-500/30 bg-blue-500/10 text-blue-300"],
        ].map(([label, value, tone]) => (
          <div key={label} className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800 to-slate-900 p-6 shadow-lg">
            <p className="text-sm text-slate-400">{label}</p>
            <h3 className="mt-2 text-4xl font-bold text-white">{value}</h3>
            <span className={`mt-3 inline-block rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>{selectedDate}</span>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800 to-slate-900 shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-700/30">
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Employee</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Start</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">End</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Work Hours</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Grace (min)</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Break (min)</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Worked / Overtime</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const person = peopleByUser.get(user._id);
                const attendance = editing[user._id] || user.attendance || {};
                const status = person?.attendance?.status || "absent";
                const overtimeSeconds = person?.attendance?.overtimeSeconds || 0;
                const shortfallSeconds = person?.attendance?.shortfallSeconds || 0;
                const workStatus = person?.attendance?.workStatus || "absent";

                return (
                  <tr key={user._id} className="border-b border-slate-700/30 transition hover:bg-slate-700/20">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-white">{user.name}</p>
                      <p className="text-xs capitalize text-slate-500">{user.role?.replace("_", " ")}</p>
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="time"
                        value={attendance.startTime || "09:00"}
                        onChange={(event) => updateDraft(user._id, "startTime", event.target.value)}
                        className="w-32 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="time"
                        value={attendance.endTime || "17:00"}
                        onChange={(event) => updateDraft(user._id, "endTime", event.target.value)}
                        className="w-32 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        min="1"
                        value={attendance.requiredHours || 8}
                        onChange={(event) => updateDraft(user._id, "requiredHours", Number(event.target.value))}
                        className="w-24 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        min="0"
                        value={attendance.graceMinutes || 0}
                        onChange={(event) => updateDraft(user._id, "graceMinutes", Number(event.target.value))}
                        className="w-24 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        min="0"
                        value={attendance.allowedBreakMinutes ?? 60}
                        onChange={(event) => updateDraft(user._id, "allowedBreakMinutes", Number(event.target.value))}
                        className="w-24 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block rounded-full border px-3 py-1 text-xs font-bold capitalize ${attendanceTone[status] || attendanceTone.absent}`}>
                        {status.replace("_", " ")}
                      </span>
                      {person?.attendance?.lateMinutes > 0 && <p className="mt-1 text-xs text-amber-300">{person.attendance.lateMinutes}m late</p>}
                      {person?.attendance?.firstLoginAt && <p className="mt-1 text-xs text-slate-500">First login {new Date(person.attendance.firstLoginAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-white">{formatSeconds(person?.activeSeconds || 0)}</p>
                      <p className="text-xs text-slate-500">Overtime {formatSeconds(overtimeSeconds)}</p>
                      {shortfallSeconds > 0 && (
                        <p className={`text-xs font-semibold capitalize ${workStatusTone[workStatus] || "text-slate-400"}`}>
                          {workStatus.replace("_", " ")} - short {formatSeconds(shortfallSeconds)}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => saveAttendance(user._id)}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => resetAttendance(user._id)}
                          disabled={Boolean(resetting[user._id])}
                          className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {resetting[user._id] ? "Resetting" : "Reset"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AdminMonitoring() {
  const [overview, setOverview] = useState(null);
  const [selectedDate, setSelectedDate] = useState(getLocalDateKey);
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchOverview = useCallback(async () => {
    try {
      setError("");
      const res = await API.get(`/monitoring/admin/overview?date=${selectedDate}`);
      setOverview(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load monitoring data");
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    let ignore = false;
    let refreshQueued = false;

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await API.get(`/monitoring/admin/overview?date=${selectedDate}`);
        if (!ignore) setOverview(res.data);
      } catch (err) {
        if (!ignore) setError(err.response?.data?.message || "Could not load monitoring data");
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    load();
    const token = getStoredToken();
    const socket = token
      ? io(getSocketBaseUrl(), {
          auth: { token },
          transports: ["websocket", "polling"],
        })
      : null;

    const queueLiveRefresh = () => {
      if (ignore || refreshQueued) return;
      refreshQueued = true;
      window.setTimeout(() => {
        refreshQueued = false;
        if (!ignore) fetchOverview();
      }, 500);
    };

    if (socket) {
      socket.on("connect", () => socket.emit("admin:join-monitoring"));
      [
        "monitoring:activity",
        "monitoring:heartbeat",
        "monitoring:online",
        "monitoring:offline",
        "monitoring:stopped",
        "monitoring:stop_attempt",
      ].forEach((eventName) => socket.on(eventName, queueLiveRefresh));
    }

    const refreshTimer = window.setInterval(() => {
      if (!ignore) fetchOverview();
    }, 30000);

    return () => {
      ignore = true;
      socket?.disconnect();
      window.clearInterval(refreshTimer);
    };
  }, [fetchOverview, selectedDate]);

  const people = overview?.people || [];
  const filteredPeople = people.filter((person) => {
    const user = person.user || {};
    const monitoringStatus = person.monitoringStatus || (person.isOnline ? "online" : person.latestSession ? "stopped" : "not_started");
    const roleOrTeam = user.department || user.role || "";
    return (
      (employeeFilter === "all" || user._id === employeeFilter) &&
      (roleFilter === "all" || roleOrTeam === roleFilter || user.role === roleFilter) &&
      (statusFilter === "all" || monitoringStatus === statusFilter || person.attendance?.status === statusFilter)
    );
  });
  const roleOptions = [...new Set(people.flatMap((person) => [person.user?.role, person.user?.department]).filter(Boolean))];
  const totals = overview?.totals || {};
  const activity = overview?.activities || {};
  const activityTotals = activity.totals || {};
  const trackedPeople = people.filter((person) => person.activeSeconds > 0);
  const idleRateDenominator = (totals.activeSeconds || 0) + (totals.idleSeconds || 0);
  const idleRate = idleRateDenominator ? Math.min(100, Math.round(((totals.idleSeconds || 0) / idleRateDenominator) * 100)) : 0;
  const completedTargetHours = people.filter((person) => person.activeSeconds >= getRequiredSeconds(person)).length;
  const monitoringStoppedUsers = totals.monitoringStoppedUsers || 0;
  const monitoringStoppedManuallyUsers = totals.monitoringStoppedManuallyUsers || 0;

  const cards = [
    {
      label: "Online Now",
      value: totals.onlineUsers || 0,
      detail: "users active in the last 90 seconds",
      icon: Wifi,
      tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    },
    {
      label: "Monitoring Stopped",
      value: monitoringStoppedUsers,
      detail: `${monitoringStoppedManuallyUsers} manual shutdowns today`,
      icon: AlertCircle,
      tone: "border-red-500/30 bg-red-500/10 text-red-300",
    },
    {
      label: "Tracked Today",
      value: totals.trackedUsers || 0,
      detail: `${people.length} total non-admin users`,
      icon: Users,
      tone: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    },
    {
      label: "Active Time",
      value: formatSeconds(totals.activeSeconds),
      detail: "combined desktop activity",
      icon: Activity,
      tone: "border-purple-500/30 bg-purple-500/10 text-purple-300",
    },
    {
      label: "Target Completed",
      value: completedTargetHours,
      detail: "users who reached their assigned hours",
      icon: CheckCircle2,
      tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    },
    {
      label: "Idle Time",
      value: formatSeconds(totals.idleSeconds),
      detail: `${idleRate}% of tracked time`,
      icon: TimerReset,
      tone: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    },
    {
      label: "YouTube Time",
      value: formatSeconds(activityTotals.youtubeSeconds),
      detail: "captured by desktop agent",
      icon: Activity,
      tone: "border-red-500/30 bg-red-500/10 text-red-300",
    },
    {
      label: "Google Searches",
      value: activityTotals.googleSearches || 0,
      detail: "queries detected today",
      icon: AlertCircle,
      tone: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
    },
  ];

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-1xl font-bold text-white mb-2">Desktop Activity Monitoring</h1>
          <p className="text-slate-400 text-sm">Live app and browser activity, active time, idle time, and individual user sessions.</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
          />
          <select
            value={employeeFilter}
            onChange={(event) => setEmployeeFilter(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
          >
            <option className="bg-white text-black" value="all">All employees</option>
            {people.map((person) => (
              <option className="bg-white text-black" key={person.user?._id} value={person.user?._id}>
                {person.user?.name}
              </option>
            ))}
          </select>
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
          >
            <option className="bg-white text-black" value="all">All roles/teams</option>
            {roleOptions.map((option) => (
              <option className="bg-white text-black" key={option} value={option}>
                {option.replace("_", " ")}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
          >
            <option className="bg-white text-black" value="all">All statuses</option>
            <option className="bg-white text-black" value="online">Online</option>
            <option className="bg-white text-black" value="stopped">Stopped</option>
            <option className="bg-white text-black" value="ended_for_today">Ended for today</option>
            <option className="bg-white text-black" value="not_started">Not started</option>
            <option className="bg-white text-black" value="on_time">On time</option>
            <option className="bg-white text-black" value="late">Late</option>
          </select>
          <button
            onClick={fetchOverview}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/20 hover:text-white"
          >
            <Clock3 className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div key={card.label} className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800 to-slate-900 p-6 shadow-lg">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-400">{card.label}</p>
                  <h3 className="mt-2 text-3xl font-bold text-white">{card.value}</h3>
                </div>
                <div className={`rounded-lg border p-3 ${card.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="text-xs text-slate-500">{card.detail}</p>
            </div>
          );
        })}
      </div>

      <div className="mb-8 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800 to-slate-900 p-6 shadow-lg">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-1xl font-bold text-white">Top Apps & Websites</h2>
              <p className="mt-1 text-sm text-slate-400">Apps and domains ranked by time spent today.</p>
            </div>
            <span className="rounded-full border border-slate-700 bg-slate-950/50 px-3 py-1 text-xs font-semibold text-slate-300">
              {formatSeconds(activityTotals.durationSeconds)}
            </span>
          </div>

          <div className="space-y-3">
            {(activity.topDomains || []).map((item) => {
              const width = activityTotals.durationSeconds
                ? Math.max(6, Math.round((item.durationSeconds / activityTotals.durationSeconds) * 100))
                : 0;

              return (
                <div key={item.domain} className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="truncate font-semibold text-white">{item.domain}</p>
                    <p className="text-sm text-slate-400">{formatSeconds(item.durationSeconds)}</p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-700">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
            {(activity.topDomains || []).length === 0 && (
              <p className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-6 text-center text-slate-400">
                No desktop activity yet. Start the Python monitoring agent.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800 to-slate-900 p-6 shadow-lg">
          <div className="mb-5">
            <h2 className="text-1xl font-bold text-white">YouTube Monitoring</h2>
            <p className="mt-1 text-sm text-slate-400">Video titles, browser names, categories, and watch time from the desktop agent.</p>
          </div>

          <div className="space-y-3">
            {(activity.youtube || []).map((item) => (
              <div key={item._id} className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">
                      {item.youtube?.videoTitle || item.title || "YouTube video"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {item.user?.name || "User"} - {item.youtube?.category || "Uncategorized"}
                    </p>
                    {item.youtube?.videoId && <p className="mt-1 text-xs text-slate-600">Video ID: {item.youtube.videoId}</p>}
                  </div>
                  <span className="w-fit rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-200">
                    {formatSeconds(item.durationSeconds)}
                  </span>
                </div>
              </div>
            ))}
            {(activity.youtube || []).length === 0 && (
              <p className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-6 text-center text-slate-400 text-sm">
                No YouTube activity captured yet.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800 to-slate-900 p-6 shadow-lg">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-1xl font-bold text-white">Google Searches & Recent Activity</h2>
            <p className="mt-1 text-sm text-slate-400">Search queries, browser tabs, and active app windows captured by the agent.</p>
          </div>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
            Non-work {formatSeconds(activityTotals.nonWorkSeconds)}
          </span>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <div className="space-y-3">
            {(activity.googleSearches || []).map((item) => (
              <div key={item._id} className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-4">
                <p className="font-semibold text-white">{item.google?.query || item.title || "Google search"}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {item.user?.name || "User"} - {new Date(item.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
            {(activity.googleSearches || []).length === 0 && (
              <p className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-6 text-center text-slate-400">
                No Google searches captured yet.
              </p>
            )}
          </div>

          <div className="space-y-3">
            {(activity.recent || []).slice(0, 8).map((item) => (
              <div key={item._id} className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{item.title || item.domain}</p>
                    <p className="mt-1 truncate text-sm text-slate-500">
                      {item.domain || item.appName || item.browser || "Desktop"} - {item.user?.name || "User"}
                    </p>
                  </div>
                  <span
                    className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${
                      item.productivity === "non_work"
                        ? "border-red-500/30 bg-red-500/10 text-red-200"
                        : "border-slate-600 bg-slate-800/70 text-slate-300"
                    }`}
                  >
                    {formatSeconds(item.durationSeconds)}
                  </span>
                </div>
              </div>
            ))}
            {(activity.recent || []).length === 0 && (
              <p className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-6 text-center text-slate-400">
                No desktop activity captured yet.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800 to-slate-900 shadow-lg">
        <div className="border-b border-slate-700/50 px-6 py-5">
          <h2 className="text-1xl font-bold text-white">Individual User Monitoring</h2>
          <p className="mt-1 text-sm text-slate-400">Admins can see each non-admin user's live desktop status and time split.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-700/30">
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">User</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Active</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Idle</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Current Activity</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {filteredPeople.map((person) => {
                const user = person.user;
                const latest = person.latestSession;
                const requiredSeconds = getRequiredSeconds(person);
                const requiredHours = Number(person.attendance?.requiredHours) || 8;
                const targetRate = requiredSeconds ? Math.min(100, Math.round((person.activeSeconds / requiredSeconds) * 100)) : 0;
                const completedTarget = person.activeSeconds >= requiredSeconds;
                const personIdleRateDenominator = (person.activeSeconds || 0) + (person.idleSeconds || 0);
                const personIdleRate = personIdleRateDenominator
                  ? Math.min(100, Math.round(((person.idleSeconds || 0) / personIdleRateDenominator) * 100))
                  : 0;
                const monitoringStatus = person.monitoringStatus || (person.isOnline ? "online" : latest ? "stopped" : "not_started");
                const currentActivity = person.isOnline
                  ? latest?.currentTitle || latest?.currentApp || latest?.portalPath || "Working, activity not captured yet"
                  : monitoringStatus === "not_started"
                    ? "Not started today"
                    : latest?.currentTitle || latest?.currentApp || latest?.portalPath || "No current activity";
                const statusStyles = {
                  online: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
                  on_break: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
                  idle: "border-amber-500/30 bg-amber-500/10 text-amber-300",
                  offline: "border-slate-500/30 bg-slate-500/10 text-slate-300",
                  stopped: "border-red-500/30 bg-red-500/10 text-red-300",
                  stopped_manually: "border-amber-500/30 bg-amber-500/10 text-amber-300",
                  ended_for_today: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
                  not_started: "border-slate-600 bg-slate-800/70 text-slate-400",
                };
                const statusLabel = {
                  online: "Online",
                  on_break: "On break",
                  idle: "Idle",
                  offline: "Offline",
                  stopped: "Monitoring stopped",
                  stopped_manually: "Stopped manually",
                  ended_for_today: "Ended for today",
                  not_started: "Not started",
                }[monitoringStatus] || "Offline";

                return (
                  <tr key={user._id} className="border-b border-slate-700/30 transition hover:bg-slate-700/20">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 font-bold text-white">
                          {user.name?.charAt(0) || "U"}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{user.name}</p>
                          <p className="text-xs capitalize text-slate-500">{user.role?.replace("_", " ")}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusStyles[monitoringStatus] || statusStyles.not_started}`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-white">{formatSeconds(person.activeSeconds)}</p>
                      <div className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-slate-700">
                        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${targetRate}%` }} />
                      </div>
                      <p className={`mt-1 text-xs font-semibold ${completedTarget ? "text-emerald-300" : "text-slate-500"}`}>
                        {completedTarget ? `${requiredHours}h shift complete` : `${targetRate}% of ${requiredHours}h shift`}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-amber-200">{formatSeconds(person.idleSeconds)}</p>
                      <p className="text-xs text-slate-500">{personIdleRate}% idle</p>
                    </td>
                    <td className="max-w-xs px-6 py-4 text-sm text-slate-400">
                      <p className="truncate">
                        {currentActivity}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">{formatLastSeen(latest?.lastSeenAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!loading && filteredPeople.length === 0 && (
          <p className="p-6 text-center text-slate-400">No users found for monitoring.</p>
        )}
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800 to-slate-900 p-6 shadow-lg">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-1xl font-bold text-white">Today's Tracked Users</h2>
            <p className="mt-1 text-sm text-slate-400">A quick list of users who have sent monitoring data today.</p>
          </div>
          <span className="rounded-full border border-slate-700 bg-slate-950/50 px-3 py-1 text-xs font-semibold text-slate-300">
            {trackedPeople.length} active records
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {trackedPeople.map((person) => (
            <div key={person.user._id} className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-bold text-white">{person.user.name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Active {formatSeconds(person.activeSeconds)} - {person.sessionCount} session{person.sessionCount === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="text-sm font-semibold text-blue-300">{formatSeconds(person.activeSeconds)} active</p>
              </div>
            </div>
          ))}
          {trackedPeople.length === 0 && (
            <p className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-6 text-center text-slate-400 text-sm">
              No monitoring activity for this date yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminCalendar() {
  const [calendar, setCalendar] = useState({ days: [], holidays: [], weeklyOffDays: [] });
  const [holidayForm, setHolidayForm] = useState({ dateKey: getLocalDateKey(), name: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const year = new Date().getFullYear();
      const res = await API.get(`/work-calendar?from=${year}-01-01&to=${year}-12-31`);
      setCalendar(res.data || { days: [], holidays: [], weeklyOffDays: [] });
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not load work calendar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  const saveHoliday = async (event) => {
    event.preventDefault();
    setMessage("");
    try {
      await API.post("/work-calendar/holidays", holidayForm);
      setHolidayForm({ dateKey: holidayForm.dateKey, name: "" });
      setMessage("Holiday saved.");
      await loadCalendar();
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not save holiday.");
    }
  };

  const removeHoliday = async (dateKey) => {
    setMessage("");
    try {
      await API.delete(`/work-calendar/holidays/${dateKey}`);
      setMessage("Holiday removed.");
      await loadCalendar();
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not remove holiday.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-300">Work Calendar</p>
            <h1 className="mt-2 text-3xl font-bold text-white">Holidays & Weekly Off Days</h1>
            <p className="mt-2 text-slate-400">
              Saturday and Sunday are automatic off days. Custom holidays are checked by shift date, so Friday overnight work still belongs to Friday.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-slate-300">
            <CalendarDays className="h-5 w-5 text-blue-300" />
            <span>{calendar.weeklyOffDays?.join(", ") || "Saturday, Sunday"}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <form onSubmit={saveHoliday} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-xl font-bold text-white">Add Custom Holiday</h2>
          <p className="mt-1 text-sm text-slate-400">Use this for Eid, national holidays, emergency office closure, or company events.</p>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-300">Holiday Date</span>
              <input
                type="date"
                value={holidayForm.dateKey}
                onChange={(event) => setHolidayForm((form) => ({ ...form, dateKey: event.target.value }))}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
                required
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-300">Holiday Name</span>
              <input
                value={holidayForm.name}
                onChange={(event) => setHolidayForm((form) => ({ ...form, name: event.target.value }))}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
                placeholder="Eid Holiday"
                required
              />
            </label>
            <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-500">
              <Plus className="h-4 w-4" />
              Save Holiday
            </button>
          </div>
        </form>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-xl font-bold text-white">Weekly Off Rule</h2>
          <div className="mt-5 rounded-xl border border-blue-500/30 bg-blue-500/10 p-5">
            <div className="flex items-center gap-3 text-blue-200">
              <CalendarDays className="h-5 w-5" />
              <p className="font-semibold">{calendar.weeklyOffDays?.join(", ") || "Saturday, Sunday"}</p>
            </div>
            <p className="mt-3 text-sm text-slate-300">
              These days are automatic off days. If a Friday shift continues after midnight, that time still belongs to Friday's shift report.
            </p>
          </div>
          {message && <p className="mt-4 rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">{message}</p>}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Custom Holidays</h2>
          {loading && <span className="text-sm text-slate-400">Loading...</span>}
        </div>
        <div className="mt-5 overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/80 text-slate-400">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Holiday Name</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {calendar.holidays?.map((holiday) => (
                <tr key={holiday.dateKey} className="bg-slate-900/40">
                  <td className="px-4 py-3 font-semibold text-white">{formatDateOnly(holiday.dateKey)}</td>
                  <td className="px-4 py-3 text-slate-300">{holiday.name}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => removeHoliday(holiday.dateKey)} className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-200 hover:bg-red-500/20">
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {!calendar.holidays?.length && (
                <tr>
                  <td colSpan="3" className="px-4 py-8 text-center text-slate-400">No custom holidays added for this year.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <DashboardLayout>
      <Routes>
        <Route index element={<AdminHome />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="add-task" element={<AdminCreateTask />} />
        <Route path="tasks" element={<AdminTasks />} />
        <Route path="performance" element={<AdminPerformance />} />
        <Route path="attendance" element={<AdminAttendance />} />
        <Route path="calendar" element={<AdminCalendar />} />
        <Route path="expenses" element={<AdminExpenses />} />
        <Route path="monitoring" element={<AdminMonitoring />} />
        <Route path="notifications" element={<Notifications />} />
      </Routes>
    </DashboardLayout>
  );
}
