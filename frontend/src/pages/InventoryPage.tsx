import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchInventory, fetchInventorySummary, fetchLowStock, fetchMovements } from "../services/inventoryApi";
import { fetchWarehouses } from "../services/warehousesApi";

export default function InventoryPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("");

  const warehouseId = warehouseFilter ? Number(warehouseFilter) : undefined;

  const summaryQuery = useQuery({ queryKey: ["inventory-summary"], queryFn: fetchInventorySummary, refetchInterval: 60000 });
  const warehousesQuery = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const inventoryQuery = useQuery({
    queryKey: ["inventory", page, pageSize, search, warehouseId],
    queryFn: () => fetchInventory({ page, pageSize, search: search || undefined, warehouseId }),
    refetchInterval: 30000,
  });
  const lowStockQuery = useQuery({ queryKey: ["inventory-low-stock"], queryFn: fetchLowStock, refetchInterval: 60000 });
  const movementsQuery = useQuery({ queryKey: ["inventory-movements"], queryFn: () => fetchMovements(12), refetchInterval: 60000 });

  const rows = useMemo(() => inventoryQuery.data?.items ?? [], [inventoryQuery.data]);
  const total = inventoryQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="panel" data-testid="inventory-page">
      <header className="panel-header">
        <div>
          <h2>Bestandsübersicht</h2>
          <p className="panel-subtitle">Aggregierter Bestand, Warnungen und letzte Bewegungen.</p>
        </div>
      </header>

      <div className="kpi-grid">
        <div className="kpi-card">
          <span>Produkte mit Bestand</span>
          <strong>{summaryQuery.data?.total_products_with_stock ?? "-"}</strong>
        </div>
        <div className="kpi-card">
          <span>Gesamtbestand</span>
          <strong>{summaryQuery.data?.total_quantity ?? "-"}</strong>
        </div>
        <div className="kpi-card">
          <span>Reserviert</span>
          <strong>{summaryQuery.data?.reserved_quantity ?? "-"}</strong>
        </div>
        <div className="kpi-card">
          <span>Unter Meldebestand</span>
          <strong>{summaryQuery.data?.low_stock_count ?? "-"}</strong>
        </div>
      </div>

      <div className="products-toolbar">
        <input
          className="input"
          placeholder="Suche nach Artikelnummer oder Name"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          data-testid="inventory-search-input"
        />
        <button
          className="btn"
          onClick={() => {
            setSearch(searchInput.trim());
            setPage(1);
          }}
          data-testid="inventory-search-btn"
        >
          Suchen
        </button>
        <select
          className="input"
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
      </div>

      <div className="table-wrap">
        <table className="products-table" data-testid="inventory-table">
          <thead>
            <tr>
              <th>Artikelnr.</th>
              <th>Bezeichnung</th>
              <th>Gesamt</th>
              <th>Reserviert</th>
              <th>Verfügbar</th>
              <th>Einheit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.product_id} data-testid={`inventory-row-${row.product_id}`}>
                <td>{row.product_number}</td>
                <td>{row.product_name}</td>
                <td>{row.total_quantity}</td>
                <td>{row.reserved_quantity}</td>
                <td>{row.available_quantity}</td>
                <td>{row.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="pagination">
        <span>
          Seite {page} / {totalPages} ({total} Einträge)
        </span>
        <div className="pagination-actions">
          <button className="btn" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
            Zurück
          </button>
          <button className="btn" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>
            Weiter
          </button>
        </div>
      </footer>

      <div className="two-col-grid">
        <article className="subpanel">
          <h3>Niedrige Bestände</h3>
          <div className="list-stack small">
            {(lowStockQuery.data ?? []).map((item) => (
              <div key={`${item.product_id}-${item.warehouse_id}`} className="list-item static-item">
                <strong>{item.product_number}</strong>
                <span>
                  {item.warehouse_code}: {item.on_hand} / Schwelle {item.threshold}
                </span>
              </div>
            ))}
            {lowStockQuery.data?.length === 0 ? <p>Keine kritischen Bestände.</p> : null}
          </div>
        </article>

        <article className="subpanel">
          <h3>Letzte Bewegungen</h3>
          <div className="list-stack small">
            {(movementsQuery.data ?? []).map((movement) => (
              <div key={movement.id} className="list-item static-item">
                <strong>{movement.product_number}</strong>
                <span>
                  {movement.movement_type} {movement.quantity} ({movement.from_bin_code ?? "-"} → {movement.to_bin_code ?? "-"})
                </span>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
