import { useQuery } from "@tanstack/react-query";

import { fetchGoodsReceiptItems, fetchGoodsReceipts } from "../../../services/operationsApi";

export function useGoodsReceiptQueries(selectedReceiptId: number | null) {
  const receiptsQuery = useQuery({
    queryKey: ["goods-receipts"],
    queryFn: () => fetchGoodsReceipts(),
  });

  const receiptItemsQuery = useQuery({
    queryKey: ["goods-receipt-items", selectedReceiptId],
    queryFn: () => fetchGoodsReceiptItems(selectedReceiptId as number),
    enabled: selectedReceiptId !== null,
  });

  return {
    receiptsQuery,
    receiptItemsQuery,
  };
}
