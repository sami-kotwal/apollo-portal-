import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Lock, Mail, UserRound, UsersRound, Zap } from "lucide-react";
import API from "../services/api";
import { saveAuthSession } from "../utils/authStorage";

const employeeTheme = {
  shell: "min-h-screen bg-slate-950 text-slate-100",
  side: "relative hidden overflow-hidden border-r border-slate-800 bg-[radial-gradient(circle_at_30%_20%,rgba(37,99,235,0.3),transparent_28rem),linear-gradient(135deg,#020617_0%,#0f172a_48%,#111827_100%)] p-10 lg:flex lg:flex-col lg:justify-between",
  main: "flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.16),transparent_28rem)] px-4 py-10 sm:px-6",
  logo: "bg-blue-600 shadow-blue-600/25",
  eyebrow: "text-blue-300",
  heading: "text-white",
  muted: "text-slate-400",
  card: "rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/30 backdrop-blur sm:p-8",
  label: "text-slate-200",
  icon: "text-slate-500",
  input: "w-full rounded-lg border border-slate-700 bg-slate-950/70 py-3 pl-10 pr-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40",
  link: "text-blue-300 hover:text-blue-200",
  button: "bg-blue-600 text-white shadow-blue-600/20 hover:bg-blue-500",
  error: "border-red-500/30 bg-red-500/10 text-red-200",
};

const customerTheme = {
  shell: "min-h-screen bg-[radial-gradient(circle_at_20%_10%,rgba(188,38,255,0.14),transparent_28rem),radial-gradient(circle_at_90%_15%,rgba(28,92,182,0.12),transparent_24rem),linear-gradient(135deg,#ffffff_0%,#f8fafc_55%,#eef4ff_100%)] text-slate-900",
  side: "relative hidden overflow-hidden border-r border-slate-200 bg-[radial-gradient(circle_at_30%_20%,rgba(188,38,255,0.14),transparent_28rem),linear-gradient(135deg,#ffffff_0%,#eef4ff_100%)] p-10 lg:flex lg:flex-col lg:justify-between",
  main: "flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(99,45,255,0.12),transparent_28rem)] px-4 py-10 sm:px-6",
  logo: "bg-[#1c5cb6] shadow-[#632dff]/20",
  eyebrow: "text-[#632dff]",
  heading: "text-slate-950",
  muted: "text-slate-600",
  card: "rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-2xl shadow-slate-200/80 backdrop-blur sm:p-8",
  label: "text-slate-700",
  icon: "text-[#1c5cb6]",
  input: "w-full rounded-lg border border-slate-200 bg-white py-3 pl-10 pr-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#632dff] focus:ring-2 focus:ring-[#632dff]/20",
  link: "text-[#632dff] hover:text-[#bc26ff]",
  button: "bg-[#1c5cb6] text-white shadow-[#632dff]/20 hover:bg-[#632dff]",
  error: "border-red-500/30 bg-red-50 text-red-700",
};

const routeForRole = (role) => {
  if (role === "admin") return "/admin";
  if (role === "pm") return "/pm";
  if (role === "teamleader_dev") return "/teamleader/dev";
  if (role === "teamleader_design") return "/teamleader/design";
  if (role === "developer") return "/developer";
  if (role === "designer") return "/designer";
  if (role === "expense_manager") return "/expense-manager";
  if (role === "customer") return "/customer";
  return "/";
};

function LoginChoice() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_10%,rgba(188,38,255,0.14),transparent_28rem),radial-gradient(circle_at_85%_20%,rgba(28,92,182,0.14),transparent_26rem),linear-gradient(135deg,#ffffff_0%,#f8fafc_45%,#eef4ff_100%)] px-4 py-10 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col justify-center">
        <div className="mb-10 flex items-center gap-3">
          <img src="/aqua-design-works-logo.webp" alt="Aqua Design Works" className="h-12 w-20 rounded-lg object-contain" />
          <div>
            <p className="text-2xl font-bold">Aqua Design Works</p>
            <p className="text-sm text-slate-500">Choose how you want to continue.</p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Link
            to="/login/customer"
            className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70 transition hover:-translate-y-1 hover:border-[#632dff]/40 hover:shadow-[#632dff]/15"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#1c5cb6] text-white">
              <UserRound className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#632dff]">Customer</p>
            <h1 className="mt-2 text-3xl font-bold">Access projects and packages</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">Login to your customer dashboard or create a new account for website, logo, domain, email, and support requests.</p>
            <span className="mt-6 inline-flex items-center gap-2 font-semibold text-[#1c5cb6] group-hover:text-[#632dff]">
              Continue as customer <ArrowRight className="h-4 w-4" />
            </span>
          </Link>

          <Link
            to="/login/employee"
            className="group rounded-2xl border border-slate-800 bg-slate-950 p-6 text-white shadow-xl shadow-slate-300/40 transition hover:-translate-y-1 hover:border-blue-500/50"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
              <UsersRound className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-300">Employee</p>
            <h1 className="mt-2 text-3xl font-bold">Team operations workspace</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">Login to manage tasks, reviews, monitoring, attendance, expenses, and internal reports.</p>
            <span className="mt-6 inline-flex items-center gap-2 font-semibold text-blue-300 group-hover:text-blue-200">
              Continue as employee <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </div>
      </div>
    </main>
  );
}

function LoginForm({ mode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const isCustomer = mode === "customer";
  const theme = isCustomer ? customerTheme : employeeTheme;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data } = await API.post("/auth/login", { email, password });
      saveAuthSession(data.token, data.user);
      navigate(routeForRole(data.user.role));
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={theme.shell}>
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className={theme.side}>
          <div className="flex items-center gap-3">
            {isCustomer ? (
              <img src="/aqua-design-works-logo.webp" alt="Aqua Design Works" className="h-12 w-20 rounded-lg object-contain" />
            ) : (
              <div className={`rounded-xl p-2 shadow-lg ${theme.logo}`}>
                <Zap className="h-6 w-6 text-white" />
              </div>
            )}
            <div>
              <p className={`text-xl font-bold tracking-tight ${theme.heading}`}>{isCustomer ? "Aqua Design Works" : "Aytech Portal"}</p>
              <p className={isCustomer ? "text-sm text-slate-500" : "text-sm text-slate-400"}>
                {isCustomer ? "Customer workspace" : "Team workspace"}
              </p>
            </div>
          </div>

          <div className="max-w-xl">
            <p className={`mb-4 text-sm font-semibold uppercase tracking-[0.18em] ${theme.eyebrow}`}>
              {isCustomer ? "Customer portal" : "Team workspace"}
            </p>
            <h1 className={`text-5xl font-bold leading-tight tracking-tight ${theme.heading}`}>
              {isCustomer
                ? "Access your projects, packages, and support."
                : "Manage work, reviews, and delivery from one clean dashboard."}
            </h1>
            <p className={`mt-5 max-w-lg text-base leading-7 ${theme.muted}`}>
              {isCustomer
                ? "Sign in to continue your project requests, selected packages, and tickets."
                : "Sign in with your company account to continue internal operations."}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {(isCustomer ? ["Packages", "Forms", "Support"] : ["Tasks", "Reviews", "Progress"]).map((item) => (
              <div key={item} className={isCustomer ? "rounded-xl border border-slate-200 bg-white/70 p-4" : "rounded-xl border border-slate-700/70 bg-slate-900/60 p-4"}>
                <p className={`text-sm font-semibold ${theme.heading}`}>{item}</p>
                <p className="mt-1 text-xs text-slate-500">Live workspace</p>
              </div>
            ))}
          </div>
        </section>

        <main className={theme.main}>
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              {isCustomer ? (
                <img src="/aqua-design-works-logo.webp" alt="Aqua Design Works" className="mb-4 h-14 w-24 rounded-lg object-contain" />
              ) : (
                <div className={`mb-4 inline-flex rounded-xl p-2 ${theme.logo}`}>
                  <Zap className="h-6 w-6 text-white" />
                </div>
              )}
              <h1 className={`text-3xl font-bold ${theme.heading}`}>{isCustomer ? "Aqua Design Works" : "Aytech Portal"}</h1>
              <p className={`mt-2 ${theme.muted}`}>Sign in to continue to your dashboard.</p>
            </div>

            <div className={theme.card}>
              <div className="mb-7">
                <p className={`text-sm font-semibold uppercase tracking-[0.16em] ${theme.eyebrow}`}>
                  {isCustomer ? "Customer login" : "Employee login"}
                </p>
                <h2 className={`mt-2 text-3xl font-bold ${theme.heading}`}>Welcome back</h2>
                <p className={`mt-2 text-sm ${theme.muted}`}>Use your {isCustomer ? "Aqua Design Works" : "Aytech"} account credentials.</p>
              </div>

              {error && <div className={`mb-5 rounded-lg border p-3 text-sm ${theme.error}`}>{error}</div>}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className={`mb-2 block text-sm font-semibold ${theme.label}`}>Email</label>
                  <div className="relative">
                    <Mail className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${theme.icon}`} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={theme.input}
                      placeholder="you@company.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className={`block text-sm font-semibold ${theme.label}`}>Password</label>
                    <Link to="/forgot-password" className={`text-xs font-semibold ${theme.link}`}>
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${theme.icon}`} />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={theme.input}
                      placeholder="Enter your password"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`flex w-full items-center justify-center rounded-lg px-4 py-3 font-semibold shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60 ${theme.button}`}
                >
                  {loading ? "Signing in..." : "Sign in"}
                </button>
              </form>

              {isCustomer ? (
                <p className="mt-6 text-center text-sm text-slate-500">
                  New customer?{" "}
                  <Link to="/register" className={`font-semibold ${theme.link}`}>
                    Create your account
                  </Link>
                </p>
              ) : (
                <p className="mt-6 text-center text-sm text-slate-500">
                  Not an employee?{" "}
                  <Link to="/login/customer" className={`font-semibold ${theme.link}`}>
                    Continue as customer
                  </Link>
                </p>
              )}

              <p className="mt-3 text-center text-xs text-slate-500">
                <Link to="/login" className={theme.link}>Change login type</Link>
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function Login() {
  const { pathname } = useLocation();
  if (pathname === "/login/customer") return <LoginForm mode="customer" />;
  if (pathname === "/login/employee") return <LoginForm mode="employee" />;
  return <LoginChoice />;
}
