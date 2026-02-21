import { ArrowLeft, Box, Layers, Activity, MapPin, Package, Edit, Calendar, Tag } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "../../components/Skeleton";
import { type useProductDetail } from "./useProductDetail";

type ProductDetailViewProps = ReturnType<typeof useProductDetail>;

export function ProductDetailView({
  productId,
  canReadPricing,
  productQuery,
  inventoryQuery,
  movementsQuery,
  resolvedPriceQuery,
  metrics,
}: ProductDetailViewProps) {
  if (!Number.isFinite(productId)) {
    return (
      <section className="page">
        <div className="panel border-red-200 bg-red-50 text-red-700 p-4 rounded-lg">
          Ungültige Produkt-ID.
        </div>
      </section>
    );
  }

  const isLoading = productQuery.isLoading;
  const isError = productQuery.isError;
  const product = productQuery.data;

  return (
    <section className="page" data-testid="product-detail-page">
      <div className="space-y-8 max-w-[1600px] mx-auto">
        {/* Header */}
        <header className="panel-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-[var(--muted)] mb-2">
              <Link to="/products" className="hover:text-[var(--accent)] transition-colors flex items-center gap-1">
                <Package size={14} />
                Produkte
              </Link>
              <span>/</span>
              <span>Details</span>
            </div>
            <h2 className="page-title flex items-center gap-2">
              {isLoading ? <Skeleton className="h-8 w-64" /> : product?.name || "Unbekanntes Produkt"}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <Link className="btn btn-secondary" to="/products">
              <ArrowLeft size={16} />
              Zurück
            </Link>
            <Link className="btn btn-primary" to={`/products/${productId}/edit`}>
              <Edit size={16} />
              Bearbeiten
            </Link>
          </div>
        </header>

        {isError && (
          <div className="panel border-red-200 bg-red-50 text-red-700 p-4 rounded-lg">
            Fehler beim Laden der Produktdaten.
          </div>
        )}

        {product && (
          <div className="grid gap-6">
            {/* KPI Cards */}
            <section className="kpi-grid grid grid-cols-1 md:grid-cols-3 gap-6">
              <article className="kpi-card">
                <span className="flex items-center gap-2 text-sm text-[var(--muted)] mb-2">
                  <Layers size={14} />
                  Gesamtbestand
                </span>
                <strong className="text-2xl">
                  {metrics.totalStock} <span className="text-base font-normal text-[var(--muted)]">{product.unit}</span>
                </strong>
              </article>
              <article className="kpi-card">
                <span className="flex items-center gap-2 text-sm text-green-600 mb-2">
                  <Box size={14} />
                  Verfügbar
                </span>
                <strong className="text-2xl text-green-700">
                  {metrics.availableStock} <span className="text-base font-normal text-[var(--muted)]">{product.unit}</span>
                </strong>
              </article>
              <article className="kpi-card">
                <span className="flex items-center gap-2 text-sm text-orange-600 mb-2">
                  <Tag size={14} />
                  Reserviert
                </span>
                <strong className="text-2xl text-orange-700">
                  {metrics.reservedStock} <span className="text-base font-normal text-[var(--muted)]">{product.unit}</span>
                </strong>
              </article>
            </section>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Main Info Column */}
              <div className="lg:col-span-1 space-y-6">
                <section className="panel">
                  <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <Package size={18} className="text-[var(--accent)]" />
                    Stammdaten
                  </h3>
                  <div className="space-y-6">
                    <div>
                      <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Artikelnummer</span>
                      <div className="font-mono bg-[var(--code-bg)] px-2.5 py-1 rounded text-sm inline-block border border-[var(--line)]">
                        {product.product_number}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Beschreibung</span>
                      <p className="text-sm leading-relaxed text-[var(--ink)]">
                        {product.description || <span className="text-[var(--muted)] italic">Keine Beschreibung</span>}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Gruppe</span>
                        <div className="flex items-center gap-1.5 text-sm">
                          <Layers size={14} className="text-[var(--muted)]" />
                          {product.group_name || "-"}
                        </div>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Status</span>
                        <span className={`status inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${product.status === 'active' ? 'status-active' : 'status-inactive'}`}>
                          {product.status}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Einzelteilverfolgung</span>
                      <span className={`status inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${product.requires_item_tracking ? "status-active" : "status-inactive"}`}>
                        {product.requires_item_tracking ? "Seriennummernpflicht" : "Nicht erforderlich"}
                      </span>
                    </div>
                    {canReadPricing && (
                      <div data-testid="product-detail-price-summary">
                        <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider block mb-1.5">Preis (aktuell)</span>
                        {resolvedPriceQuery.isLoading ? (
                          <Skeleton className="h-12 w-full" />
                        ) : resolvedPriceQuery.data?.source === "none" || !resolvedPriceQuery.data ? (
                          <p className="text-sm text-[var(--muted)] italic">Kein Preis hinterlegt</p>
                        ) : (
                          <div className="text-sm space-y-1 bg-[var(--panel-soft)] p-3 rounded-lg border border-[var(--line)]">
                            <div className="flex justify-between">
                              <span className="text-[var(--muted)]">Netto:</span>
                              <span><span className="font-semibold">{resolvedPriceQuery.data.net_price ?? "-"}</span> {resolvedPriceQuery.data.currency ?? ""}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[var(--muted)]">USt:</span>
                              <span className="font-semibold">{resolvedPriceQuery.data.vat_rate ?? "-"}%</span>
                            </div>
                            <div className="flex justify-between pt-1 border-t border-[var(--line)] mt-1">
                              <span className="text-[var(--muted)]">Brutto:</span>
                              <span><span className="font-semibold">{resolvedPriceQuery.data.gross_price ?? "-"}</span> {resolvedPriceQuery.data.currency ?? ""}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="pt-4 mt-4 border-t border-[var(--line)] flex items-center gap-4 text-xs text-[var(--muted)]">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={14} />
                        Erstellt: {new Date(product.created_at).toLocaleDateString()}
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
                  <div className="table-wrap overflow-x-auto rounded-lg border border-[var(--line)]">
                    <table className="products-table w-full text-sm text-left">
                      <thead className="bg-[var(--panel-soft)] text-[var(--muted)] text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Lagerort (Zone / Platz)</th>
                          <th className="px-4 py-3 text-right">Gesamt</th>
                          <th className="px-4 py-3 text-right">Reserviert</th>
                          <th className="px-4 py-3 text-right">Verfügbar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--line)]">
                        {inventoryQuery.isLoading ? (
                          <tr>
                            <td colSpan={4} className="p-4">
                              <Skeleton className="h-10 w-full" />
                            </td>
                          </tr>
                        ) : (inventoryQuery.data ?? []).length > 0 ? (
                          (inventoryQuery.data ?? []).map((item) => (
                            <tr key={item.inventory_id} className="hover:bg-[var(--panel-soft)] transition-colors">
                              <td className="px-4 py-3 font-medium">
                                <div className="flex items-center gap-2">
                                  <MapPin size={14} className="text-[var(--muted)]" />
                                  {item.warehouse_code}
                                  <span className="text-[var(--muted)]">/</span>
                                  {item.zone_code}
                                  <span className="text-[var(--muted)]">/</span>
                                  {item.bin_code}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-[var(--ink)]">{item.quantity}</td>
                              <td className="px-4 py-3 text-right font-mono text-orange-600">{item.reserved_quantity}</td>
                              <td className="px-4 py-3 text-right font-mono text-green-600 font-bold">{item.available_quantity}</td>
                            </tr>
                          ))
                        ) : (
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
                    <span className="text-xs font-medium text-[var(--muted)] bg-[var(--panel-soft)] px-2 py-1 rounded">
                      Max. 10 Einträge
                    </span>
                  </header>
                  <div className="space-y-3">
                    {movementsQuery.isLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                      </div>
                    ) : (movementsQuery.data ?? []).length > 0 ? (
                      (movementsQuery.data ?? []).map((movement) => (
                        <div key={movement.id} className="flex items-center justify-between p-4 rounded-lg border border-[var(--line)] bg-[var(--bg)] hover:border-[var(--accent)] transition-colors">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border
                                ${movement.movement_type === 'GOODS_RECEIPT' ? 'bg-green-50 text-green-700 border-green-200' : ''}
                                ${movement.movement_type === 'GOODS_ISSUE' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
                                ${movement.movement_type === 'STOCK_TRANSFER' ? 'bg-orange-50 text-orange-700 border-orange-200' : ''}
                              `}>
                                {movement.movement_type.replace('_', ' ')}
                              </span>
                              <span className="text-sm font-mono text-[var(--muted)]">{movement.reference_number || "-"}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                              <Calendar size={12} />
                              {new Date(movement.performed_at).toLocaleString()}
                              <span className="mx-1">•</span>
                              <MapPin size={12} />
                              {movement.from_bin_code ? String(movement.from_bin_code) : 'Ext'} → {movement.to_bin_code ? String(movement.to_bin_code) : 'Ext'}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className={`text-base font-bold font-mono ${Number(movement.quantity) > 0 ? 'text-green-600' : 'text-[var(--ink)]'}`}>
                                {Number(movement.quantity) > 0 ? '+' : ''}{movement.quantity}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-[var(--muted)]">
                        <Activity size={24} className="mx-auto mb-2 opacity-50" />
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
    </section>
  );
}
