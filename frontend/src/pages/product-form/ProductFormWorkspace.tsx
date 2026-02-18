import { ProductFormWorkspaceView } from "./ProductFormWorkspaceView";
import { useProductFormWorkspaceVm } from "./hooks/useProductFormWorkspaceVm";

export function ProductFormWorkspace() {
  const { isEditMode, productQuery, vm } = useProductFormWorkspaceVm();

  if (isEditMode && productQuery.isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="h-20 bg-[var(--panel-soft)] rounded-lg"></div>
        <div className="h-12 w-64 bg-[var(--panel-soft)] rounded-lg"></div>
        <div className="h-96 bg-[var(--panel)] rounded-xl border border-[var(--line)]"></div>
      </div>
    );
  }

  return <ProductFormWorkspaceView vm={vm} />;
}
