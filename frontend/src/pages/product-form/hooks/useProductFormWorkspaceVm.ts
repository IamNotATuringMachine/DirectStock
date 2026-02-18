import { FormEvent, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { DollarSign, Package, Truck, Warehouse } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { createProductBasePrice, fetchProductBasePrices, resolveProductPrice } from "../../../services/pricingApi";
import {
  deleteProductWarehouseSetting,
  fetchProductWarehouseSettings,
  upsertProductWarehouseSetting,
} from "../../../services/productSettingsApi";
import { createProduct, updateProduct } from "../../../services/productsApi";
import {
  createProductSupplier,
  deleteProductSupplier,
  fetchProductSuppliers,
  updateProductSupplier,
} from "../../../services/suppliersApi";
import { fetchBins, fetchZones } from "../../../services/warehousesApi";
import { useAuthStore } from "../../../stores/authStore";
import type { ProductSupplierRelation } from "../../../types";
import { useProductFormActions } from "./useProductFormActions";
import { useProductFormQueries } from "./useProductFormQueries";
import { useProductFormState } from "./useProductFormState";
import {
  ProductCreateStep,
  ProductTab,
  WarehouseSettingFormState,
  deriveActiveBasePriceId,
  emptyWarehouseSettingForm,
  toApiUnit,
  toDisplayUnit,
  toNullableDecimal,
  toNullableNumber,
} from "../model";

const tabConfig: Array<{
  id: ProductTab;
  label: string;
  icon: typeof Package;
  testId: string;
}> = [
  { id: "master", label: "Stammdaten", icon: Package, testId: "product-form-master-tab" },
  { id: "warehouse", label: "Lagerdaten", icon: Warehouse, testId: "product-form-warehouse-tab-button" },
  { id: "suppliers", label: "Lieferanten", icon: Truck, testId: "product-form-suppliers-tab-button" },
  { id: "pricing", label: "Preise", icon: DollarSign, testId: "product-form-pricing-tab" },
];

const createStepMeta: Record<ProductCreateStep, { label: string; icon: typeof Package; optional: boolean }> = {
  master: { label: "Stammdaten", icon: Package, optional: false },
  pricing: { label: "Preise", icon: DollarSign, optional: true },
  warehouse: { label: "Lagerdaten", icon: Warehouse, optional: true },
  suppliers: { label: "Lieferanten", icon: Truck, optional: true },
};

function toMutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim().length > 0) {
      return detail;
    }
  }
  return fallback;
}

export function useProductFormWorkspaceVm() {
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
  const isCreateMode = !isEditMode;
  const requestedFlow = searchParams.get("flow");
  const isCreateWizardFlow = requestedFlow === "create";
  const isCreateWizardMode = isCreateMode || isCreateWizardFlow;
  const requestedTab = searchParams.get("tab");
  const requestedStep = searchParams.get("step");

  const {
    activeTab,
    setActiveTab,
    productForm,
    setProductForm,
    warehouseFormById,
    setWarehouseFormById,
    selectedSupplierId,
    setSelectedSupplierId,
    supplierProductNumber,
    setSupplierProductNumber,
    supplierPrice,
    setSupplierPrice,
    supplierLeadTimeDays,
    setSupplierLeadTimeDays,
    supplierMinOrderQuantity,
    setSupplierMinOrderQuantity,
    supplierPreferred,
    setSupplierPreferred,
    basePriceNet,
    setBasePriceNet,
    basePriceVatRate,
    setBasePriceVatRate,
    basePriceError,
    setBasePriceError,
    defaultBinId,
    setDefaultBinId,
    defaultBinWarehouseId,
    setDefaultBinWarehouseId,
    defaultBinZoneId,
    setDefaultBinZoneId,
  } = useProductFormState();

  const createWizardSteps = useMemo<ProductCreateStep[]>(() => {
    const steps: ProductCreateStep[] = ["master"];
    if (canReadPricing) {
      steps.push("pricing");
    }
    steps.push("warehouse", "suppliers");
    return steps;
  }, [canReadPricing]);

  const firstCreateOptionalStep = useMemo<ProductCreateStep>(() => {
    return createWizardSteps.find((step) => step !== "master") ?? "master";
  }, [createWizardSteps]);

  const { productQuery, warehousesQuery, suppliersQuery } = useProductFormQueries(productId, isEditMode);

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
      groupId: product.product_group_id ? String(product.product_group_id) : "",
      unit: toDisplayUnit(product.unit),
      status: product.status,
      requiresItemTracking: product.requires_item_tracking,
    });
    setDefaultBinId(product.default_bin_id ?? null);
  }, [productQuery.data, setDefaultBinId, setProductForm]);

  useEffect(() => {
    if (isCreateMode) {
      setActiveTab("master");
      return;
    }

    if (isCreateWizardFlow) {
      if (requestedStep && createWizardSteps.includes(requestedStep as ProductCreateStep)) {
        setActiveTab(requestedStep as ProductTab);
        return;
      }
      setActiveTab(firstCreateOptionalStep);
      return;
    }

    if (!requestedTab) {
      return;
    }
    if (requestedTab === "pricing") {
      setActiveTab(canReadPricing ? "pricing" : "master");
      return;
    }
    if (requestedTab === "warehouse" || requestedTab === "suppliers" || requestedTab === "master") {
      setActiveTab(requestedTab);
    }
  }, [
    canReadPricing,
    createWizardSteps,
    firstCreateOptionalStep,
    isCreateMode,
    isCreateWizardFlow,
    requestedStep,
    requestedTab,
    setActiveTab,
  ]);

  useEffect(() => {
    if (!warehousesQuery.data) {
      return;
    }

    const settingByWarehouse = new Map((settingsQuery.data ?? []).map((setting) => [setting.warehouse_id, setting]));

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
  }, [warehousesQuery.data, settingsQuery.data, setWarehouseFormById]);

  const createProductMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: async (createdProduct) => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      navigate(`/products/${createdProduct.id}/edit?flow=create&step=${firstCreateOptionalStep}`);
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
      await queryClient.invalidateQueries({
        queryKey: ["product-warehouse-settings", productId],
      });
      await queryClient.invalidateQueries({ queryKey: ["inventory-low-stock"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-low-stock"] });
    },
  });

  const deleteWarehouseSettingMutation = useMutation({
    mutationFn: (warehouseId: number) => deleteProductWarehouseSetting(productId as number, warehouseId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["product-warehouse-settings", productId],
      });
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

  const title = useMemo(() => {
    if (isCreateWizardFlow) {
      return "Neuer Artikel";
    }
    return isEditMode ? "Artikel bearbeiten" : "Neuer Artikel";
  }, [isCreateWizardFlow, isEditMode]);

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

  const { activeCreateStepIndex, createWizardStepCount, navigateCreateWizardToStep, renderCreateWizardFooter } =
    useProductFormActions({
      navigate,
      isCreateWizardFlow,
      isEditMode,
      productId,
      activeTab: activeTab as ProductCreateStep,
      createWizardSteps,
      setActiveTab: (tab) => setActiveTab(tab as ProductTab),
    });

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
      product_group_id: productForm.groupId ? Number(productForm.groupId) : null,
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

  return {
    isEditMode,
    productQuery,
    vm: {
      title,
      isEditMode,
      isCreateWizardFlow,
      productId,
      isAdmin,
      productQuery,
      isCreateWizardMode,
      activeTab,
      activeCreateStepIndex,
      createWizardStepCount,
      createWizardSteps,
      createStepMeta,
      navigateCreateWizardToStep,
      setActiveTab,
      canReadPricing,
      tabConfig,
      handleSubmit,
      productForm,
      setProductForm,
      warehousesQuery,
      defaultBinId,
      setDefaultBinId,
      defaultBinWarehouseId,
      setDefaultBinWarehouseId,
      defaultBinZoneId,
      setDefaultBinZoneId,
      defaultBinZonesQuery,
      defaultBinBinsQuery,
      pending,
      warehouseFormById,
      setWarehouseFormById,
      onClearWarehouseSetting,
      onSaveWarehouseSetting,
      renderCreateWizardFooter,
      onCreateBasePrice,
      basePriceNet,
      setBasePriceNet,
      basePriceVatRate,
      setBasePriceVatRate,
      basePriceGrossPreview,
      basePriceError,
      canWritePricing,
      createProductBasePriceMutation,
      productBasePricesQuery,
      activeBasePriceId,
      onCreateSupplierRelation,
      selectedSupplierId,
      setSelectedSupplierId,
      suppliersQuery,
      supplierProductNumber,
      setSupplierProductNumber,
      supplierPrice,
      setSupplierPrice,
      supplierLeadTimeDays,
      setSupplierLeadTimeDays,
      supplierMinOrderQuantity,
      setSupplierMinOrderQuantity,
      supplierPreferred,
      setSupplierPreferred,
      createProductSupplierMutation,
      productSuppliersQuery,
      supplierNameById,
      updateProductSupplierMutation,
      deleteProductSupplierMutation,
    },
  };
}
