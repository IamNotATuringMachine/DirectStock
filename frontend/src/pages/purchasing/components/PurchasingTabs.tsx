import { AlertCircle, FileText, Filter, Settings } from "lucide-react";

import type { PurchasingTab } from "../model";

type PurchasingTabsProps = {
  tab: PurchasingTab;
  onTabChange: (tab: PurchasingTab) => void;
};

export function PurchasingTabs({ tab, onTabChange }: PurchasingTabsProps) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-[var(--line)]">
      <button
        onClick={() => onTabChange("orders")}
        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
          tab === "orders"
            ? "border-[var(--accent)] text-[var(--accent)]"
            : "border-transparent text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]"
        }`}
        data-testid="purchasing-tab-orders"
      >
        <FileText className="w-4 h-4" />
        Bestellungen
      </button>

      <button
        onClick={() => onTabChange("abc")}
        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
          tab === "abc"
            ? "border-[var(--accent)] text-[var(--accent)]"
            : "border-transparent text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]"
        }`}
        data-testid="purchasing-tab-abc"
      >
        <Filter className="w-4 h-4" />
        ABC-Analyse
      </button>

      <button
        onClick={() => onTabChange("recommendations")}
        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
          tab === "recommendations"
            ? "border-[var(--accent)] text-[var(--accent)]"
            : "border-transparent text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]"
        }`}
        data-testid="purchasing-tab-recommendations"
      >
        <AlertCircle className="w-4 h-4" />
        Bestellvorschläge
      </button>

      <button
        onClick={() => onTabChange("setup")}
        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
          tab === "setup"
            ? "border-[var(--accent)] text-[var(--accent)]"
            : "border-transparent text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]"
        }`}
        data-testid="purchasing-tab-setup"
      >
        <Settings className="w-4 h-4" />
        Setup
      </button>
    </div>
  );
}
