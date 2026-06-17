import { Routes, Route } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { BarChart3, CheckCircle2, Clock, Layers3 } from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import API from "../../services/api";
import TaskCard from "../../components/TaskCard";
import DashboardAnalytics from "../../components/DashboardAnalytics";
import TaskStatusFilter, { filterTasksByStatus } from "../../components/TaskStatusFilter";
import Notifications from "../Notifications";
import { getStoredUser } from "../../utils/authStorage";


// 🏠 HOME
function DevLeaderHome() {
  const currentUser = getStoredUser();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    let ignore = false;

    Promise.all([API.get("/tasks"), API.get("/users")]).then(([taskRes, userRes]) => {
      if (ignore) return;
      setTasks(taskRes.data);
      setUsers(userRes.data.filter((member) => member.role === "designer" || member.role === "teamleader_design"));
    });

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <DashboardAnalytics
      title={`Welcome ${currentUser?.name || "Team Leader"}`}
      subtitle="Track design progress, team members, task timing, deadlines, and recent work history."
      tasks={tasks}
      users={users}
      showPeople
      showMonitoringSummary
    />
  );
  /*

  return <h2 className="text-xl font-bold">Welcome {user?.name} 👨‍💻</h2>;
}


// 📋 ALL TASKS
  */
}

function AllTasks() {
  const [tasks, setTasks] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    API.get("/tasks").then(res => setTasks(res.data));
  }, []);

  return (
    <>
      <h2 className="text-xl font-bold mb-4">All Design Tasks</h2>
      <TaskStatusFilter value={statusFilter} onChange={setStatusFilter} tasks={tasks} />

      {filterTasksByStatus(tasks, statusFilter).map(task => (
        <TaskCard key={task._id} task={task} />
      ))}
    </>
  );
}


// 👨‍💻 ASSIGN TASKS
function AssignTasks() {
  const user = getStoredUser();
  const [tasks, setTasks] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [users, setUsers] = useState([]);

  const getId = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    return value._id || value.id || "";
  };

  const getAssignableUsers = (teamMembers) => {
    const leaderOption = {
      _id: user?._id,
      name: `${user?.name || "Me"} (Team Leader)`,
      role: user?.role,
    };

    return [leaderOption, ...teamMembers.filter((member) => member._id !== user?._id)];
  };

  const getTakeBackCounts = () => {
    return users.map((member) => {
      const count = tasks.reduce((total, task) => {
        const taskCount = (task.takeBackHistory || []).filter((entry) => getId(entry.takenFrom) === member._id).length;
        return total + taskCount;
      }, 0);

      return { ...member, count };
    });
  };

  const fetchData = async () => {
    const taskRes = await API.get("/tasks");
    const userRes = await API.get("/users");

    setTasks(taskRes.data);
    setUsers(userRes.data.filter(u => u.role === "designer"));
  };

  useEffect(() => {
    let ignore = false;

    Promise.all([API.get("/tasks"), API.get("/users")]).then(([taskRes, userRes]) => {
      if (ignore) return;

      setTasks(taskRes.data);
      setUsers(userRes.data.filter(u => u.role === "designer"));
    });

    return () => {
      ignore = true;
    };
  }, []);

  const assign = async (taskId, userId) => {
    if (!userId) return;
    await API.put("/tasks/assign", { taskId, userId });
    fetchData();
  };

  const takeBackRecords = getTakeBackCounts();
  const assignableUsers = getAssignableUsers(users);

  return (
    <>
      <h2 className="text-xl font-bold mb-4">Assign Tasks</h2>
      <TaskStatusFilter value={statusFilter} onChange={setStatusFilter} tasks={tasks} />

      <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/20">
        <h3 className="text-lg font-bold text-white">Take Back Records</h3>
        <p className="mt-1 text-sm text-slate-400">How many times each designer could not continue and the task was taken back.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {takeBackRecords.map((member) => (
            <div key={member._id} className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-4">
              <p className="font-semibold text-white">{member.name}</p>
              <p className="mt-1 text-sm text-slate-400">Taken back: <span className="font-bold text-amber-300">{member.count}</span></p>
            </div>
          ))}
        </div>
      </div>

      {filterTasksByStatus(tasks, statusFilter).map(task => (
        <TaskCard key={task._id} task={task}>
          {task.status !== "completed" && (
            <>
              <select
                value={getId(task.assignedTo)}
                className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-sm font-medium text-slate-100 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                onChange={(e) => assign(task._id, e.target.value)}
              >
                <option value="" className="bg-white text-black">
                  Select designer or assign to yourself
                </option>
                {assignableUsers.map(u => (
                  <option className="bg-white text-black" key={u._id} value={u._id}>
                    {u.name}
                  </option>
                ))}
              </select>

              {getId(task.assignedTo) && getId(task.assignedTo) !== user?._id && (
                <button
                  onClick={() => assign(task._id, user._id)}
                  className="mt-3 w-full rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 hover:text-white"
                >
                  Take Back Task
                </button>
              )}
            </>
          )}
        </TaskCard>
      ))}
    </>
  );
}


// 🔍 WORK REVIEW
function WorkReview() {
  const [tasks, setTasks] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [comments, setComments] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fetchReviewTasks = useCallback(async () => {
    const res = await API.get("/tasks");
    setTasks(res.data.filter(t => t.reviewSubmission && t.reviewStatus === "pending" && !t.submission));
  }, []);

  useEffect(() => {
    let ignore = false;

    API.get("/tasks").then((res) => {
      if (ignore) return;
      setTasks(res.data.filter(t => t.reviewSubmission && t.reviewStatus === "pending" && !t.submission));
    });

    return () => {
      ignore = true;
    };
  }, []);

  const reviewTask = async (taskId, decision) => {
    setMessage("");
    setError("");

    try {
      await API.put("/tasks/review-submission", {
        taskId,
        decision,
        comment: comments[taskId],
      });

      setComments({ ...comments, [taskId]: "" });
      setMessage(decision === "approved" ? "Task approved. Designer can upload now." : "Changes requested.");
      fetchReviewTasks();
    } catch (err) {
      setError(err.response?.data?.message || "Could not review task");
    }
  };

  return (
    <>
      <h2 className="text-xl font-bold mb-4">Work Review</h2>
      <p className="mb-6 text-slate-400">Review designer submissions before they are allowed to upload to PM.</p>
      <TaskStatusFilter value={statusFilter} onChange={setStatusFilter} tasks={tasks} />

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

      {filterTasksByStatus(tasks, statusFilter).length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 text-center text-slate-400">
          No submissions waiting for review.
        </div>
      ) : (
        filterTasksByStatus(tasks, statusFilter).map(task => (
          <TaskCard key={task._id} task={task}>
            <div className="space-y-3">
              <a
                href={task.reviewSubmission}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm font-semibold text-blue-300 hover:text-blue-200"
              >
                Open submitted work
              </a>
              <textarea
                placeholder="Write changes, or write: You can upload now"
                value={comments[task._id] || ""}
                onChange={(e) => setComments({ ...comments, [task._id]: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                rows={3}
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => reviewTask(task._id, "changes_requested")}
                  className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20 hover:text-white"
                >
                  Request Changes
                </button>
                <button
                  onClick={() => reviewTask(task._id, "approved")}
                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 hover:text-white"
                >
                  Approve Upload
                </button>
              </div>
            </div>
          </TaskCard>
        ))
      )}
    </>
  );
}


// 🔔 NOTIFICATIONS
function UploadOwnWork() {
  const user = getStoredUser();
  const userId = user?._id;
  const [tasks, setTasks] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [submission, setSubmission] = useState({});
  const [submissionMessage, setSubmissionMessage] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fetchTasks = useCallback(async () => {
    const res = await API.get("/tasks");
    setTasks(
      res.data.filter(
        (task) => task.status === "in-progress" && (task.assignedTo?._id || task.assignedTo) === userId
      )
    );
  }, [userId]);

  useEffect(() => {
    let ignore = false;

    API.get("/tasks").then((res) => {
      if (ignore) return;
      setTasks(
        res.data.filter(
          (task) => task.status === "in-progress" && (task.assignedTo?._id || task.assignedTo) === userId
        )
      );
    });

    return () => {
      ignore = true;
    };
  }, [userId]);

  const uploadTask = async (taskId) => {
    setMessage("");
    setError("");

    try {
      await API.put("/tasks/submit", {
        taskId,
        submission: submission[taskId],
        message: submissionMessage[taskId],
      });

      setSubmission({ ...submission, [taskId]: "" });
      setSubmissionMessage({ ...submissionMessage, [taskId]: "" });
      setMessage("Task uploaded to PM.");
      fetchTasks();
    } catch (err) {
      setError(err.response?.data?.message || "Could not upload task");
    }
  };

  return (
    <>
      <h2 className="text-xl font-bold mb-4">Upload Work</h2>
      <p className="mb-6 text-slate-400">Tasks assigned to you as team leader upload directly to PM.</p>
      <TaskStatusFilter value={statusFilter} onChange={setStatusFilter} tasks={tasks} />

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

      {filterTasksByStatus(tasks, statusFilter).length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 text-center text-slate-400">
          No tasks assigned to you for upload.
        </div>
      ) : (
        filterTasksByStatus(tasks, statusFilter).map((task) => (
          <TaskCard key={task._id} task={task}>
            <input
              placeholder="Paste final work link for PM"
              value={submission[task._id] || ""}
              onChange={(e) => setSubmission({ ...submission, [task._id]: e.target.value })}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            />
            <textarea
              placeholder="Write what you added, fixed, or completed"
              value={submissionMessage[task._id] || ""}
              onChange={(e) => setSubmissionMessage({ ...submissionMessage, [task._id]: e.target.value })}
              rows={3}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            />
            <button
              onClick={() => uploadTask(task._id)}
              className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Upload to PM
            </button>
          </TaskCard>
        ))
      )}
    </>
  );
}

// 📊 PERFORMANCE
function Performance() {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    API.get("/tasks").then(res => setTasks(res.data));
  }, []);

  const completed = tasks.filter(t => t.status === "completed").length;
  const inProgress = tasks.filter(t => t.status === "in-progress").length;
  const completionRate = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

  const stats = [
    { label: "Total Tasks", value: tasks.length, icon: Layers3, color: "border-blue-500/30 bg-blue-500/10 text-blue-300" },
    { label: "Completed", value: completed, icon: CheckCircle2, color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
    { label: "In Progress", value: inProgress, icon: Clock, color: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
  ];

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-300">Performance</p>
        <h2 className="mt-2 text-3xl font-bold text-white">Team Performance</h2>
        <p className="mt-2 text-slate-400">Track design task progress at a glance.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div key={stat.label} className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/20">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-400">{stat.label}</p>
                  <p className="mt-2 text-4xl font-bold text-white">{stat.value}</p>
                </div>
                <div className={`rounded-lg border p-3 ${stat.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg shadow-slate-950/20">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">Completion Rate</p>
            <h3 className="mt-1 text-2xl font-bold text-white">{completionRate}% complete</h3>
          </div>
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-blue-300">
            <BarChart3 className="h-6 w-6" />
          </div>
        </div>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${completionRate}%` }} />
        </div>
      </div>
    </div>
  );
}


// MAIN EXPORT
export default function DevLeaderDashboard() {
  return (
    <DashboardLayout>
      <Routes>
        <Route index element={<DevLeaderHome />} />
        <Route path="tasks" element={<AllTasks />} />
        <Route path="assign" element={<AssignTasks />} />
        <Route path="upload" element={<UploadOwnWork />} />
        <Route path="review" element={<WorkReview />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="performance" element={<Performance />} />
      </Routes>
    </DashboardLayout>
  );
}
