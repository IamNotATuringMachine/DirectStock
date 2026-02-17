import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Package,
  Activity,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowRightLeft,
  MapPin,
  Layers,
} from "lucide-react";

import {
  fetchInventory,
  fetchInventoryByProduct,
  fetchInventorySummary,
  fetchLowStock,
  fetchMovements,
} from "../services/inventoryApi";
import { fetchWarehouses } from "../services/warehousesApi";
import type { InventoryItem } from "../types";

export default function InventoryPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);

  const warehouseId = warehouseFilter ? Number(warehouseFilter) : undefined;

  const summaryQuery = useQuery({ queryKey: ["inventory-summary"], queryFn: fetchInventorySummary, refetchInterval: 60000 });
  const warehousesQuery = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const inventoryQuery = useQuery({
    queryKey: ["inventory", page, pageSize, search, warehouseId],
    queryFn: () => fetchInventory({ page, pageSize, search: search || undefined, warehouseId }),
    refetchInterval: 30000,
  });
  const lowStockQuery = useQuery({ queryKey: ["inventory-low-stock"], queryFn: fetchLowStock, refetchInterval: 60000 });
  const movementsQuery = useQuery({
    queryKey: ["inventory-movements"],
    queryFn: () => fetchMovements({ limit: 12 }),
    refetchInterval: 60000,
  });

  const detailStockQuery = useQuery({
    queryKey: ["inventory-by-product", selectedProduct?.product_id],
    queryFn: () => fetchInventoryByProduct(selectedProduct?.product_id as number),
    enabled: selectedProduct !== null,
  });

  const detailMovementsQuery = useQuery({
    queryKey: ["inventory-movements", "product", selectedProduct?.product_id],
    queryFn: () => fetchMovements({ limit: 10, productId: selectedProduct?.product_id }),
    enabled: selectedProduct !== null,
  });

  const rows = useMemo(() => inventoryQuery.data?.items ?? [], [inventoryQuery.data]);
  const total = inventoryQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="page flex flex-col gap-6" data-testid="inventory-page">
      {/* Header */}
      <header className="panel-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="page-title">Bestandsübersicht</h2>
          <p className="section-subtitle mt-1">
            Aggregierter Bestand, Warnungen und letzte Bewegungen in Echtzeit.
          </p>
        </div>
      </header>

      {/* KPI Grid */}
      <div className="kpi-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card bg-[var(--panel)] p-6 rounded-[var(--radius-lg)] border border-[var(--line)] shadow-sm">
          <div>
            <span className="text-sm font-medium text-[var(--muted)]">Produkte mit Bestand</span>
            <strong className="text-3xl font-bold text-[var(--ink)] mt-2 block">
              {summaryQuery.data?.total_products_with_stock ?? "-"}
            </strong>
          </div>
        </div>
        
        <div className="kpi-card bg-[var(--panel)] p-6 rounded-[var(--radius-lg)] border border-[var(--line)] shadow-sm">
          <div>
            <span className="text-sm font-medium text-[var(--muted)]">Gesamtbestand</span>
            <strong className="text-3xl font-bold text-[var(--ink)] mt-2 block">
              {summaryQuery.data?.total_quantity ?? "-"}
            </strong>
          </div>
        </div>

        <div className="kpi-card bg-[var(--panel)] p-6 rounded-[var(--radius-lg)] border border-[var(--line)] shadow-sm">
          <div>
            <span className="text-sm font-medium text-[var(--muted)]">Reserviert</span>
            <strong className="text-3xl font-bold text-[var(--ink)] mt-2 block">
              {summaryQuery.data?.reserved_quantity ?? "-"}
            </strong>
          </div>
        </div>

        <div className="kpi-card bg-[var(--panel)] p-6 rounded-[var(--radius-lg)] border border-[var(--line)] shadow-sm">
          <div>
            <span className="text-sm font-medium text-[var(--muted)]">Unter Meldebestand</span>
            <strong className="text-3xl font-bold text-rose-600 dark:text-rose-400 mt-2 block">
              {summaryQuery.data?.low_stock_count ?? "-"}
            </strong>
          </div>
        </div>
      </div>

      {/* Toolbar & Table Section */}
      <div className="bg-[var(--panel)] rounded-[var(--radius-lg)] border border-[var(--line)] shadow-sm overflow-hidden">
        <div className="products-toolbar p-4 border-b border-[var(--line)] flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
            <input
              className="input inventory-toolbar-search-input w-full h-10 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="Suche nach Artikelnummer oder Name"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              data-testid="inventory-search-input"
            />
          </div>
          <div className="flex gap-2">
            <button
              className="btn h-10 px-6 rounded-[var(--radius-sm)] bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors flex items-center gap-2 shadow-sm"
              onClick={() => {
                setSearch(searchInput.trim());
                setPage(1);
              }}
              data-testid="inventory-search-btn"
            >
              <Search className="w-4 h-4" />
              Suchen
            </button>
            <div className="relative min-w-[200px]">
              <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
              <select
                className="input inventory-toolbar-warehouse-select w-full h-10 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer transition-all"
                value={warehouseFilter}
                onChange={(event) => {
                  setWarehouseFilter(event.target.value);
                  setPage(1);
                }}
                data-testid="inventory-warehouse-filter"
              >
                <option value="">Alle Lager</option>
                {(warehousesQuery.data ?? []).map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} - {warehouse.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>
        </div>

        <div className="table-wrap overflow-x-auto">
          <table className="products-table w-full text-left" data-testid="inventory-table">
            <thead className="bg-[var(--panel-soft)] border-b border-[var(--line)]">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Artikelnr.</th>
                <th className="px-6 py-4 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Bezeichnung</th>
                <th className="px-6 py-4 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider text-right">Gesamt</th>
                <th className="px-6 py-4 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider text-right">Reserviert</th>
                <th className="px-6 py-4 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider text-right">Verfügbar</th>
                <th className="px-6 py-4 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Einheit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {rows.map((row) => (
                <tr
                  key={row.product_id}
                  data-testid={`inventory-row-${row.product_id}`}
                  className="inventory-row-clickable hover:bg-[var(--panel-soft)] transition-colors cursor-pointer group"
                  onClick={() => setSelectedProduct(row)}
                >
                  <td className="px-6 py-4 text-sm font-medium text-[var(--ink)] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" data-label="Artikelnr.">{row.product_number}</td>
                  <td className="px-6 py-4 text-sm text-[var(--muted)]" data-label="Bezeichnung">{row.product_name}</td>
                  <td className="px-6 py-4 text-sm font-medium text-[var(--ink)] text-right" data-label="Gesamt">{row.total_quantity}</td>
                  <td className="px-6 py-4 text-sm text-amber-600 dark:text-amber-400 text-right" data-label="Reserviert">{row.reserved_quantity}</td>
                  <td className="px-6 py-4 text-sm font-bold text-emerald-600 dark:text-emerald-400 text-right" data-label="Verfügbar">{row.available_quantity}</td>
                  <td className="px-6 py-4 text-sm text-[var(--muted)]" data-label="Einheit">{row.unit}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[var(--muted)]">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="w-8 h-8 opacity-20" />
                      <p>Keine Artikel gefunden.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="pagination p-4 border-t border-[var(--line)] flex items-center justify-between bg-[var(--panel-soft)]">
          <span className="text-sm text-[var(--muted)]">
            Seite <span className="font-medium text-[var(--ink)]">{page}</span> / {totalPages} ({total} Einträge)
          </span>
          <div className="pagination-actions flex gap-2">
            <button
              className="btn h-9 px-3 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] hover:bg-[var(--panel-soft)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors text-sm"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
              Zurück
            </button>
            <button
              className="btn h-9 px-3 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] hover:bg-[var(--panel-soft)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors text-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Weiter
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </footer>
      </div>

      {/* Info Panels */}
      <div className="two-col-grid grid grid-cols-1 lg:grid-cols-2 gap-6">
        <article className="subpanel bg-[var(--panel)] rounded-[var(--radius-lg)] border border-[var(--line)] shadow-sm p-5 h-full">
          <h3 className="section-title mb-4">Niedrige Bestände</h3>
          <div className="list-stack small space-y-2 max-h-[300px] overflow-y-auto pr-2">
            {(lowStockQuery.data ?? []).map((item) => (
              <div
                key={`${item.product_id}-${item.warehouse_id}`}
                className="list-item static-item p-3 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel-soft)] hover:border-rose-200 dark:hover:border-rose-800 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <strong className="text-sm font-semibold text-[var(--ink)]">{item.product_number}</strong>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300">
                    Kritisch
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-[var(--muted)]">
                  <MapPin className="w-3 h-3" />
                  <span>{item.warehouse_code}</span>
                  <span className="text-[var(--line)]">|</span>
                  <span className="font-medium text-rose-600 dark:text-rose-400">
                    {item.on_hand} / {item.threshold}
                  </span>
                </div>
              </div>
            ))}
            {lowStockQuery.data?.length === 0 ? (
              <p className="text-sm text-[var(--muted)] text-center py-4">Keine kritischen Bestände.</p>
            ) : null}
          </div>
        </article>

        <article className="subpanel bg-[var(--panel)] rounded-[var(--radius-lg)] border border-[var(--line)] shadow-sm p-5 h-full">
          <h3 className="section-title mb-4">Letzte Bewegungen</h3>
          <div className="list-stack small space-y-2 max-h-[300px] overflow-y-auto pr-2">
            {(movementsQuery.data ?? []).map((movement) => (
              <div
                key={movement.id}
                className="list-item static-item p-3 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel-soft)] hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <strong className="text-sm font-semibold text-[var(--ink)]">{movement.product_number}</strong>
                  <span className="text-xs text-[var(--muted)]">{new Date().toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs">
                  <span className={`font-medium ${Number(movement.quantity) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {movement.movement_type} {Number(movement.quantity) > 0 ? '+' : ''}{movement.quantity}
                  </span>
                  <span className="text-[var(--line)]">|</span>
                  <span className="text-[var(--muted)] flex items-center gap-1 whitespace-nowrap">
                    <span>{movement.from_bin_code ?? "-"}</span>
                    <ArrowRightLeft className="w-3 h-3 shrink-0" />
                    <span>{movement.to_bin_code ?? "-"}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      {/* Detail Modal */}
      {selectedProduct ? (
        <div className="modal-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedProduct(null)}>
          <div
            className="modal-card bg-[var(--panel)] rounded-[var(--radius-lg)] shadow-2xl border border-[var(--line)] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
            data-testid="inventory-detail-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-header p-6 border-b border-[var(--line)] flex items-start justify-between bg-[var(--panel-soft)]">
              <div>
                <h3 className="text-xl font-bold text-[var(--ink)] flex items-center gap-2">
                  <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  {selectedProduct.product_number}
                </h3>
                <p className="panel-subtitle text-[var(--muted)] mt-1">{selectedProduct.product_name}</p>
              </div>
              <button
                className="btn p-2 rounded-lg hover:bg-[var(--panel-strong)] transition-colors text-[var(--muted)]"
                onClick={() => setSelectedProduct(null)}
                aria-label="Schließen"
              >
                <X className="w-5 h-5" />
                <span className="sr-only">Schließen</span>
              </button>
            </div>

            <div className="overflow-y-auto p-6">
              <div className="two-col-grid grid grid-cols-1 md:grid-cols-2 gap-6">
                <article className="subpanel space-y-4">
                  <div className="flex items-center gap-2 border-b border-[var(--line)] pb-2">
                    <Layers className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <h4 className="font-semibold text-[var(--ink)]">Bestand pro Lagerplatz</h4>
                  </div>
                  <div className="list-stack small space-y-2">
                    {(detailStockQuery.data ?? []).map((item) => (
                      <div key={item.inventory_id} className="list-item static-item p-3 rounded-[var(--radius-sm)] bg-[var(--panel-soft)] border border-[var(--line)]">
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="w-4 h-4 text-[var(--muted)]" />
                          <strong className="text-sm text-[var(--ink)]">
                            {item.warehouse_code} / {item.zone_code} / {item.bin_code}
                          </strong>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                          <div className="bg-[var(--panel)] p-2 rounded border border-[var(--line)] text-center">
                            <span className="block text-[var(--muted)] text-[10px] uppercase">Menge</span>
                            <span className="font-semibold text-[var(--ink)]">{item.quantity}</span>
                          </div>
                          <div className="bg-[var(--panel)] p-2 rounded border border-[var(--line)] text-center">
                            <span className="block text-amber-500 dark:text-amber-400 text-[10px] uppercase">Reserviert</span>
                            <span className="font-semibold text-amber-600 dark:text-amber-400">{item.reserved_quantity}</span>
                          </div>
                          <div className="bg-[var(--panel)] p-2 rounded border border-[var(--line)] text-center">
                            <span className="block text-emerald-500 dark:text-emerald-400 text-[10px] uppercase">Verfügbar</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{item.available_quantity}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {!detailStockQuery.isLoading && (detailStockQuery.data?.length ?? 0) === 0 ? (
                      <p className="text-sm text-[var(--muted)] italic">Kein Bestand vorhanden.</p>
                    ) : null}
                  </div>
                </article>

                <article className="subpanel space-y-4">
                  <div className="flex items-center gap-2 border-b border-[var(--line)] pb-2">
                    <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h4 className="font-semibold text-[var(--ink)]">Letzte 10 Bewegungen</h4>
                  </div>
                  <div className="list-stack small space-y-2">
                    {(detailMovementsQuery.data ?? []).map((movement) => (
                      <div key={movement.id} className="list-item static-item p-3 rounded-[var(--radius-sm)] bg-[var(--panel-soft)] border border-[var(--line)]">
                        <strong className="text-xs font-mono text-[var(--muted)] block mb-1">
                          {movement.reference_number ?? "-"}
                        </strong>
                        <div className="flex justify-between items-center text-sm">
                          <span className="font-medium text-[var(--ink)]">{movement.movement_type}</span>
                          <span className={`font-bold ${Number(movement.quantity) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {Number(movement.quantity) > 0 ? '+' : ''}{movement.quantity}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-[var(--muted)]">
                           <span className="inline-flex items-center gap-2 whitespace-nowrap">
                             <span>{movement.from_bin_code ?? "-"}</span>
                             <ArrowRightLeft className="w-3 h-3 shrink-0" />
                             <span>{movement.to_bin_code ?? "-"}</span>
                           </span>
                        </div>
                      </div>
                    ))}
                    {!detailMovementsQuery.isLoading && (detailMovementsQuery.data?.length ?? 0) === 0 ? (
                      <p className="text-sm text-[var(--muted)] italic">Keine Bewegungen vorhanden.</p>
                    ) : null}
                  </div>
                </article>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
