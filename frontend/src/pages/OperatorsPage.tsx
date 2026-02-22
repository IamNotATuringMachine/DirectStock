import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createOperator,
  deleteOperator,
  fetchOperationSignoffSettings,
  fetchOperators,
  updateOperationSignoffSettings,
  updateOperator,
} from "../services/operatorsApi";
import { useAuthStore } from "../stores/authStore";

export default function OperatorsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPinEnabled, setNewPinEnabled] = useState(false);
  const [requirePinInput, setRequirePinInput] = useState(false);
  const [requireOperatorSelectionInput, setRequireOperatorSelectionInput] = useState(true);
  const [ttlInput, setTtlInput] = useState("480");

  const canManageSettings = useMemo(
    () => Boolean(user?.permissions?.includes("module.operators.settings.write")),
    [user?.permissions]
  );

  const operatorsQuery = useQuery({
    queryKey: ["operators"],
    queryFn: fetchOperators,
  });

  const settingsQuery = useQuery({
    queryKey: ["operators", "signoff-settings"],
    queryFn: fetchOperationSignoffSettings,
    enabled: canManageSettings,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["operators"] });
    await queryClient.invalidateQueries({ queryKey: ["operators", "signoff-settings"] });
  };

  const createMutation = useMutation({
    mutationFn: createOperator,
    onSuccess: async () => {
      setNewDisplayName("");
      setNewPin("");
      setNewPinEnabled(false);
      await refresh();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ operatorId, payload }: { operatorId: number; payload: Parameters<typeof updateOperator>[1] }) =>
      updateOperator(operatorId, payload),
    onSuccess: async () => {
      await refresh();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteOperator,
    onSuccess: async () => {
      await refresh();
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: updateOperationSignoffSettings,
    onSuccess: async (settings) => {
      setRequirePinInput(settings.require_pin);
      setRequireOperatorSelectionInput(settings.require_operator_selection);
      setTtlInput(String(settings.pin_session_ttl_minutes));
      await refresh();
    },
  });

  const onCreateOperator = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newDisplayName.trim()) {
      return;
    }
    await createMutation.mutateAsync({
      display_name: newDisplayName.trim(),
      pin: newPin.trim() || undefined,
      pin_enabled: newPinEnabled,
    });
  };

  const onToggleOperatorActive = async (operatorId: number, nextValue: boolean) => {
    await updateMutation.mutateAsync({
      operatorId,
      payload: { is_active: nextValue },
    });
  };

  const onRenameOperator = async (operatorId: number, currentName: string) => {
    const renamed = window.prompt("Neuer Name", currentName)?.trim();
    if (!renamed || renamed === currentName) {
      return;
    }
    await updateMutation.mutateAsync({
      operatorId,
      payload: { display_name: renamed },
    });
  };

  const onSetOperatorPin = async (operatorId: number) => {
    const pin = window.prompt("Neue PIN (mind. 4 Zeichen)")?.trim();
    if (!pin) {
      return;
    }
    await updateMutation.mutateAsync({
      operatorId,
      payload: { pin, pin_enabled: true },
    });
  };

  const onTogglePinMode = async (operatorId: number, pinEnabled: boolean, hasPin: boolean) => {
    if (pinEnabled) {
      await updateMutation.mutateAsync({
        operatorId,
        payload: { pin_enabled: false },
      });
      return;
    }

    if (!hasPin) {
      const pin = window.prompt("PIN setzen (mind. 4 Zeichen)")?.trim();
      if (!pin) {
        return;
      }
      await updateMutation.mutateAsync({
        operatorId,
        payload: { pin, pin_enabled: true },
      });
      return;
    }

    await updateMutation.mutateAsync({
      operatorId,
      payload: { pin_enabled: true },
    });
  };

  const onClearPin = async (operatorId: number) => {
    if (!window.confirm("PIN für diesen Mitarbeiter wirklich löschen?")) {
      return;
    }
    await updateMutation.mutateAsync({
      operatorId,
      payload: { clear_pin: true },
    });
  };

  const onDelete = async (operatorId: number) => {
    if (!window.confirm("Mitarbeiter wirklich löschen?")) {
      return;
    }
    await deleteMutation.mutateAsync(operatorId);
  };

  const settings = settingsQuery.data;
  const operators = operatorsQuery.data ?? [];

  useEffect(() => {
    if (!settings) {
      return;
    }
    setRequirePinInput(settings.require_pin);
    setRequireOperatorSelectionInput(settings.require_operator_selection);
    setTtlInput(String(settings.pin_session_ttl_minutes));
  }, [settings]);

  return (
    <section className="page flex flex-col gap-6" data-testid="operators-page">
      <header>
        <h1 className="page-title">Mitarbeiterverwaltung</h1>
        <p className="section-subtitle mt-1">Operatoren für Abschluss-Signaturen pflegen.</p>
      </header>

      {canManageSettings ? (
        <article className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--panel)] p-5">
          <h2 className="section-title mb-3">Signoff-Einstellungen</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <label className="flex items-center gap-2 text-sm md:col-span-1">
              <input
                type="checkbox"
                checked={requirePinInput}
                onChange={(event) => {
                  const nextRequirePin = event.target.checked;
                  setRequirePinInput(nextRequirePin);
                  void updateSettingsMutation.mutateAsync({
                    require_pin: nextRequirePin,
                    require_operator_selection: requireOperatorSelectionInput,
                    pin_session_ttl_minutes: Number(ttlInput) || 480,
                  });
                }}
                disabled={updateSettingsMutation.isPending || settingsQuery.isLoading}
                data-testid="operators-require-pin-toggle"
              />
              PIN für Signoff erforderlich
            </label>
            <label className="flex items-center gap-2 text-sm md:col-span-1">
              <input
                type="checkbox"
                checked={requireOperatorSelectionInput}
                onChange={(event) => {
                  const nextRequireOperatorSelection = event.target.checked;
                  setRequireOperatorSelectionInput(nextRequireOperatorSelection);
                  void updateSettingsMutation.mutateAsync({
                    require_pin: requirePinInput,
                    require_operator_selection: nextRequireOperatorSelection,
                    pin_session_ttl_minutes: Number(ttlInput) || 480,
                  });
                }}
                disabled={updateSettingsMutation.isPending || settingsQuery.isLoading}
                data-testid="operators-require-operator-selection-toggle"
              />
              Namensauswahl bei Signoff erforderlich
            </label>
            <label className="flex flex-col gap-1.5 md:col-span-1">
              <span className="form-label-standard">PIN Session TTL (Minuten)</span>
              <input
                className="input"
                value={ttlInput}
                onChange={(event) => setTtlInput(event.target.value)}
                inputMode="numeric"
                data-testid="operators-pin-ttl-input"
              />
            </label>
            <button
              className="btn"
              type="button"
              onClick={() => {
                void updateSettingsMutation.mutateAsync({
                  require_pin: requirePinInput,
                  require_operator_selection: requireOperatorSelectionInput,
                  pin_session_ttl_minutes: Math.max(5, Number(ttlInput) || 480),
                });
              }}
              disabled={updateSettingsMutation.isPending}
              data-testid="operators-save-settings-btn"
            >
              Einstellungen speichern
            </button>
          </div>
        </article>
      ) : null}

      <article className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--panel)] p-5">
        <h2 className="section-title mb-3">Neuen Mitarbeiter anlegen</h2>
        <form className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end" onSubmit={(event) => void onCreateOperator(event)}>
          <label className="flex flex-col gap-1.5 md:col-span-2">
            <span className="form-label-standard">Name</span>
            <input
              className="input"
              value={newDisplayName}
              onChange={(event) => setNewDisplayName(event.target.value)}
              placeholder="z. B. Max Mustermann"
              required
              data-testid="operators-create-name"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="form-label-standard">PIN (optional)</span>
            <input
              className="input"
              type="password"
              value={newPin}
              onChange={(event) => setNewPin(event.target.value)}
              placeholder="mind. 4 Zeichen"
              data-testid="operators-create-pin"
            />
          </label>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newPinEnabled}
                onChange={(event) => setNewPinEnabled(event.target.checked)}
                data-testid="operators-create-pin-enabled"
              />
              PIN-Modus aktiv
            </label>
            <button className="btn btn-primary" type="submit" disabled={createMutation.isPending} data-testid="operators-create-btn">
              Anlegen
            </button>
          </div>
        </form>
      </article>

      <article className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--panel)] p-0 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[var(--panel-strong)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">PIN</th>
              <th className="px-4 py-3 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {operators.map((operator) => (
              <tr key={operator.id} className="border-t border-[var(--line)]">
                <td className="px-4 py-3">
                  <div className="font-medium text-[var(--ink)]">{operator.display_name}</div>
                  <div className="text-xs text-[var(--muted)]">ID {operator.id}</div>
                </td>
                <td className="px-4 py-3">
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => void onToggleOperatorActive(operator.id, !operator.is_active)}
                    disabled={updateMutation.isPending}
                  >
                    {operator.is_active ? "Aktiv" : "Inaktiv"}
                  </button>
                </td>
                <td className="px-4 py-3 text-sm text-[var(--muted)]">
                  {operator.has_pin ? "PIN gesetzt" : "Keine PIN"}
                  {operator.pin_enabled ? " · aktiv" : " · aus"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button className="btn btn-ghost" type="button" onClick={() => void onRenameOperator(operator.id, operator.display_name)}>
                      Umbenennen
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={() => void onSetOperatorPin(operator.id)}>
                      PIN setzen
                    </button>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => void onTogglePinMode(operator.id, operator.pin_enabled, operator.has_pin)}
                    >
                      PIN {operator.pin_enabled ? "deaktivieren" : "aktivieren"}
                    </button>
                    {operator.has_pin ? (
                      <button className="btn btn-ghost" type="button" onClick={() => void onClearPin(operator.id)}>
                        PIN löschen
                      </button>
                    ) : null}
                    <button className="btn btn-ghost" type="button" onClick={() => void onDelete(operator.id)}>
                      Löschen
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!operatorsQuery.isLoading && operators.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-sm text-[var(--muted)] text-center">
                  Keine Mitarbeiter vorhanden.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </article>
    </section>
  );
}
