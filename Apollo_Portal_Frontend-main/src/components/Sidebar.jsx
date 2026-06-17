import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  CheckSquare,
  BarChart3,
  Bell,
  LogOut,
  Plus,
  Eye,
  History,
  Zap,
  Code2,
  Palette,
  UploadCloud,
  Activity,
  ReceiptText,
  Package,
  FileText,
  Globe2,
  AtSign,
  LifeBuoy,
  CalendarDays,
} from "lucide-react";
import { disconnectSocket } from "../services/socket";
import { clearAuthSession, getStoredUser } from "../utils/authStorage";

const EMAIL_PACKAGE_IDS = [
  "informative-startup",
  "informative-professional",
  "ecommerce-startup",
  "ecommerce-professional",
  "ecommerce-business",
  "domain-email",
  "email",
];

const getSelectedPackageId = (item) => (typeof item === "string" ? item : item?.packageId || item?.id || "");

export default function Sidebar({ mobileOpen = false, onClose }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(getStoredUser());

  useEffect(() => {
    const refreshUser = () => setUser(getStoredUser());
    window.addEventListener("apollo:user-updated", refreshUser);
    return () => window.removeEventListener("apollo:user-updated", refreshUser);
  }, []);

  const logout = async () => {
    disconnectSocket();
    clearAuthSession();
    navigate("/login");
  };

  const role = user?.role;
  const isCustomer = role === "customer";

  const iconMap = {
    dashboard: <LayoutDashboard className="w-4 h-4" />,
    users: <Users className="w-4 h-4" />,
    projects: <Briefcase className="w-4 h-4" />,
    tasks: <CheckSquare className="w-4 h-4" />,
    performance: <BarChart3 className="w-4 h-4" />,
    notifications: <Bell className="w-4 h-4" />,
    plus: <Plus className="w-4 h-4" />,
    review: <Eye className="w-4 h-4" />,
    code: <Code2 className="w-4 h-4" />,
    design: <Palette className="w-4 h-4" />,
    history: <History className="w-4 h-4" />,
    send: <UploadCloud className="w-4 h-4" />,
    monitoring: <Activity className="w-4 h-4" />,
    expenses: <ReceiptText className="w-4 h-4" />,
    packages: <Package className="w-4 h-4" />,
    form: <FileText className="w-4 h-4" />,
    domain: <Globe2 className="w-4 h-4" />,
    email: <AtSign className="w-4 h-4" />,
    ticket: <LifeBuoy className="w-4 h-4" />,
    calendar: <CalendarDays className="w-4 h-4" />,
  };

  const menus = {
    admin: [
      { label: "Dashboard", path: "/admin", icon: "dashboard" },
      { label: "Customers", path: "/admin/customers", icon: "users" },
      { label: "All Users", path: "/admin/users", icon: "users" },
      { label: "Attendance", path: "/admin/attendance", icon: "performance" },
      { label: "Performance", path: "/admin/performance", icon: "performance" },
      { label: "Monitoring", path: "/admin/monitoring", icon: "monitoring" },
      { label: "Tasks", path: "/admin/tasks", icon: "tasks" },
      { label: "Add Tasks", path: "/admin/add-task", icon: "plus" },
      { label: "Calendar", path: "/admin/calendar", icon: "calendar" },
      { label: "Expenses", path: "/admin/expenses", icon: "expenses" },
      { label: "Notifications", path: "/admin/notifications", icon: "notifications" },
    ],

    pm: [
      { label: "Dashboard", path: "/pm", icon: "dashboard" },
      { label: "Projects", path: "/pm/projects", icon: "projects" },
      { label: "Client List", path: "/pm/clients", icon: "users" },
      { label: "Add Tasks", path: "/pm/tasks", icon: "plus" },
      { label: "Work Review", path: "/pm/review", icon: "review" },
      { label: "Notifications", path: "/pm/notifications", icon: "notifications" },
    ],

    teamleader_dev: [
      { label: "Dashboard", path: "/teamleader/dev", icon: "dashboard" },
      { label: "All Tasks", path: "/teamleader/dev/tasks", icon: "tasks" },
      { label: "Assign Tasks", path: "/teamleader/dev/assign", icon: "plus" },
      { label: "Upload Work", path: "/teamleader/dev/upload", icon: "send" },
      { label: "Work Review", path: "/teamleader/dev/review", icon: "review" },
      { label: "Notifications", path: "/teamleader/dev/notifications", icon: "notifications" },
    ],

    teamleader_design: [
      { label: "Dashboard", path: "/teamleader/design", icon: "dashboard" },
      { label: "All Tasks", path: "/teamleader/design/tasks", icon: "tasks" },
      { label: "Assign Tasks", path: "/teamleader/design/assign", icon: "plus" },
      { label: "Upload Work", path: "/teamleader/design/upload", icon: "send" },
      { label: "Work Review", path: "/teamleader/design/review", icon: "review" },
      { label: "Notifications", path: "/teamleader/design/notifications", icon: "notifications" },
    ],

    developer: [
      { label: "Dashboard", path: "/developer", icon: "dashboard" },
      { label: "My Tasks", path: "/developer/tasks", icon: "tasks" },
      { label: "Upload Builds", path: "/developer/upload", icon: "send" },
      { label: "Revisions", path: "/developer/revisions", icon: "history" },
      { label: "Notifications", path: "/developer/notifications", icon: "notifications" },
    ],

    designer: [
      { label: "Dashboard", path: "/designer", icon: "dashboard" },
      { label: "Design Tasks", path: "/designer/tasks", icon: "tasks" },
      { label: "Upload Designs", path: "/designer/upload", icon: "send" },
      { label: "Revisions", path: "/designer/revisions", icon: "history" },
      { label: "Notifications", path: "/designer/notifications", icon: "notifications" },
    ],

    expense_manager: [
      { label: "Dashboard", path: "/expense-manager", icon: "dashboard" },
      { label: "Expenses", path: "/expense-manager/expenses", icon: "expenses" },
      { label: "Reports", path: "/expense-manager/reports", icon: "performance" },
      { label: "Notifications", path: "/expense-manager/notifications", icon: "notifications" },
    ],

    customer: [
      { label: "Dashboard", path: "/customer", icon: "dashboard" },
      { label: "Packages", path: "/customer/packages", icon: "packages" },
      { label: "Logo Form", path: "/customer/logo", icon: "form" },
      { label: "Website Form", path: "/customer/website", icon: "form" },
      { label: "Domain Form", path: "/customer/domain", icon: "domain" },
      { label: "Consent Form", path: "/customer/consent", icon: "form" },
      { label: "Email Form", path: "/customer/email", icon: "email", requiresPackage: "email" },
      { label: "Raise Ticket", path: "/customer/tickets", icon: "ticket" },
    ],
  };

  const selectedPackages = user?.customerProfile?.selectedPackages || [];
  const navItems = (menus[role] || [])
    .filter((item) => !item.requiresPackage || (item.requiresPackage === "email" && selectedPackages.some((selected) => EMAIL_PACKAGE_IDS.includes(getSelectedPackageId(selected)))))
    .map((item) => {
    const iconKey = item.icon === "plus" ? "plus" : item.icon === "send" ? "send" : item.icon;
    const icon = iconMap[iconKey] || iconMap.dashboard;

    return (
      <NavLink
        key={item.path}
        to={item.path}
        end
        onClick={onClose}
        className={({ isActive }) =>
          `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition duration-150 ${
            isCustomer
              ? isActive
                ? "bg-[#1c5cb6] text-white shadow-lg shadow-[#632dff]/20"
                : "text-slate-600 hover:bg-[#632dff]/5 hover:text-[#632dff]"
              : isActive
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : "text-slate-400 hover:bg-slate-900 hover:text-white"
          }`
        }
      >
        {icon}
        <span className="text-sm">{item.label}</span>
      </NavLink>
    );
  });

  const content = (
    <>
      <div className={`p-6 border-b ${isCustomer ? "border-slate-200" : "border-slate-700/50"}`}>
        <div className="mb-6 flex items-center">
          {isCustomer ? (
            <img src="/aqua-design-works-logo.webp" alt="Aqua Design Works" className="h-12 w-16 rounded-md object-contain" />
          ) : (
            <div className="rounded-xl bg-blue-600 p-2 shadow-lg shadow-blue-500/20">
              <Zap className="w-6 h-6 text-white" />
            </div>
          )}
          <div className="ml-3">
            <p className={`text-xl font-bold tracking-tight ${isCustomer ? "text-slate-950" : "text-white"}`}>{isCustomer ? "Aqua Design Works" : "Aytech"}</p>
            <p className="text-xs font-medium text-slate-500">{isCustomer ? "Customer portal" : "Team operations"}</p>
          </div>
        </div>

        <div className={`flex items-center gap-3 rounded-xl border p-4 ${isCustomer ? "border-slate-200 bg-slate-50" : "border-slate-800 bg-slate-900/70"}`}>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm ${isCustomer ? "bg-[#632dff]" : "bg-blue-600"}`}>
            {user?.name?.charAt(0) || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-sm truncate ${isCustomer ? "text-slate-950" : "text-white"}`}>{user?.name || "User"}</p>
            <p className="text-xs text-slate-400 capitalize truncate">{role?.replace("_", " ") || "Member"}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-1">
        {navItems}
      </nav>

      <div className={`p-4 border-t space-y-3 ${isCustomer ? "border-slate-200" : "border-slate-700/50"}`}>
        <button
          onClick={logout}
          className={`w-full flex items-center justify-center gap-2 border font-semibold py-2.5 rounded-lg transition duration-150 ${
            isCustomer
              ? "border-[#632dff]/25 bg-[#632dff]/10 text-[#1c5cb6] hover:border-[#632dff]/50 hover:bg-[#632dff]/15 hover:text-[#632dff]"
              : "border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-200 hover:text-white"
          }`}
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>

        <div className={`rounded-lg px-3 py-2 text-center ${isCustomer ? "bg-slate-100" : "bg-slate-900/70"}`}>
          <p className="text-xs text-slate-500">Powered by {isCustomer ? "Aqua Design Works" : "Aytech"}</p>
        </div>
      </div>
    </>
  );

  return (
    <>
      <aside className={`sticky top-0 z-30 flex h-screen w-72 shrink-0 flex-col border-r shadow-2xl max-lg:hidden ${
        isCustomer
          ? "border-slate-200 bg-white text-slate-950 shadow-slate-200/50"
          : "border-slate-800/80 bg-slate-950/95 text-white shadow-slate-950/40"
      }`}>
        {content}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className="absolute inset-0 bg-black/70"
          />
          <aside className={`relative z-10 flex h-full w-80 max-w-[85vw] flex-col border-r shadow-2xl shadow-black/50 ${
            isCustomer
              ? "border-slate-200 bg-white text-slate-950"
              : "border-slate-800/80 bg-slate-950 text-white"
          }`}>
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
