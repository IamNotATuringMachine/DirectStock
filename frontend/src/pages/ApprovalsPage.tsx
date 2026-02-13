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
    <section className="panel" data-testid="approvals-page">
      <header className="panel-header">
        <div>
          <h2>Genehmigungen</h2>
          <p className="panel-subtitle">Approval-Regeln verwalten und offene Genehmigungen bearbeiten.</p>
        </div>
      </header>

      <div className="warehouse-grid">
        <article className="subpanel">
          <h3>Regeln</h3>
          {canManageRules ? (
            <form className="form-grid" onSubmit={(event) => void onCreateRule(event)} data-testid="approval-rule-form">
              <label>
                Name
                <input
                  className="input"
                  value={ruleName}
                  onChange={(event) => setRuleName(event.target.value)}
                  data-testid="approval-rule-name"
                />
              </label>
              <label>
                Entity
                <select
                  className="input"
                  value={entityType}
                  onChange={(event) => setEntityType(event.target.value as typeof entityType)}
                  data-testid="approval-rule-entity"
                >
                  <option value="purchase_order">purchase_order</option>
                  <option value="return_order">return_order</option>
                </select>
              </label>
              <label>
                Schwellwert
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={minAmount}
                  onChange={(event) => setMinAmount(event.target.value)}
                  data-testid="approval-rule-min-amount"
                />
              </label>
              <label>
                Pflichtrolle
                <input
                  className="input"
                  value={requiredRole}
                  onChange={(event) => setRequiredRole(event.target.value)}
                  data-testid="approval-rule-required-role"
                />
              </label>
              <button className="btn" type="submit" disabled={createRuleMutation.isPending} data-testid="approval-rule-create-btn">
                Regel speichern
              </button>
            </form>
          ) : (
            <p data-testid="approval-rule-readonly-hint">Nur Admin/Lagerleiter dürfen Regeln bearbeiten.</p>
          )}

          <div className="list-stack small" data-testid="approval-rule-list">
            {(rulesQuery.data ?? []).map((rule) => (
              <div className="list-item static-item" key={rule.id}>
                <strong>{rule.name}</strong>
                <span>
                  {rule.entity_type} | min: {rule.min_amount ?? "-"} | role: {rule.required_role}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="subpanel">
          <h3>Offene Genehmigungen</h3>
          <div className="list-stack" data-testid="approval-request-list">
            {(approvalsQuery.data ?? []).map((request) => (
              <div className="list-item static-item" key={request.id}>
                <strong>
                  #{request.id} {request.entity_type}:{request.entity_id}
                </strong>
                <span>Status: {request.status} | Betrag: {request.amount ?? "-"}</span>
                <div className="actions-cell">
                  <button
                    className="btn"
                    onClick={() => void approveMutation.mutateAsync(request.id)}
                    disabled={approveMutation.isPending}
                    data-testid={`approval-approve-${request.id}`}
                  >
                    approve
                  </button>
                  <button
                    className="btn"
                    onClick={() => void rejectMutation.mutateAsync(request.id)}
                    disabled={rejectMutation.isPending}
                    data-testid={`approval-reject-${request.id}`}
                  >
                    reject
                  </button>
                </div>
              </div>
            ))}
            {!approvalsQuery.isLoading && (approvalsQuery.data?.length ?? 0) === 0 ? <p>Keine offenen Genehmigungen.</p> : null}
          </div>
        </article>
      </div>
    </section>
  );
}
