import { Bell, CheckCircle2, Clock, ExternalLink, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import { getStoredUser } from "../utils/authStorage";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const user = getStoredUser();

  const getNotificationRoute = (notification) => {
    if (notification.entityType !== "task") return "";

    const taskQuery = notification.entityId ? `?task=${notification.entityId}` : "";
    if (user?.role === "admin") return `/admin/tasks${taskQuery}`;
    if (user?.role === "pm") return `/pm/projects${taskQuery}`;
    if (user?.role === "teamleader_dev") return `/teamleader/dev/tasks${taskQuery}`;
    if (user?.role === "teamleader_design") return `/teamleader/design/tasks${taskQuery}`;
    if (user?.role === "developer") return `/developer/tasks${taskQuery}`;
    if (user?.role === "designer") return `/designer/tasks${taskQuery}`;
    return "";
  };

  const fetchNotifications = async () => {
    const res = await API.get("/notifications");
    setNotifications(res.data);
  };

  useEffect(() => {
    let ignore = false;

    API.get("/notifications")
      .then((res) => {
        if (ignore) return;
        setNotifications(res.data);
      })
      .catch(() => {
        if (ignore) return;
        setError("Could not load notifications");
      });

    return () => {
      ignore = true;
    };
  }, []);

  const markAsRead = async (notificationId) => {
    setMessage("");
    setError("");

    try {
      await API.put(`/notifications/${notificationId}/read`);
      await fetchNotifications();
      window.dispatchEvent(new Event("notifications:changed"));
    } catch (err) {
      setError(err.response?.data?.message || "Could not mark notification as read");
    }
  };

  const openNotification = async (notification) => {
    const route = getNotificationRoute(notification);
    if (!route) return;

    setMessage("");
    setError("");

    try {
      if (!notification.read) {
        await API.put(`/notifications/${notification._id}/read`);
        window.dispatchEvent(new Event("notifications:changed"));
      }
      navigate(route);
    } catch (err) {
      setError(err.response?.data?.message || "Could not open notification");
    }
  };

  const markAllAsRead = async () => {
    setMessage("");
    setError("");

    try {
      await API.put("/notifications/read-all");
      setMessage("All notifications marked as read.");
      await fetchNotifications();
      window.dispatchEvent(new Event("notifications:changed"));
    } catch (err) {
      setError(err.response?.data?.message || "Could not mark notifications as read");
    }
  };

  const deleteNotification = async (notificationId) => {
    setMessage("");
    setError("");

    try {
      await API.delete(`/notifications/${notificationId}`);
      await fetchNotifications();
      window.dispatchEvent(new Event("notifications:changed"));
    } catch (err) {
      setError(err.response?.data?.message || "Could not delete notification");
    }
  };

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Notifications</h1>
          <p className="text-slate-400">Stay updated with your latest task activity</p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/20 hover:text-white"
          >
            <CheckCircle2 className="h-4 w-4" />
            Mark all read
          </button>
        )}
      </div>

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

      {notifications.length === 0 ? (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-xl p-12 text-center shadow-lg">
          <Bell className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No notifications at this moment</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => {
            const route = getNotificationRoute(notification);

            return (
            <div
              key={notification._id}
              role={route ? "button" : undefined}
              tabIndex={route ? 0 : undefined}
              onClick={() => route && openNotification(notification)}
              onKeyDown={(event) => {
                if (!route) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openNotification(notification);
                }
              }}
              className={`flex items-start gap-4 rounded-xl border p-5 shadow-lg transition ${
                notification.read
                  ? "border-slate-700/50 bg-slate-900/70"
                  : "border-blue-500/30 bg-blue-500/10"
              } ${route ? "cursor-pointer hover:border-blue-400/50 hover:bg-slate-900" : ""}`}
            >
              <div
                className={`mt-1 rounded-lg p-2 ${
                  notification.read ? "bg-slate-800 text-slate-400" : "bg-blue-500/20 text-blue-300"
                }`}
              >
                <Bell className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {!notification.read && <span className="h-2 w-2 rounded-full bg-red-500"></span>}
                  <p className="font-semibold text-white">{notification.displayMessage || notification.message}</p>
                  {route && <ExternalLink className="h-4 w-4 text-blue-300" />}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="h-4 w-4" />
                  {new Date(notification.createdAt).toLocaleString()}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
              {!notification.read && (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    markAsRead(notification._id);
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-blue-500/50 hover:text-white"
                >
                  Mark read
                </button>
              )}
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteNotification(notification._id);
                  }}
                  className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-red-300 transition hover:bg-red-500/20 hover:text-white"
                  title="Delete notification"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
