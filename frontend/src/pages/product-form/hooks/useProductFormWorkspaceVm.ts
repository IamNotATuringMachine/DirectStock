import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { fetchProductBasePrices, resolveProductPrice } from "../../../services/pricingApi";
import { fetchProductWarehouseSettings } from "../../../services/productSettingsApi";
import { fetchProductSuppliers } from "../../../services/suppliersApi";
import { fetchBins, fetchZones } from "../../../services/warehousesApi";
import { useAuthStore } from "../../../stores/authStore";
import { useProductFormActions } from "./useProductFormActions";
import { createStepMeta, tabConfig } from "./productFormWorkspaceMeta";
import { useProductFormQueries } from "./useProductFormQueries";
import { useProductFormState } from "./useProductFormState";
import { useProductFormWorkspaceEffects } from "./useProductFormWorkspaceEffects";
import { useProductFormWorkspaceHandlers } from "./useProductFormWorkspaceHandlers";
import { useProductFormWorkspaceMutations } from "./useProductFormWorkspaceMutations";
import { ProductCreateStep, ProductTab, deriveActiveBasePriceId } from "../model";

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

  useProductFormWorkspaceEffects({
    productQueryData: productQuery.data,
    setProductForm,
    setDefaultBinId,
    isCreateMode,
    isCreateWizardFlow,
    requestedStep,
    requestedTab,
    createWizardSteps,
    firstCreateOptionalStep,
    setActiveTab,
    canReadPricing,
    warehousesData: warehousesQuery.data,
    warehouseSettingsData: settingsQuery.data,
    setWarehouseFormById,
  });

  const {
    createProductMutation,
    updateProductMutation,
    upsertWarehouseSettingMutation,
    deleteWarehouseSettingMutation,
    createProductSupplierMutation,
    updateProductSupplierMutation,
    deleteProductSupplierMutation,
    createProductBasePriceMutation,
    pending,
  } = useProductFormWorkspaceMutations({
    queryClient,
    navigate,
    firstCreateOptionalStep,
    productId,
    setSupplierProductNumber,
    setSupplierPrice,
    setSupplierLeadTimeDays,
    setSupplierMinOrderQuantity,
    setSupplierPreferred,
    setBasePriceNet,
    setBasePriceVatRate,
    setBasePriceError,
  });

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

  const { handleSubmit, onSaveWarehouseSetting, onClearWarehouseSetting, onCreateSupplierRelation, onCreateBasePrice } =
    useProductFormWorkspaceHandlers({
      isAdmin,
      isEditMode,
      productId,
      productForm,
      defaultBinId,
      warehouseFormById,
      selectedSupplierId,
      supplierProductNumber,
      supplierPrice,
      supplierLeadTimeDays,
      supplierMinOrderQuantity,
      supplierPreferred,
      canWritePricing,
      basePriceNet,
      basePriceVatRate,
      setBasePriceError,
      createProductMutation,
      updateProductMutation,
      upsertWarehouseSettingMutation,
      deleteWarehouseSettingMutation,
      createProductSupplierMutation,
      createProductBasePriceMutation,
    });

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
