import { useNavigate } from "react-router-dom";
import { Bell, LogOut, Menu, Search, X, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import API from "../services/api";
import { disconnectSocket, getSocket } from "../services/socket";
import { clearAuthSession, getStoredUser } from "../utils/authStorage";

export default function Header({ onMenuClick }) {
  const navigate = useNavigate();
  const user = getStoredUser();
  const isCustomer = user?.role === "customer";
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [slideNotification, setSlideNotification] = useState(null);
  const knownNotificationIdsRef = useRef(new Set());
  const initializedNotificationsRef = useRef(false);
  const dismissedNotificationIdsRef = useRef(new Set());
  const slideStorageKey = user?._id ? `apollo:notification-slide:${user._id}` : "";

  const showNotificationSlide = useCallback((notification) => {
    if (!notification?._id) return;
    setSlideNotification(notification);
    if (slideStorageKey) {
      sessionStorage.setItem(
        slideStorageKey,
        JSON.stringify({
          notification,
          expiresAt: Date.now() + 45000,
        })
      );
    }
  }, [slideStorageKey]);

  const clearNotificationSlide = useCallback(() => {
    setSlideNotification(null);
    if (slideStorageKey) sessionStorage.removeItem(slideStorageKey);
  }, [slideStorageKey]);

  const routeFor = (type) => {
    const role = user?.role;
    if (type === "Notification") {
      if (role === "teamleader_dev") return "/teamleader/dev/notifications";
      if (role === "teamleader_design") return "/teamleader/design/notifications";
      if (role === "developer") return "/developer/notifications";
      if (role === "designer") return "/designer/notifications";
      if (role === "pm") return "/pm/notifications";
      if (role === "admin") return "/admin/notifications";
      if (role === "customer") return "/customer/tickets";
    }
    if (type === "User") {
      if (role === "admin") return "/admin/users";
      if (role === "pm") return "/pm";
      if (role === "teamleader_dev") return "/teamleader/dev/assign";
      if (role === "teamleader_design") return "/teamleader/design/assign";
    }
    if (type === "Task") {
      if (role === "admin") return "/admin/tasks";
      if (role === "pm") return "/pm/projects";
      if (role === "teamleader_dev") return "/teamleader/dev/tasks";
      if (role === "teamleader_design") return "/teamleader/design/tasks";
      if (role === "developer") return "/developer/tasks";
      if (role === "designer") return "/designer/tasks";
      if (role === "customer") return "/customer/packages";
    }
    return "/";
  };

  const taskRoute = (taskId = "") => {
    const baseRoute = routeFor("Task");
    return taskId ? `${baseRoute}?task=${taskId}` : baseRoute;
  };

  const notificationRoute = (notification) => {
    if (notification?.entityType === "task") {
      return taskRoute(notification.entityId || "");
    }
    return routeFor("Notification");
  };

  const fetchUnreadCount = useCallback(async ({ showSlide = false } = {}) => {
    try {
      const res = await API.get("/notifications");
      const notifications = res.data || [];
      const unreadNotifications = notifications.filter((notification) => !notification.read);
      setUnreadCount(unreadNotifications.length);

      if (!initializedNotificationsRef.current) {
        knownNotificationIdsRef.current = new Set(notifications.map((notification) => notification._id));
        initializedNotificationsRef.current = true;
        return;
      }

      const newUnread = unreadNotifications.find((notification) => {
        const isNew = !knownNotificationIdsRef.current.has(notification._id);
        const isDismissed = dismissedNotificationIdsRef.current.has(notification._id);
        return isNew && !isDismissed;
      });

      notifications.forEach((notification) => knownNotificationIdsRef.current.add(notification._id));
      if (showSlide && newUnread) showNotificationSlide(newUnread);
    } catch {
      setUnreadCount(0);
    }
  }, [showNotificationSlide]);

  useEffect(() => {
    let active = true;

    fetchUnreadCount();
    const intervalId = window.setInterval(() => {
      if (active) fetchUnreadCount({ showSlide: true });
    }, 30000);

    const onNotificationsChanged = () => {
      fetchUnreadCount();
    };

    window.addEventListener("notifications:changed", onNotificationsChanged);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("notifications:changed", onNotificationsChanged);
    };
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (!slideStorageKey) return;
    const raw = sessionStorage.getItem(slideStorageKey);
    if (!raw) return;
    try {
      const stored = JSON.parse(raw);
      if (stored?.notification && stored.expiresAt > Date.now()) {
        setSlideNotification(stored.notification);
      } else {
        sessionStorage.removeItem(slideStorageKey);
      }
    } catch {
      sessionStorage.removeItem(slideStorageKey);
    }
  }, [slideStorageKey]);

  useEffect(() => {
    if (!slideNotification) return undefined;
    const raw = slideStorageKey ? sessionStorage.getItem(slideStorageKey) : "";
    let expiresAt = Date.now() + 45000;
    if (raw) {
      try {
        expiresAt = JSON.parse(raw)?.expiresAt || expiresAt;
      } catch {
        expiresAt = Date.now() + 45000;
      }
    }
    const timeoutId = window.setTimeout(clearNotificationSlide, Math.max(1000, expiresAt - Date.now()));
    return () => window.clearTimeout(timeoutId);
  }, [clearNotificationSlide, slideNotification, slideStorageKey]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    const onNewNotification = (notification) => {
      if (!notification?._id) return;
      knownNotificationIdsRef.current.add(notification._id);
      setUnreadCount((count) => count + (notification.read ? 0 : 1));
      if (!notification.read && !dismissedNotificationIdsRef.current.has(notification._id)) {
        showNotificationSlide(notification);
      }
    };

    socket.on("notification:new", onNewNotification);

    return () => {
      socket.off("notification:new", onNewNotification);
    };
  }, [showNotificationSlide]);

  useEffect(() => {
    let ignore = false;
    const query = searchQuery.trim().toLowerCase();
    if (query.length < 2) {
      setSearchResults([]);
      return undefined;
    }

    const search = async () => {
      const requests = [API.get("/tasks"), API.get("/notifications")];
      if (user?.role === "admin" || user?.role === "pm" || user?.role?.startsWith("teamleader")) {
        requests.push(API.get("/users"));
      }

      const responses = await Promise.allSettled(requests);
      if (ignore) return;

      const tasks = responses[0].status === "fulfilled" ? responses[0].value.data : [];
      const notifications = responses[1].status === "fulfilled" ? responses[1].value.data : [];
      const users = responses[2]?.status === "fulfilled" ? responses[2].value.data : [];

      const matches = [
        ...tasks
          .filter((task) =>
            [task.title, task.description, task.status, task.department, task.assignedTo?.name, task.createdBy?.name]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(query))
          )
          .slice(0, 6)
          .map((task) => ({ type: "Task", title: task.title, detail: `${task.status} - ${task.department || "task"}`, route: taskRoute(task._id) })),
        ...notifications
          .filter((notification) => String(notification.displayMessage || notification.message || "").toLowerCase().includes(query))
          .slice(0, 4)
          .map((notification) => ({ type: "Notification", title: notification.displayMessage || notification.message, detail: notification.read ? "read" : "unread", route: notificationRoute(notification) })),
        ...users
          .filter((item) =>
            [item.name, item.email, item.role, item.department].filter(Boolean).some((value) => String(value).toLowerCase().includes(query))
          )
          .slice(0, 4)
          .map((item) => ({ type: "User", title: item.name, detail: `${item.role?.replace("_", " ") || "user"} - ${item.email || ""}`, route: routeFor("User") })),
      ].slice(0, 10);

      setSearchResults(matches);
      setSearchOpen(true);
    };

    const timeoutId = window.setTimeout(search, 250);

    return () => {
      ignore = true;
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery, user?.role]);

  const goToNotifications = () => {
    const role = user?.role;

    if (role === "teamleader_dev") navigate("/teamleader/dev/notifications");
    else if (role === "teamleader_design") navigate("/teamleader/design/notifications");
    else if (role === "developer") navigate("/developer/notifications");
    else if (role === "designer") navigate("/designer/notifications");
    else if (role === "pm") navigate("/pm/notifications");
    else if (role === "admin") navigate("/admin/notifications");
    else if (role === "customer") navigate("/customer/tickets");
  };

  const dismissSlideNotification = () => {
    if (slideNotification?._id) dismissedNotificationIdsRef.current.add(slideNotification._id);
    clearNotificationSlide();
  };

  const openSlideNotification = async () => {
    if (!slideNotification) return;
    const route = notificationRoute(slideNotification);
    try {
      if (!slideNotification.read) {
        await API.put(`/notifications/${slideNotification._id}/read`);
        window.dispatchEvent(new Event("notifications:changed"));
      }
    } catch {
      // Navigation should still happen even if marking read fails.
    } finally {
      clearNotificationSlide();
      navigate(route);
    }
  };

  const handleLogout = () => {
    disconnectSocket();
    clearAuthSession();
    navigate("/login");
  };

  const openSearchResult = (item) => {
    setSearchOpen(false);
    setSearchQuery("");
    navigate(item.route || routeFor(item.type));
  };

  return (
    <>
    <header className={`sticky top-0 z-20 flex min-h-[76px] items-center justify-between border-b px-4 py-4 shadow-xl backdrop-blur sm:px-6 lg:px-8 ${
      isCustomer
        ? "border-slate-200 bg-white/90 shadow-slate-200/50"
        : "border-slate-800 bg-slate-950/90 shadow-slate-950/20"
    }`}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className={`rounded-xl border p-2 transition lg:hidden ${
            isCustomer
              ? "border-slate-200 bg-white text-[#1c5cb6] hover:border-[#632dff]/40 hover:bg-[#632dff]/5"
              : "border-slate-800 bg-slate-900/80 text-white hover:border-blue-500/50 hover:bg-slate-800"
          }`}
          title="Open navigation"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        {isCustomer ? (
          <img src="/aqua-design-works-logo.webp" alt="Aqua Design Works" className="hidden h-10 w-14 rounded-lg object-contain sm:block lg:hidden" />
        ) : (
          <div className="hidden rounded-xl bg-blue-600 p-2 sm:block lg:hidden">
            <Zap className="h-5 w-5 text-white" />
          </div>
        )}
        <div>
          <h1 className={`text-lg font-bold ${isCustomer ? "text-slate-950" : "text-white"}`}>{isCustomer ? "Aqua Design Works" : "Aytech Portal"}</h1>
          <p className="text-xs text-slate-500">{isCustomer ? "Customer portal" : "Project management system"}</p>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-3 sm:gap-4">
        <div className="relative hidden w-full max-w-md md:block">
          <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${isCustomer ? "text-[#1c5cb6]" : "text-slate-500"}`} />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
            placeholder="Search tasks, users, notifications..."
            className={`w-full rounded-lg border py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:ring-2 ${
              isCustomer
                ? "border-slate-200 bg-slate-50 text-slate-950 focus:border-[#632dff] focus:ring-[#632dff]/20"
                : "border-slate-800 bg-slate-900/70 text-white focus:border-blue-500 focus:ring-blue-500/20"
            }`}
          />
          {searchOpen && searchQuery.trim().length >= 2 && (
            <div className={`absolute right-0 top-12 z-50 max-h-96 w-full overflow-y-auto rounded-lg border p-2 shadow-2xl ${
              isCustomer ? "border-slate-200 bg-white shadow-slate-200/70" : "border-slate-800 bg-slate-950 shadow-slate-950/40"
            }`}>
              {searchResults.length === 0 ? (
                <p className="px-3 py-2 text-sm text-slate-500">No matches found.</p>
              ) : (
                searchResults.map((item, index) => (
                  <button
                    key={`${item.type}-${index}`}
                    type="button"
                    onClick={() => openSearchResult(item)}
                    className={`block w-full rounded-md px-3 py-2 text-left ${isCustomer ? "hover:bg-[#632dff]/5" : "hover:bg-slate-900"}`}
                  >
                    <p className={`text-xs font-bold uppercase tracking-wide ${isCustomer ? "text-[#632dff]" : "text-blue-300"}`}>{item.type}</p>
                    <p className={`mt-1 truncate text-sm font-semibold ${isCustomer ? "text-slate-950" : "text-white"}`}>{item.title}</p>
                    <p className="truncate text-xs text-slate-500">{item.detail}</p>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <button
          onClick={goToNotifications}
          className={`group relative rounded-lg border p-2 transition duration-150 ${
            isCustomer
              ? "border-slate-200 bg-white hover:border-[#632dff]/40 hover:bg-[#632dff]/5"
              : "border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-900"
          }`}
          title="Notifications"
        >
          <Bell className={`h-5 w-5 transition ${isCustomer ? "text-[#1c5cb6] group-hover:text-[#632dff]" : "text-slate-300 group-hover:text-white"}`} />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500"></span>
            </span>
          )}
        </button>

        <div className={`hidden h-6 w-px sm:block ${isCustomer ? "bg-slate-200" : "bg-slate-800"}`}></div>

        <div className="hidden items-center gap-3 sm:flex">
          <div className="text-right leading-tight">
            <p className={`text-sm font-semibold ${isCustomer ? "text-slate-950" : "text-white"}`}>{user?.name || "User"}</p>
            <p className="text-xs capitalize text-slate-400">{user?.role?.replace("_", " ") || "Member"}</p>
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg font-bold text-white shadow-lg ${
            isCustomer ? "bg-[#1c5cb6] shadow-[#632dff]/20" : "bg-blue-600 shadow-blue-600/20"
          }`}>
            {user?.name?.charAt(0) || "U"}
          </div>
        </div>

        <button
          onClick={handleLogout}
          className={`rounded-lg p-2 transition duration-150 hover:bg-red-500/10 hover:text-red-300 ${isCustomer ? "text-slate-500" : "text-slate-400"}`}
          title="Logout"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
    {slideNotification && (
      <div className="fixed right-4 top-24 z-50 w-[min(24rem,calc(100vw-2rem))] animate-[slideIn_.25s_ease-out]">
        <div className={`overflow-hidden rounded-xl border shadow-2xl ${
          isCustomer
            ? "border-[#632dff]/25 bg-white text-slate-950 shadow-slate-300/70"
            : "border-blue-500/30 bg-slate-950 text-white shadow-slate-950/50"
        }`}>
          <button
            type="button"
            onClick={openSlideNotification}
            className={`block w-full p-4 text-left transition ${isCustomer ? "hover:bg-[#632dff]/5" : "hover:bg-slate-900"}`}
          >
            <div className="flex items-start gap-3">
              <div className={`rounded-lg p-2 ${isCustomer ? "bg-[#632dff]/10 text-[#1c5cb6]" : "bg-blue-500/20 text-blue-300"}`}>
                <Bell className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-bold uppercase tracking-[0.16em] ${isCustomer ? "text-[#632dff]" : "text-blue-300"}`}>New notification</p>
                <p className="mt-1 line-clamp-2 text-sm font-semibold">{slideNotification.displayMessage || slideNotification.message}</p>
                <p className="mt-2 text-xs text-slate-500">Click to open</p>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={dismissSlideNotification}
            className={`absolute right-2 top-2 rounded-lg p-1.5 transition ${isCustomer ? "text-slate-400 hover:bg-slate-100 hover:text-slate-700" : "text-slate-500 hover:bg-slate-800 hover:text-white"}`}
            aria-label="Dismiss notification"
            title="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    )}
    </>
  );
}
