import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { CheckCircle2, Clock, AlertCircle, ExternalLink, Calendar, Timer, User, X } from "lucide-react";
import { formatDuration, getTaskDurationMinutes } from "../utils/taskMetrics";
import { formatDateOnly } from "../utils/dateOnly";

export default function TaskCard({ task, children }) {
  const [showDetails, setShowDetails] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const taskId = new URLSearchParams(location.search).get("task");
    if (taskId && taskId === task._id) {
      setShowDetails(true);
    }
  }, [location.search, task._id]);

  const getStatusIcon = (status) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-5 h-5 text-green-400" />;
      case "in-progress":
        return <Clock className="w-5 h-5 text-blue-400" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "bg-green-500/10 text-green-300 border-green-500/30";
      case "in-progress":
        return "bg-blue-500/10 text-blue-300 border-blue-500/30";
      default:
        return "bg-yellow-500/10 text-yellow-300 border-yellow-500/30";
    }
  };

  const priorityColor = {
    high: "bg-red-500/10 border-red-500/30 text-red-300",
    medium: "bg-yellow-500/10 border-yellow-500/30 text-yellow-300",
    low: "bg-blue-500/10 border-blue-500/30 text-blue-300",
  };

  const isInteractiveElement = (element) => {
    const interactive = "input, textarea, select, button, a, label, [contenteditable='true']";
    return Boolean(element?.closest?.(interactive));
  };

  const deadline = task.deadline || task.dueDate;
  const deadlineEnd = deadline ? new Date(deadline) : null;
  if (deadlineEnd) deadlineEnd.setHours(23, 59, 59, 999);
  const isLate =
    deadlineEnd &&
    task.status === "completed" &&
    new Date(task.completedAt || task.updatedAt).getTime() > deadlineEnd.getTime();

  return (
    <>
    <div
      role="button"
      tabIndex={0}
      onClick={(event) => {
        if (isInteractiveElement(event.target)) return;
        setShowDetails(true);
      }}
      onKeyDown={(event) => {
        if (isInteractiveElement(event.target)) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setShowDetails(true);
        }
      }}
      className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-xl p-6 shadow-lg hover:shadow-xl hover:shadow-purple-500/20 transition duration-300 group cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {getStatusIcon(task.status)}
            <h3 className="font-bold text-white text-lg group-hover:text-purple-300 transition">
              {task.title}
            </h3>
          </div>
          <p className="line-clamp-3 whitespace-pre-line text-slate-400 text-sm leading-relaxed">{task.description}</p>
        </div>

        {/* Status Badge */}
        <span
          className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border ${getStatusColor(
            task.status
          )} whitespace-nowrap`}
        >
          {task.status.replace("-", " ").charAt(0).toUpperCase() + task.status.slice(1)}
        </span>
      </div>

      {/* Task Details */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-4 border-y border-slate-700/30">
        {/* Assigned To */}
        {task.assignedTo && (
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-500" />
            <div>
              <p className="text-xs text-slate-500">Assigned To</p>
              <p className="text-sm font-semibold text-slate-300">{task.assignedTo?.name}</p>
            </div>
          </div>
        )}

        {/* Due Date */}
        {deadline && (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <div>
              <p className="text-xs text-slate-500">Deadline</p>
              <p className={`text-sm font-semibold ${isLate ? "text-red-300" : "text-slate-300"}`}>
                {formatDateOnly(deadline)}
              </p>
            </div>
          </div>
        )}

        {(task.assignedAt || task.createdAt) && (
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-slate-500" />
            <div>
              <p className="text-xs text-slate-500">Task Time</p>
              <p className="text-sm font-semibold text-slate-300">{formatDuration(getTaskDurationMinutes(task))}</p>
            </div>
          </div>
        )}

        {/* Priority */}
        {task.priority && (
          <div>
            <p className="text-xs text-slate-500 mb-1">Priority</p>
            <span
              className={`inline-block text-xs font-bold px-2 py-1 rounded border capitalize ${
                priorityColor[task.priority] || priorityColor.medium
              }`}
            >
              {task.priority}
            </span>
          </div>
        )}
      </div>

      {/* Submission Link */}
      {task.submission && (
        <div className="mt-4 pt-4 border-t border-slate-700/30">
          <a
            href={task.submission}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 text-sm font-semibold transition"
          >
            <ExternalLink className="w-4 h-4" />
            View Submitted Work
          </a>
        </div>
      )}

      {/* Actions */}
      {children && (
        <div
          className="mt-4"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {children}
        </div>
      )}
    </div>
    {showDetails && <TaskDetailsModal task={task} onClose={() => setShowDetails(false)} />}
    </>
  );
}

function LinkifiedText({ text }) {
  if (!text) return <span className="text-slate-500">Not added</span>;

  const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const parts = String(text).split(urlPattern);

  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, index) => {
        if (!part.match(urlPattern)) return <span key={`${part}-${index}`}>{part}</span>;
        const href = part.startsWith("http") ? part : `https://${part}`;
        return (
          <a
            key={`${part}-${index}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-blue-300 underline underline-offset-4 hover:text-blue-200"
          >
            {part}
          </a>
        );
      })}
    </span>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2 text-sm font-semibold text-white">{value || "Not added"}</div>
    </div>
  );
}

function TaskDetailsModal({ task, onClose }) {
  const deadline = task.deadline || task.dueDate;
  const services = Array.isArray(task.services) ? task.services : [];
  const media = Array.isArray(task.media) ? task.media : [];
  const comments = Array.isArray(task.comments) ? task.comments : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-300">Task Details</p>
            <h2 className="mt-1 break-words text-2xl font-bold text-white">{task.title}</h2>
            <p className="mt-2 text-sm capitalize text-slate-400">{task.status?.replace("-", " ") || "pending"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 transition hover:text-white"
            title="Close task details"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <h3 className="font-bold text-white">Description</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              <LinkifiedText text={task.description} />
            </p>
          </section>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <DetailRow label="Deadline" value={deadline ? formatDateOnly(deadline) : "Not added"} />
            <DetailRow label="Department" value={task.department?.replace("_", " ")} />
            <DetailRow label="Assigned To" value={task.assignedTo?.name || task.assignedTo?.email} />
            <DetailRow label="Created By" value={task.createdBy?.name || task.createdBy?.email} />
            <DetailRow label="Assigned By" value={task.assignedBy?.name || task.assignedBy?.email} />
            <DetailRow label="Assigned At" value={task.assignedAt ? new Date(task.assignedAt).toLocaleString() : "Not assigned"} />
            <DetailRow label="Completed At" value={task.completedAt ? new Date(task.completedAt).toLocaleString() : "Not completed"} />
            <DetailRow label="Task Time" value={formatDuration(getTaskDurationMinutes(task))} />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
              <h3 className="font-bold text-white">Services / Requirements</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {services.length > 0 ? services.map((service, index) => (
                  <span key={`${service}-${index}`} className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-200">
                    {service}
                  </span>
                )) : <p className="text-sm text-slate-500">No services added.</p>}
              </div>
            </section>

            <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
              <h3 className="font-bold text-white">Media / Reference Links</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                {media.length > 0 ? media.map((link, index) => (
                  <p key={`${link}-${index}`} className="break-words">
                    <LinkifiedText text={link} />
                  </p>
                )) : <p className="text-slate-500">No media links added.</p>}
              </div>
            </section>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
              <h3 className="font-bold text-white">Submission</h3>
              <div className="mt-3 space-y-3 text-sm text-slate-300">
                <p><span className="text-slate-500">Submitted work: </span><LinkifiedText text={task.submission} /></p>
                <p><span className="text-slate-500">Submitted message: </span><LinkifiedText text={task.submissionMessage} /></p>
                <p><span className="text-slate-500">Review submission: </span><LinkifiedText text={task.reviewSubmission} /></p>
                <p><span className="text-slate-500">Review submission message: </span><LinkifiedText text={task.reviewSubmissionMessage} /></p>
                <p><span className="text-slate-500">Review status: </span><span className="capitalize">{task.reviewStatus?.replace("_", " ") || "none"}</span></p>
                {task.reviewComment && <p><span className="text-slate-500">Review comment: </span><LinkifiedText text={task.reviewComment} /></p>}
              </div>
            </section>

            <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
              <h3 className="font-bold text-white">Comments</h3>
              <div className="mt-3 space-y-3">
                {comments.length > 0 ? comments.map((comment, index) => (
                  <div key={comment._id || index} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm">
                    <p className="text-slate-300"><LinkifiedText text={comment.text} /></p>
                    <p className="mt-2 text-xs text-slate-500">
                      {comment.by?.name || "User"} {comment.date ? `- ${new Date(comment.date).toLocaleString()}` : ""}
                    </p>
                  </div>
                )) : <p className="text-sm text-slate-500">No comments added.</p>}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
