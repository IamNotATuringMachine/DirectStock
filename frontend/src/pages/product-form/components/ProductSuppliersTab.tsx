import type { ReactNode } from "react";

export function ProductSuppliersTab({ children }: { children: ReactNode }) {
  return <section data-testid="product-suppliers-tab-section">{children}</section>;
}
