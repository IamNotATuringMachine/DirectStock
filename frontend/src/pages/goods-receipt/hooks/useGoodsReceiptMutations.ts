import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  cancelGoodsReceipt,
  completeGoodsReceipt,
  createGoodsReceipt,
  deleteGoodsReceipt,
} from "../../../services/operationsApi";

export function useGoodsReceiptMutations(selectedReceiptId: number | null) {
  const queryClient = useQueryClient();

  const createReceiptMutation = useMutation({
    mutationFn: createGoodsReceipt,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: completeGoodsReceipt,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
      await queryClient.invalidateQueries({ queryKey: ["goods-receipt-items", selectedReceiptId] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelGoodsReceipt,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
      await queryClient.invalidateQueries({ queryKey: ["goods-receipt-items", selectedReceiptId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGoodsReceipt,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
    },
  });

  return {
    createReceiptMutation,
    completeMutation,
    cancelMutation,
    deleteMutation,
  };
}
