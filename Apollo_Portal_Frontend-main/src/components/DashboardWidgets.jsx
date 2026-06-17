import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  Inbox,
  Link as LinkIcon,
  Send,
} from "lucide-react";
import TaskCard from "./TaskCard";

export function PageHeader({ eyebrow, title, description }) {
  return (
    <div className="mb-8">
      {eyebrow && <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-blue-300">{eyebrow}</p>}
      <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1>
      {description && <p className="mt-2 max-w-3xl text-slate-400">{description}</p>}
    </div>
  );
}

export function SectionCard({ children, className = "" }) {
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/20 ${className}`}>
      {children}
    </div>
  );
}

export function EmptyState({ title = "Nothing here yet", description = "New items will appear here when they are available." }) {
  return (
    <SectionCard className="text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-slate-400">
        <Inbox className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
    </SectionCard>
  );
}

export function StatCard({ label, value, icon: Icon = Activity, tone = "blue" }) {
  const tones = {
    blue: "bg-blue-500/10 text-blue-300 border-blue-500/30",
    green: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    red: "bg-red-500/10 text-red-300 border-red-500/30",
    slate: "bg-slate-800 text-slate-300 border-slate-700",
  };

  return (
    <SectionCard>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
        </div>
        <div className={`rounded-lg border p-3 ${tones[tone] || tones.blue}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </SectionCard>
  );
}

export function TaskStats({ tasks }) {
  const completed = tasks.filter((task) => task.status === "completed").length;
  const active = tasks.filter((task) => task.status === "in-progress").length;
  const pending = tasks.filter((task) => task.status === "pending").length;

  return (
    <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
      <StatCard label="In Progress" value={active} icon={Clock} tone="blue" />
      <StatCard label="Completed" value={completed} icon={CheckCircle2} tone="green" />
      <StatCard label="Pending" value={pending} icon={AlertCircle} tone="amber" />
    </div>
  );
}

export function TaskList({ tasks, emptyTitle, children }) {
  if (!tasks.length) return <EmptyState title={emptyTitle} />;

  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <TaskCard key={task._id} task={task}>
          {typeof children === "function" ? children(task) : children}
        </TaskCard>
      ))}
    </div>
  );
}

export function UploadTaskList({ tasks, submission, setSubmission, onSubmit, placeholder = "Paste work link" }) {
  return (
    <TaskList tasks={tasks} emptyTitle="No in-progress tasks ready for upload">
      {(task) => (
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              placeholder={placeholder}
              value={submission[task._id] || ""}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/60 py-3 pl-10 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              onChange={(e) => setSubmission({ ...submission, [task._id]: e.target.value })}
            />
          </div>
          <button
            onClick={() => onSubmit(task._id)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            <Send className="h-4 w-4" />
            Submit
          </button>
        </div>
      )}
    </TaskList>
  );
}

export function PerformancePanel({ tasks, title = "Team Performance" }) {
  const completed = tasks.filter((task) => task.status === "completed").length;
  const active = tasks.filter((task) => task.status === "in-progress").length;
  const total = tasks.length;
  const rate = total ? Math.round((completed / total) * 100) : 0;

  return (
    <div>
      <TaskStats tasks={tasks} />
      <SectionCard>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">{title}</p>
            <h2 className="mt-1 text-2xl font-bold text-white">{rate}% completion rate</h2>
          </div>
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-blue-300">
            <BarChart3 className="h-6 w-6" />
          </div>
        </div>
        <div className="mt-5 h-3 rounded-full bg-slate-800">
          <div className="h-3 rounded-full bg-blue-500 transition-all" style={{ width: `${rate}%` }} />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg bg-slate-950/50 p-3">
            <p className="text-slate-500">Total</p>
            <p className="text-lg font-bold text-white">{total}</p>
          </div>
          <div className="rounded-lg bg-slate-950/50 p-3">
            <p className="text-slate-500">Active</p>
            <p className="text-lg font-bold text-white">{active}</p>
          </div>
          <div className="rounded-lg bg-slate-950/50 p-3">
            <p className="text-slate-500">Done</p>
            <p className="text-lg font-bold text-white">{completed}</p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

export function NotificationsList({ tasks }) {
  const comments = tasks.flatMap((task) =>
    (task.comments || []).map((comment, index) => ({
      id: `${task._id}-${index}`,
      taskTitle: task.title,
      text: comment.text,
    }))
  );

  if (!comments.length) return <EmptyState title="No notifications yet" description="Task comments and revision notes will show here." />;

  return (
    <div className="space-y-3">
      {comments.map((comment) => (
        <SectionCard key={comment.id} className="p-4">
          <p className="text-sm font-semibold text-white">{comment.taskTitle}</p>
          <p className="mt-1 text-sm text-slate-400">{comment.text}</p>
        </SectionCard>
      ))}
    </div>
  );
}
