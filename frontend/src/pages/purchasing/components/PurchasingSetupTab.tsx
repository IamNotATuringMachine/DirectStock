import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Mail, Plus, Settings, Trash2, X } from "lucide-react";

import type {
  PurchaseEmailSenderProfile,
  PurchaseEmailSenderProfileUpdatePayload,
  PurchaseEmailSettings,
  PurchaseEmailSettingsUpdatePayload,
  Supplier,
  SupplierPurchaseEmailTemplate,
} from "../../../types";
import { purchaseTemplatePlaceholders } from "../model";

type EditableProfile = PurchaseEmailSenderProfile & {
  local_id: number;
  smtp_password: string;
  clear_smtp_password: boolean;
  imap_password: string;
  clear_imap_password: boolean;
};

export type PurchasingSetupTabProps = {
  suppliers: Supplier[];
  selectedSupplierId: string;
  onSelectedSupplierIdChange: (value: string) => void;
  supplierTemplate: SupplierPurchaseEmailTemplate | null;
  supplierTemplateLoading: boolean;
  canEditSupplierTemplate: boolean;
  onTemplateFieldChange: (field: keyof Omit<SupplierPurchaseEmailTemplate, "supplier_id">, value: string) => void;
  onSaveSupplierTemplate: () => void;
  saveSupplierTemplatePending: boolean;
  templateFeedback: string | null;
  purchaseEmailSettings: PurchaseEmailSettings | null;
  purchaseEmailSettingsLoading: boolean;
  onSavePurchaseEmailSettings: (payload: PurchaseEmailSettingsUpdatePayload) => void;
  savePurchaseEmailSettingsPending: boolean;
  purchaseEmailSettingsFeedback: string | null;
};

function toEditableProfiles(settings: PurchaseEmailSettings): EditableProfile[] {
  const mapped = settings.profiles.map((profile, index) => ({
    ...profile,
    local_id: index + 1,
    smtp_password: "",
    clear_smtp_password: false,
    imap_password: "",
    clear_imap_password: false,
  }));

  if (!mapped.some((item) => item.is_active) && mapped.length > 0) {
    mapped[0].is_active = true;
  }

  return mapped;
}

function trimOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function PurchasingSetupTab({
  suppliers,
  selectedSupplierId,
  onSelectedSupplierIdChange,
  supplierTemplate,
  supplierTemplateLoading,
  canEditSupplierTemplate,
  onTemplateFieldChange,
  onSaveSupplierTemplate,
  saveSupplierTemplatePending,
  templateFeedback,
  purchaseEmailSettings,
  purchaseEmailSettingsLoading,
  onSavePurchaseEmailSettings,
  savePurchaseEmailSettingsPending,
  purchaseEmailSettingsFeedback,
}: PurchasingSetupTabProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [profiles, setProfiles] = useState<EditableProfile[]>([]);
  const [selectedProfileLocalId, setSelectedProfileLocalId] = useState<number | null>(null);

  useEffect(() => {
    if (!purchaseEmailSettings || !isModalOpen) {
      return;
    }
    const next = toEditableProfiles(purchaseEmailSettings);
    setProfiles(next);
    const active = next.find((item) => item.is_active) ?? next[0] ?? null;
    setSelectedProfileLocalId(active?.local_id ?? null);
  }, [purchaseEmailSettings, isModalOpen]);

  const selectedProfile = useMemo(
    () => profiles.find((item) => item.local_id === selectedProfileLocalId) ?? null,
    [profiles, selectedProfileLocalId]
  );

  const activeProfile = useMemo(() => {
    if (!purchaseEmailSettings) {
      return null;
    }
    return (
      purchaseEmailSettings.profiles.find((profile) => profile.id === purchaseEmailSettings.active_profile_id) ??
      purchaseEmailSettings.profiles[0] ??
      null
    );
  }, [purchaseEmailSettings]);

  const updateSelectedProfile = (patch: Partial<EditableProfile>) => {
    if (!selectedProfileLocalId) {
      return;
    }
    setProfiles((current) =>
      current.map((profile) =>
        profile.local_id === selectedProfileLocalId
          ? {
              ...profile,
              ...patch,
            }
          : profile
      )
    );
  };

  const addProfile = () => {
    const source = selectedProfile ?? profiles[0] ?? null;
    const nextLocalId = profiles.reduce((max, item) => Math.max(max, item.local_id), 0) + 1;
    const newProfile: EditableProfile = {
      id: 0,
      local_id: nextLocalId,
      profile_name: `Profil ${profiles.length + 1}`,
      is_active: profiles.length === 0,
      smtp_enabled: source?.smtp_enabled ?? false,
      smtp_host: source?.smtp_host ?? null,
      smtp_port: source?.smtp_port ?? 587,
      smtp_username: source?.smtp_username ?? null,
      smtp_password_set: false,
      smtp_use_tls: source?.smtp_use_tls ?? true,
      from_address: source?.from_address ?? "einkauf@directstock.local",
      reply_to_address: source?.reply_to_address ?? "einkauf@directstock.local",
      sender_name: source?.sender_name ?? "Einkauf",
      imap_enabled: source?.imap_enabled ?? false,
      imap_host: source?.imap_host ?? null,
      imap_port: source?.imap_port ?? 993,
      imap_username: source?.imap_username ?? null,
      imap_password_set: false,
      imap_mailbox: source?.imap_mailbox ?? "INBOX",
      imap_use_ssl: source?.imap_use_ssl ?? true,
      poll_interval_seconds: source?.poll_interval_seconds ?? 300,
      default_to_addresses: source?.default_to_addresses ?? null,
      default_cc_addresses: source?.default_cc_addresses ?? null,
      smtp_password: "",
      clear_smtp_password: false,
      imap_password: "",
      clear_imap_password: false,
    };

    setProfiles((current) => [...current, newProfile]);
    setSelectedProfileLocalId(newProfile.local_id);
  };

  const removeSelectedProfile = () => {
    if (!selectedProfile || profiles.length <= 1) {
      return;
    }
    const next = profiles.filter((profile) => profile.local_id !== selectedProfile.local_id);
    if (!next.some((profile) => profile.is_active)) {
      next[0].is_active = true;
    }
    setProfiles(next);
    setSelectedProfileLocalId(next[0]?.local_id ?? null);
  };

  const markSelectedAsActive = () => {
    if (!selectedProfile) {
      return;
    }
    setProfiles((current) =>
      current.map((profile) => ({
        ...profile,
        is_active: profile.local_id === selectedProfile.local_id,
      }))
    );
  };

  const onSaveSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (profiles.length === 0) {
      return;
    }

    const hasActive = profiles.some((profile) => profile.is_active);
    const normalizedProfiles = hasActive
      ? profiles
      : profiles.map((profile, index) => ({
          ...profile,
          is_active: index === 0,
        }));

    const payload: PurchaseEmailSettingsUpdatePayload = {
      profiles: normalizedProfiles.map((profile): PurchaseEmailSenderProfileUpdatePayload => {
        const item: PurchaseEmailSenderProfileUpdatePayload = {
          profile_name: profile.profile_name.trim() || "Standard",
          is_active: profile.is_active,
          smtp_enabled: profile.smtp_enabled,
          smtp_host: trimOrNull(profile.smtp_host ?? ""),
          smtp_port: Number(profile.smtp_port) || 587,
          smtp_username: trimOrNull(profile.smtp_username ?? ""),
          clear_smtp_password: profile.clear_smtp_password,
          smtp_use_tls: profile.smtp_use_tls,
          from_address: profile.from_address.trim() || "einkauf@directstock.local",
          reply_to_address: profile.reply_to_address.trim() || "einkauf@directstock.local",
          sender_name: profile.sender_name.trim() || "Einkauf",
          imap_enabled: profile.imap_enabled,
          imap_host: trimOrNull(profile.imap_host ?? ""),
          imap_port: Number(profile.imap_port) || 993,
          imap_username: trimOrNull(profile.imap_username ?? ""),
          clear_imap_password: profile.clear_imap_password,
          imap_mailbox: profile.imap_mailbox.trim() || "INBOX",
          imap_use_ssl: profile.imap_use_ssl,
          poll_interval_seconds: Number(profile.poll_interval_seconds) || 300,
          default_to_addresses: trimOrNull(profile.default_to_addresses ?? ""),
          default_cc_addresses: trimOrNull(profile.default_cc_addresses ?? ""),
        };
        if (profile.id > 0) {
          item.id = profile.id;
        }
        if (profile.smtp_password.trim()) {
          item.smtp_password = profile.smtp_password.trim();
        }
        if (profile.imap_password.trim()) {
          item.imap_password = profile.imap_password.trim();
        }
        return item;
      }),
    };

    onSavePurchaseEmailSettings(payload);
    setIsModalOpen(false);
  };

  return (
    <div
      className="bg-[var(--panel)] border border-[var(--line)] rounded-xl shadow-sm overflow-hidden"
      data-testid="purchasing-setup-tab"
    >
      <div className="p-5 border-b border-[var(--line)] bg-[var(--panel-soft)]">
        <h3 className="text-lg font-semibold text-[var(--ink)] flex items-center gap-2">
          <Settings className="w-5 h-5 text-[var(--accent)]" />
          Einkaufs-E-Mail Setup
        </h3>
        <p className="text-sm text-[var(--muted)] mt-1">
          Zentrale Pflege für Lieferanten-Mailtemplates und Versandhinweise.
        </p>
      </div>

      <div className="p-5 space-y-5">
        <div className="rounded-lg border border-[var(--line)] bg-[var(--bg)] p-4 text-sm text-[var(--ink)] space-y-2">
          <p className="font-medium">So ist der Versand konfiguriert:</p>
          {purchaseEmailSettingsLoading ? <p>Lade Konfiguration...</p> : null}
          {activeProfile ? (
            <>
              <p>
                Profil: {activeProfile.profile_name} | SMTP: {activeProfile.smtp_enabled ? "aktiv" : "inaktiv"} |
                IMAP: {activeProfile.imap_enabled ? "aktiv" : "inaktiv"}
              </p>
              <p>
                Absender: {activeProfile.from_address} | Reply-To: {activeProfile.reply_to_address}
              </p>
              <p>
                Zusätzliche To-Empfänger: {activeProfile.default_to_addresses ?? "-"} | CC: {activeProfile.default_cc_addresses ?? "-"}
              </p>
            </>
          ) : null}
          <p>
            Lieferanten-Adresse kommt aus dem Lieferantenstamm. Mehrere E-Mails sind per Komma oder Semikolon möglich.
          </p>
          <div className="pt-2">
            <button
              type="button"
              className="h-9 px-4 bg-[var(--ink)] hover:bg-[var(--ink)]/90 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              onClick={() => setIsModalOpen(true)}
              disabled={savePurchaseEmailSettingsPending || !canEditSupplierTemplate}
              data-testid="purchase-email-settings-open-modal"
            >
              SMTP/IMAP konfigurieren
            </button>
          </div>
          {purchaseEmailSettingsFeedback ? (
            <div className="text-xs text-[var(--muted)]">{purchaseEmailSettingsFeedback}</div>
          ) : null}
        </div>

        <div>
          <label className="block text-xs text-[var(--muted)] mb-1">Lieferant für Template</label>
          <select
            className="w-full h-10 px-3 bg-[var(--panel)] border border-[var(--line)] rounded-lg text-sm text-[var(--ink)]"
            value={selectedSupplierId}
            onChange={(event) => onSelectedSupplierIdChange(event.target.value)}
            data-testid="purchase-setup-supplier-select"
          >
            <option value="">Bitte Lieferant auswählen</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.supplier_number} - {supplier.company_name}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-[var(--bg)]/50 border border-[var(--line)] rounded-lg p-4" data-testid="supplier-template-editor-setup">
          <div className="flex items-center justify-between gap-4 mb-3">
            <h4 className="text-sm font-semibold text-[var(--ink)] flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Lieferanten-E-Mail-Template
            </h4>
            <button
              type="button"
              onClick={onSaveSupplierTemplate}
              disabled={!canEditSupplierTemplate || saveSupplierTemplatePending || !supplierTemplate}
              className="h-9 px-4 bg-[var(--ink)] hover:bg-[var(--ink)]/90 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              data-testid="supplier-template-save-setup"
            >
              Template speichern
            </button>
          </div>

          {supplierTemplateLoading ? <p className="text-sm text-[var(--muted)]">Template wird geladen...</p> : null}
          {supplierTemplate ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">Anrede</label>
                <input
                  value={supplierTemplate.salutation ?? ""}
                  onChange={(event) => onTemplateFieldChange("salutation", event.target.value)}
                  className="w-full h-9 px-3 bg-[var(--panel)] border border-[var(--line)] rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">Betreff-Template</label>
                <input
                  value={supplierTemplate.subject_template ?? ""}
                  onChange={(event) => onTemplateFieldChange("subject_template", event.target.value)}
                  className="w-full h-9 px-3 bg-[var(--panel)] border border-[var(--line)] rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">Body-Template</label>
                <textarea
                  value={supplierTemplate.body_template ?? ""}
                  onChange={(event) => onTemplateFieldChange("body_template", event.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 bg-[var(--panel)] border border-[var(--line)] rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">Signatur</label>
                <textarea
                  value={supplierTemplate.signature ?? ""}
                  onChange={(event) => onTemplateFieldChange("signature", event.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-[var(--panel)] border border-[var(--line)] rounded-lg text-sm"
                />
              </div>
              <div className="text-xs text-[var(--muted)]">Platzhalter: {purchaseTemplatePlaceholders.join(", ")}</div>
              {templateFeedback ? <div className="text-xs text-[var(--muted)]">{templateFeedback}</div> : null}
              {!canEditSupplierTemplate ? (
                <div className="text-xs text-[var(--muted)]">Keine Berechtigung für Lieferanten-Templates.</div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">Wähle einen Lieferanten, um sein Template zu bearbeiten.</p>
          )}
        </div>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-auto bg-[var(--panel)] border border-[var(--line)] rounded-xl shadow-xl">
            <div className="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between">
              <h4 className="text-base font-semibold text-[var(--ink)]">SMTP/IMAP Profile</h4>
              <button
                type="button"
                className="text-[var(--muted)] hover:text-[var(--ink)]"
                onClick={() => setIsModalOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form className="p-5 space-y-5" onSubmit={onSaveSettings}>
              <div className="rounded-lg border border-[var(--line)] p-4 space-y-3">
                <h5 className="text-sm font-semibold text-[var(--ink)]">Absenderprofile</h5>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                  <select
                    className="input w-full"
                    value={selectedProfileLocalId ?? ""}
                    onChange={(event) => setSelectedProfileLocalId(Number(event.target.value) || null)}
                  >
                    {profiles.map((profile) => (
                      <option key={profile.local_id} value={profile.local_id}>
                        {profile.profile_name} {profile.is_active ? "(aktiv)" : ""}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-ghost" onClick={addProfile}>
                    <Plus className="w-4 h-4" />
                    Neu
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={markSelectedAsActive}
                    disabled={!selectedProfile}
                  >
                    Aktiv setzen
                  </button>
                  <button
                    type="button"
                    className="btn text-red-600 border-red-300 hover:bg-red-50"
                    onClick={removeSelectedProfile}
                    disabled={!selectedProfile || profiles.length <= 1}
                  >
                    <Trash2 className="w-4 h-4" />
                    Entfernen
                  </button>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  Mehrere Absenderprofile sind möglich, genau eines ist aktiv und wird für Versand + Reply-Sync genutzt.
                </p>
              </div>

              {selectedProfile ? (
                <>
                  <div className="rounded-lg border border-[var(--line)] p-4 space-y-3">
                    <h5 className="text-sm font-semibold text-[var(--ink)]">Profil</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        className="input w-full"
                        placeholder="Profilname"
                        value={selectedProfile.profile_name}
                        onChange={(event) => updateSelectedProfile({ profile_name: event.target.value })}
                      />
                      <input
                        className="input w-full"
                        placeholder="Absender E-Mail"
                        value={selectedProfile.from_address}
                        onChange={(event) => updateSelectedProfile({ from_address: event.target.value })}
                      />
                      <input
                        className="input w-full"
                        placeholder="Reply-To E-Mail"
                        value={selectedProfile.reply_to_address}
                        onChange={(event) => updateSelectedProfile({ reply_to_address: event.target.value })}
                      />
                    </div>
                    <input
                      className="input w-full"
                      placeholder="Anzeigename"
                      value={selectedProfile.sender_name}
                      onChange={(event) => updateSelectedProfile({ sender_name: event.target.value })}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <textarea
                        className="input w-full min-h-[86px] py-2"
                        placeholder="Zusätzliche Empfänger (To), Komma oder Semikolon getrennt"
                        value={selectedProfile.default_to_addresses ?? ""}
                        onChange={(event) => updateSelectedProfile({ default_to_addresses: event.target.value })}
                      />
                      <textarea
                        className="input w-full min-h-[86px] py-2"
                        placeholder="CC-Empfänger, Komma oder Semikolon getrennt"
                        value={selectedProfile.default_cc_addresses ?? ""}
                        onChange={(event) => updateSelectedProfile({ default_cc_addresses: event.target.value })}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-[var(--line)] p-4 space-y-3">
                    <h5 className="text-sm font-semibold text-[var(--ink)]">SMTP</h5>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedProfile.smtp_enabled}
                        onChange={(event) => updateSelectedProfile({ smtp_enabled: event.target.checked })}
                      />
                      SMTP aktivieren
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <input
                        className="input w-full"
                        placeholder="Host"
                        value={selectedProfile.smtp_host ?? ""}
                        onChange={(event) => updateSelectedProfile({ smtp_host: event.target.value })}
                      />
                      <input
                        className="input w-full"
                        placeholder="Port"
                        value={String(selectedProfile.smtp_port)}
                        onChange={(event) => updateSelectedProfile({ smtp_port: Number(event.target.value) || 587 })}
                      />
                      <input
                        className="input w-full"
                        placeholder="Username"
                        value={selectedProfile.smtp_username ?? ""}
                        onChange={(event) => updateSelectedProfile({ smtp_username: event.target.value })}
                      />
                      <input
                        type="password"
                        className="input w-full"
                        placeholder="Neues Passwort (optional)"
                        value={selectedProfile.smtp_password}
                        onChange={(event) => updateSelectedProfile({ smtp_password: event.target.value })}
                      />
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-[var(--muted)]">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedProfile.smtp_use_tls}
                          onChange={(event) => updateSelectedProfile({ smtp_use_tls: event.target.checked })}
                        />
                        TLS verwenden
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedProfile.clear_smtp_password}
                          onChange={(event) => updateSelectedProfile({ clear_smtp_password: event.target.checked })}
                        />
                        SMTP-Passwort löschen
                      </label>
                      <span>Passwort gespeichert: {selectedProfile.smtp_password_set ? "ja" : "nein"}</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-[var(--line)] p-4 space-y-3">
                    <h5 className="text-sm font-semibold text-[var(--ink)]">IMAP</h5>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedProfile.imap_enabled}
                        onChange={(event) => updateSelectedProfile({ imap_enabled: event.target.checked })}
                      />
                      IMAP aktivieren
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      <input
                        className="input w-full"
                        placeholder="Host"
                        value={selectedProfile.imap_host ?? ""}
                        onChange={(event) => updateSelectedProfile({ imap_host: event.target.value })}
                      />
                      <input
                        className="input w-full"
                        placeholder="Port"
                        value={String(selectedProfile.imap_port)}
                        onChange={(event) => updateSelectedProfile({ imap_port: Number(event.target.value) || 993 })}
                      />
                      <input
                        className="input w-full"
                        placeholder="Username"
                        value={selectedProfile.imap_username ?? ""}
                        onChange={(event) => updateSelectedProfile({ imap_username: event.target.value })}
                      />
                      <input
                        type="password"
                        className="input w-full"
                        placeholder="Neues Passwort (optional)"
                        value={selectedProfile.imap_password}
                        onChange={(event) => updateSelectedProfile({ imap_password: event.target.value })}
                      />
                      <input
                        className="input w-full"
                        placeholder="Mailbox"
                        value={selectedProfile.imap_mailbox}
                        onChange={(event) => updateSelectedProfile({ imap_mailbox: event.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
                        <input
                          type="checkbox"
                          checked={selectedProfile.imap_use_ssl}
                          onChange={(event) => updateSelectedProfile({ imap_use_ssl: event.target.checked })}
                        />
                        SSL verwenden
                      </label>
                      <input
                        className="input w-full"
                        placeholder="Poll Intervall Sekunden"
                        value={String(selectedProfile.poll_interval_seconds)}
                        onChange={(event) =>
                          updateSelectedProfile({ poll_interval_seconds: Number(event.target.value) || 300 })
                        }
                      />
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-[var(--muted)]">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedProfile.clear_imap_password}
                          onChange={(event) => updateSelectedProfile({ clear_imap_password: event.target.checked })}
                        />
                        IMAP-Passwort löschen
                      </label>
                      <span>Passwort gespeichert: {selectedProfile.imap_password_set ? "ja" : "nein"}</span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-[var(--muted)]">Kein Profil verfügbar.</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>
                  Abbrechen
                </button>
                <button type="submit" className="btn btn-primary" disabled={savePurchaseEmailSettingsPending}>
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
