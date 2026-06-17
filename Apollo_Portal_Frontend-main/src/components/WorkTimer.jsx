import { MonitorCheck } from "lucide-react";
import { getStoredUser } from "../utils/authStorage";

export default function WorkTimer() {
  const user = getStoredUser();

  const isExcluded =
    !user ||
    user.role === "admin" ||
    user.role === "expense_manager" ||
    user.role === "finance" ||
    user.role === "customer";

  if (isExcluded) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-blue-500/25 bg-slate-950/95 p-4 text-white shadow-2xl shadow-blue-950/30 backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="rounded-md border border-blue-500/30 bg-blue-500/10 p-2 text-blue-300">
          <MonitorCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Desktop monitoring active</p>
          <p className="mt-1 text-sm leading-5 text-slate-400">
            Your working time is tracked automatically through the company desktop monitoring app.
          </p>
        </div>
      </div>
    </div>
  );
}
