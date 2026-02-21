import { Layout, Settings, X } from "lucide-react";
import { DashboardStats } from "./dashboard/components/DashboardStats";
import { DashboardQuickActions } from "./dashboard/components/DashboardQuickActions";
import { DashboardRecentMovements } from "./dashboard/components/DashboardRecentMovements";
import { DashboardLowStock } from "./dashboard/components/DashboardLowStock";
import { DashboardCriticalAlerts } from "./dashboard/components/DashboardCriticalAlerts";
import { DashboardActivity } from "./dashboard/components/DashboardActivity";
import { useDashboard } from "./dashboard/hooks/useDashboard";

export default function DashboardPage() {
    const {
        showConfig,
        setShowConfig,
        summaryQuery,
        recentQuery,
        lowStockQuery,
        activityQuery,
        kpiQuery,
        criticalAlertsQuery,
        cardsCatalog,
        visibleCardKeys,
        isSavingDashboardConfig,
        toggleCard,
    } = useDashboard();

    return (
        <section className="page" data-testid="dashboard-page">
            <div className="space-y-8 max-w-[1600px] mx-auto">
                <header className="panel-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h2 className="page-title truncate">Dashboard</h2>
                        <p className="section-subtitle mt-1 truncate">Operativer Überblick</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            className="btn btn-secondary flex items-center gap-2"
                            onClick={() => setShowConfig(!showConfig)}
                            title="Dashboard anpassen"
                        >
                            {showConfig ? <X size={18} /> : <Settings size={18} />}
                            <span className="truncate">{showConfig ? "Schließen" : "Anpassen"}</span>
                        </button>
                    </div>
                </header>

                {showConfig && (
                    <article className="subpanel animate-in slide-in-from-top duration-300">
                        <div className="flex items-center gap-2 mb-4">
                            <Layout size={20} className="text-zinc-900" />
                            <h3 className="text-lg font-semibold m-0 text-zinc-900 truncate">Karten konfigurieren</h3>
                        </div>
                        <p className="text-sm text-zinc-500 mb-4 line-clamp-2">
                            Wählen Sie die Module aus, die auf Ihrem Dashboard angezeigt werden sollen. Die Änderungen werden automatisch gespeichert.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {cardsCatalog.map((card) => (
                                <label
                                    key={card.card_key}
                                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                        visibleCardKeys.has(card.card_key)
                                            ? "bg-zinc-50 border-zinc-300"
                                            : "bg-white border-zinc-200 hover:border-zinc-400"
                                    }`}
                                >
                                    <div className="relative flex items-center justify-center h-5 w-5 shrink-0">
                                        <input
                                            type="checkbox"
                                            className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-zinc-300 transition-all checked:bg-zinc-900 checked:border-zinc-900 focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
                                            checked={visibleCardKeys.has(card.card_key)}
                                            onChange={() => toggleCard(card.card_key)}
                                            disabled={isSavingDashboardConfig}
                                            data-testid={`dashboard-card-toggle-${card.card_key}`}
                                        />
                                        <CheckIcon className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                                    </div>
                                    <span className="text-sm font-medium text-zinc-900 truncate">{card.title}</span>
                                </label>
                            ))}
                        </div>
                    </article>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <DashboardStats
                        summary={summaryQuery.data}
                        kpis={kpiQuery.data}
                        visible={visibleCardKeys.has("summary")}
                        isLoading={summaryQuery.isLoading || kpiQuery.isLoading}
                    />

                    <DashboardQuickActions visible={visibleCardKeys.has("quick-actions")} />

                    <div className="lg:col-span-2 flex flex-col gap-6">
                        <DashboardRecentMovements
                            data={recentQuery.data}
                            visible={visibleCardKeys.has("recent-movements")}
                            isLoading={recentQuery.isLoading}
                        />
                    </div>

                    <div className="lg:col-span-2 flex flex-col gap-6">
                        <DashboardLowStock
                            data={lowStockQuery.data}
                            visible={visibleCardKeys.has("low-stock")}
                            isLoading={lowStockQuery.isLoading}
                        />
                        <DashboardCriticalAlerts
                            data={criticalAlertsQuery.data}
                            visible={visibleCardKeys.has("critical-alerts")}
                            isLoading={criticalAlertsQuery.isLoading}
                        />
                    </div>

                    <DashboardActivity
                        data={activityQuery.data}
                        visible={visibleCardKeys.has("activity-today")}
                        isLoading={activityQuery.isLoading}
                    />
                </div>
            </div>
        </section>
    );
}

function CheckIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}
