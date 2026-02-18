import type { ReactNode } from "react";

export function ReceiptItemForm({ children }: { children: ReactNode }) {
  return <section data-testid="goods-receipt-item-form">{children}</section>;
}
