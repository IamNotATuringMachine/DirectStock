import { GoodsReceiptWorkspaceView } from "./GoodsReceiptWorkspaceView";
import { useGoodsReceiptFlow } from "./hooks/useGoodsReceiptFlow";

export function GoodsReceiptWorkspace() {
  const vm = useGoodsReceiptFlow();
  return <GoodsReceiptWorkspaceView vm={vm} />;
}
