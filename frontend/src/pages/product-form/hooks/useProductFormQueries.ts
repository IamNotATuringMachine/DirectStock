import { useQuery } from "@tanstack/react-query";

import { fetchProductById, fetchProductGroups } from "../../../services/productsApi";
import { fetchSuppliers } from "../../../services/suppliersApi";
import { fetchWarehouses } from "../../../services/warehousesApi";

export function useProductFormQueries(productId: number | null, isEditMode: boolean) {
  const productQuery = useQuery({
    queryKey: ["product", productId],
    queryFn: () => fetchProductById(productId as number),
    enabled: isEditMode,
  });

  const productGroupsQuery = useQuery({
    queryKey: ["product-groups"],
    queryFn: fetchProductGroups,
  });

  const suppliersQuery = useQuery({
    queryKey: ["suppliers", "product-form"],
    queryFn: () => fetchSuppliers({ page: 1, pageSize: 200, isActive: true }),
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouses", "product-form"],
    queryFn: fetchWarehouses,
  });

  return {
    productQuery,
    productGroupsQuery,
    suppliersQuery,
    warehousesQuery,
  };
}
