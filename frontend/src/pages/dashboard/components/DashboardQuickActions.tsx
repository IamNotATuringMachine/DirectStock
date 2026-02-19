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
    <div className="dashboard-full-width grid grid-cols-2 md:grid-cols-4 gap-4">
      {quickActions.map((action) => (
        <Link
          key={action.to}
          to={action.to}
          className="action-card"
          data-testid={`dashboard-quick-action-${action.to.slice(1)}`}
        >
          <div className="action-icon">{action.icon}</div>
          <span className="action-label">{action.label}</span>
        </Link>
      ))}
    </div>
  );
}
