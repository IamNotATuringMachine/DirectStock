import { useQuery } from "@tanstack/react-query";
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
    return <p className="error">Ungueltige Produkt-ID.</p>;
  }

  return (
    <section className="panel" data-testid="product-detail-page">
      <header className="panel-header">
        <div>
          <h2>Produktdetails</h2>
          <p className="panel-subtitle">Stammdaten, Bestand je Lagerplatz und letzte Bewegungen.</p>
        </div>
        <div className="actions-cell">
          <Link className="btn" to="/products">
            Zur Liste
          </Link>
          <Link className="btn" to={`/products/${productId}/edit`}>
            Bearbeiten
          </Link>
        </div>
      </header>

      {productQuery.isLoading ? <p>Lade Produkt...</p> : null}
      {productQuery.isError ? <p className="error">Fehler beim Laden der Produktdaten.</p> : null}

      {productQuery.data ? (
        <article className="subpanel">
          <h3>{productQuery.data.product_number}</h3>
          <p>
            <strong>{productQuery.data.name}</strong>
          </p>
          <p>{productQuery.data.description ?? "-"}</p>
          <p>
            Einheit: {productQuery.data.unit} | Status: {productQuery.data.status} | Gruppe: {productQuery.data.group_name ?? "-"}
          </p>
        </article>
      ) : null}

      <div className="two-col-grid">
        <article className="subpanel" data-testid="product-detail-inventory">
          <h3>Bestand je Lagerplatz</h3>
          <div className="list-stack small">
            {(inventoryQuery.data ?? []).map((item) => (
              <div key={item.inventory_id} className="list-item static-item">
                <strong>
                  {item.warehouse_code} / {item.zone_code} / {item.bin_code}
                </strong>
                <span>
                  Menge: {item.quantity} | Reserviert: {item.reserved_quantity} | Verfuegbar: {item.available_quantity}
                </span>
              </div>
            ))}
            {!inventoryQuery.isLoading && (inventoryQuery.data?.length ?? 0) === 0 ? <p>Kein Bestand vorhanden.</p> : null}
          </div>
        </article>

        <article className="subpanel" data-testid="product-detail-movements">
          <h3>Letzte 10 Bewegungen</h3>
          <div className="list-stack small">
            {(movementsQuery.data ?? []).map((movement) => (
              <div key={movement.id} className="list-item static-item">
                <strong>{movement.reference_number ?? "-"}</strong>
                <span>
                  {movement.movement_type} {movement.quantity} ({movement.from_bin_code ?? "-"} -&gt; {movement.to_bin_code ?? "-"})
                </span>
              </div>
            ))}
            {!movementsQuery.isLoading && (movementsQuery.data?.length ?? 0) === 0 ? <p>Keine Bewegungen.</p> : null}
          </div>
        </article>
      </div>
    </section>
  );
}
