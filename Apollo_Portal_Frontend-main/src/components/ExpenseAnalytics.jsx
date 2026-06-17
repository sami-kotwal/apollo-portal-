import { CalendarDays, CreditCard, HandCoins, WalletCards } from "lucide-react";
import { formatMoney } from "../utils/money";

function ExpenseMetric({ label, value, detail, icon: Icon, tone }) {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800 to-slate-900 p-6 shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <h3 className="mt-2 text-3xl font-bold text-white">{value}</h3>
          {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
        </div>
        <div className={`rounded-lg border p-3 ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function ExpenseAnalytics({ summary }) {
  const companySpent = summary?.companySpent || 0;
  const personalPaid = summary?.personalPaid || 0;
  const spentAgainstFund = summary?.spentAgainstFund ?? companySpent + personalPaid;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      <ExpenseMetric
        label="Available Company Fund"
        value={formatMoney(summary?.remainingFund || 0)}
        detail={`${formatMoney(summary?.fund?.amount || 0)} provided this month`}
        icon={WalletCards}
        tone="border-blue-500/30 bg-blue-500/10 text-blue-300"
      />
      <ExpenseMetric
        label="Total Spent Against Fund"
        value={formatMoney(spentAgainstFund)}
        detail={summary?.overBudget > 0 ? `${formatMoney(summary.overBudget)} over fund` : `${summary?.monthly?.count || 0} monthly entries`}
        icon={CreditCard}
        tone="border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      />
      <ExpenseMetric
        label="Personal Paid"
        value={formatMoney(personalPaid)}
        detail="reimbursement due"
        icon={HandCoins}
        tone="border-amber-500/30 bg-amber-500/10 text-amber-300"
      />
      <ExpenseMetric
        label="Daily Expenses"
        value={formatMoney(summary?.daily?.total || 0)}
        detail={`${summary?.daily?.count || 0} entries today`}
        icon={CalendarDays}
        tone="border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
      />
    </div>
  );
}
