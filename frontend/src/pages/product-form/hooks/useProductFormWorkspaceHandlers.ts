import { FormEvent } from "react";

import { emptyWarehouseSettingForm, toApiUnit, toNullableDecimal, toNullableNumber } from "../model";

type UseProductFormWorkspaceHandlersParams = {
  isAdmin: boolean;
  isEditMode: boolean;
  productId: number | null;
  productForm: {
    productNumber: string;
    name: string;
    description: string;
    groupId: string;
    unit: string;
    status: string;
    requiresItemTracking: boolean;
  };
  defaultBinId: number | null;
  warehouseFormById: Record<number, any>;
  selectedSupplierId: string;
  supplierProductNumber: string;
  supplierPrice: string;
  supplierLeadTimeDays: string;
  supplierMinOrderQuantity: string;
  supplierPreferred: boolean;
  canWritePricing: boolean;
  basePriceNet: string;
  basePriceVatRate: string;
  setBasePriceError: (next: string | null) => void;
  createProductMutation: any;
  updateProductMutation: any;
  upsertWarehouseSettingMutation: any;
  deleteWarehouseSettingMutation: any;
  createProductSupplierMutation: any;
  createProductBasePriceMutation: any;
};

export function useProductFormWorkspaceHandlers(params: UseProductFormWorkspaceHandlersParams) {
  const {
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
  } = params;

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
    handleSubmit,
    onSaveWarehouseSetting,
    onClearWarehouseSetting,
    onCreateSupplierRelation,
    onCreateBasePrice,
  };
}
