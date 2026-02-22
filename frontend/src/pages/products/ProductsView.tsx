import {
  AlertCircle,
  Archive,
  Ban,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Layers,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  Package,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Product, ProductGroup, ProductStatus } from "../../types";
import { productStatuses, toDisplayStatus, toDisplayUnit } from "./model";

type ProductsViewProps = {
  isAdmin: boolean;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSearchKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  statusFilter: "" | ProductStatus;
  onStatusFilterChange: (value: "" | ProductStatus) => void;
  groupFilter: string;
  onGroupFilterChange: (value: string) => void;
  groups: ProductGroup[];
  onSearch: () => void;
  loading: boolean;
  error: boolean;
  productRows: Product[];
  deletePending: boolean;
  onDeleteProduct: (productId: number) => void;
  page: number;
  totalPages: number;
  total: number;
  onPrevPage: () => void;
  onNextPage: () => void;
};

function StatusIcon({ status }: { status: ProductStatus }) {
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
}

export function ProductsView({
  isAdmin,
  searchInput,
  onSearchInputChange,
  onSearchKeyDown,
  statusFilter,
  onStatusFilterChange,
  groupFilter,
  onGroupFilterChange,
  groups,
  onSearch,
  loading,
  error,
  productRows,
  deletePending,
  onDeleteProduct,
  page,
  totalPages,
  total,
  onPrevPage,
  onNextPage,
}: ProductsViewProps) {
  return (
    <section className="page flex flex-col gap-6 max-w-[1600px] mx-auto" data-testid="products-page">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4" data-testid="products-page-header">
        <div>
          <h2 className="page-title text-zinc-900 dark:text-zinc-100">Artikelstamm</h2>
          <p className="section-subtitle mt-1 text-zinc-500 dark:text-zinc-400">
            Verwalten Sie alle Produkte und Lagerartikel zentral. Dienstleistungen werden über Produktgruppen abgebildet.
          </p>
        </div>
        {isAdmin && (
          <Link
            to="/products/new"
            className="btn h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-all duration-200 inline-flex items-center"
            data-testid="products-create-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Neuer Artikel
          </Link>
        )}
      </header>

      <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 shadow-sm" data-testid="products-toolbar">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-4 items-center">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            <input
              className="input products-toolbar-search-input h-10 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="Suche nach Nummer, Name, Beschreibung..."
              value={searchInput}
              onChange={(event) => onSearchInputChange(event.target.value)}
              onKeyDown={onSearchKeyDown}
              data-testid="products-search-input"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            <select
              className="input products-toolbar-status-select h-10 w-full appearance-none rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={statusFilter}
              onChange={(event) => onStatusFilterChange(event.target.value as "" | ProductStatus)}
              data-testid="products-status-filter"
              aria-label="Produkte nach Status filtern"
            >
              <option value="">Alle Status</option>
              {productStatuses.map((status) => (
                <option key={status} value={status}>
                  {toDisplayStatus(status)}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
              <ChevronRight className="w-4 h-4 rotate-90" />
            </div>
          </div>

          <div className="relative">
            <Layers className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            <select
              className="input products-toolbar-group-select h-10 w-full appearance-none rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={groupFilter}
              onChange={(event) => onGroupFilterChange(event.target.value)}
              data-testid="products-group-filter"
              aria-label="Produkte nach Gruppe filtern"
            >
              <option value="">Alle Gruppen</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
              <ChevronRight className="w-4 h-4 rotate-90" />
            </div>
          </div>

          <button
            className="btn h-10 px-4 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-100 font-medium transition-colors w-full md:w-auto"
            onClick={onSearch}
            data-testid="products-search-btn"
          >
            Suchen
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-12 text-center text-zinc-500">
          <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
          Lade Artikel...
        </div>
      ) : error ? (
        <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-8 text-center text-rose-800 dark:text-rose-400">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          Fehler beim Laden der Artikel. Bitte versuchen Sie es erneut.
        </div>
      ) : (
        <article className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto" data-testid="products-table-wrap">
            <table className="w-full text-left border-collapse" data-testid="products-table">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <th className="px-6 py-4">Artikelnr.</th>
                  <th className="px-6 py-4">Bezeichnung</th>
                  <th className="px-6 py-4 text-center">Gruppe</th>
                  <th className="px-6 py-4 text-center">Einheit</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {productRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 dark:text-zinc-400 italic">
                      <div className="flex flex-col items-center gap-2">
                        <Package className="w-8 h-8 opacity-20" />
                        <p>Keine Artikel gefunden.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  productRows.map((product) => (
                    <tr
                      key={product.id}
                      className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors duration-150"
                      data-testid={`products-row-${product.id}`}
                    >
                      <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-zinc-400" />
                          {product.product_number}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100 font-semibold truncate max-w-xs" title={product.name}>
                        {product.name}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex justify-center">
                          {product.group_name ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 text-xs whitespace-nowrap">
                              <Layers className="w-3 h-3 opacity-60" />
                              <span className="truncate max-w-[100px]" title={product.group_name}>{product.group_name}</span>
                            </span>
                          ) : (
                            <span className="text-zinc-400 dark:text-zinc-500">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex justify-center">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 text-xs font-mono">
                            {toDisplayUnit(product.unit)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                              product.status === "active"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
                                : product.status === "blocked" || product.status === "deprecated"
                                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800"
                                : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-400 dark:border-zinc-700"
                            }`}
                          >
                            <StatusIcon status={product.status} />
                            {toDisplayStatus(product.status)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-100 transition-opacity">
                          <Link
                            to={`/products/${product.id}`}
                            className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                            aria-label="Details"
                            title="Details ansehen"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <Link
                            to={`/products/${product.id}/edit`}
                            className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                            title="Bearbeiten"
                          >
                            <Pencil className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => onDeleteProduct(product.id)}
                            disabled={!isAdmin || deletePending}
                            className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

          {productRows.length > 0 && (
            <div className="border-t border-zinc-200 dark:border-zinc-700 p-4 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50" data-testid="products-pagination">
              <div className="text-sm text-zinc-500 dark:text-zinc-400" data-testid="products-pagination-info">
                Seite <span className="font-medium text-zinc-900 dark:text-zinc-100">{page}</span> /{" "}
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{totalPages}</span> ({total} Artikel)
              </div>
              <div className="flex gap-2" data-testid="products-pagination-actions">
                <button
                  className="btn h-8 px-3 rounded-md bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
                  disabled={page <= 1}
                  onClick={onPrevPage}
                  aria-label="Zurück"
                  title="Vorherige Seite"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  className="btn h-8 px-3 rounded-md bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
                  disabled={page >= totalPages}
                  onClick={onNextPage}
                  aria-label="Weiter"
                  title="Nächste Seite"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </article>
      )}
    </section>
  );
}
