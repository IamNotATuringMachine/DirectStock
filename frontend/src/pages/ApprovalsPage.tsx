import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  approveRequest,
  createApprovalRule,
  fetchApprovals,
  fetchApprovalRules,
  rejectRequest,
} from "../services/approvalsApi";
import { useAuthStore } from "../stores/authStore";

export default function ApprovalsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [ruleName, setRuleName] = useState("");
  const [entityType, setEntityType] = useState<"purchase_order" | "return_order">("purchase_order");
  const [minAmount, setMinAmount] = useState("");
  const [requiredRole, setRequiredRole] = useState("lagerleiter");
  const canManageRules = Boolean(user?.roles.some((role) => role === "admin" || role === "lagerleiter"));

  const rulesQuery = useQuery({
    queryKey: ["approval-rules"],
    queryFn: () => fetchApprovalRules(),
  });

  const approvalsQuery = useQuery({
    queryKey: ["approvals"],
    queryFn: () => fetchApprovals({ status: "pending" }),
  });

  const createRuleMutation = useMutation({
    mutationFn: createApprovalRule,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["approval-rules"] });
      setRuleName("");
      setMinAmount("");
    },
  });

  const approveMutation = useMutation({
    mutationFn: (requestId: number) => approveRequest(requestId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["approvals"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (requestId: number) => rejectRequest(requestId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["approvals"] });
    },
  });

  const onCreateRule = async (event: FormEvent) => {
    event.preventDefault();
    if (!ruleName.trim()) {
      return;
    }
    await createRuleMutation.mutateAsync({
      name: ruleName.trim(),
      entity_type: entityType,
      min_amount: minAmount.trim() || null,
      required_role: requiredRole,
      is_active: true,
    });
  };

  return (
    <div className="page space-y-6" data-testid="approvals-page">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="page-title">Genehmigungen</h1>
          <p className="section-subtitle">Approval-Regeln verwalten und offene Genehmigungen bearbeiten.</p>
        </div>
      </header>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3 items-start">
        {/* Left Column: Rules Management */}
        <div className="space-y-6 lg:col-span-1 min-w-0">
          <section className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] p-5 shadow-[var(--shadow-soft)]">
            <h2 className="section-title mb-4">Regeln</h2>

            {canManageRules ? (
              <form onSubmit={(event) => void onCreateRule(event)} data-testid="approval-rule-form" className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-[var(--ink)]">Name</label>
                  <input
                    className="input w-full"
                    value={ruleName}
                    onChange={(event) => setRuleName(event.target.value)}
                    data-testid="approval-rule-name"
                    placeholder="Regel-Name"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-[var(--ink)]">Entity</label>
                  <select
                    className="input w-full"
                    value={entityType}
                    onChange={(event) => setEntityType(event.target.value as typeof entityType)}
                    data-testid="approval-rule-entity"
                  >
                    <option value="purchase_order">purchase_order</option>
                    <option value="return_order">return_order</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-[var(--ink)]">Schwellwert</label>
                  <input
                    className="input w-full"
                    type="number"
                    min="0"
                    step="0.01"
                    value={minAmount}
                    onChange={(event) => setMinAmount(event.target.value)}
                    data-testid="approval-rule-min-amount"
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-[var(--ink)]">Pflichtrolle</label>
                  <input
                    className="input w-full"
                    value={requiredRole}
                    onChange={(event) => setRequiredRole(event.target.value)}
                    data-testid="approval-rule-required-role"
                  />
                </div>

                <button
                  className="btn btn-primary w-full justify-center mt-2"
                  type="submit"
                  disabled={createRuleMutation.isPending}
                  data-testid="approval-rule-create-btn"
                >
                  Regel speichern
                </button>
              </form>
            ) : (
              <div className="p-3 bg-[var(--panel-soft)] rounded border border-[var(--line)] text-sm text-[var(--muted)]" data-testid="approval-rule-readonly-hint">
                Nur Admin/Lagerleiter dürfen Regeln bearbeiten.
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-[var(--line)] space-y-3" data-testid="approval-rule-list">
              <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider">Vorhandene Regeln</h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                {(rulesQuery.data ?? []).map((rule) => (
                  <div key={rule.id} className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-[var(--radius-sm)]">
                    <div className="font-medium text-[var(--ink)] truncate" title={rule.name}>{rule.name}</div>
                    <div className="text-xs text-[var(--muted)] mt-1 flex flex-wrap gap-2">
                      <span className="bg-[var(--panel)] px-1.5 py-0.5 rounded border border-[var(--line)]">{rule.entity_type}</span>
                      {rule.min_amount && <span className="bg-[var(--panel)] px-1.5 py-0.5 rounded border border-[var(--line)]">min: {rule.min_amount}</span>}
                      <span className="bg-[var(--panel)] px-1.5 py-0.5 rounded border border-[var(--line)]">{rule.required_role}</span>
                    </div>
                  </div>
                ))}
                {(rulesQuery.data?.length ?? 0) === 0 && (
                  <p className="text-sm text-[var(--muted)] italic">Keine Regeln definiert.</p>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Approvals List */}
        <div className="space-y-6 lg:col-span-2 min-w-0">
          <section className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] p-5 shadow-[var(--shadow-soft)] min-h-[500px]">
            <h2 className="section-title mb-4">Offene Genehmigungen</h2>

            <div className="space-y-3" data-testid="approval-request-list">
              {(approvalsQuery.data ?? []).map((request) => (
                <div key={request.id} className="group p-4 bg-[var(--panel-soft)] border border-[var(--line)] rounded-[var(--radius-md)] hover:border-[var(--line-strong)] transition-colors grid gap-4 sm:grid-cols-[1fr_auto] items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-bold text-[var(--ink)]">#{request.id}</span>
                      <span className="px-2 py-0.5 text-xs font-semibold bg-[var(--warning-bg)] text-[var(--warning-ink)] rounded-full border border-[var(--warning-ink)]/20 uppercase tracking-wide">
                        {request.status}
                      </span>
                    </div>
                    <div className="font-medium text-[var(--ink)] truncate break-words">
                      {request.entity_type} <span className="text-[var(--muted)]">ID:</span> {request.entity_id}
                    </div>
                    <div className="mt-1 text-sm text-[var(--muted)]">
                      Betrag: <span className="font-semibold text-[var(--ink)]">{request.amount ?? "-"}</span>
                      {request.reason && <span className="block mt-1 text-xs italic opacity-80 break-words">"{request.reason}"</span>}
                    </div>
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      className="btn flex-1 sm:flex-none justify-center bg-[var(--success-bg)] text-[var(--success-ink)] border-[var(--success-bg)] hover:bg-[var(--success-ink)] hover:text-white"
                      onClick={() => void approveMutation.mutateAsync(request.id)}
                      disabled={approveMutation.isPending}
                      data-testid={`approval-approve-${request.id}`}
                    >
                      Approve
                    </button>
                    <button
                      className="btn flex-1 sm:flex-none justify-center btn-danger"
                      onClick={() => void rejectMutation.mutateAsync(request.id)}
                      disabled={rejectMutation.isPending}
                      data-testid={`approval-reject-${request.id}`}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}

              {!approvalsQuery.isLoading && (approvalsQuery.data?.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-[var(--muted)] border-2 border-dashed border-[var(--line)] rounded-[var(--radius-md)] bg-[var(--bg)]">
                  <p className="mb-1">Keine offenen Genehmigungen</p>
                  <span className="text-sm opacity-70">Alles erledigt!</span>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
