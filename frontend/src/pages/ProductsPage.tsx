import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Package,
  Layers,
  Tag,
  Archive,
  Ban,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

import { deleteProduct, fetchProductGroups, fetchProducts } from "../services/productsApi";
import { useAuthStore } from "../stores/authStore";
import type { ProductStatus } from "../types";

const productStatuses: ProductStatus[] = ["active", "blocked", "deprecated", "archived"];
const productStatusLabels: Record<ProductStatus, string> = {
  active: "Aktiv",
  blocked: "Gesperrt",
  deprecated: "Veraltet",
  archived: "Archiviert",
};

function toDisplayUnit(unit: string): string {
  const normalized = unit.trim().toLowerCase();
  if (normalized === "piece" || normalized === "pieces") {
    return "Stück";
  }
  return unit;
}

function toDisplayStatus(status: ProductStatus): string {
  return productStatusLabels[status];
}

const StatusIcon = ({ status }: { status: ProductStatus }) => {
  switch (status) {
    case "active":
      return <CheckCircle className="w-3.5 h-3.5" />;
    case "blocked":
      return <Ban className="w-3.5 h-3.5" />;
    case "deprecated":
      return <AlertCircle className="w-3.5 h-3.5" />;
    case "archived":
      return <Archive className="w-3.5 h-3.5" />;
    default:
      return null;
  }
};

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <section className="page flex flex-col gap-6" data-testid="products-page">
      {/* Header Section */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="page-title">Artikelstamm</h2>
          <p className="section-subtitle mt-1">
            Verwalten Sie alle Produkte und Lagerartikel zentral. Dienstleistungen werden über Produktgruppen abgebildet.
          </p>
        </div>
        {isAdmin && (
          <Link
            to="/products/new"
            className="btn btn-primary shadow-sm hover:shadow transition-all duration-200"
            data-testid="products-create-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Neuer Artikel
          </Link>
        )}
      </header>

      {/* Toolbar / Filters */}
      <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-4 items-center">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)] pointer-events-none" />
            <input
              className="input w-full !pl-12"
              placeholder="Suche nach Nummer, Name, Beschreibung..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              data-testid="products-search-input"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)] opacity-70 pointer-events-none" />
            <select
              className="input w-full !pl-12 appearance-none"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as "" | ProductStatus);
                setPage(1);
              }}
              data-testid="products-status-filter"
            >
              <option value="">Alle Status</option>
              {productStatuses.map((status) => (
                <option key={status} value={status}>
                  {toDisplayStatus(status)}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--muted)]">
              <ChevronRight className="w-4 h-4 rotate-90" />
            </div>
          </div>

          {/* Group Filter */}
          <div className="relative">
            <Layers className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)] opacity-70 pointer-events-none" />
            <select
              className="input w-full !pl-12 appearance-none"
              value={groupFilter}
              onChange={(e) => {
                setGroupFilter(e.target.value);
                setPage(1);
              }}
              data-testid="products-group-filter"
            >
              <option value="">Alle Gruppen</option>
              {(groupsQuery.data ?? []).map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--muted)]">
              <ChevronRight className="w-4 h-4 rotate-90" />
            </div>
          </div>

          {/* Search Button */}
          <button
            className="btn w-full md:w-auto"
            onClick={handleSearch}
            data-testid="products-search-btn"
          >
            Suchen
          </button>
        </div>
      </div>

      {/* Content Area */}
      {productsQuery.isLoading ? (
        <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] p-12 text-center text-[var(--muted)]">
          <div className="animate-spin w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full mx-auto mb-2"></div>
          Lade Artikel...
        </div>
      ) : productsQuery.isError ? (
        <div className="bg-red-50 border border-red-200 rounded-[var(--radius-lg)] p-8 text-center text-red-800">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          Fehler beim Laden der Artikel. Bitte versuchen Sie es erneut.
        </div>
      ) : (
        <>
          <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse" data-testid="products-table">
                <thead>
                  <tr className="border-b border-[var(--line)] bg-[var(--panel-soft)] text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                    <th className="px-6 py-4">Artikelnr.</th>
                    <th className="px-6 py-4">Bezeichnung</th>
                    <th className="px-6 py-4 text-center">Gruppe</th>
                    <th className="px-6 py-4 text-center">Einheit</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {productRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-[var(--muted)] italic">
                        Keine Artikel gefunden.
                      </td>
                    </tr>
                  ) : (
                    productRows.map((product) => (
                      <tr
                        key={product.id}
                        className="group hover:bg-[var(--panel-soft)] transition-colors duration-150"
                        data-testid={`products-row-${product.id}`}
                      >
                        <td className="px-6 py-4 font-medium text-[var(--ink)] whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Tag className="w-3.5 h-3.5 text-[var(--muted)] opacity-50" />
                            {product.product_number}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-[var(--ink)] font-semibold">{product.name}</td>
                        <td className="px-6 py-4 text-[var(--muted)] text-sm">
                          <div className="flex justify-center">
                            {product.group_name ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] text-xs">
                                <Layers className="w-3 h-3 opacity-60" />
                                {product.group_name}
                              </span>
                            ) : (
                              <span className="text-[var(--muted)] opacity-50">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-[var(--muted)] text-sm">
                          <div className="flex justify-center">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--bg)] text-[var(--muted)] border border-[var(--line)] text-xs font-mono">
                              {toDisplayUnit(product.unit)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border
                                ${product.status === "active"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
                                  : product.status === "blocked" || product.status === "deprecated"
                                    ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800"
                                    : "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700"
                                }
                              `}
                            >
                              <StatusIcon status={product.status} />
                              {toDisplayStatus(product.status)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-100">
                            <Link
                              to={`/products/${product.id}`}
                              className="p-2 text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--bg)] rounded-md transition-colors"
                              title="Details ansehen"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            <Link
                              to={`/products/${product.id}/edit`}
                              className="p-2 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--bg)] rounded-md transition-colors"
                              title="Bearbeiten"
                            >
                              <Pencil className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => void deleteProductMutation.mutateAsync(product.id)}
                              disabled={!isAdmin || deleteProductMutation.isPending}
                              className="p-2 text-[var(--muted)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50"
                              title="Löschen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer - Only show if we have items */}
            {productRows.length > 0 && (
              <div className="border-t border-[var(--line)] p-4 flex items-center justify-between bg-[var(--panel-soft)]">
                <div className="text-sm text-[var(--muted)]">
                  Zeige <span className="font-medium text-[var(--ink)]">{page}</span> von{" "}
                  <span className="font-medium text-[var(--ink)]">{totalPages}</span> Seiten ({total} Artikel)
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn px-3 disabled:opacity-50"
                    disabled={page <= 1}
                    onClick={() => setPage((v) => v - 1)}
                    title="Vorherige Seite"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    className="btn px-3 disabled:opacity-50"
                    disabled={page >= totalPages}
                    onClick={() => setPage((v) => v + 1)}
                    title="Nächste Seite"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
