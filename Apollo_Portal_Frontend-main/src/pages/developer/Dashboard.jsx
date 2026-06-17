import { Routes, Route } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import API from "../../services/api";
import TaskCard from "../../components/TaskCard";
import DashboardAnalytics from "../../components/DashboardAnalytics";
import TaskStatusFilter, { filterTasksByStatus } from "../../components/TaskStatusFilter";
import Notifications from "../Notifications";
import { getStoredUser } from "../../utils/authStorage";


// 🏠 HOME
function DeveloperHome() {
  const user = getStoredUser();
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    API.get("/tasks").then((res) => setTasks(res.data));
  }, []);

  return (
    <DashboardAnalytics
      title={`Welcome ${user?.name || "Developer"}`}
      subtitle="Your daily progress, monthly progress, deadlines, task time, and work history."
      tasks={tasks}
      showMonitoringSummary
    />
  );
  /*

  return (
    <h2 className="text-2xl font-bold">
      Welcome {user?.name} 👋
    </h2>
  );
  */
}


// 📋 TASKS
function DevTasks() {
  const [tasks, setTasks] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    API.get("/tasks").then(res => setTasks(res.data));
  }, []);

  return (
    <>
      <h2 className="text-xl font-bold mb-4">My Development Tasks</h2>
      <TaskStatusFilter value={statusFilter} onChange={setStatusFilter} tasks={tasks} />

      {filterTasksByStatus(tasks, statusFilter).map(task => (
        <TaskCard key={task._id} task={task} />
      ))}
    </>
  );
}


// 📤 UPLOAD (ONLY IN-PROGRESS)
function DevUpload() {
  const [tasks, setTasks] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [submission, setSubmission] = useState({});
  const [submissionMessage, setSubmissionMessage] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fetchTasks = useCallback(async () => {
    const res = await API.get("/tasks");

    const filtered = res.data.filter(
      t => t.status === "in-progress" || t.status === "completed" || t.reviewSubmission
    );

    setTasks(filtered);
  }, []);

  useEffect(() => {
    let ignore = false;

    API.get("/tasks").then((res) => {
      if (ignore) return;

      const filtered = res.data.filter(
        t => t.status === "in-progress" || t.status === "completed" || t.reviewSubmission
      );

      setTasks(filtered);
    });

    return () => {
      ignore = true;
    };
  }, []);

  const submitWork = async (taskId) => {
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
      setMessage("Submission sent successfully.");
      fetchTasks();
    } catch (err) {
      setError(err.response?.data?.message || "Could not submit work");
    }
  };

  const deleteSubmission = async (taskId) => {
    const confirmed = window.confirm("Remove this uploaded link? You can add a new one after removing it.");
    if (!confirmed) return;

    setMessage("");
    setError("");

    try {
      await API.delete(`/tasks/${taskId}/submission`);
      setMessage("Uploaded link removed. You can add a new one now.");
      fetchTasks();
    } catch (err) {
      setError(err.response?.data?.message || "Could not remove uploaded link");
    }
  };

  const getReviewNote = (task) => {
    if (task.reviewStatus === "pending") return "Waiting for team leader review.";
    if (task.reviewStatus === "changes_requested") return task.reviewComment || "Changes requested by your team leader.";
    if (task.reviewStatus === "approved") return task.reviewComment || "Approved. You can upload to PM now.";
    return "First submit this work to your team leader for review.";
  };

  const getButtonLabel = (task) => {
    if (task.submission) return "Update PM Upload";
    if (task.reviewStatus === "approved") return "Upload to PM";
    if (task.reviewStatus === "changes_requested") return "Resubmit for Review";
    if (task.reviewSubmission) return "Update Review Submission";
    return "Send to Team Leader Review";
  };

  return (
    <>
      <h2 className="text-xl font-bold mb-4">Upload Builds</h2>
      <p className="mb-6 text-slate-400">Developers submit to the team leader first. After approval, upload the final build to PM.</p>
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

      {filterTasksByStatus(tasks, statusFilter).map(task => (
        <TaskCard key={task._id} task={task}>
          <div className="mb-3 rounded-lg border border-slate-700/60 bg-slate-950/40 p-3 text-sm text-slate-300">
            <span className="font-semibold text-white">Review status: </span>
            {task.reviewStatus?.replace("_", " ") || "not submitted"}
            <p className="mt-1 text-slate-400">{getReviewNote(task)}</p>
          </div>

          {task.reviewSubmission && (
            <a
              href={task.reviewSubmission}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-3 inline-block text-sm font-semibold text-blue-300 hover:text-blue-200"
            >
              View review submission
            </a>
          )}

          {task.submission && (
            <a
              href={task.submission}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-3 ml-0 block text-sm font-semibold text-emerald-300 hover:text-emerald-200"
            >
              View PM upload
            </a>
          )}

          <input
            placeholder={task.reviewStatus === "approved" ? "Paste final deploy/build link for PM" : "Paste build link for team leader review"}
            value={submission[task._id] || ""}
            disabled={task.reviewStatus === "pending" && !task.submission}
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            onChange={(e) =>
              setSubmission({ ...submission, [task._id]: e.target.value })
            }
          />
          <textarea
            placeholder="Write what you added, fixed, or completed"
            value={submissionMessage[task._id] || ""}
            disabled={task.reviewStatus === "pending" && !task.submission}
            rows={3}
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            onChange={(e) =>
              setSubmissionMessage({ ...submissionMessage, [task._id]: e.target.value })
            }
          />

          <button
            onClick={() => submitWork(task._id)}
            disabled={task.reviewStatus === "pending" && !task.submission}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {getButtonLabel(task)}
          </button>

          {(task.reviewSubmission || task.submission) && (
            <button
              onClick={() => deleteSubmission(task._id)}
              className="ml-2 mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 hover:text-white"
            >
              Delete Upload
            </button>
          )}
        </TaskCard>
      ))}
    </>
  );
}


// 📜 HISTORY
function DevHistory() {
  const [tasks, setTasks] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    API.get("/tasks").then(res => {
      const completed = res.data.filter(
        t => t.status === "completed"
      );
      setTasks(completed);
    });
  }, []);

  return (
    <>
      <h2 className="text-xl font-bold mb-4">Task History</h2>
      <TaskStatusFilter value={statusFilter} onChange={setStatusFilter} tasks={tasks} />

      {filterTasksByStatus(tasks, statusFilter).map(task => (
        <TaskCard key={task._id} task={task} />
      ))}
    </>
  );
}


// 🔄 REVISIONS
function DevRevisions() {
  const [tasks, setTasks] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    let ignore = false;
    const fetchRevisions = () => API.get("/tasks").then(res => {
      if (ignore) return;
      const revisions = res.data.filter(
        t => (t.comments || []).length > 0 || t.reviewStatus === "changes_requested" || t.reviewComment
      );
      setTasks(revisions);
    });

    fetchRevisions();
    const intervalId = window.setInterval(fetchRevisions, 30000);

    return () => {
      ignore = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <>
      <h2 className="text-xl font-bold mb-4">Revisions</h2>
      <TaskStatusFilter value={statusFilter} onChange={setStatusFilter} tasks={tasks} />

      {filterTasksByStatus(tasks, statusFilter).length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 text-center text-slate-400">
          No revisions or comments yet.
        </div>
      ) : (
        filterTasksByStatus(tasks, statusFilter).map(task => (
          <TaskCard key={task._id} task={task}>
            <div className="space-y-3">
              {task.reviewComment && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                  <p className="font-semibold">Team leader review</p>
                  <p className="mt-1">{task.reviewComment}</p>
                </div>
              )}

              {(task.comments || []).map((comment, index) => (
                <div key={index} className="rounded-lg border border-slate-700 bg-slate-950/50 p-3 text-sm text-slate-300">
                  <p>{comment.text}</p>
                  {comment.date && <p className="mt-1 text-xs text-slate-500">{new Date(comment.date).toLocaleString()}</p>}
                </div>
              ))}
            </div>
          </TaskCard>
        ))
      )}
    </>
  );
}


// 🔔 NOTIFICATIONS
// MAIN
export default function DeveloperDashboard() {
  return (
    <DashboardLayout>
      <Routes>
        <Route index element={<DeveloperHome />} />
        <Route path="tasks" element={<DevTasks />} />
        <Route path="upload" element={<DevUpload />} />
        <Route path="history" element={<DevHistory />} />
        <Route path="revisions" element={<DevRevisions />} />
        <Route path="notifications" element={<Notifications />} />
      </Routes>
    </DashboardLayout>
  );
}
