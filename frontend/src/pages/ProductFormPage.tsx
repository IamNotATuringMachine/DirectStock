import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  createProduct,
  fetchProductById,
  fetchProductGroups,
  updateProduct,
} from "../services/productsApi";
import { useAuthStore } from "../stores/authStore";
import type { ProductStatus } from "../types";

type ProductFormState = {
  productNumber: string;
  name: string;
  description: string;
  groupId: string;
  unit: string;
  status: ProductStatus;
};

type ProductTab = "master" | "warehouse" | "suppliers";

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

export default function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.roles.includes("admin") ?? false;

  const productId = id ? Number(id) : null;
  const isEditMode = productId !== null;

  const [activeTab, setActiveTab] = useState<ProductTab>("master");
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm());

  const groupsQuery = useQuery({
    queryKey: ["product-groups"],
    queryFn: fetchProductGroups,
  });

  const productQuery = useQuery({
    queryKey: ["product", productId],
    queryFn: () => fetchProductById(productId as number),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (!productQuery.data) {
      return;
    }
    const product = productQuery.data;
    setProductForm({
      productNumber: product.product_number,
      name: product.name,
      description: product.description ?? "",
      groupId: product.product_group_id ? String(product.product_group_id) : "",
      unit: product.unit,
      status: product.status,
    });
  }, [productQuery.data]);

  const createProductMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["product", created.id] });
      navigate(`/products/${created.id}`);
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ productId: nextProductId, payload }: { productId: number; payload: Parameters<typeof updateProduct>[1] }) =>
      updateProduct(nextProductId, payload),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["product", updated.id] });
      navigate(`/products/${updated.id}`);
    },
  });

  const pending = createProductMutation.isPending || updateProductMutation.isPending;

  const title = useMemo(
    () => (isEditMode ? `Artikel bearbeiten #${productId}` : "Neuer Artikel"),
    [isEditMode, productId]
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!isAdmin) {
      return;
    }

    if (isEditMode) {
      await updateProductMutation.mutateAsync({
        productId: productId as number,
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

  return (
    <section className="panel" data-testid="product-form-page">
      <header className="panel-header">
        <div>
          <h2>{title}</h2>
          <p className="panel-subtitle">Tabs: Stammdaten, Lagerdaten, Lieferanten.</p>
        </div>
        <div className="actions-cell">
          <Link className="btn" to="/products">
            Zur Liste
          </Link>
          {isEditMode ? (
            <Link className="btn" to={`/products/${productId}`}>
              Zur Detailseite
            </Link>
          ) : null}
        </div>
      </header>

      {!isAdmin ? <p className="error">Nur Admins duerfen Artikel bearbeiten.</p> : null}
      {isEditMode && productQuery.isLoading ? <p>Lade Artikeldaten...</p> : null}
      {isEditMode && productQuery.isError ? <p className="error">Fehler beim Laden des Artikels.</p> : null}

      <div className="tab-strip" role="tablist" aria-label="Produktformular Tabs">
        <button className={`btn ${activeTab === "master" ? "btn-tab-active" : ""}`} onClick={() => setActiveTab("master")} type="button">
          Stammdaten
        </button>
        <button className={`btn ${activeTab === "warehouse" ? "btn-tab-active" : ""}`} onClick={() => setActiveTab("warehouse")} type="button">
          Lagerdaten
        </button>
        <button className={`btn ${activeTab === "suppliers" ? "btn-tab-active" : ""}`} onClick={() => setActiveTab("suppliers")} type="button">
          Lieferanten
        </button>
      </div>

      <form className="form-grid" onSubmit={(event) => void handleSubmit(event)}>
        {activeTab === "master" ? (
          <>
            <label>
              Artikelnummer
              <input
                className="input"
                value={productForm.productNumber}
                onChange={(event) =>
                  setProductForm((prev) => ({ ...prev, productNumber: event.target.value }))
                }
                required
                disabled={isEditMode}
                data-testid="product-form-number"
              />
            </label>
            <label>
              Bezeichnung
              <input
                className="input"
                value={productForm.name}
                onChange={(event) => setProductForm((prev) => ({ ...prev, name: event.target.value }))}
                required
                data-testid="product-form-name"
              />
            </label>
            <label>
              Beschreibung
              <textarea
                className="input textarea"
                value={productForm.description}
                onChange={(event) =>
                  setProductForm((prev) => ({ ...prev, description: event.target.value }))
                }
                data-testid="product-form-description"
              />
            </label>
            <label>
              Gruppe
              <select
                className="input"
                value={productForm.groupId}
                onChange={(event) => setProductForm((prev) => ({ ...prev, groupId: event.target.value }))}
                data-testid="product-form-group"
              >
                <option value="">Keine Gruppe</option>
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
                  data-testid="product-form-unit"
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
                  data-testid="product-form-status"
                >
                  {productStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        ) : null}

        {activeTab === "warehouse" ? (
          <article className="subpanel">
            <h3>Lagerdaten</h3>
            <p>Die lagerbezogenen Produktdaten werden in Phase 2 als eigene Eingabemaske erweitert.</p>
          </article>
        ) : null}

        {activeTab === "suppliers" ? (
          <article className="subpanel">
            <h3>Lieferanten</h3>
            <p>Lieferantenzuordnung ist vorbereitet und wird in der nächsten Ausbaustufe vertieft.</p>
          </article>
        ) : null}

        <div className="actions-cell">
          <button className="btn btn-primary" type="submit" disabled={pending || !isAdmin} data-testid="product-form-submit">
            {isEditMode ? "Artikel speichern" : "Artikel anlegen"}
          </button>
        </div>
      </form>
    </section>
  );
}
