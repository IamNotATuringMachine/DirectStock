import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import { deleteProductWarehouseSetting, fetchProductWarehouseSettings, upsertProductWarehouseSetting } from "../services/productSettingsApi";
import {
  createProduct,
  fetchProductById,
  fetchProductGroups,
  updateProduct,
} from "../services/productsApi";
import {
  createProductSupplier,
  deleteProductSupplier,
  fetchProductSuppliers,
  fetchSuppliers,
  updateProductSupplier,
} from "../services/suppliersApi";
import { fetchWarehouses } from "../services/warehousesApi";
import { useAuthStore } from "../stores/authStore";
import type { ProductStatus, ProductSupplierRelation } from "../types";

type ProductFormState = {
  productNumber: string;
  name: string;
  description: string;
  groupId: string;
  unit: string;
  status: ProductStatus;
};

type ProductTab = "master" | "warehouse" | "suppliers";

type WarehouseSettingFormState = {
  ean: string;
  minStock: string;
  reorderPoint: string;
  maxStock: string;
  safetyStock: string;
  leadTimeDays: string;
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

function emptyWarehouseSettingForm(): WarehouseSettingFormState {
  return {
    ean: "",
    minStock: "",
    reorderPoint: "",
    maxStock: "",
    safetyStock: "",
    leadTimeDays: "",
  };
}

function toNullableNumber(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableDecimal(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
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
  const [warehouseFormById, setWarehouseFormById] = useState<Record<number, WarehouseSettingFormState>>({});

  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [supplierProductNumber, setSupplierProductNumber] = useState("");
  const [supplierPrice, setSupplierPrice] = useState("");
  const [supplierLeadTimeDays, setSupplierLeadTimeDays] = useState("");
  const [supplierMinOrderQuantity, setSupplierMinOrderQuantity] = useState("");
  const [supplierPreferred, setSupplierPreferred] = useState(false);

  const groupsQuery = useQuery({
    queryKey: ["product-groups"],
    queryFn: fetchProductGroups,
  });

  const productQuery = useQuery({
    queryKey: ["product", productId],
    queryFn: () => fetchProductById(productId as number),
    enabled: isEditMode,
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouses", "product-form"],
    queryFn: fetchWarehouses,
  });

  const settingsQuery = useQuery({
    queryKey: ["product-warehouse-settings", productId],
    queryFn: () => fetchProductWarehouseSettings(productId as number),
    enabled: isEditMode,
  });

  const suppliersQuery = useQuery({
    queryKey: ["suppliers", "product-form"],
    queryFn: () => fetchSuppliers({ page: 1, pageSize: 200, isActive: true }),
  });

  const productSuppliersQuery = useQuery({
    queryKey: ["product-suppliers", productId],
    queryFn: () => fetchProductSuppliers(productId as number),
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

  useEffect(() => {
    if (!warehousesQuery.data) {
      return;
    }

    const settingByWarehouse = new Map(
      (settingsQuery.data ?? []).map((setting) => [setting.warehouse_id, setting])
    );

    const nextState: Record<number, WarehouseSettingFormState> = {};
    for (const warehouse of warehousesQuery.data) {
      const setting = settingByWarehouse.get(warehouse.id);
      nextState[warehouse.id] = {
        ean: setting?.ean ?? "",
        minStock: setting?.min_stock ?? "",
        reorderPoint: setting?.reorder_point ?? "",
        maxStock: setting?.max_stock ?? "",
        safetyStock: setting?.safety_stock ?? "",
        leadTimeDays: setting?.lead_time_days ? String(setting.lead_time_days) : "",
      };
    }

    setWarehouseFormById(nextState);
  }, [warehousesQuery.data, settingsQuery.data]);

  const createProductMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["product", created.id] });
      navigate(`/products/${created.id}/edit`);
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: ({
      productId: nextProductId,
      payload,
    }: {
      productId: number;
      payload: Parameters<typeof updateProduct>[1];
    }) => updateProduct(nextProductId, payload),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["product", updated.id] });
      navigate(`/products/${updated.id}`);
    },
  });

  const upsertWarehouseSettingMutation = useMutation({
    mutationFn: ({
      warehouseId,
      payload,
    }: {
      warehouseId: number;
      payload: Parameters<typeof upsertProductWarehouseSetting>[2];
    }) => upsertProductWarehouseSetting(productId as number, warehouseId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["product-warehouse-settings", productId] });
      await queryClient.invalidateQueries({ queryKey: ["inventory-low-stock"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-low-stock"] });
    },
  });

  const deleteWarehouseSettingMutation = useMutation({
    mutationFn: (warehouseId: number) => deleteProductWarehouseSetting(productId as number, warehouseId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["product-warehouse-settings", productId] });
      await queryClient.invalidateQueries({ queryKey: ["inventory-low-stock"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-low-stock"] });
    },
  });

  const createProductSupplierMutation = useMutation({
    mutationFn: (payload: Parameters<typeof createProductSupplier>[1]) =>
      createProductSupplier(productId as number, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["product-suppliers", productId] });
      setSupplierProductNumber("");
      setSupplierPrice("");
      setSupplierLeadTimeDays("");
      setSupplierMinOrderQuantity("");
      setSupplierPreferred(false);
    },
  });

  const updateProductSupplierMutation = useMutation({
    mutationFn: ({
      relation,
      payload,
    }: {
      relation: ProductSupplierRelation;
      payload: Parameters<typeof updateProductSupplier>[2];
    }) => updateProductSupplier(productId as number, relation.id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["product-suppliers", productId] });
    },
  });

  const deleteProductSupplierMutation = useMutation({
    mutationFn: (relationId: number) => deleteProductSupplier(productId as number, relationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["product-suppliers", productId] });
    },
  });

  const pending =
    createProductMutation.isPending ||
    updateProductMutation.isPending ||
    upsertWarehouseSettingMutation.isPending ||
    deleteWarehouseSettingMutation.isPending ||
    createProductSupplierMutation.isPending ||
    updateProductSupplierMutation.isPending ||
    deleteProductSupplierMutation.isPending;

  const title = useMemo(
    () => (isEditMode ? `Artikel bearbeiten #${productId}` : "Neuer Artikel"),
    [isEditMode, productId]
  );

  const supplierNameById = useMemo(
    () =>
      new Map(
        (suppliersQuery.data?.items ?? []).map((supplier) => [supplier.id, `${supplier.supplier_number} - ${supplier.company_name}`])
      ),
    [suppliersQuery.data]
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

  const onSaveWarehouseSetting = async (warehouseId: number) => {
    const form = warehouseFormById[warehouseId] ?? emptyWarehouseSettingForm();
    await upsertWarehouseSettingMutation.mutateAsync({
      warehouseId,
      payload: {
        ean: form.ean.trim() || null,
        min_stock: toNullableDecimal(form.minStock),
        reorder_point: toNullableDecimal(form.reorderPoint),
        max_stock: toNullableDecimal(form.maxStock),
        safety_stock: toNullableDecimal(form.safetyStock),
        lead_time_days: toNullableNumber(form.leadTimeDays),
      },
    });
  };

  const onClearWarehouseSetting = async (warehouseId: number) => {
    await deleteWarehouseSettingMutation.mutateAsync(warehouseId);
  };

  const onCreateSupplierRelation = async (event: FormEvent) => {
    event.preventDefault();
    if (!isEditMode || !selectedSupplierId) {
      return;
    }

    await createProductSupplierMutation.mutateAsync({
      supplier_id: Number(selectedSupplierId),
      supplier_product_number: supplierProductNumber.trim() || null,
      price: supplierPrice.trim() || null,
      lead_time_days: toNullableNumber(supplierLeadTimeDays),
      min_order_quantity: supplierMinOrderQuantity.trim() || null,
      is_preferred: supplierPreferred,
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
        <button
          className={`btn ${activeTab === "master" ? "btn-tab-active" : ""}`}
          onClick={() => setActiveTab("master")}
          type="button"
        >
          Stammdaten
        </button>
        <button
          className={`btn ${activeTab === "warehouse" ? "btn-tab-active" : ""}`}
          onClick={() => setActiveTab("warehouse")}
          type="button"
        >
          Lagerdaten
        </button>
        <button
          className={`btn ${activeTab === "suppliers" ? "btn-tab-active" : ""}`}
          onClick={() => setActiveTab("suppliers")}
          type="button"
        >
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

            <div className="actions-cell">
              <button className="btn btn-primary" type="submit" disabled={pending || !isAdmin} data-testid="product-form-submit">
                {isEditMode ? "Artikel speichern" : "Artikel anlegen"}
              </button>
            </div>
          </>
        ) : null}
      </form>

      {activeTab === "warehouse" ? (
        <article className="subpanel" data-testid="product-form-warehouse-tab">
          <h3>Lagerdaten</h3>
          {!isEditMode ? <p>Bitte zuerst den Artikel anlegen, um Lagerdaten je Standort zu pflegen.</p> : null}

          {isEditMode ? (
            <div className="list-stack">
              {(warehousesQuery.data ?? []).map((warehouse) => {
                const form = warehouseFormById[warehouse.id] ?? emptyWarehouseSettingForm();

                return (
                  <div key={warehouse.id} className="list-item static-item" data-testid={`product-warehouse-setting-${warehouse.id}`}>
                    <strong>
                      {warehouse.code} - {warehouse.name}
                    </strong>
                    <div className="split-grid">
                      <label>
                        EAN
                        <input
                          className="input"
                          value={form.ean}
                          onChange={(event) =>
                            setWarehouseFormById((prev) => ({
                              ...prev,
                              [warehouse.id]: { ...form, ean: event.target.value },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Lead Time (Tage)
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="1"
                          value={form.leadTimeDays}
                          onChange={(event) =>
                            setWarehouseFormById((prev) => ({
                              ...prev,
                              [warehouse.id]: { ...form, leadTimeDays: event.target.value },
                            }))
                          }
                        />
                      </label>
                    </div>

                    <div className="split-grid">
                      <label>
                        Mindestbestand
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="0.001"
                          value={form.minStock}
                          onChange={(event) =>
                            setWarehouseFormById((prev) => ({
                              ...prev,
                              [warehouse.id]: { ...form, minStock: event.target.value },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Meldebestand
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="0.001"
                          value={form.reorderPoint}
                          onChange={(event) =>
                            setWarehouseFormById((prev) => ({
                              ...prev,
                              [warehouse.id]: { ...form, reorderPoint: event.target.value },
                            }))
                          }
                        />
                      </label>
                    </div>

                    <div className="split-grid">
                      <label>
                        Maximalbestand
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="0.001"
                          value={form.maxStock}
                          onChange={(event) =>
                            setWarehouseFormById((prev) => ({
                              ...prev,
                              [warehouse.id]: { ...form, maxStock: event.target.value },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Sicherheitsbestand
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="0.001"
                          value={form.safetyStock}
                          onChange={(event) =>
                            setWarehouseFormById((prev) => ({
                              ...prev,
                              [warehouse.id]: { ...form, safetyStock: event.target.value },
                            }))
                          }
                        />
                      </label>
                    </div>

                    <div className="actions-cell">
                      <button
                        className="btn"
                        type="button"
                        onClick={() => void onSaveWarehouseSetting(warehouse.id)}
                        disabled={pending || !isAdmin}
                        data-testid={`product-warehouse-save-${warehouse.id}`}
                      >
                        Lagerdaten speichern
                      </button>
                      <button
                        className="btn"
                        type="button"
                        onClick={() => void onClearWarehouseSetting(warehouse.id)}
                        disabled={pending || !isAdmin}
                        data-testid={`product-warehouse-clear-${warehouse.id}`}
                      >
                        Lagerdaten löschen
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </article>
      ) : null}

      {activeTab === "suppliers" ? (
        <article className="subpanel" data-testid="product-form-suppliers-tab">
          <h3>Lieferanten</h3>
          {!isEditMode ? <p>Bitte zuerst den Artikel anlegen, um Lieferanten zuzuordnen.</p> : null}

          {isEditMode ? (
            <>
              <form className="form-grid" onSubmit={(event) => void onCreateSupplierRelation(event)} data-testid="product-supplier-form">
                <label>
                  Lieferant
                  <select
                    className="input"
                    value={selectedSupplierId}
                    onChange={(event) => setSelectedSupplierId(event.target.value)}
                    data-testid="product-supplier-select"
                    required
                  >
                    <option value="">Lieferant wählen</option>
                    {(suppliersQuery.data?.items ?? []).map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.supplier_number} - {supplier.company_name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="split-grid">
                  <label>
                    Lieferanten-Artikelnr.
                    <input
                      className="input"
                      value={supplierProductNumber}
                      onChange={(event) => setSupplierProductNumber(event.target.value)}
                      data-testid="product-supplier-product-number"
                    />
                  </label>
                  <label>
                    Preis
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={supplierPrice}
                      onChange={(event) => setSupplierPrice(event.target.value)}
                      data-testid="product-supplier-price"
                    />
                  </label>
                </div>

                <div className="split-grid">
                  <label>
                    Lieferzeit (Tage)
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="1"
                      value={supplierLeadTimeDays}
                      onChange={(event) => setSupplierLeadTimeDays(event.target.value)}
                      data-testid="product-supplier-lead-time"
                    />
                  </label>
                  <label>
                    Mindestbestellmenge
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.001"
                      value={supplierMinOrderQuantity}
                      onChange={(event) => setSupplierMinOrderQuantity(event.target.value)}
                      data-testid="product-supplier-min-order"
                    />
                  </label>
                </div>

                <label>
                  <input
                    type="checkbox"
                    checked={supplierPreferred}
                    onChange={(event) => setSupplierPreferred(event.target.checked)}
                    data-testid="product-supplier-preferred"
                  />{" "}
                  Bevorzugter Lieferant
                </label>

                <button
                  className="btn"
                  type="submit"
                  disabled={pending || !isAdmin}
                  data-testid="product-supplier-add-btn"
                >
                  Lieferant zuordnen
                </button>
              </form>

              <div className="list-stack">
                {(productSuppliersQuery.data ?? []).map((relation) => (
                  <div key={relation.id} className="list-item static-item" data-testid={`product-supplier-relation-${relation.id}`}>
                    <strong>{supplierNameById.get(relation.supplier_id) ?? `Lieferant #${relation.supplier_id}`}</strong>
                    <span>
                      Preis: {relation.price ?? "-"} | Lead Time: {relation.lead_time_days ?? "-"} | MOQ: {relation.min_order_quantity ?? "-"}
                    </span>
                    <span>
                      Lieferanten-Artikelnr.: {relation.supplier_product_number ?? "-"} | Preferred: {relation.is_preferred ? "ja" : "nein"}
                    </span>
                    <div className="actions-cell">
                      <button
                        className="btn"
                        type="button"
                        onClick={() =>
                          void updateProductSupplierMutation.mutateAsync({
                            relation,
                            payload: { is_preferred: !relation.is_preferred },
                          })
                        }
                        disabled={pending || !isAdmin}
                        data-testid={`product-supplier-toggle-preferred-${relation.id}`}
                      >
                        Preferred umschalten
                      </button>
                      <button
                        className="btn"
                        type="button"
                        onClick={() => void deleteProductSupplierMutation.mutateAsync(relation.id)}
                        disabled={pending || !isAdmin}
                        data-testid={`product-supplier-delete-${relation.id}`}
                      >
                        Entfernen
                      </button>
                    </div>
                  </div>
                ))}
                {!productSuppliersQuery.isLoading && (productSuppliersQuery.data?.length ?? 0) === 0 ? (
                  <p>Noch keine Lieferanten zugeordnet.</p>
                ) : null}
              </div>
            </>
          ) : null}
        </article>
      ) : null}
    </section>
  );
}
