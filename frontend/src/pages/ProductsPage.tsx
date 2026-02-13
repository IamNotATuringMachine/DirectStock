import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createProduct,
  createProductGroup,
  deleteProduct,
  fetchProductGroups,
  fetchProducts,
  updateProduct,
} from "../services/productsApi";
import { useAuthStore } from "../stores/authStore";
import type { Product, ProductStatus } from "../types";

type ProductFormState = {
  productNumber: string;
  name: string;
  description: string;
  groupId: string;
  unit: string;
  status: ProductStatus;
};

const productStatuses: ProductStatus[] = ["active", "blocked", "deprecated", "archived"];

function emptyProductForm(): ProductFormState {
  return {
    productNumber: "",
    name: "",
    description: "",
    groupId: "",
    unit: "piece",
    status: "active",
  };
}

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

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm());

  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");

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

  const createProductMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      setDialogOpen(false);
      setProductForm(emptyProductForm());
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ productId, payload }: { productId: number; payload: Parameters<typeof updateProduct>[1] }) =>
      updateProduct(productId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      setDialogOpen(false);
      setEditingProduct(null);
      setProductForm(emptyProductForm());
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: createProductGroup,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["product-groups"] });
      setNewGroupName("");
      setNewGroupDescription("");
    },
  });

  const total = productsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const productRows = useMemo(() => productsQuery.data?.items ?? [], [productsQuery.data]);

  const openCreateDialog = () => {
    setEditingProduct(null);
    setProductForm(emptyProductForm());
    setDialogOpen(true);
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      productNumber: product.product_number,
      name: product.name,
      description: product.description ?? "",
      groupId: product.product_group_id ? String(product.product_group_id) : "",
      unit: product.unit,
      status: product.status,
    });
    setDialogOpen(true);
  };

  const handleProductSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (editingProduct) {
      await updateProductMutation.mutateAsync({
        productId: editingProduct.id,
        payload: {
          name: productForm.name,
          description: productForm.description || null,
          product_group_id: productForm.groupId ? Number(productForm.groupId) : null,
          unit: productForm.unit,
          status: productForm.status,
        },
      });
      return;
    }

    await createProductMutation.mutateAsync({
      product_number: productForm.productNumber,
      name: productForm.name,
      description: productForm.description || null,
      product_group_id: productForm.groupId ? Number(productForm.groupId) : null,
      unit: productForm.unit,
      status: productForm.status,
    });
  };

  const handleCreateGroup = async (event: FormEvent) => {
    event.preventDefault();
    if (!newGroupName.trim()) {
      return;
    }
    await createGroupMutation.mutateAsync({
      name: newGroupName.trim(),
      description: newGroupDescription.trim() || null,
    });
  };

  return (
    <section className="panel" data-testid="products-page">
      <header className="panel-header">
        <div>
          <h2>Artikelstamm</h2>
          <p className="panel-subtitle">Produkte suchen, filtern und verwalten.</p>
        </div>
        {isAdmin ? (
          <button className="btn btn-primary" onClick={openCreateDialog} data-testid="products-create-btn">
            Neuer Artikel
          </button>
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

      {isAdmin ? (
        <form className="inline-form" onSubmit={handleCreateGroup}>
          <input
            className="input"
            placeholder="Neue Gruppe"
            value={newGroupName}
            onChange={(event) => setNewGroupName(event.target.value)}
          />
          <input
            className="input"
            placeholder="Beschreibung (optional)"
            value={newGroupDescription}
            onChange={(event) => setNewGroupDescription(event.target.value)}
          />
          <button className="btn" type="submit" disabled={createGroupMutation.isPending}>
            Gruppe anlegen
          </button>
        </form>
      ) : null}

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
                      <button className="btn" onClick={() => openEditDialog(product)} disabled={!isAdmin}>
                        Bearbeiten
                      </button>
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

      {dialogOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h3>{editingProduct ? "Artikel bearbeiten" : "Neuer Artikel"}</h3>
            <form className="form-grid" onSubmit={(event) => void handleProductSubmit(event)}>
              <label>
                Artikelnummer
                <input
                  className="input"
                  value={productForm.productNumber}
                  onChange={(event) => setProductForm((prev) => ({ ...prev, productNumber: event.target.value }))}
                  disabled={Boolean(editingProduct)}
                  required
                />
              </label>

              <label>
                Bezeichnung
                <input
                  className="input"
                  value={productForm.name}
                  onChange={(event) => setProductForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </label>

              <label>
                Beschreibung
                <textarea
                  className="input textarea"
                  value={productForm.description}
                  onChange={(event) => setProductForm((prev) => ({ ...prev, description: event.target.value }))}
                />
              </label>

              <label>
                Gruppe
                <select
                  className="input"
                  value={productForm.groupId}
                  onChange={(event) => setProductForm((prev) => ({ ...prev, groupId: event.target.value }))}
                >
                  <option value="">Keine</option>
                  {(groupsQuery.data ?? []).map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="split-grid">
                <label>
                  Einheit
                  <input
                    className="input"
                    value={productForm.unit}
                    onChange={(event) => setProductForm((prev) => ({ ...prev, unit: event.target.value }))}
                    required
                  />
                </label>
                <label>
                  Status
                  <select
                    className="input"
                    value={productForm.status}
                    onChange={(event) =>
                      setProductForm((prev) => ({ ...prev, status: event.target.value as ProductStatus }))
                    }
                  >
                    {productStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setDialogOpen(false)}>
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createProductMutation.isPending || updateProductMutation.isPending}
                >
                  {editingProduct ? "Speichern" : "Anlegen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
