import type { ReactNode } from "react";

export function ProductMasterTab({ children }: { children: ReactNode }) {
  return <section data-testid="product-master-tab-section">{children}</section>;
}
