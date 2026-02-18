import type { ReactNode } from "react";

export function ReceiptHeaderForm({ children }: { children: ReactNode }) {
  return <section data-testid="goods-receipt-header-form">{children}</section>;
}
