export function GoodsReceiptReceiptActions({ vm }: { vm: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-4 border-t border-[var(--line)]">
      <button
        className="btn btn-ghost w-full justify-center text-[var(--destructive)] hover:bg-red-50"
        type="button"
        disabled={!vm.selectedReceiptId || vm.selectedReceipt?.status !== "draft" || vm.deleteMutation.isPending}
        onClick={() => {
          if (!vm.selectedReceiptId) {
            return;
          }
          if (!window.confirm("Diesen Draft-Beleg wirklich loeschen?")) {
            return;
          }
          void vm.deleteMutation.mutateAsync(vm.selectedReceiptId);
        }}
        data-testid="goods-receipt-delete-btn"
      >
        Loeschen
      </button>

      <button
        className="btn btn-ghost w-full justify-center text-[var(--destructive)] hover:bg-red-50"
        type="button"
        disabled={!vm.selectedReceiptId || vm.selectedReceipt?.status !== "draft" || vm.cancelMutation.isPending}
        onClick={() => vm.selectedReceiptId && void vm.cancelMutation.mutateAsync(vm.selectedReceiptId)}
        data-testid="goods-receipt-cancel-btn"
      >
        Stornieren
      </button>

      <button
        className="btn btn-primary w-full justify-center"
        type="button"
        disabled={!vm.selectedReceiptId || vm.selectedReceipt?.status !== "draft" || vm.completeMutation.isPending}
        onClick={() => void vm.onCompleteReceipt()}
        data-testid="goods-receipt-complete-btn"
      >
        Abschließen
      </button>
    </div>
  );
}
