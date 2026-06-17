import { Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import { Plus, X, Link as LinkIcon, Pencil, Send, Trash2 } from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { Input, Button, Textarea, Select, Badge, Alert, Card } from "../../components/FormComponents";
import API from "../../services/api";
import TaskCard from "../../components/TaskCard";
import DashboardAnalytics from "../../components/DashboardAnalytics";
import TaskStatusFilter, { filterTasksByStatus } from "../../components/TaskStatusFilter";
import Notifications from "../Notifications";
import { getStoredUser } from "../../utils/authStorage";

function PMHome() {
  const user = getStoredUser();
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

  return (
    <DashboardAnalytics
      title={`Welcome back, ${user?.name || "PM"}`}
      subtitle="Track task creation, assignments, feedback waiting on you, active owners, and deadline risk."
      tasks={tasks}
      users={users}
      showPeople
      mode="pm"
      showMonitoringSummary
    />
  );
}

function PMTasks() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState("development");
  const [deadline, setDeadline] = useState("");
  const [services, setServices] = useState([]);
  const [media, setMedia] = useState([]);
  const [serviceInput, setServiceInput] = useState("");
  const [mediaInput, setMediaInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const addService = () => {
    if (serviceInput.trim()) {
      setServices([...services, serviceInput.trim()]);
      setServiceInput("");
    }
  };

  const addMedia = () => {
    if (mediaInput.trim()) {
      setMedia([...media, mediaInput.trim()]);
      setMediaInput("");
    }
  };

  const removeService = (index) => {
    setServices(services.filter((_, i) => i !== index));
  };

  const removeMedia = (index) => {
    setMedia(media.filter((_, i) => i !== index));
  };

  const createTask = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await API.post("/tasks", {
        title,
        description,
        services,
        media,
        department,
        deadline,
      });

      setSuccess(true);
      setTitle("");
      setDescription("");
      setServices([]);
      setMedia([]);
      setDeadline("");

      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Error creating task:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-4xl font-bold text-white mb-2">Create Task</h1>
      <p className="text-slate-400 mb-8">Set up a new task for your team members</p>

      {success && (
        <Alert variant="success">
          ✨ Task created successfully! Your team will be notified.
        </Alert>
      )}

      <Card className="mt-6">
        <form onSubmit={createTask} className="space-y-6">
          {/* Title */}
          <Input
            label="Task Title"
            type="text"
            placeholder="Enter task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          {/* Description */}
          <Textarea
            label="Task Description"
            placeholder="Describe what needs to be done..."
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />

          {/* Department */}
          <Select
            label="Department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            options={[
              { label: "Development", value: "development" },
              { label: "Design", value: "designing" },
            ]}
          />

          <Input
            label="Deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            required
          />

          {/* Services */}
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-2">Services Required</label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="Add service (e.g., Frontend, Backend)"
                value={serviceInput}
                onChange={(e) => setServiceInput(e.target.value)}
                className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addService())}
              />
              <Button type="button" onClick={addService} icon={Plus} size="md">
                Add
              </Button>
            </div>
            {services.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {services.map((service, i) => (
                  <Badge key={i} variant="info">
                    <div className="flex items-center gap-2">
                      {service}
                      <button type="button" onClick={() => removeService(i)}>
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Media */}
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-2">Media / References</label>
            <div className="flex gap-2 mb-3">
              <input
                type="url"
                placeholder="Paste media/reference link"
                value={mediaInput}
                onChange={(e) => setMediaInput(e.target.value)}
                className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addMedia())}
              />
              <Button type="button" onClick={addMedia} icon={LinkIcon} size="md">
                Add
              </Button>
            </div>
            {media.length > 0 && (
              <div className="space-y-2">
                {media.map((link, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
                    <a href={link} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 text-sm truncate">
                      {link}
                    </a>
                    <button type="button" onClick={() => removeMedia(i)} className="text-slate-500 hover:text-slate-300">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <Button loading={loading} icon={Send} variant="primary" size="lg" className="w-full">
            Create Task
          </Button>
        </form>
      </Card>
    </div>
  );
}

function PMReview() {
  const [tasks, setTasks] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [comment, setComment] = useState({});

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await API.get("/tasks");
        setTasks(res.data.filter((task) => task.submission));
      } catch (error) {
        console.error("Error fetching tasks:", error);
      }
    };
    fetchTasks();
  }, []);

  const addComment = async (taskId) => {
    if (!comment[taskId]?.trim()) return;

    try {
      await API.post("/tasks/comment", {
        taskId,
        text: comment[taskId],
      });

      setComment({ ...comment, [taskId]: "" });

      // Refetch tasks after comment
      const fetchTasks = async () => {
        try {
          const res = await API.get("/tasks");
          setTasks(res.data.filter((task) => task.submission));
        } catch (error) {
          console.error("Error fetching tasks:", error);
        }
      };
      fetchTasks();
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  return (
    <div>
      <h1 className="text-4xl font-bold text-white mb-2">Work Review</h1>
      <p className="text-slate-400 mb-8">Review and provide feedback on team submissions</p>
      <TaskStatusFilter value={statusFilter} onChange={setStatusFilter} tasks={tasks} />

      {filterTasksByStatus(tasks, statusFilter).length === 0 ? (
        <Card>
          <p className="text-slate-400 text-center">No tasks pending review</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filterTasksByStatus(tasks, statusFilter).map((task) => (
            <TaskCard key={task._id} task={task}>
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  placeholder="Add your feedback..."
                  value={comment[task._id] || ""}
                  onChange={(e) => setComment({ ...comment, [task._id]: e.target.value })}
                  className="flex-1 px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition text-sm"
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addComment(task._id))}
                />
                <Button onClick={() => addComment(task._id)} icon={Send} size="sm">
                  Send
                </Button>
              </div>
            </TaskCard>
          ))}
        </div>
      )}
    </div>
  );
}

function PMProjects() {
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

    API.get("/tasks").then((res) => {
      if (ignore) return;
      setTasks(res.data);
    });

    return () => {
      ignore = true;
    };
  }, []);

  const deleteTask = async (taskId) => {
    const confirmed = window.confirm("Delete this task? It will no longer be visible to assigned team leaders or team members.");
    if (!confirmed) return;

    setMessage("");
    setError("");

    try {
      await API.delete(`/tasks/${taskId}`);
      setMessage("Task deleted successfully.");
      fetchTasks();
    } catch (err) {
      setError(err.response?.data?.message || "Could not delete task");
    }
  };

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

  const splitList = (value) =>
    String(value || "")
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);

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
      fetchTasks();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update task");
    }
  };

  return (
    <div>
      <h1 className="text-4xl font-bold text-white mb-2">Projects</h1>
      <p className="text-slate-400 mb-8">Manage all your active projects</p>

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

      <TaskStatusFilter value={statusFilter} onChange={setStatusFilter} tasks={tasks} />

      <div className="space-y-4">
        {filterTasksByStatus(tasks, statusFilter).map((task) => (
          <TaskCard key={task._id} task={task}>
            {editingTaskId === task._id ? (
              <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-950/50 p-4">
                <Input
                  label="Title"
                  value={editForm.title}
                  onChange={(event) => setEditForm({ ...editForm, title: event.target.value })}
                />
                <Textarea
                  label="Description"
                  value={editForm.description}
                  onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <Select
                    label="Department"
                    value={editForm.department}
                    onChange={(event) => setEditForm({ ...editForm, department: event.target.value })}
                    options={[
                      { value: "development", label: "Development" },
                      { value: "designing", label: "Designing" },
                    ]}
                  />
                  <Input
                    label="Deadline"
                    type="date"
                    value={editForm.deadline}
                    onChange={(event) => setEditForm({ ...editForm, deadline: event.target.value })}
                  />
                </div>
                <Input
                  label="Services"
                  value={editForm.services}
                  onChange={(event) => setEditForm({ ...editForm, services: event.target.value })}
                  placeholder="Website, Dashboard, API"
                />
                <Textarea
                  label="Media Links"
                  value={editForm.media}
                  onChange={(event) => setEditForm({ ...editForm, media: event.target.value })}
                  placeholder="One link per line"
                />
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

export default function PMDashboard() {
  return (
    <DashboardLayout>
      <Routes>
        <Route index element={<PMHome />} />
        <Route path="projects" element={<PMProjects />} />
        <Route path="tasks" element={<PMTasks />} />
        <Route path="review" element={<PMReview />} />
        <Route
          path="notifications"
          element={<Notifications />}
        />
      </Routes>
    </DashboardLayout>
  );
}
