import { Link } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, Repeat, QrCode } from "lucide-react";

interface QuickAction {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const quickActions: QuickAction[] = [
  { to: "/goods-receipt", label: "Wareneingang", icon: <ArrowDownLeft size={32} /> },
  { to: "/goods-issue", label: "Warenausgang", icon: <ArrowUpRight size={32} /> },
  { to: "/stock-transfer", label: "Umlagerung", icon: <Repeat size={32} /> },
  { to: "/scanner", label: "Scanner", icon: <QrCode size={32} /> },
];

interface DashboardQuickActionsProps {
  visible: boolean;
}

export function DashboardQuickActions({ visible }: DashboardQuickActionsProps) {
  if (!visible) return null;

  return (
    <div className="lg:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4">
      {quickActions.map((action) => (
        <Link
          key={action.to}
          to={action.to}
          className="bg-white border border-zinc-200 rounded-xl p-6 flex flex-col items-center justify-center text-center gap-4 text-zinc-900 transition-all duration-200 min-h-[140px] hover:border-zinc-300 hover:bg-zinc-50 hover:-translate-y-0.5 hover:shadow-md"
          data-testid={`dashboard-quick-action-${action.to.slice(1)}`}
        >
          <div className="text-zinc-600 w-12 h-12 flex items-center justify-center bg-zinc-100 rounded-full">
            {action.icon}
          </div>
          <span className="font-medium text-base truncate w-full px-2">{action.label}</span>
        </Link>
      ))}
    </div>
  );
}
