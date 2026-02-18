import type { ReactNode } from "react";

export function ProductWarehouseTab({ children }: { children: ReactNode }) {
  return <section data-testid="product-warehouse-tab-section">{children}</section>;
}
