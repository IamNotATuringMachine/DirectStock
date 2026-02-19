import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  fetchInventory,
  fetchInventoryByProduct,
  fetchInventorySummary,
  fetchLowStock,
  fetchMovements,
} from "../services/inventoryApi";
import { fetchWarehouses } from "../services/warehousesApi";
import type { InventoryItem } from "../types";
import { InventoryView } from "./inventory/InventoryView";

export default function InventoryPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);

  const warehouseId = warehouseFilter ? Number(warehouseFilter) : undefined;

  const summaryQuery = useQuery({ queryKey: ["inventory-summary"], queryFn: fetchInventorySummary, refetchInterval: 60000 });
  const warehousesQuery = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const inventoryQuery = useQuery({
    queryKey: ["inventory", page, pageSize, search, warehouseId],
    queryFn: () => fetchInventory({ page, pageSize, search: search || undefined, warehouseId }),
    refetchInterval: 30000,
  });
  const lowStockQuery = useQuery({ queryKey: ["inventory-low-stock"], queryFn: fetchLowStock, refetchInterval: 60000 });
  const movementsQuery = useQuery({
    queryKey: ["inventory-movements"],
    queryFn: () => fetchMovements({ limit: 12 }),
    refetchInterval: 60000,
  });

  const detailStockQuery = useQuery({
    queryKey: ["inventory-by-product", selectedProduct?.product_id],
    queryFn: () => fetchInventoryByProduct(selectedProduct?.product_id as number),
    enabled: selectedProduct !== null,
  });

  const detailMovementsQuery = useQuery({
    queryKey: ["inventory-movements", "product", selectedProduct?.product_id],
    queryFn: () => fetchMovements({ limit: 10, productId: selectedProduct?.product_id }),
    enabled: selectedProduct !== null,
  });

  const rows = useMemo(() => inventoryQuery.data?.items ?? [], [inventoryQuery.data]);
  const total = inventoryQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <InventoryView
      summary={summaryQuery.data ?? null}
      searchInput={searchInput}
      onSearchInputChange={setSearchInput}
      onSearch={() => {
        setSearch(searchInput.trim());
        setPage(1);
      }}
      warehouseFilter={warehouseFilter}
      onWarehouseFilterChange={(value) => {
        setWarehouseFilter(value);
        setPage(1);
      }}
      warehouses={warehousesQuery.data ?? []}
      rows={rows}
      page={page}
      totalPages={totalPages}
      total={total}
      onPrevPage={() => setPage((value) => value - 1)}
      onNextPage={() => setPage((value) => value + 1)}
      onSelectProduct={setSelectedProduct}
      lowStock={lowStockQuery.data ?? []}
      movements={movementsQuery.data ?? []}
      selectedProduct={selectedProduct}
      onCloseDetail={() => setSelectedProduct(null)}
      detailStock={detailStockQuery.data ?? []}
      detailStockLoading={detailStockQuery.isLoading}
      detailMovements={detailMovementsQuery.data ?? []}
      detailMovementsLoading={detailMovementsQuery.isLoading}
    />
  );
}
