import type { ReactNode } from "react";

export function ScanFlowPanel({ children }: { children: ReactNode }) {
  return <section data-testid="goods-receipt-scan-flow">{children}</section>;
}
