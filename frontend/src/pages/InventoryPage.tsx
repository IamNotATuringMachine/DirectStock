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
          <h2 className="page-title text-2xl font-bold text-zinc-900 dark:text-zinc-100">Bestandsübersicht</h2>
          <p className="section-subtitle mt-1 text-zinc-500 dark:text-zinc-400">
            Aggregierter Bestand, Warnungen und letzte Bewegungen in Echtzeit.
          </p>
        </div>
      </header>

      {/* KPI Grid */}
      <div className="kpi-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          className="kpi-card bg-white dark:bg-zinc-800 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm"
          data-testid="inventory-kpi-card"
        >
          <div>
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Produkte mit Bestand</span>
            <strong className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mt-2 block">
              {summaryQuery.data?.total_products_with_stock ?? "-"}
            </strong>
          </div>
        </div>

        <div
          className="kpi-card bg-white dark:bg-zinc-800 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm"
          data-testid="inventory-kpi-card"
        >
          <div>
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Gesamtbestand</span>
            <strong className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mt-2 block">
              {summaryQuery.data?.total_quantity ?? "-"}
            </strong>
          </div>
        </div>

        <div
          className="kpi-card bg-white dark:bg-zinc-800 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm"
          data-testid="inventory-kpi-card"
        >
          <div>
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Reserviert</span>
            <strong className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mt-2 block">
              {summaryQuery.data?.reserved_quantity ?? "-"}
            </strong>
          </div>
        </div>

        <div
          className="kpi-card bg-white dark:bg-zinc-800 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm"
          data-testid="inventory-kpi-card"
        >
          <div>
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Unter Meldebestand</span>
            <strong className="text-3xl font-bold text-rose-600 dark:text-rose-400 mt-2 block">
              {summaryQuery.data?.low_stock_count ?? "-"}
            </strong>
          </div>
        </div>
      </div>

      {/* Toolbar & Table Section */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden">
        <div className="products-toolbar p-4 border-b border-zinc-200 dark:border-zinc-700 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              className="input inventory-toolbar-search-input w-full h-10 pl-10 pr-4 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-zinc-400"
              placeholder="Suche nach Artikelnummer oder Name"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              data-testid="inventory-search-input"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              className="btn h-10 px-6 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors flex items-center justify-center gap-2 shadow-sm w-full sm:w-auto"
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
              <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <select
                className="input inventory-toolbar-warehouse-select w-full h-10 pl-10 pr-8 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer transition-all"
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
                <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>
        </div>

        <div className="table-wrap overflow-x-auto">
          <table className="products-table w-full text-left" data-testid="inventory-table">
            <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-700">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Artikelnr.</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Bezeichnung</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-right">Gesamt</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-right">Reserviert</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-right">Verfügbar</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Einheit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {rows.map((row) => (
                <tr
                  key={row.product_id}
                  data-testid={`inventory-row-${row.product_id}`}
                  className="inventory-row-clickable hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer group"
                  onClick={() => setSelectedProduct(row)}
                >
                  <td className="px-6 py-4 text-sm font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" data-label="Artikelnr.">{row.product_number}</td>
                  <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400" data-label="Bezeichnung">{row.product_name}</td>
                  <td className="px-6 py-4 text-sm font-medium text-zinc-900 dark:text-zinc-100 text-right" data-label="Gesamt">{row.total_quantity}</td>
                  <td className="px-6 py-4 text-sm text-amber-600 dark:text-amber-400 text-right" data-label="Reserviert">{row.reserved_quantity}</td>
                  <td className="px-6 py-4 text-sm font-bold text-emerald-600 dark:text-emerald-400 text-right" data-label="Verfügbar">{row.available_quantity}</td>
                  <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400" data-label="Einheit">{row.unit}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 dark:text-zinc-400">
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

        <footer className="pagination p-4 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            Seite <span className="font-medium text-zinc-900 dark:text-zinc-100">{page}</span> / {totalPages} ({total} Einträge)
          </span>
          <div className="pagination-actions flex gap-2">
            <button
              className="btn h-9 px-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors text-sm"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
              Zurück
            </button>
            <button
              className="btn h-9 px-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors text-sm"
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
        <article className="subpanel bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm p-5 h-full">
          <h3 className="section-title text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Niedrige Bestände</h3>
          <div className="list-stack small space-y-2 max-h-[300px] overflow-y-auto pr-2">
            {(lowStockQuery.data ?? []).map((item) => (
              <div
                key={`${item.product_id}-${item.warehouse_id}`}
                className="list-item static-item p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/30 hover:border-rose-200 dark:hover:border-rose-800 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <strong className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.product_number}</strong>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300">
                    Kritisch
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  <MapPin className="w-3 h-3" />
                  <span>{item.warehouse_code}</span>
                  <span className="text-zinc-300 dark:text-zinc-700">|</span>
                  <span className="font-medium text-rose-600 dark:text-rose-400">
                    {item.on_hand} / {item.threshold}
                  </span>
                </div>
              </div>
            ))}
            {lowStockQuery.data?.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">Keine kritischen Bestände.</p>
            ) : null}
          </div>
        </article>

        <article className="subpanel bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm p-5 h-full">
          <h3 className="section-title text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Letzte Bewegungen</h3>
          <div className="list-stack small space-y-2 max-h-[300px] overflow-y-auto pr-2">
            {(movementsQuery.data ?? []).map((movement) => (
              <div
                key={movement.id}
                className="list-item static-item p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/30 hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <strong className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{movement.product_number}</strong>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{new Date().toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs">
                  <span className={`font-medium ${Number(movement.quantity) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {movement.movement_type} {Number(movement.quantity) > 0 ? '+' : ''}{movement.quantity}
                  </span>
                  <span className="text-zinc-300 dark:text-zinc-700">|</span>
                  <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1 whitespace-nowrap">
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
            className="modal-card bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
            data-testid="inventory-detail-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-header p-6 border-b border-zinc-200 dark:border-zinc-700 flex items-start justify-between bg-zinc-50 dark:bg-zinc-900/50">
              <div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  {selectedProduct.product_number}
                </h3>
                <p className="panel-subtitle text-zinc-500 dark:text-zinc-400 mt-1">{selectedProduct.product_name}</p>
              </div>
              <button
                className="btn p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-zinc-500 dark:text-zinc-400"
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
                  <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-700 pb-2">
                    <Layers className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Bestand pro Lagerplatz</h4>
                  </div>
                  <div className="list-stack small space-y-2">
                    {(detailStockQuery.data ?? []).map((item) => (
                      <div key={item.inventory_id} className="list-item static-item p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-700">
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                          <strong className="text-sm text-zinc-900 dark:text-zinc-100">
                            {item.warehouse_code} / {item.zone_code} / {item.bin_code}
                          </strong>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                          <div className="bg-white dark:bg-zinc-800 p-2 rounded border border-zinc-200 dark:border-zinc-700 text-center">
                            <span className="block text-zinc-500 dark:text-zinc-400 text-[10px] uppercase">Menge</span>
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{item.quantity}</span>
                          </div>
                          <div className="bg-white dark:bg-zinc-800 p-2 rounded border border-zinc-200 dark:border-zinc-700 text-center">
                            <span className="block text-amber-500 dark:text-amber-400 text-[10px] uppercase">Reserviert</span>
                            <span className="font-semibold text-amber-600 dark:text-amber-400">{item.reserved_quantity}</span>
                          </div>
                          <div className="bg-white dark:bg-zinc-800 p-2 rounded border border-zinc-200 dark:border-zinc-700 text-center">
                            <span className="block text-emerald-500 dark:text-emerald-400 text-[10px] uppercase">Verfügbar</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{item.available_quantity}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {!detailStockQuery.isLoading && (detailStockQuery.data?.length ?? 0) === 0 ? (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 italic">Kein Bestand vorhanden.</p>
                    ) : null}
                  </div>
                </article>

                <article className="subpanel space-y-4">
                  <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-700 pb-2">
                    <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Letzte 10 Bewegungen</h4>
                  </div>
                  <div className="list-stack small space-y-2">
                    {(detailMovementsQuery.data ?? []).map((movement) => (
                      <div key={movement.id} className="list-item static-item p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-700">
                        <strong className="text-xs font-mono text-zinc-500 dark:text-zinc-400 block mb-1">
                          {movement.reference_number ?? "-"}
                        </strong>
                        <div className="flex justify-between items-center text-sm">
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">{movement.movement_type}</span>
                          <span className={`font-bold ${Number(movement.quantity) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {Number(movement.quantity) > 0 ? '+' : ''}{movement.quantity}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          <span className="inline-flex items-center gap-2 whitespace-nowrap">
                            <span>{movement.from_bin_code ?? "-"}</span>
                            <ArrowRightLeft className="w-3 h-3 shrink-0" />
                            <span>{movement.to_bin_code ?? "-"}</span>
                          </span>
                        </div>
                      </div>
                    ))}
                    {!detailMovementsQuery.isLoading && (detailMovementsQuery.data?.length ?? 0) === 0 ? (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 italic">Keine Bewegungen vorhanden.</p>
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
