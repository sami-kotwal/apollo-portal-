const statusOptions = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "In Progress", value: "in-progress" },
  { label: "Completed", value: "completed" },
];

export const filterTasksByStatus = (tasks, status) => {
  if (status === "all") return tasks;
  return tasks.filter((task) => task.status === status);
};

export default function TaskStatusFilter({ value, onChange, tasks = [] }) {
  const getCount = (status) => filterTasksByStatus(tasks, status).length;

  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {statusOptions.map((option) => {
        const active = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
              active
                ? "border-blue-500/40 bg-blue-500/20 text-white"
                : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500 hover:bg-slate-800"
            }`}
          >
            {option.label}
            <span className="ml-2 text-xs text-slate-400">{getCount(option.value)}</span>
          </button>
        );
      })}
    </div>
  );
}
