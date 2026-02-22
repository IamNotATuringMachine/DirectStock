import { ArrowDownToLine, ArrowUpFromLine, ClipboardList, PackageCheck, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

const HUB_CARDS = [
  {
    id: "goods-receipt",
    title: "Wareneingang",
    description: "Anlieferungen buchen und abschließen",
    path: "/goods-receipt",
    icon: ArrowDownToLine,
  },
  {
    id: "goods-issue",
    title: "Warenausgang",
    description: "Entnahmen und Auslieferungen bearbeiten",
    path: "/goods-issue",
    icon: ArrowUpFromLine,
  },
  {
    id: "inventory-count",
    title: "Inventur",
    description: "Zählungen durchführen und finalisieren",
    path: "/inventory-counts",
    icon: ClipboardList,
  },
  {
    id: "sales-orders",
    title: "Verkaufsaufträge",
    description: "Aufträge prüfen und abschließen",
    path: "/sales-orders",
    icon: PackageCheck,
  },
] as const;

export default function TabletOperationsHubPage() {
  const navigate = useNavigate();

  return (
    <section className="page flex flex-col gap-6" data-testid="tablet-ops-hub-page">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Tablet Operations</h1>
          <p className="section-subtitle mt-1">Wähle den Arbeitsbereich für den aktuellen Vorgang.</p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => navigate("/operators")}
          data-testid="tablet-ops-manage-operators-btn"
        >
          <Users size={16} />
          Mitarbeiter verwalten
        </button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
        {HUB_CARDS.map((card) => (
          <button
            key={card.id}
            type="button"
            className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--panel)] p-6 text-left shadow-sm hover:shadow-md hover:border-[var(--line-strong)] transition-all min-h-[180px]"
            onClick={() => navigate(card.path)}
            data-testid={`tablet-ops-card-${card.id}`}
          >
            <div className="w-11 h-11 rounded-xl bg-[var(--panel-strong)] border border-[var(--line)] flex items-center justify-center mb-4">
              <card.icon size={22} className="text-[var(--accent)]" />
            </div>
            <h2 className="text-lg font-semibold text-[var(--ink)]">{card.title}</h2>
            <p className="text-sm text-[var(--muted)] mt-2">{card.description}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
