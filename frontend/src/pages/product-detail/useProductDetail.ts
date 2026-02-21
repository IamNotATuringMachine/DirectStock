import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { fetchInventoryByProduct, fetchMovements } from "../../services/inventoryApi";
import { resolveProductPrice } from "../../services/pricingApi";
import { fetchProductById } from "../../services/productsApi";
import { useAuthStore } from "../../stores/authStore";

export function useProductDetail() {
  const { id } = useParams();
  const productId = Number(id);

  const user = useAuthStore((state) => state.user);
  const canReadPricing = Boolean(user?.permissions?.includes("module.pricing.read"));

  const productQuery = useQuery({
    queryKey: ["product", productId],
    queryFn: () => fetchProductById(productId),
    enabled: Number.isFinite(productId),
  });

  const inventoryQuery = useQuery({
    queryKey: ["inventory-by-product", productId],
    queryFn: () => fetchInventoryByProduct(productId),
    enabled: Number.isFinite(productId),
  });

  const movementsQuery = useQuery({
    queryKey: ["inventory-movements", "product", productId],
    queryFn: () => fetchMovements({ limit: 10, productId }),
    enabled: Number.isFinite(productId),
  });

  const resolvedPriceQuery = useQuery({
    queryKey: ["pricing-resolve", productId],
    queryFn: () => resolveProductPrice(productId),
    enabled: Number.isFinite(productId) && canReadPricing,
  });

  const totalStock =
    inventoryQuery.data?.reduce((acc, item) => acc + Number(item.quantity), 0) ?? 0;
  const availableStock =
    inventoryQuery.data?.reduce((acc, item) => acc + Number(item.available_quantity), 0) ?? 0;
  const reservedStock =
    inventoryQuery.data?.reduce((acc, item) => acc + Number(item.reserved_quantity), 0) ?? 0;

  return {
    productId,
    canReadPricing,
    productQuery,
    inventoryQuery,
    movementsQuery,
    resolvedPriceQuery,
    metrics: {
      totalStock,
      availableStock,
      reservedStock,
    },
  };
}
