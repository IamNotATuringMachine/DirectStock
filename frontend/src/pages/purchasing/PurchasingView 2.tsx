import { ShoppingCart } from "lucide-react";

import { PurchasingAbcTab, type PurchasingAbcTabProps } from "./components/PurchasingAbcTab";
import { PurchasingOrderDetails, type PurchasingOrderDetailsProps } from "./components/PurchasingOrderDetails";
import { PurchasingOrdersSidebar, type PurchasingOrdersSidebarProps } from "./components/PurchasingOrdersSidebar";
import { PurchasingRecommendationsTab, type PurchasingRecommendationsTabProps } from "./components/PurchasingRecommendationsTab";
import { PurchasingSetupTab, type PurchasingSetupTabProps } from "./components/PurchasingSetupTab";
import { PurchasingTabs } from "./components/PurchasingTabs";
import type { PurchasingTab } from "./model";

type PurchasingViewProps = {
  tab: PurchasingTab;
  onTabChange: (tab: PurchasingTab) => void;
  ordersSidebarProps: PurchasingOrdersSidebarProps;
  orderDetailsProps: PurchasingOrderDetailsProps;
  abcTabProps: PurchasingAbcTabProps;
  recommendationsTabProps: PurchasingRecommendationsTabProps;
  setupTabProps: PurchasingSetupTabProps;
};

export function PurchasingView({
  tab,
  onTabChange,
  ordersSidebarProps,
  orderDetailsProps,
  abcTabProps,
  recommendationsTabProps,
  setupTabProps,
}: PurchasingViewProps) {
  return (
    <div className="page space-y-6" data-testid="purchasing-page">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[var(--line)] pb-4" data-testid="purchasing-page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-[var(--accent)]" />
            Einkauf / Bestellwesen
          </h1>
          <p className="section-subtitle mt-1 max-w-2xl">
            Verwalten Sie Bestellungen, ABC-Klassifizierungen und erhalten Sie intelligente Bestellvorschläge.
          </p>
        </div>
      </div>

      <PurchasingTabs tab={tab} onTabChange={onTabChange} />

      {tab === "orders" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" data-testid="purchasing-orders-grid">
          <PurchasingOrdersSidebar {...ordersSidebarProps} />
          <div className="lg:col-span-8 space-y-6">
            <PurchasingOrderDetails {...orderDetailsProps} />
          </div>
        </div>
      ) : null}

      {tab === "abc" ? <PurchasingAbcTab {...abcTabProps} /> : null}
      {tab === "recommendations" ? <PurchasingRecommendationsTab {...recommendationsTabProps} /> : null}
      {tab === "setup" ? <PurchasingSetupTab {...setupTabProps} /> : null}
    </div>
  );
}
