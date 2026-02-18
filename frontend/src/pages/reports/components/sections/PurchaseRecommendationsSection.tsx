import type { ReportPurchaseRecommendationRow } from "../../../../types";

type PurchaseRecommendationsSectionProps = {
  items: ReportPurchaseRecommendationRow[];
};

export function PurchaseRecommendationsSection({ items }: PurchaseRecommendationsSectionProps) {
  return (
    <table className="products-table" data-testid="reports-purchase-recommendations-table">
      <thead className="table-head-standard">
        <tr>
          <th>ID</th>
          <th>Produkt</th>
          <th>Status</th>
          <th>Target</th>
          <th>On Hand</th>
          <th>Open PO</th>
          <th>Deficit</th>
          <th>Rec. Qty</th>
        </tr>
      </thead>
      <tbody>
        {items.map((row) => (
          <tr key={row.recommendation_id} className="hover:bg-[var(--panel-soft)]">
            <td>{row.recommendation_id}</td>
            <td>{row.product_id}</td>
            <td>{row.status}</td>
            <td>{row.target_stock}</td>
            <td>{row.on_hand_quantity}</td>
            <td>{row.open_po_quantity}</td>
            <td className="text-red-600 font-medium">{row.deficit_quantity}</td>
            <td className="text-[var(--accent)] font-bold">{row.recommended_quantity}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
