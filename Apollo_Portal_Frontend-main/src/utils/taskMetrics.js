const getCompletedAt = (task) => task.completedAt || (task.status === "completed" ? task.updatedAt : null);

export const getTaskDurationMinutes = (task) => {
  if (!task.assignedAt && !task.createdAt) return 0;

  const startedAt = new Date(task.assignedAt || task.createdAt).getTime();
  const finishedAt = new Date(getCompletedAt(task) || Date.now()).getTime();

  if (Number.isNaN(startedAt) || Number.isNaN(finishedAt) || finishedAt <= startedAt) return 0;

  return Math.round((finishedAt - startedAt) / 60000);
};

export const formatDuration = (minutes) => {
  if (!minutes) return "0m";

  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

export const getCompletedDate = getCompletedAt;
