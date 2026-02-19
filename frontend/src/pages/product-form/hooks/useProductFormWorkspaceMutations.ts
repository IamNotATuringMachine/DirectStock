import { useMutation } from "@tanstack/react-query";

import { createProductBasePrice } from "../../../services/pricingApi";
import { deleteProductWarehouseSetting, upsertProductWarehouseSetting } from "../../../services/productSettingsApi";
import { createProduct, updateProduct } from "../../../services/productsApi";
import { createProductSupplier, deleteProductSupplier, updateProductSupplier } from "../../../services/suppliersApi";
import type { ProductSupplierRelation } from "../../../types";
import { toMutationErrorMessage } from "./productFormWorkspaceMeta";

type UseProductFormWorkspaceMutationsParams = {
  queryClient: any;
  navigate: (path: string) => void;
  firstCreateOptionalStep: string;
  productId: number | null;
  setSupplierProductNumber: (next: string) => void;
  setSupplierPrice: (next: string) => void;
  setSupplierLeadTimeDays: (next: string) => void;
  setSupplierMinOrderQuantity: (next: string) => void;
  setSupplierPreferred: (next: boolean) => void;
  setBasePriceNet: (next: string) => void;
  setBasePriceVatRate: (next: string) => void;
  setBasePriceError: (next: string | null) => void;
};

export function useProductFormWorkspaceMutations(params: UseProductFormWorkspaceMutationsParams) {
  const {
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
  } = params;

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

  return {
    createProductMutation,
    updateProductMutation,
    upsertWarehouseSettingMutation,
    deleteWarehouseSettingMutation,
    createProductSupplierMutation,
    updateProductSupplierMutation,
    deleteProductSupplierMutation,
    createProductBasePriceMutation,
    pending,
  };
}
