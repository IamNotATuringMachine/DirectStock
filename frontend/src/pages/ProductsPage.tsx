import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { deleteProduct, fetchProductGroups, fetchProducts } from "../services/productsApi";
import { useAuthStore } from "../stores/authStore";
import type { ProductStatus } from "../types";
import { ProductsView } from "./products/ProductsView";

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.roles.includes("admin") ?? false;

  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | ProductStatus>("");
  const [groupFilter, setGroupFilter] = useState<string>("");

  const groupIdNumber = groupFilter ? Number(groupFilter) : undefined;

  const productsQuery = useQuery({
    queryKey: ["products", page, pageSize, search, statusFilter, groupIdNumber],
    queryFn: () =>
      fetchProducts({
        page,
        pageSize,
        search: search || undefined,
        status: statusFilter || undefined,
        groupId: groupIdNumber,
      }),
  });

  const groupsQuery = useQuery({
    queryKey: ["product-groups"],
    queryFn: fetchProductGroups,
  });

  const deleteProductMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  const total = productsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const productRows = useMemo(() => productsQuery.data?.items ?? [], [productsQuery.data]);

  const handleSearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <ProductsView
      isAdmin={isAdmin}
      searchInput={searchInput}
      onSearchInputChange={setSearchInput}
      onSearchKeyDown={handleKeyDown}
      statusFilter={statusFilter}
      onStatusFilterChange={(value) => {
        setStatusFilter(value);
        setPage(1);
      }}
      groupFilter={groupFilter}
      onGroupFilterChange={(value) => {
        setGroupFilter(value);
        setPage(1);
      }}
      groups={groupsQuery.data ?? []}
      onSearch={handleSearch}
      loading={productsQuery.isLoading}
      error={productsQuery.isError}
      productRows={productRows}
      deletePending={deleteProductMutation.isPending}
      onDeleteProduct={(productId) => {
        void deleteProductMutation.mutateAsync(productId);
      }}
      page={page}
      totalPages={totalPages}
      total={total}
      onPrevPage={() => setPage((value) => value - 1)}
      onNextPage={() => setPage((value) => value + 1)}
    />
  );
}
