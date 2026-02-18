import type { ReactNode } from "react";

export function ProductPricingTab({ children }: { children: ReactNode }) {
  return <section data-testid="product-pricing-tab-section">{children}</section>;
}
