import { ArrowRight, ListOrdered } from "lucide-react";

import type { Customer, CustomerLocation, GoodsIssue } from "../../../types";

type GoodsIssueDocumentPanelProps = {
  customerId: string;
  setCustomerId: (value: string) => void;
  customerLocationId: string;
  setCustomerLocationId: (value: string) => void;
  customerReference: string;
  setCustomerReference: (value: string) => void;
  customers: Customer[];
  customerLocations: CustomerLocation[];
  onCreateIssue: (event: React.FormEvent) => void;
  createIssuePending: boolean;
  issues: GoodsIssue[];
  selectedIssueId: number | null;
  onSelectIssue: (id: number) => void;
};

export function GoodsIssueDocumentPanel({
  customerId,
  setCustomerId,
  customerLocationId,
  setCustomerLocationId,
  customerReference,
  setCustomerReference,
  customers,
  customerLocations,
  onCreateIssue,
  createIssuePending,
  issues,
  selectedIssueId,
  onSelectIssue,
}: GoodsIssueDocumentPanelProps) {
  return (
    <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm flex flex-col h-[calc(100vh-200px)] min-h-[500px] overflow-hidden">
      <div className="p-4 border-b border-[var(--line)] bg-[var(--panel-soft)]">
        <h3 className="section-title flex items-center gap-2">
          <ListOrdered className="w-4 h-4 text-[var(--muted)]" />
          1. Beleg & Auswahl
        </h3>
      </div>

      <div className="p-4 flex-1 overflow-hidden flex flex-col gap-4">
        <form className="flex flex-col gap-3" onSubmit={onCreateIssue}>
          <select
            className="input w-full min-w-0"
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            data-testid="goods-issue-customer-select"
          >
            <option value="">Kein Kunde</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.customer_number} - {customer.company_name}
              </option>
            ))}
          </select>
          {customerId ? (
            <select
              className="input w-full min-w-0"
              value={customerLocationId}
              onChange={(event) => setCustomerLocationId(event.target.value)}
              data-testid="goods-issue-customer-location-select"
            >
              <option value="">Kein Standort</option>
              {customerLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.location_code} - {location.name}
                </option>
              ))}
            </select>
          ) : null}
          <div className="flex gap-2">
            <input
              className="input w-full min-w-0"
              placeholder="Kundenreferenz (opt.)"
              value={customerReference}
              onChange={(event) => setCustomerReference(event.target.value)}
            />
            <button className="btn btn-primary shrink-0" type="submit" disabled={createIssuePending}>
              Neu
            </button>
          </div>
        </form>

        <div className="border-b border-[var(--line)] my-1"></div>

        <div className="flex-1 overflow-y-auto border border-[var(--line)] rounded-[var(--radius-sm)] bg-[var(--bg)]" data-testid="goods-issue-list">
          {issues.length === 0 ? (
            <div className="p-8 text-center text-[var(--muted)] italic text-sm">
              Keine offenen Ausgänge gefunden.
            </div>
          ) : (
            <div className="divide-y divide-[var(--line)]">
              {issues.map((issue) => (
                <button
                  key={issue.id}
                  className={`w-full text-left p-3 hover:bg-[var(--panel-soft)] transition-colors flex items-center justify-between gap-3 group
                    ${selectedIssueId === issue.id ? "bg-[var(--panel-strong)] border-l-4 border-l-[var(--accent)] pl-[calc(0.75rem-4px)]" : "border-l-4 border-l-transparent"}
                  `}
                  onClick={() => onSelectIssue(issue.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-[var(--ink)] truncate">{issue.issue_number}</div>
                    <div className="text-xs text-[var(--muted)] flex items-center gap-1.5 mt-0.5">
                      <span className={`inline-block w-2 h-2 rounded-full ${issue.status === "completed" ? "bg-emerald-500" : issue.status === "cancelled" ? "bg-red-500" : "bg-amber-500"}`}></span>
                      {issue.status}
                    </div>
                  </div>
                  <ArrowRight className={`w-4 h-4 text-[var(--muted)] transition-transform ${selectedIssueId === issue.id ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
