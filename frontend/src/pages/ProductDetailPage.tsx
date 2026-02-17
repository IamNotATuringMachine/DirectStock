import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Box,
  Layers,
  Activity,
  MapPin,
  Package,
  Edit,
  BarChart3,
  Calendar,
  Tag
} from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { fetchInventoryByProduct, fetchMovements } from "../services/inventoryApi";
import { fetchProductById } from "../services/productsApi";

export default function ProductDetailPage() {
  const { id } = useParams();
  const productId = Number(id);

  const productQuery = useQuery({
    queryKey: ["product", productId],
    queryFn: () => fetchProductById(productId),
    enabled: Number.isFinite(productId),
  });

  const inventoryQuery = useQuery({
    queryKey: ["inventory-by-product", productId],
    queryFn: () => fetchInventoryByProduct(productId),
    enabled: Number.isFinite(productId),
  });

  const movementsQuery = useQuery({
    queryKey: ["inventory-movements", "product", productId],
    queryFn: () => fetchMovements({ limit: 10, productId }),
    enabled: Number.isFinite(productId),
  });

  if (!Number.isFinite(productId)) {
    return (
      <div className="page">
        <div className="warning">Ungültige Produkt-ID.</div>
      </div>
    );
  }

  // Derived metrics
  const totalStock = inventoryQuery.data?.reduce((acc, item) => acc + Number(item.quantity), 0) ?? 0;
  const availableStock = inventoryQuery.data?.reduce((acc, item) => acc + Number(item.available_quantity), 0) ?? 0;
  const reservedStock = inventoryQuery.data?.reduce((acc, item) => acc + Number(item.reserved_quantity), 0) ?? 0;

  return (
    <div className="page" data-testid="product-detail-page">
      {/* Header */}
      <header className="panel-header">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <Link to="/products" className="hover:text-[var(--accent)] transition-colors flex items-center gap-1">
              <Package size={14} /> Produkte
            </Link>
            <span>/</span>
            <span>Details</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {productQuery.data?.name || "Lade Produkt..."}
          </h1>
        </div>
        <div className="actions-cell">
          <Link className="btn" to="/products">
            <ArrowLeft size={16} /> Zurück
          </Link>
          <Link className="btn btn-primary" to={`/products/${productId}/edit`}>
            <Edit size={16} /> Bearbeiten
          </Link>
        </div>
      </header>

      {/* Loading State */}
      {productQuery.isLoading && (
        <div className="panel flex items-center justify-center p-8 text-[var(--muted)]">
          <Activity className="animate-pulse mr-2" /> Lade Produktdaten...
        </div>
      )}

      {/* Error State */}
      {productQuery.isError && (
        <div className="panel border-red-200 bg-red-50 text-red-700 p-4 rounded-lg">
          Fehler beim Laden der Produktdaten.
        </div>
      )}

      {productQuery.data && (
        <div className="grid gap-6">
          {/* KPI Cards */}
          <section className="kpi-grid">
            <article className="kpi-card">
              <span className="flex items-center gap-2"><Layers size={14} /> Gesamtbestand</span>
              <strong>{totalStock} <span className="text-sm font-normal text-[var(--muted)]">{productQuery.data.unit}</span></strong>
            </article>
            <article className="kpi-card">
              <span className="flex items-center gap-2 text-green-600"><Box size={14} /> Verfügbar</span>
              <strong className="text-green-700">{availableStock} <span className="text-sm font-normal text-[var(--muted)]">{productQuery.data.unit}</span></strong>
            </article>
            <article className="kpi-card">
              <span className="flex items-center gap-2 text-orange-600"><Tag size={14} /> Reserviert</span>
              <strong className="text-orange-700">{reservedStock} <span className="text-sm font-normal text-[var(--muted)]">{productQuery.data.unit}</span></strong>
            </article>
          </section>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Info Column */}
            <div className="lg:col-span-1 space-y-6">
              <section className="panel">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Package size={18} className="text-[var(--accent)]" />
                  Stammdaten
                </h3>

                <div className="space-y-4">
                  <div>
                    <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider block mb-1">Artikelnummer</span>
                    <div className="font-mono bg-[var(--code-bg)] px-2 py-1 rounded text-sm inline-block">
                      {productQuery.data.product_number}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider block mb-1">Beschreibung</span>
                    <p className="text-sm leading-relaxed text-[var(--ink)]">
                      {productQuery.data.description || <span className="text-[var(--muted)] italic">Keine Beschreibung</span>}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider block mb-1">Gruppe</span>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Layers size={14} className="text-[var(--muted)]" />
                        {productQuery.data.group_name || "-"}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider block mb-1">Status</span>
                      <span className={`status inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border
                        ${productQuery.data.status === 'active' ? 'status-active' : 'status-inactive'}`}>
                        {productQuery.data.status}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider block mb-1">Einzelteilverfolgung</span>
                    <span className={`status inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${
                      productQuery.data.requires_item_tracking ? "status-active" : "status-inactive"
                    }`}>
                      {productQuery.data.requires_item_tracking ? "Seriennummernpflicht" : "Nicht erforderlich"}
                    </span>
                  </div>

                  <div className="pt-4 mt-4 border-t border-[var(--line)] flex items-center gap-4 text-xs text-[var(--muted)]">
                    <div className="flex items-center gap-1">
                      <Calendar size={12} /> Erstellt: {new Date(productQuery.data.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Data Columns */}
            <div className="lg:col-span-2 space-y-6">

              {/* Inventory Table */}
              <section className="panel" data-testid="product-detail-inventory">
                <header className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <MapPin size={18} className="text-[var(--accent)]" />
                    Lagerbestand
                  </h3>
                </header>

                <div className="table-wrap">
                  <table className="products-table">
                    <thead>
                      <tr>
                        <th className="text-left">Lagerort (Zone / Platz)</th>
                        <th className="text-right">Gesamt</th>
                        <th className="text-right">Reserviert</th>
                        <th className="text-right">Verfügbar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(inventoryQuery.data ?? []).map((item) => (
                        <tr key={item.inventory_id} className="hover:bg-[var(--panel-soft)] transition-colors">
                          <td className="font-medium">
                            <div className="flex items-center gap-2">
                              <MapPin size={14} className="text-[var(--muted)]" />
                              {item.warehouse_code} <span className="text-[var(--muted)]">/</span> {item.zone_code} <span className="text-[var(--muted)]">/</span> {item.bin_code}
                            </div>
                          </td>
                          <td className="text-right font-mono text-[var(--ink)]">{item.quantity}</td>
                          <td className="text-right font-mono text-orange-600">{item.reserved_quantity}</td>
                          <td className="text-right font-mono text-green-600 font-bold">{item.available_quantity}</td>
                        </tr>
                      ))}
                      {!inventoryQuery.isLoading && (inventoryQuery.data?.length ?? 0) === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center py-8 text-[var(--muted)]">
                            <Box size={24} className="mx-auto mb-2 opacity-50" />
                            Kein Bestand vorhanden.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Movements List */}
              <section className="panel" data-testid="product-detail-movements">
                <header className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Activity size={18} className="text-[var(--accent)]" />
                    Letzte Bewegungen
                  </h3>
                  <span className="text-xs text-[var(--muted)] bg-[var(--panel-strong)] px-2 py-1 rounded">
                    Max. 10 Einträge
                  </span>
                </header>

                <div className="space-y-2">
                  {(movementsQuery.data ?? []).map((movement) => (
                    <div key={movement.id} className="subpanel flex items-center justify-between p-3 hover:border-[var(--accent)] transition-colors">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide border
                            ${movement.movement_type === 'GOODS_RECEIPT' ? 'bg-green-50 text-green-700 border-green-200' : ''}
                            ${movement.movement_type === 'GOODS_ISSUE' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
                            ${movement.movement_type === 'STOCK_TRANSFER' ? 'bg-orange-50 text-orange-700 border-orange-200' : ''}
                          `}>
                            {movement.movement_type.replace('_', ' ')}
                          </span>
                          <span className="text-sm font-mono text-[var(--muted)]">{movement.reference_number || "-"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                          <span>{movement.from_bin_code || "Start"}</span>
                          <ArrowLeft size={12} className="rotate-180" />
                          <span>{movement.to_bin_code || "Ziel"}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold font-mono">
                          {Number(movement.quantity) > 0 ? '+' : ''}{movement.quantity}
                        </div>
                        <div className="text-xs text-[var(--muted)]">{productQuery.data?.unit}</div>
                      </div>
                    </div>
                  ))}

                  {!movementsQuery.isLoading && (movementsQuery.data?.length ?? 0) === 0 && (
                    <div className="text-center py-8 text-[var(--muted)] border border-dashed border-[var(--line-strong)] rounded-lg">
                      <BarChart3 size={24} className="mx-auto mb-2 opacity-50" />
                      Keine Bewegungen gefunden.
                    </div>
                  )}
                </div>
              </section>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
