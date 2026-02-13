import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { deleteProduct, fetchProductGroups, fetchProducts } from "../services/productsApi";
import { useAuthStore } from "../stores/authStore";
import type { ProductStatus } from "../types";

const productStatuses: ProductStatus[] = ["active", "blocked", "deprecated", "archived"];

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.roles.includes("admin") ?? false;

  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | ProductStatus>("");
  const [groupFilter, setGroupFilter] = useState<string>("");

  const groupIdNumber = groupFilter ? Number(groupFilter) : undefined;

  const productsQuery = useQuery({
    queryKey: ["products", page, pageSize, search, statusFilter, groupIdNumber],
    queryFn: () =>
      fetchProducts({
        page,
        pageSize,
        search: search || undefined,
        status: statusFilter || undefined,
        groupId: groupIdNumber,
      }),
  });

  const groupsQuery = useQuery({
    queryKey: ["product-groups"],
    queryFn: fetchProductGroups,
  });

  const deleteProductMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  const total = productsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const productRows = useMemo(() => productsQuery.data?.items ?? [], [productsQuery.data]);

  return (
    <section className="panel" data-testid="products-page">
      <header className="panel-header">
        <div>
          <h2>Artikelstamm</h2>
          <p className="panel-subtitle">Produkte suchen, filtern und verwalten.</p>
        </div>
        {isAdmin ? (
          <Link className="btn btn-primary" to="/products/new" data-testid="products-create-btn">
            Neuer Artikel
          </Link>
        ) : null}
      </header>

      <div className="products-toolbar">
        <input
          className="input"
          placeholder="Suche nach Nummer, Name, Beschreibung"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          data-testid="products-search-input"
        />
        <button
          className="btn"
          onClick={() => {
            setSearch(searchInput.trim());
            setPage(1);
          }}
          data-testid="products-search-btn"
        >
          Suchen
        </button>
        <select
          className="input"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value as "" | ProductStatus);
            setPage(1);
          }}
          data-testid="products-status-filter"
        >
          <option value="">Alle Status</option>
          {productStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={groupFilter}
          onChange={(event) => {
            setGroupFilter(event.target.value);
            setPage(1);
          }}
          data-testid="products-group-filter"
        >
          <option value="">Alle Gruppen</option>
          {(groupsQuery.data ?? []).map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </div>

      {productsQuery.isLoading ? <p>Lade Artikel...</p> : null}
      {productsQuery.isError ? <p className="error">Fehler beim Laden der Artikel.</p> : null}

      {!productsQuery.isLoading && !productsQuery.isError ? (
        <>
          <div className="table-wrap">
            <table className="products-table" data-testid="products-table">
              <thead>
                <tr>
                  <th>Artikelnr.</th>
                  <th>Bezeichnung</th>
                  <th>Gruppe</th>
                  <th>Einheit</th>
                  <th>Status</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {productRows.map((product) => (
                  <tr key={product.id} data-testid={`products-row-${product.id}`}>
                    <td>{product.product_number}</td>
                    <td>{product.name}</td>
                    <td>{product.group_name ?? "-"}</td>
                    <td>{product.unit}</td>
                    <td>
                      <span className={`status status-${product.status}`}>{product.status}</span>
                    </td>
                    <td className="actions-cell">
                      <Link className="btn" to={`/products/${product.id}`}>
                        Details
                      </Link>
                      <Link className="btn" to={`/products/${product.id}/edit`}>
                        Bearbeiten
                      </Link>
                      <button
                        className="btn"
                        onClick={() => void deleteProductMutation.mutateAsync(product.id)}
                        disabled={!isAdmin || deleteProductMutation.isPending}
                      >
                        Löschen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="pagination">
            <span>
              Seite {page} / {totalPages} ({total} Artikel)
            </span>
            <div className="pagination-actions">
              <button className="btn" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                Zurück
              </button>
              <button
                className="btn"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Weiter
              </button>
            </div>
          </footer>
        </>
      ) : null}
    </section>
  );
}
