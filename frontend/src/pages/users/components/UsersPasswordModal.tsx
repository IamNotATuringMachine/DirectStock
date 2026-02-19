import { X } from "lucide-react";

type UsersPasswordModalProps = {
  passwordChangeId: number | null;
  newPassword: string;
  onNewPasswordChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
};

export function UsersPasswordModal({
  passwordChangeId,
  newPassword,
  onNewPasswordChange,
  onClose,
  onConfirm,
  isSubmitting,
}: UsersPasswordModalProps) {
  if (!passwordChangeId) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[var(--panel)] rounded-[var(--radius-lg)] shadow-2xl w-full max-w-md border border-[var(--line)]">
        <header className="p-6 border-b border-[var(--line)] flex justify-between items-center">
          <h3 className="section-title">Passwort ändern</h3>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--ink)]">
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="p-6 space-y-4">
          <p className="text-sm text-[var(--muted)]">Setzen Sie ein neues Passwort für den ausgewählten Benutzer.</p>
          <div className="space-y-2">
            <label className="form-label-standard text-[var(--ink)]">Neues Passwort</label>
            <input
              type="password"
              className="input w-full"
              value={newPassword}
              onChange={(event) => onNewPasswordChange(event.target.value)}
              placeholder="Min. 8 Zeichen"
              autoFocus
            />
          </div>
        </div>
        <footer className="p-6 border-t border-[var(--line)] bg-[var(--panel-soft)]/30 flex justify-end gap-3">
          <button onClick={onClose} className="btn btn-ghost">
            Abbrechen
          </button>
          <button onClick={onConfirm} className="btn btn-primary" disabled={newPassword.length < 8 || isSubmitting}>
            Passwort ändern
          </button>
        </footer>
      </div>
    </div>
  );
}
