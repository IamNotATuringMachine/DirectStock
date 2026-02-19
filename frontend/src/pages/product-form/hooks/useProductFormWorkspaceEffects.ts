import { useEffect } from "react";

import { ProductCreateStep, ProductFormState, ProductTab, WarehouseSettingFormState, toDisplayUnit } from "../model";

type UseProductFormWorkspaceEffectsParams = {
  productQueryData: any;
  setProductForm: (next: ProductFormState) => void;
  setDefaultBinId: (next: number | null) => void;
  isCreateMode: boolean;
  isCreateWizardFlow: boolean;
  requestedStep: string | null;
  requestedTab: string | null;
  createWizardSteps: ProductCreateStep[];
  firstCreateOptionalStep: ProductCreateStep;
  setActiveTab: (next: ProductTab) => void;
  canReadPricing: boolean;
  warehousesData: Array<{ id: number }> | undefined;
  warehouseSettingsData:
    | Array<{
        warehouse_id: number;
        ean: string | null;
        min_stock: string | null;
        reorder_point: string | null;
        max_stock: string | null;
        safety_stock: string | null;
        lead_time_days: number | null;
      }>
    | undefined;
  setWarehouseFormById: (next: Record<number, WarehouseSettingFormState>) => void;
};

export function useProductFormWorkspaceEffects(params: UseProductFormWorkspaceEffectsParams) {
  const {
    productQueryData,
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
    warehousesData,
    warehouseSettingsData,
    setWarehouseFormById,
  } = params;

  useEffect(() => {
    if (!productQueryData) {
      return;
    }
    const product = productQueryData;
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
  }, [productQueryData, setDefaultBinId, setProductForm]);

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
    if (!warehousesData) {
      return;
    }

    const settingByWarehouse = new Map((warehouseSettingsData ?? []).map((setting) => [setting.warehouse_id, setting]));

    const nextState: Record<number, WarehouseSettingFormState> = {};
    for (const warehouse of warehousesData) {
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
  }, [setWarehouseFormById, warehouseSettingsData, warehousesData]);
}
