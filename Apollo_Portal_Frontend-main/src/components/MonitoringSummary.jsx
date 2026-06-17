import { Activity, BarChart3, CheckCircle2, Clock3, Coffee, Timer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import API from "../services/api";
import { formatDuration, getCompletedDate, getTaskDurationMinutes } from "../utils/taskMetrics";
import { formatDateOnly } from "../utils/dateOnly";

const formatSeconds = (seconds = 0) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const getLocalDateKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toLocalDateKey = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getRangeDays = (from, to) => {
  const fromTime = new Date(`${from}T00:00:00`).getTime();
  const toTime = new Date(`${to}T00:00:00`).getTime();
  if (Number.isNaN(fromTime) || Number.isNaN(toTime)) return 0;
  return Math.floor((toTime - fromTime) / 86400000) + 1;
};

const isTaskLate = (task) => {
  if (!task.deadline) return false;
  const deadline = new Date(task.deadline);
  deadline.setHours(23, 59, 59, 999);
  const compareDate = new Date(getCompletedDate(task) || Date.now());
  return compareDate.getTime() > deadline.getTime();
};

function Stat({ icon: Icon, label, value, tone = "blue" }) {
  const tones = {
    blue: "border-blue-500/25 bg-blue-500/10 text-blue-300",
    green: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    amber: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    slate: "border-slate-700 bg-slate-950/50 text-slate-300",
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="mt-1 text-xl font-bold text-white">{value}</p>
        </div>
        <div className={`rounded-lg border p-2 ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

export default function MonitoringSummary({ tasks = [] }) {
  const [summary, setSummary] = useState(null);
  const [rangeFrom, setRangeFrom] = useState(getLocalDateKey);
  const [rangeTo, setRangeTo] = useState(getLocalDateKey);
  const [rangeReport, setRangeReport] = useState(null);
  const [rangeError, setRangeError] = useState("");

  useEffect(() => {
    let ignore = false;
    const fetchSummary = async () => {
      try {
        const res = await API.get("/monitoring/me/summary");
        if (!ignore) setSummary(res.data);
      } catch {
        if (!ignore) setSummary(null);
      }
    };

    fetchSummary();
    const intervalId = window.setInterval(fetchSummary, 30000);
    return () => {
      ignore = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const today = summary?.today || {};
  const todayKey = getLocalDateKey();
  const todayAttendanceStatus = today.attendanceStatus || "not_started";
  const todayAttendanceCounts = {
    onTime: todayAttendanceStatus === "on_time" ? 1 : 0,
    late: todayAttendanceStatus === "late" ? 1 : 0,
    absent: todayAttendanceStatus === "absent" ? 1 : 0,
  };
  const todayTasks = tasks.filter((task) =>
    [task.createdAt, task.updatedAt, task.completedAt, task.assignedAt].some((date) => toLocalDateKey(date) === todayKey)
  );
  const completedTasks = todayTasks.filter((task) => task.status === "completed");
  const inProgressTasks = todayTasks.filter((task) => task.status === "in-progress");
  const pendingTasks = todayTasks.filter((task) => task.status === "pending");
  const averageMinutes = completedTasks.length
    ? Math.round(completedTasks.reduce((total, task) => total + getTaskDurationMinutes(task), 0) / completedTasks.length)
    : 0;
  const onTimeTasks = completedTasks.filter((task) => !isTaskLate(task));
  const lateTasks = todayTasks.filter(isTaskLate);
  const recentTasks = useMemo(
    () => [...todayTasks].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)).slice(0, 5),
    [todayTasks],
  );

  const loadRange = async () => {
    setRangeError("");
    const days = getRangeDays(rangeFrom, rangeTo);
    if (days < 1 || days > 15) {
      setRangeError("Please select a valid range from 1 to 15 days.");
      return;
    }

    try {
      const res = await API.get(`/monitoring/me/range?from=${rangeFrom}&to=${rangeTo}`);
      setRangeReport(res.data);
    } catch (error) {
      setRangeError(error.response?.data?.message || "Could not load range report");
    }
  };

  return (
    <section className="mb-6 rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/20">
      <div className="mb-5">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-300">Work Summary</p>
        <h2 className="mt-1 text-xl font-bold text-white">Your Attendance, Tasks, Performance, And Monitoring</h2>
      </div>

      <div className="space-y-6">
        <section>
          <h3 className="mb-3 text-lg font-bold text-white">Attendance</h3>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={CheckCircle2} label="Status" value={today.attendanceStatus?.replace("_", " ") || "not started"} tone="green" />
            <Stat icon={CheckCircle2} label="On Time" value={todayAttendanceCounts.onTime} tone="green" />
            <Stat icon={Clock3} label="Late" value={todayAttendanceCounts.late} tone="amber" />
            <Stat icon={Activity} label="Absent" value={todayAttendanceCounts.absent} tone="slate" />
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-lg font-bold text-white">Task</h3>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={BarChart3} label="Today Tasks" value={todayTasks.length} />
            <Stat icon={CheckCircle2} label="Completed" value={completedTasks.length} tone="green" />
            <Stat icon={Timer} label="In Progress" value={inProgressTasks.length} tone="blue" />
            <Stat icon={Clock3} label="Pending" value={pendingTasks.length} tone="amber" />
          </div>
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">Task</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Deadline</th>
                </tr>
              </thead>
              <tbody>
                {recentTasks.map((task) => (
                  <tr key={task._id} className="border-t border-slate-800 text-slate-300">
                    <td className="max-w-sm truncate px-4 py-3 font-semibold text-white">{task.title || "Untitled task"}</td>
                    <td className="px-4 py-3 capitalize">{task.status?.replace("-", " ") || "pending"}</td>
                    <td className="px-4 py-3">{task.deadline ? formatDateOnly(task.deadline) : "Not set"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {recentTasks.length === 0 && <p className="p-4 text-center text-slate-400">No task activity found for today.</p>}
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-lg font-bold text-white">Performance</h3>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={CheckCircle2} label="On Time Tasks" value={onTimeTasks.length} tone="green" />
            <Stat icon={Clock3} label="Late Tasks" value={lateTasks.length} tone="amber" />
            <Stat icon={Timer} label="Avg Task Time" value={formatDuration(averageMinutes)} tone="blue" />
            <Stat icon={BarChart3} label="Completion Rate" value={`${todayTasks.length ? Math.round((completedTasks.length / todayTasks.length) * 100) : 0}%`} />
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-lg font-bold text-white">Monitoring</h3>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={Timer} label="Active" value={formatSeconds(today.activeSeconds)} tone="green" />
            <Stat icon={Clock3} label="Idle" value={formatSeconds(today.idleSeconds)} tone="amber" />
            <Stat icon={Coffee} label="Break" value={formatSeconds(today.breakSeconds)} tone="blue" />
            <Stat icon={Activity} label="Overtime" value={formatSeconds(today.overtimeSeconds)} tone="slate" />
          </div>

          <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
            <div className="mb-4">
              <h4 className="font-bold text-white">Progress Between Dates</h4>
              <p className="mt-1 text-sm text-slate-500">Check active, idle, break, overtime, on-time, late, and absent days.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="text-sm text-slate-400">
                From
                <input
                  type="date"
                  value={rangeFrom}
                  onChange={(event) => setRangeFrom(event.target.value)}
                  className="mt-1 block rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                />
              </label>
              <label className="text-sm text-slate-400">
                To
                <input
                  type="date"
                  value={rangeTo}
                  onChange={(event) => setRangeTo(event.target.value)}
                  className="mt-1 block rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                />
              </label>
              <button
                onClick={loadRange}
                className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/20 hover:text-white"
              >
                View Range
              </button>
            </div>

            {rangeError && <p className="mt-3 text-sm text-red-300">{rangeError}</p>}

            {rangeReport && (
              <div className="mt-5">
                <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                  <Stat icon={Timer} label="Range Active" value={formatSeconds(rangeReport.totals?.activeSeconds)} tone="green" />
                  <Stat icon={Clock3} label="Range Idle" value={formatSeconds(rangeReport.totals?.idleSeconds)} tone="amber" />
                  <Stat icon={Coffee} label="Range Break" value={formatSeconds(rangeReport.totals?.breakSeconds)} tone="blue" />
                  <Stat icon={Activity} label="Range Overtime" value={formatSeconds(rangeReport.totals?.overtimeSeconds)} tone="slate" />
                  <Stat icon={CheckCircle2} label="On Time / Late" value={`${rangeReport.totals?.onTimeDays || 0} / ${rangeReport.totals?.lateDays || 0}`} tone="green" />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[42rem] text-sm">
                    <thead>
                      <tr className="border-y border-slate-800 text-left text-slate-400">
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Active</th>
                        <th className="px-3 py-2">Idle</th>
                        <th className="px-3 py-2">Break</th>
                        <th className="px-3 py-2">Overtime</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(rangeReport.days || []).map((day) => (
                        <tr key={day.dateKey} className="border-b border-slate-800">
                          <td className="px-3 py-2 font-semibold text-white">{day.dateKey}</td>
                          <td className="px-3 py-2 capitalize text-slate-300">{day.attendanceStatus?.replace("_", " ")}</td>
                          <td className="px-3 py-2 text-emerald-300">{formatSeconds(day.activeSeconds)}</td>
                          <td className="px-3 py-2 text-amber-300">{formatSeconds(day.idleSeconds)}</td>
                          <td className="px-3 py-2 text-blue-300">{formatSeconds(day.breakSeconds)}</td>
                          <td className="px-3 py-2 text-slate-300">{formatSeconds(day.overtimeSeconds)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
