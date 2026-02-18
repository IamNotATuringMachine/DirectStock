import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Package,
  Save,
  Truck,
  Warehouse,
  Check,
  AlertCircle,
  Hash,
  FileText,
  Tag,
  Layers,
  Info,
  DollarSign,
  Clock,
  ShoppingCart,
  Trash2,
  Star,
  Plus,
  ChevronDown,
  X,
  Loader2,
} from "lucide-react";
import { createProductBasePrice, fetchProductBasePrices, resolveProductPrice } from "../services/pricingApi";

import {
  deleteProductWarehouseSetting,
  fetchProductWarehouseSettings,
  upsertProductWarehouseSetting,
} from "../services/productSettingsApi";
import {
  createProduct,
  createProductGroup,
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
import { fetchBins, fetchWarehouses, fetchZones } from "../services/warehousesApi";
import { useAuthStore } from "../stores/authStore";
import type { ProductPrice, ProductStatus, ProductSupplierRelation } from "../types";

type ProductFormState = {
  productNumber: string;
  name: string;
  description: string;
  groupId: string;
  unit: string;
  status: ProductStatus;
  requiresItemTracking: boolean;
};

type ProductTab = "master" | "warehouse" | "suppliers" | "pricing";

type WarehouseSettingFormState = {
  ean: string;
  minStock: string;
  reorderPoint: string;
  maxStock: string;
  safetyStock: string;
  leadTimeDays: string;
};

const productStatusOptions: Array<{ value: ProductStatus; label: string }> = [
  { value: "active", label: "Aktiv" },
  { value: "blocked", label: "Gesperrt" },
  { value: "deprecated", label: "Veraltet" },
  { value: "archived", label: "Archiviert" },
];

function emptyProductForm(): ProductFormState {
  return {
    productNumber: "",
    name: "",
    description: "",
    groupId: "",
    unit: "Stück",
    status: "active",
    requiresItemTracking: false,
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

function toDisplayUnit(unit: string): string {
  const normalized = unit.trim().toLowerCase();
  if (
    normalized === "piece" ||
    normalized === "pieces" ||
    normalized === "pc" ||
    normalized === "pcs"
  ) {
    return "Stück";
  }
  return unit;
}

function toApiUnit(unit: string): string {
  const normalized = unit.trim().toLowerCase();
  if (normalized === "stück" || normalized === "stueck") {
    return "piece";
  }
  return unit.trim();
}

function toMutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim().length > 0) {
      return detail;
    }
  }
  return fallback;
}

function formatPriceAmount(value: string | null): string {
  if (!value) {
    return "-";
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return parsed.toFixed(2);
}

function deriveActiveBasePriceId(basePrices: ProductPrice[] | undefined, resolvedPrice: {
  source: "customer" | "base" | "none";
  net_price: string | null;
  vat_rate: string | null;
  currency: string | null;
} | undefined): number | null {
  if (!basePrices || !resolvedPrice || resolvedPrice.source !== "base") {
    return null;
  }
  const match = basePrices.find(
    (item) =>
      item.is_active &&
      item.net_price === resolvedPrice.net_price &&
      item.vat_rate === resolvedPrice.vat_rate &&
      item.currency === resolvedPrice.currency
  );
  return match?.id ?? null;
}

function ProductGroupSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const queryClient = useQueryClient();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const groupsQuery = useQuery({
    queryKey: ["product-groups"],
    queryFn: fetchProductGroups,
  });

  const createGroupMutation = useMutation({
    mutationFn: createProductGroup,
    onSuccess: async (newGroup) => {
      await queryClient.invalidateQueries({ queryKey: ["product-groups"] });
      onChange(String(newGroup.id));
      setIsCreating(false);
      setNewGroupName("");
      setIsOpen(false);
    },
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setIsCreating(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef]);

  const selectedGroup = groupsQuery.data?.find(
    (g) => String(g.id) === value
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    await createGroupMutation.mutateAsync({ name: newGroupName.trim() });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="input !pl-10 w-full text-left flex items-center justify-between transition-all focus:ring-2 ring-[var(--accent)]/20"
      >
        <span className={value ? "text-[var(--ink)]" : "text-[var(--muted)]"}>
          {selectedGroup ? selectedGroup.name : "Keine Gruppe"}
        </span>
        <ChevronDown size={16} className={`text-[var(--muted)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--panel)] border border-[var(--line)] rounded-lg shadow-lg z-50 overflow-hidden max-h-80 flex flex-col animate-in fade-in zoom-in-95 duration-100">
          {!isCreating ? (
            <>
              <div className="overflow-y-auto flex-1 py-1">
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-[var(--bg)] text-sm text-[var(--muted)] transition-colors"
                >
                  Keine Gruppe
                </button>
                {(groupsQuery.data ?? []).map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => {
                      onChange(String(group.id));
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-[var(--bg)] text-sm transition-colors ${String(group.id) === value
                      ? "text-[var(--accent)] font-medium bg-[var(--bg)]"
                      : "text-[var(--ink)]"
                      }`}
                  >
                    {group.name}
                  </button>
                ))}
              </div>
              <div className="border-t border-[var(--line)] p-2 bg-[var(--panel-soft)]">
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsCreating(true);
                  }}
                  className="w-full btn btn-sm btn-ghost justify-start text-[var(--accent)] hover:bg-[var(--bg)]"
                >
                  <Plus size={14} />
                  Neue Gruppe erstellen
                </button>
              </div>
            </>
          ) : (
            <div className="p-3 space-y-3 bg-[var(--panel)]">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-[var(--muted)] uppercase">
                  Neue Gruppe
                </h4>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              <input
                autoFocus
                className="input input-sm w-full"
                placeholder="Name der Gruppe"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleCreate(e);
                  } else if (e.key === "Escape") {
                    setIsCreating(false);
                  }
                }}
              />
              <button
                type="button"
                onClick={(e) => void handleCreate(e)}
                disabled={createGroupMutation.isPending || !newGroupName.trim()}
                className="btn btn-sm btn-primary w-full justify-center"
              >
                {createGroupMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Erstellen"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProductFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.roles.includes("admin") ?? false;
  const permissions = useMemo(() => new Set(user?.permissions ?? []), [user?.permissions]);
  const canReadPricing = permissions.has("module.pricing.read");
  const canWritePricing = permissions.has("module.pricing.write");

  const productId = id ? Number(id) : null;
  const isEditMode = productId !== null;
  const requestedTab = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<ProductTab>("master");
  const [productForm, setProductForm] = useState<ProductFormState>(
    emptyProductForm()
  );
  const [warehouseFormById, setWarehouseFormById] = useState<
    Record<number, WarehouseSettingFormState>
  >({});

  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [supplierProductNumber, setSupplierProductNumber] = useState("");
  const [supplierPrice, setSupplierPrice] = useState("");
  const [supplierLeadTimeDays, setSupplierLeadTimeDays] = useState("");
  const [supplierMinOrderQuantity, setSupplierMinOrderQuantity] = useState("");
  const [supplierPreferred, setSupplierPreferred] = useState(false);
  const [basePriceNet, setBasePriceNet] = useState("");
  const [basePriceVatRate, setBasePriceVatRate] = useState("19");
  const [basePriceError, setBasePriceError] = useState<string | null>(null);
  const [defaultBinId, setDefaultBinId] = useState<number | null>(null);
  const [defaultBinWarehouseId, setDefaultBinWarehouseId] = useState<number | null>(null);
  const [defaultBinZoneId, setDefaultBinZoneId] = useState<number | null>(null);

  const productQuery = useQuery({
    queryKey: ["product", productId],
    queryFn: () => fetchProductById(productId as number),
    enabled: isEditMode,
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouses", "product-form"],
    queryFn: fetchWarehouses,
  });

  const defaultBinZonesQuery = useQuery({
    queryKey: ["zones", defaultBinWarehouseId, "product-form"],
    queryFn: () => fetchZones(defaultBinWarehouseId!),
    enabled: defaultBinWarehouseId !== null,
  });

  const defaultBinBinsQuery = useQuery({
    queryKey: ["bins", defaultBinZoneId, "product-form"],
    queryFn: () => fetchBins(defaultBinZoneId!),
    enabled: defaultBinZoneId !== null,
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

  const productBasePricesQuery = useQuery({
    queryKey: ["product-base-prices", productId],
    queryFn: () => fetchProductBasePrices(productId as number),
    enabled: isEditMode && canReadPricing,
  });

  const resolvedProductPriceQuery = useQuery({
    queryKey: ["resolved-product-price", productId],
    queryFn: () => resolveProductPrice(productId as number),
    enabled: isEditMode && canReadPricing,
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
      groupId: product.product_group_id
        ? String(product.product_group_id)
        : "",
      unit: toDisplayUnit(product.unit),
      status: product.status,
      requiresItemTracking: product.requires_item_tracking,
    });
    setDefaultBinId(product.default_bin_id ?? null);
  }, [productQuery.data]);

  useEffect(() => {
    if (!isEditMode || !requestedTab) {
      return;
    }
    if (requestedTab === "pricing") {
      setActiveTab(canReadPricing ? "pricing" : "master");
      return;
    }
    if (requestedTab === "warehouse" || requestedTab === "suppliers" || requestedTab === "master") {
      setActiveTab(requestedTab);
    }
  }, [canReadPricing, isEditMode, requestedTab]);

  useEffect(() => {
    if (!warehousesQuery.data) {
      return;
    }

    const settingByWarehouse = new Map(
      (settingsQuery.data ?? []).map((setting) => [
        setting.warehouse_id,
        setting,
      ])
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
        leadTimeDays: setting?.lead_time_days
          ? String(setting.lead_time_days)
          : "",
      };
    }

    setWarehouseFormById(nextState);
  }, [warehousesQuery.data, settingsQuery.data]);

  const createProductMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: async (createdProduct) => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      navigate(`/products/${createdProduct.id}/edit?tab=pricing`);
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
    }) =>
      upsertProductWarehouseSetting(productId as number, warehouseId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["product-warehouse-settings", productId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["inventory-low-stock"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["dashboard-low-stock"],
      });
    },
  });

  const deleteWarehouseSettingMutation = useMutation({
    mutationFn: (warehouseId: number) =>
      deleteProductWarehouseSetting(productId as number, warehouseId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["product-warehouse-settings", productId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["inventory-low-stock"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["dashboard-low-stock"],
      });
    },
  });

  const createProductSupplierMutation = useMutation({
    mutationFn: (payload: Parameters<typeof createProductSupplier>[1]) =>
      createProductSupplier(productId as number, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["product-suppliers", productId],
      });
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
      await queryClient.invalidateQueries({
        queryKey: ["product-suppliers", productId],
      });
    },
  });

  const deleteProductSupplierMutation = useMutation({
    mutationFn: (relationId: number) =>
      deleteProductSupplier(productId as number, relationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["product-suppliers", productId],
      });
    },
  });

  const createProductBasePriceMutation = useMutation({
    mutationFn: (payload: Parameters<typeof createProductBasePrice>[1]) =>
      createProductBasePrice(productId as number, payload),
    onMutate: () => setBasePriceError(null),
    onSuccess: async () => {
      setBasePriceNet("");
      setBasePriceVatRate("19");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["product-base-prices", productId] }),
        queryClient.invalidateQueries({ queryKey: ["resolved-product-price", productId] }),
      ]);
    },
    onError: (error) => {
      setBasePriceError(toMutationErrorMessage(error, "Preis konnte nicht gespeichert werden."));
    },
  });

  const pending =
    createProductMutation.isPending ||
    updateProductMutation.isPending ||
    upsertWarehouseSettingMutation.isPending ||
    deleteWarehouseSettingMutation.isPending ||
    createProductSupplierMutation.isPending ||
    updateProductSupplierMutation.isPending ||
    deleteProductSupplierMutation.isPending ||
    createProductBasePriceMutation.isPending;

  const title = useMemo(
    () => (isEditMode ? `Artikel bearbeiten` : "Neuer Artikel"),
    [isEditMode]
  );

  const supplierNameById = useMemo(
    () =>
      new Map(
        (suppliersQuery.data?.items ?? []).map((supplier) => [
          supplier.id,
          `${supplier.supplier_number} - ${supplier.company_name}`,
        ])
      ),
    [suppliersQuery.data]
  );

  const basePriceGrossPreview = useMemo(() => {
    const net = Number(basePriceNet);
    const vatRate = Number(basePriceVatRate);
    if (!Number.isFinite(net) || net <= 0 || !Number.isFinite(vatRate)) {
      return null;
    }
    return (net * (1 + vatRate / 100)).toFixed(2);
  }, [basePriceNet, basePriceVatRate]);

  const activeBasePriceId = useMemo(
    () => deriveActiveBasePriceId(productBasePricesQuery.data, resolvedProductPriceQuery.data),
    [productBasePricesQuery.data, resolvedProductPriceQuery.data]
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
          product_group_id: productForm.groupId
            ? Number(productForm.groupId)
            : null,
          unit: toApiUnit(productForm.unit),
          status: productForm.status,
          requires_item_tracking: productForm.requiresItemTracking,
          default_bin_id: defaultBinId,
        },
      });
      return;
    }

    await createProductMutation.mutateAsync({
      product_number: productForm.productNumber,
      name: productForm.name,
      description: productForm.description || null,
      product_group_id: productForm.groupId
        ? Number(productForm.groupId)
        : null,
      unit: toApiUnit(productForm.unit),
      status: productForm.status,
      requires_item_tracking: productForm.requiresItemTracking,
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

  const onCreateBasePrice = async (event: FormEvent) => {
    event.preventDefault();
    if (!isEditMode || !canWritePricing) {
      return;
    }
    const normalizedNet = basePriceNet.trim();
    if (!normalizedNet) {
      setBasePriceError("Nettopreis ist erforderlich.");
      return;
    }
    await createProductBasePriceMutation.mutateAsync({
      net_price: normalizedNet,
      vat_rate: basePriceVatRate,
      currency: "EUR",
      is_active: true,
    });
  };

  if (isEditMode && productQuery.isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="h-20 bg-[var(--panel-soft)] rounded-lg"></div>
        <div className="h-12 w-64 bg-[var(--panel-soft)] rounded-lg"></div>
        <div className="h-96 bg-[var(--panel)] rounded-xl border border-[var(--line)]"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8" data-testid="product-form-page">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link
            to="/products"
            className="p-2.5 rounded-xl text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--panel-strong)] border border-transparent hover:border-[var(--line)] transition-all shadow-sm hover:shadow"
            title="Zurück zur Liste"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-[var(--ink)] tracking-tight">
                {title}
              </h1>
              {isEditMode && (
                <span className="px-2.5 py-0.5 rounded-md bg-[var(--panel-strong)] border border-[var(--line)] text-xs font-mono text-[var(--muted)]">
                  ID: {productId}
                </span>
              )}
            </div>
            <p className="text-[var(--muted)] mt-1.5">
              {isEditMode
                ? "Verwalten Sie hier alle Stammdaten, Lagerbestände und Lieferantenbeziehungen."
                : "Füllen Sie das Formular aus, um einen neuen Artikel im System zu registrieren."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isEditMode && (
            <Link
              to={`/products/${productId}`}
              className="btn bg-[var(--panel)] shadow-sm"
            >
              <FileText size={18} className="text-[var(--accent)]" />
              Zur Detailansicht
            </Link>
          )}
        </div>
      </header>

      {/* States & Errors */}
      {!isAdmin && (
        <div className="p-4 rounded-xl bg-red-50/50 border border-red-200 text-red-700 flex items-start gap-3 shadow-sm">
          <AlertCircle className="shrink-0 mt-0.5" size={18} />
          <p className="text-sm font-medium">Nur Administratoren sind berechtigt, Artikeldaten zu bearbeiten.</p>
        </div>
      )}
      {isEditMode && productQuery.isError && (
        <div className="p-4 rounded-xl bg-red-50/50 border border-red-200 text-red-700 flex items-start gap-3 shadow-sm">
          <AlertCircle className="shrink-0 mt-0.5" size={18} />
          <p className="text-sm font-medium">Es gab ein Problem beim Laden der Artikeldaten. Bitte versuchen Sie es erneut.</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-[var(--line)]">
        <div className="flex items-center gap-8 overflow-x-auto no-scrollbar">
          {[
            { id: "master", label: "Stammdaten", icon: Package, testId: "product-form-master-tab" },
            { id: "warehouse", label: "Lagerdaten", icon: Warehouse, testId: "product-form-warehouse-tab-button" },
            { id: "suppliers", label: "Lieferanten", icon: Truck, testId: "product-form-suppliers-tab-button" },
            ...(canReadPricing ? [{ id: "pricing", label: "Preise", icon: DollarSign, testId: "product-form-pricing-tab" }] : []),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ProductTab)}
              type="button"
              data-testid={tab.testId}
              className={`group pb-4 px-1 text-sm font-semibold flex items-center gap-2.5 transition-all relative whitespace-nowrap ${activeTab === tab.id
                ? "text-[var(--accent)]"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
            >
              <tab.icon
                size={18}
                className={`transition-colors ${activeTab === tab.id
                  ? "text-[var(--accent)]"
                  : "text-[var(--muted)] group-hover:text-[var(--ink)]"
                  }`}
              />
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)] rounded-t-full shadow-[0_-2px_6px_rgba(21,128,61,0.2)]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === "master" && (
          <div className="card p-8 border border-[var(--line)] bg-[var(--panel)] shadow-sm rounded-xl">
            <form
              onSubmit={(event) => void handleSubmit(event)}
              className="space-y-8 max-w-4xl"
            >
              {/* Primary Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-[var(--muted)] uppercase tracking-wider flex items-center gap-2">
                    <Info size={14} /> Grundinformationen
                  </h3>

                  <div className="space-y-5">
                    <label className="space-y-1.5 block">
                      <span className="text-sm font-medium text-[var(--ink)]">
                        Artikelnummer <span className="text-[var(--danger)]">*</span>
                      </span>
                      <div className="relative group">
                        <Hash
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] group-focus-within:text-[var(--accent)] transition-colors"
                        />
                        <input
                          className="input !pl-10 w-full transition-all focus:ring-2 ring-[var(--accent)]/20"
                          value={productForm.productNumber}
                          onChange={(event) =>
                            setProductForm((prev) => ({
                              ...prev,
                              productNumber: event.target.value,
                            }))
                          }
                          required
                          disabled={isEditMode}
                          data-testid="product-form-number"
                          placeholder="z.B. AR-10001"
                        />
                      </div>
                    </label>

                    <label className="space-y-1.5 block">
                      <span className="text-sm font-medium text-[var(--ink)]">
                        Bezeichnung <span className="text-[var(--danger)]">*</span>
                      </span>
                      <div className="relative group">
                        <Tag
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] group-focus-within:text-[var(--accent)] transition-colors"
                        />
                        <input
                          className="input !pl-10 w-full transition-all focus:ring-2 ring-[var(--accent)]/20"
                          value={productForm.name}
                          onChange={(event) =>
                            setProductForm((prev) => ({
                              ...prev,
                              name: event.target.value,
                            }))
                          }
                          required
                          data-testid="product-form-name"
                          placeholder="Produktbezeichnung"
                        />
                      </div>
                    </label>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-[var(--muted)] uppercase tracking-wider flex items-center gap-2">
                    <Layers size={14} /> Kategorisierung
                  </h3>

                  <div className="space-y-5">
                    <div className="space-y-1.5 block">
                      <span className="text-sm font-medium text-[var(--ink)]">
                        Produktgruppe
                      </span>
                      <div className="relative group">
                        <Layers
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] group-focus-within:text-[var(--accent)] transition-colors"
                        />
                        <ProductGroupSelect
                          value={productForm.groupId}
                          onChange={(newValue) =>
                            setProductForm((prev) => ({
                              ...prev,
                              groupId: newValue,
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <label className="space-y-1.5 block">
                        <span className="text-sm font-medium text-[var(--ink)]">
                          Einheit <span className="text-[var(--danger)]">*</span>
                        </span>
                        <div className="relative group">
                          <Package size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] group-focus-within:text-[var(--accent)] transition-colors" />
                          <input
                            className="input !pl-10 w-full transition-all focus:ring-2 ring-[var(--accent)]/20"
                            value={productForm.unit}
                            onChange={(event) =>
                              setProductForm((prev) => ({
                                ...prev,
                                unit: event.target.value,
                              }))
                            }
                            required
                            data-testid="product-form-unit"
                            placeholder="Stück"
                          />
                        </div>
                      </label>

                      <label className="space-y-1.5 block">
                        <span className="text-sm font-medium text-[var(--ink)]">
                          Status
                        </span>
                        <div className="relative group">
                          <Info size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] group-focus-within:text-[var(--accent)] transition-colors" />
                          <select
                            className="input !pl-10 w-full appearance-none transition-all focus:ring-2 ring-[var(--accent)]/20"
                            value={productForm.status}
                            onChange={(event) =>
                              setProductForm((prev) => ({
                                ...prev,
                                status: event.target.value as ProductStatus,
                              }))
                            }
                            data-testid="product-form-status"
                          >
                            {productStatusOptions.map((status) => (
                              <option key={status.value} value={status.value}>
                                {status.label}
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
                        </div>
                      </label>
                    </div>

                    <div className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel-soft)] p-3 group">
                      <div className="relative flex items-center">
                        <input
                          id="product-form-item-tracking-checkbox"
                          type="checkbox"
                          className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-[var(--line)] checked:border-[var(--accent)] checked:bg-[var(--accent)] transition-all"
                          checked={productForm.requiresItemTracking}
                          onChange={(event) =>
                            setProductForm((prev) => ({
                              ...prev,
                              requiresItemTracking: event.target.checked,
                            }))
                          }
                          data-testid="product-form-requires-item-tracking"
                        />
                        <Check size={14} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" />
                      </div>
                      <label
                        htmlFor="product-form-item-tracking-checkbox"
                        className="cursor-pointer text-sm text-[var(--ink)] transition-colors group-hover:text-[var(--accent)]"
                      >
                        Einzelteilverfolgung (Seriennummernpflicht)
                      </label>
                    </div>

                    <div className="space-y-2 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel-soft)] p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[var(--ink)]">Standard-Lagerplatz</span>
                        {defaultBinId ? (
                          <button
                            type="button"
                            className="text-xs text-[var(--destructive)] hover:underline"
                            onClick={() => {
                              setDefaultBinId(null);
                              setDefaultBinWarehouseId(null);
                              setDefaultBinZoneId(null);
                            }}
                            data-testid="product-form-remove-default-bin"
                          >
                            Entfernen
                          </button>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <select
                          className="input w-full text-xs"
                          value={defaultBinWarehouseId ?? ""}
                          onChange={(event) => {
                            setDefaultBinWarehouseId(event.target.value ? Number(event.target.value) : null);
                            setDefaultBinZoneId(null);
                            setDefaultBinId(null);
                          }}
                          data-testid="product-form-default-bin-warehouse"
                        >
                          <option value="">Lager...</option>
                          {(warehousesQuery.data ?? []).map((w) => (
                            <option key={w.id} value={w.id}>{w.code}</option>
                          ))}
                        </select>
                        <select
                          className="input w-full text-xs"
                          value={defaultBinZoneId ?? ""}
                          onChange={(event) => {
                            setDefaultBinZoneId(event.target.value ? Number(event.target.value) : null);
                            setDefaultBinId(null);
                          }}
                          disabled={!defaultBinWarehouseId}
                          data-testid="product-form-default-bin-zone"
                        >
                          <option value="">Zone...</option>
                          {(defaultBinZonesQuery.data ?? []).map((z) => (
                            <option key={z.id} value={z.id}>{z.code}</option>
                          ))}
                        </select>
                        <select
                          className="input w-full text-xs"
                          value={defaultBinId ?? ""}
                          onChange={(event) => setDefaultBinId(event.target.value ? Number(event.target.value) : null)}
                          disabled={!defaultBinZoneId}
                          data-testid="product-form-default-bin-select"
                        >
                          <option value="">Platz...</option>
                          {(defaultBinBinsQuery.data ?? []).map((b) => (
                            <option key={b.id} value={b.id}>{b.code}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 pb-2">
                <div className="h-px bg-[var(--line)] w-full"></div>
              </div>

              <label className="space-y-1.5 block">
                <span className="text-sm font-medium text-[var(--ink)]">
                  Beschreibung
                </span>
                <textarea
                  className="input min-h-[120px] w-full transition-all focus:ring-2 ring-[var(--accent)]/20 resize-y"
                  value={productForm.description}
                  onChange={(event) =>
                    setProductForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  data-testid="product-form-description"
                  placeholder="Detaillierte Produktbeschreibung..."
                />
              </label>

              <div className="pt-6 flex justify-end">
                <button
                  className="btn btn-primary w-full md:w-auto min-w-[180px] shadow-lg shadow-[var(--accent)]/20"
                  type="submit"
                  disabled={pending || !isAdmin}
                  data-testid="product-form-submit"
                >
                  {pending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  {isEditMode ? "Änderungen speichern" : "Artikel anlegen"}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === "warehouse" && (
          <div className="space-y-8" data-testid="product-form-warehouse-tab">
            {!isEditMode && (
              <div className="flex items-center gap-4 p-5 rounded-xl bg-amber-50 text-black border border-amber-200 shadow-sm">
                <Info size={24} className="shrink-0 text-amber-600" />
                <div>
                  <h4 className="font-semibold">Artikel noch nicht erstellt</h4>
                  <p className="text-sm text-black mt-1">
                    Bitte speichern Sie den Artikel zuerst, um spezifische Lagerdaten verwalten zu können.
                  </p>
                </div>
              </div>
            )}

            {isEditMode && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {(warehousesQuery.data ?? []).map((warehouse) => {
                  const form =
                    warehouseFormById[warehouse.id] ??
                    emptyWarehouseSettingForm();

                  return (
                    <div
                      key={warehouse.id}
                      className="card border border-[var(--line)] bg-[var(--panel)] shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden"
                      data-testid={`product-warehouse-setting-${warehouse.id}`}
                    >
                      <div className="bg-[var(--panel-soft)] border-b border-[var(--line)] px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[var(--panel)] border border-[var(--line)] flex items-center justify-center text-[var(--accent)] shadow-sm">
                            <Warehouse size={20} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-[var(--ink)] text-lg leading-tight">
                              {warehouse.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs font-mono bg-[var(--line)] px-1.5 py-0.5 rounded text-[var(--muted)]">
                                {warehouse.code}
                              </span>
                              <span className="text-xs text-[var(--muted)]">Lager #{warehouse.id}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
                          {/* Row 1 - Main Info */}
                          <label className="space-y-1.5">
                            <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">
                              EAN Code
                            </span>
                            <div className="relative">
                              <input
                                className="input w-full text-sm h-10"
                                value={form.ean}
                                onChange={(event) =>
                                  setWarehouseFormById((prev) => ({
                                    ...prev,
                                    [warehouse.id]: {
                                      ...form,
                                      ean: event.target.value,
                                    },
                                  }))
                                }
                                placeholder="-"
                              />
                            </div>
                          </label>
                          <label className="space-y-1.5">
                            <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">
                              Lead Time (Tage)
                            </span>
                            <input
                              className="input w-full text-sm h-10"
                              type="number"
                              min="0"
                              step="1"
                              value={form.leadTimeDays}
                              onChange={(event) =>
                                setWarehouseFormById((prev) => ({
                                  ...prev,
                                  [warehouse.id]: {
                                    ...form,
                                    leadTimeDays: event.target.value,
                                  },
                                }))
                              }
                              placeholder="0"
                            />
                          </label>
                          <div className="hidden md:block" />

                          {/* Row 2 - Stock Levels */}
                          <div className="md:col-span-3 border-t border-[var(--line)] my-2"></div>

                          <label className="space-y-1.5">
                            <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-red-500"></div> Min. Bestand
                            </span>
                            <input
                              className="input w-full text-sm h-10"
                              type="number"
                              min="0"
                              step="0.001"
                              value={form.minStock}
                              onChange={(event) =>
                                setWarehouseFormById((prev) => ({
                                  ...prev,
                                  [warehouse.id]: {
                                    ...form,
                                    minStock: event.target.value,
                                  },
                                }))
                              }
                              placeholder="0.000"
                            />
                          </label>
                          <label className="space-y-1.5">
                            <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-amber-500"></div> Meldebestand
                            </span>
                            <input
                              className="input w-full text-sm h-10"
                              type="number"
                              min="0"
                              step="0.001"
                              value={form.reorderPoint}
                              onChange={(event) =>
                                setWarehouseFormById((prev) => ({
                                  ...prev,
                                  [warehouse.id]: {
                                    ...form,
                                    reorderPoint: event.target.value,
                                  },
                                }))
                              }
                              placeholder="0.000"
                            />
                          </label>
                          <label className="space-y-1.5">
                            <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-blue-500"></div> Sicherheitsbest.
                            </span>
                            <input
                              className="input w-full text-sm h-10"
                              type="number"
                              min="0"
                              step="0.001"
                              value={form.safetyStock}
                              onChange={(event) =>
                                setWarehouseFormById((prev) => ({
                                  ...prev,
                                  [warehouse.id]: {
                                    ...form,
                                    safetyStock: event.target.value,
                                  },
                                }))
                              }
                              placeholder="0.000"
                            />
                          </label>

                          <label className="space-y-1.5">
                            <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">
                              Maximalbestand
                            </span>
                            <input
                              className="input w-full text-sm h-10"
                              type="number"
                              min="0"
                              step="0.001"
                              value={form.maxStock}
                              onChange={(event) =>
                                setWarehouseFormById((prev) => ({
                                  ...prev,
                                  [warehouse.id]: {
                                    ...form,
                                    maxStock: event.target.value,
                                  },
                                }))
                              }
                              placeholder="0.000"
                            />
                          </label>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-[var(--line)]">
                          <button
                            className="btn btn-sm text-sm text-[var(--danger)] hover:bg-red-50 hover:border-red-200"
                            type="button"
                            onClick={() =>
                              void onClearWarehouseSetting(warehouse.id)
                            }
                            disabled={pending || !isAdmin}
                            data-testid={`product-warehouse-clear-${warehouse.id}`}
                          >
                            <Trash2 size={14} />
                            Zurücksetzen
                          </button>
                          <button
                            className="btn btn-sm text-sm btn-primary shadow-sm"
                            type="button"
                            onClick={() => void onSaveWarehouseSetting(warehouse.id)}
                            disabled={pending || !isAdmin}
                            data-testid={`product-warehouse-save-${warehouse.id}`}
                          >
                            <Save size={14} />
                            Speichern
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "pricing" && canReadPricing && (
          <div className="space-y-6" data-testid="product-form-pricing-panel">
            {!isEditMode && (
              <div className="flex items-center gap-4 p-5 rounded-xl bg-amber-50 text-black border border-amber-200 shadow-sm">
                <Info size={24} className="shrink-0 text-amber-600" />
                <div>
                  <h4 className="font-semibold">Artikel noch nicht erstellt</h4>
                  <p className="text-sm text-black mt-1">
                    Bitte speichern Sie den Artikel zuerst, um Basispreise zu hinterlegen.
                  </p>
                </div>
              </div>
            )}

            {isEditMode && (
              <>
                <section className="card p-6 border border-[var(--line)] bg-[var(--panel)] shadow-sm rounded-xl">
                  <h3 className="text-lg font-semibold text-[var(--ink)] mb-5">
                    Basispreis (für alle Kunden)
                  </h3>
                  <form className="space-y-4" onSubmit={(event) => void onCreateBasePrice(event)}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <label className="space-y-1.5">
                        <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">
                          Nettopreis
                        </span>
                        <input
                          className="input w-full"
                          type="number"
                          min="0"
                          step="0.01"
                          value={basePriceNet}
                          onChange={(event) => setBasePriceNet(event.target.value)}
                          data-testid="product-pricing-net-input"
                          placeholder="0.00"
                          disabled={!canWritePricing}
                          required
                        />
                      </label>

                      <label className="space-y-1.5">
                        <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">
                          USt
                        </span>
                        <select
                          className="input w-full"
                          value={basePriceVatRate}
                          onChange={(event) => setBasePriceVatRate(event.target.value)}
                          data-testid="product-pricing-vat-select"
                          disabled={!canWritePricing}
                        >
                          <option value="0">0%</option>
                          <option value="7">7%</option>
                          <option value="19">19%</option>
                        </select>
                      </label>

                      <div className="space-y-1.5">
                        <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">
                          Brutto (Vorschau)
                        </span>
                        <div
                          className="input w-full bg-[var(--panel-soft)] flex items-center"
                          data-testid="product-pricing-gross-preview"
                        >
                          {basePriceGrossPreview ? `${basePriceGrossPreview} EUR` : "-"}
                        </div>
                      </div>
                    </div>

                    {basePriceError ? (
                      <p className="text-sm text-red-600">{basePriceError}</p>
                    ) : null}

                    {!canWritePricing ? (
                      <p className="text-sm text-[var(--muted)]">Keine Berechtigung zum Schreiben von Preisen.</p>
                    ) : null}

                    <div className="flex justify-end">
                      <button
                        className="btn btn-primary min-w-[180px]"
                        type="submit"
                        disabled={createProductBasePriceMutation.isPending || !canWritePricing}
                        data-testid="product-pricing-save-btn"
                      >
                        {createProductBasePriceMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Preis speichern
                      </button>
                    </div>
                  </form>
                </section>

                <section
                  className="card p-6 border border-[var(--line)] bg-[var(--panel)] shadow-sm rounded-xl"
                  data-testid="product-pricing-history"
                >
                  <h3 className="text-lg font-semibold text-[var(--ink)] mb-4">
                    Preis-Historie
                  </h3>

                  {productBasePricesQuery.isLoading ? (
                    <p className="text-sm text-[var(--muted)]">Preise werden geladen...</p>
                  ) : (productBasePricesQuery.data?.length ?? 0) === 0 ? (
                    <p className="text-sm text-[var(--muted)]">Noch kein Basispreis vorhanden.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-[var(--muted)] border-b border-[var(--line)]">
                            <th className="py-2 pr-4">Status</th>
                            <th className="py-2 pr-4">Netto</th>
                            <th className="py-2 pr-4">USt</th>
                            <th className="py-2 pr-4">Brutto</th>
                            <th className="py-2 pr-4">Gültig ab</th>
                            <th className="py-2 pr-4">Gültig bis</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(productBasePricesQuery.data ?? []).map((price) => (
                            <tr key={price.id} className="border-b border-[var(--line)]/50">
                              <td className="py-2 pr-4">
                                {activeBasePriceId === price.id ? (
                                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-green-100 text-green-800 border border-green-200">
                                    Aktuell
                                  </span>
                                ) : (
                                  <span className="text-[var(--muted)] text-xs">Historisch</span>
                                )}
                              </td>
                              <td className="py-2 pr-4">{formatPriceAmount(price.net_price)} {price.currency}</td>
                              <td className="py-2 pr-4">{price.vat_rate}%</td>
                              <td className="py-2 pr-4">{formatPriceAmount(price.gross_price)} {price.currency}</td>
                              <td className="py-2 pr-4">{price.valid_from ? new Date(price.valid_from).toLocaleString() : "-"}</td>
                              <td className="py-2 pr-4">{price.valid_to ? new Date(price.valid_to).toLocaleString() : "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        )}

        {activeTab === "suppliers" && (
          <div className="space-y-8" data-testid="product-form-suppliers-tab">
            {!isEditMode && (
              <div className="flex items-center gap-4 p-5 rounded-xl bg-amber-50 text-black border border-amber-200 shadow-sm">
                <Info size={24} className="shrink-0 text-amber-600" />
                <div>
                  <h4 className="font-semibold">Artikel noch nicht erstellt</h4>
                  <p className="text-sm text-black mt-1">
                    Bitte speichern Sie den Artikel zuerst, um Lieferanten zuordnen zu können.
                  </p>
                </div>
              </div>
            )}

            {isEditMode && (
              <>
                <section className="card p-6 border border-[var(--line)] bg-[var(--panel)] shadow-sm rounded-xl">
                  <h3 className="text-lg font-semibold text-[var(--ink)] mb-6 flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-[var(--accent)]/10 text-[var(--accent)]">
                      <Plus size={18} />
                    </div>
                    Neuen Lieferanten zuordnen
                  </h3>
                  <form
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
                    onSubmit={(event) => void onCreateSupplierRelation(event)}
                    data-testid="product-supplier-form"
                  >
                    <label className="md:col-span-2 lg:col-span-4 space-y-1.5">
                      <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">
                        Lieferant auswählen <span className="text-[var(--danger)]">*</span>
                      </span>
                      <select
                        className="input w-full h-11"
                        value={selectedSupplierId}
                        onChange={(event) =>
                          setSelectedSupplierId(event.target.value)
                        }
                        data-testid="product-supplier-select"
                        required
                      >
                        <option value="">-- Bitte wählen --</option>
                        {(suppliersQuery.data?.items ?? []).map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.supplier_number} - {supplier.company_name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">
                        Lieferanten Art.-Nr.
                      </span>
                      <div className="relative">
                        <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                        <input
                          className="input w-full !pl-10 text-sm h-11"
                          value={supplierProductNumber}
                          onChange={(event) =>
                            setSupplierProductNumber(event.target.value)
                          }
                          data-testid="product-supplier-product-number"
                          placeholder="Optional"
                        />
                      </div>
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">
                        Einkaufspreis
                      </span>
                      <div className="relative">
                        <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                        <input
                          className="input w-full !pl-10 text-sm h-11"
                          type="number"
                          min="0"
                          step="0.01"
                          value={supplierPrice}
                          onChange={(event) =>
                            setSupplierPrice(event.target.value)
                          }
                          data-testid="product-supplier-price"
                          placeholder="0.00"
                        />
                      </div>
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">
                        Lieferzeit (Tage)
                      </span>
                      <div className="relative">
                        <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                        <input
                          className="input w-full !pl-10 text-sm h-11"
                          type="number"
                          min="0"
                          step="1"
                          value={supplierLeadTimeDays}
                          onChange={(event) =>
                            setSupplierLeadTimeDays(event.target.value)
                          }
                          data-testid="product-supplier-lead-time"
                          placeholder="0"
                        />
                      </div>
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">
                        Mindestbestellmenge
                      </span>
                      <div className="relative">
                        <ShoppingCart size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                        <input
                          className="input w-full !pl-10 text-sm h-11"
                          type="number"
                          min="0"
                          step="0.001"
                          value={supplierMinOrderQuantity}
                          onChange={(event) =>
                            setSupplierMinOrderQuantity(event.target.value)
                          }
                          data-testid="product-supplier-min-order"
                          placeholder="0"
                        />
                      </div>
                    </label>

                    <div className="md:col-span-2 lg:col-span-4 flex items-center justify-between pt-4 border-t border-[var(--line)]">
                      <div className="flex items-center gap-3 min-w-0 group">
                        <div className="relative flex items-center">
                          <input
                            id="product-supplier-preferred-checkbox"
                            type="checkbox"
                            className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-[var(--line)] checked:border-[var(--accent)] checked:bg-[var(--accent)] transition-all"
                            checked={supplierPreferred}
                            onChange={(event) =>
                              setSupplierPreferred(event.target.checked)
                            }
                            data-testid="product-supplier-preferred"
                          />
                          <Check size={14} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" />
                        </div>
                        <label
                          htmlFor="product-supplier-preferred-checkbox"
                          className="cursor-pointer text-sm font-medium text-[var(--ink)] transition-colors group-hover:text-[var(--accent)]"
                        >
                          Als bevorzugter Lieferant markieren
                        </label>
                      </div>

                      <button
                        className="btn btn-primary min-w-[140px]"
                        type="submit"
                        disabled={pending || !isAdmin}
                        data-testid="product-supplier-add-btn"
                      >
                        {createProductSupplierMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                        Hinzufügen
                      </button>
                    </div>
                  </form>
                </section>

                <div className="space-y-4">
                  <h3 className="font-bold text-[var(--muted)] uppercase tracking-wider text-sm px-1">Zugeordnete Lieferanten</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {(productSuppliersQuery.data ?? []).map((relation) => (
                      <div
                        key={relation.id}
                        className={`group flex flex-col md:flex-row md:items-center justify-between gap-6 p-5 rounded-xl border transition-all duration-200 ${relation.is_preferred
                          ? "border-[var(--accent)] bg-green-50/40 shadow-sm"
                          : "border-[var(--line)] bg-[var(--panel)] hover:border-[var(--line-strong)] hover:shadow-sm"
                          }`}
                        data-testid={`product-supplier-relation-${relation.id}`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-[var(--ink)] text-lg">
                              {supplierNameById.get(relation.supplier_id) ??
                                `Lieferant #${relation.supplier_id}`}
                            </span>
                            {relation.is_preferred && (
                              <span className="inline-flex items-center gap-1.5 text-[10px] uppercase font-bold text-[var(--accent-strong)] bg-green-100 px-2 py-0.5 rounded-full border border-green-200">
                                <Star size={10} fill="currentColor" /> Preferred
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--muted)]">
                            <span className="flex items-center gap-1.5"><Hash size={14} /> Art.-Nr: <span className="font-medium text-[var(--ink)]">{relation.supplier_product_number || "-"}</span></span>
                            <span className="flex items-center gap-1.5"><DollarSign size={14} /> Preis: <span className="font-medium text-[var(--ink)]">{relation.price ?? "-"}</span></span>
                            <span className="flex items-center gap-1.5"><Clock size={14} /> Lead Time: <span className="font-medium text-[var(--ink)]">{relation.lead_time_days ?? "-"} Tage</span></span>
                            <span className="flex items-center gap-1.5"><ShoppingCart size={14} /> MOQ: <span className="font-medium text-[var(--ink)]">{relation.min_order_quantity ?? "-"}</span></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-4 md:pt-0 border-t md:border-0 border-[var(--line)]/50">
                          <button
                            className={`btn btn-sm ${relation.is_preferred ? "text-[var(--muted)] hover:bg-[var(--line)]" : "text-[var(--accent)] bg-green-50 hover:bg-green-100 border-green-200"}`}
                            type="button"
                            onClick={() =>
                              void updateProductSupplierMutation.mutateAsync({
                                relation,
                                payload: {
                                  is_preferred: !relation.is_preferred,
                                },
                              })
                            }
                            disabled={pending || !isAdmin}
                            data-testid={`product-supplier-toggle-preferred-${relation.id}`}
                            title={relation.is_preferred ? "Markierung entfernen" : "Als bevorzugt markieren"}
                          >
                            <Star size={16} fill={relation.is_preferred ? "none" : "currentColor"} />
                            {relation.is_preferred ? "Unmark" : "Preferred"}
                          </button>
                          <button
                            className="btn btn-sm text-red-600 hover:bg-red-50 border-transparent hover:border-red-200"
                            type="button"
                            onClick={() =>
                              void deleteProductSupplierMutation.mutateAsync(
                                relation.id
                              )
                            }
                            disabled={pending || !isAdmin}
                            data-testid={`product-supplier-delete-${relation.id}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {!productSuppliersQuery.isLoading &&
                    (productSuppliersQuery.data?.length ?? 0) === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 text-[var(--muted)] bg-[var(--panel-soft)] rounded-xl border border-dashed border-[var(--line)]">
                        <Truck size={48} className="opacity-20 mb-3" />
                        <p className="font-medium">Noch keine Lieferanten zugeordnet.</p>
                        <p className="text-sm">Verwenden Sie das Formular oben, um Lieferanten hinzuzufügen.</p>
                      </div>
                    )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
