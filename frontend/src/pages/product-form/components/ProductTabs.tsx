import type { LucideIcon } from "lucide-react";

import type { ProductTab } from "../model";

type ProductTabConfig = {
  id: ProductTab;
  label: string;
  icon: LucideIcon;
  testId: string;
};

type ProductTabsProps = {
  isCreateWizardMode: boolean;
  canReadPricing: boolean;
  activeTab: ProductTab;
  setActiveTab: (tab: ProductTab) => void;
  tabConfig: ProductTabConfig[];
};

export function ProductTabs({
  isCreateWizardMode,
  canReadPricing,
  activeTab,
  setActiveTab,
  tabConfig,
}: ProductTabsProps) {
  if (isCreateWizardMode) {
    return null;
  }

  return (
    <div className="border-b border-[var(--line)]">
      <div className="tab-strip flex items-center gap-8 overflow-x-auto no-scrollbar">
        {tabConfig
          .filter((tab) => tab.id !== "pricing" || canReadPricing)
          .map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
              data-testid={tab.testId}
              className={`group pb-4 px-1 text-sm font-semibold flex items-center gap-2.5 transition-all relative whitespace-nowrap ${
                activeTab === tab.id ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              <tab.icon
                size={18}
                className={`transition-colors ${
                  activeTab === tab.id ? "text-[var(--accent)]" : "text-[var(--muted)] group-hover:text-[var(--ink)]"
                }`}
              />
              {tab.label}
              {activeTab === tab.id ? (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)] rounded-t-full shadow-[0_-2px_6px_rgba(21,128,61,0.2)]" />
              ) : null}
            </button>
          ))}
      </div>
    </div>
  );
}
