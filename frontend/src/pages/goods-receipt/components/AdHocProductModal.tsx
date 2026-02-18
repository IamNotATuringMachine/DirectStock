import type { ReactNode } from "react";

export function AdHocProductModal({ children }: { children: ReactNode }) {
  return <section data-testid="goods-receipt-adhoc-product-modal">{children}</section>;
}
