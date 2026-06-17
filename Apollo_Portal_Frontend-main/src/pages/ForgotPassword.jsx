import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Zap } from "lucide-react";
import API from "../services/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const { data } = await API.post("/auth/forgot-password", { email });
      setMessage(data.message || "Request received.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not submit request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.18),transparent_28rem),linear-gradient(180deg,#0f172a_0%,#020617_100%)] px-4 py-10 text-slate-100">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/85 p-8 shadow-2xl shadow-slate-950/30">
        <div className="mb-7">
          <div className="mb-4 inline-flex rounded-xl bg-blue-600 p-2">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-300">Password help</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Reset access</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">Enter your account email and support will send reset instructions after verification.</p>
        </div>

        {message && <p className="mb-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</p>}
        {error && <p className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

        <form onSubmit={submit} className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-200">Email</span>
            <span className="relative block">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/70 py-3 pl-10 pr-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                placeholder="you@company.com"
                required
              />
            </span>
          </label>
          <button disabled={loading} className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60">
            {loading ? "Sending..." : "Request reset"}
          </button>
        </form>

        <Link to="/login" className="mt-6 block text-center text-sm font-semibold text-blue-300 hover:text-blue-200">
          Back to login
        </Link>
      </section>
    </main>
  );
}
