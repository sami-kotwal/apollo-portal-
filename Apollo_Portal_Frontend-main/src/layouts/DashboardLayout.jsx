import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { getStoredUser } from "../utils/authStorage";

export default function DashboardLayout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isCustomer = getStoredUser()?.role === "customer";

  return (
    <div className={`min-h-screen lg:flex ${isCustomer ? "bg-slate-50 text-slate-900" : "bg-slate-950 text-slate-100"}`}>
      <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <div className="min-w-0 flex-1">
        <Header onMenuClick={() => setMobileMenuOpen(true)} />
        <main
          className={`min-h-[calc(100vh-76px)] px-4 py-6 sm:px-6 lg:px-8 ${
            isCustomer
              ? "bg-[radial-gradient(circle_at_top_right,rgba(188,38,255,0.12),transparent_30rem),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]"
              : "bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.14),transparent_32rem),linear-gradient(180deg,#0f172a_0%,#020617_100%)]"
          }`}
        >
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
