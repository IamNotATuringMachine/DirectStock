import { useEffect, useState } from "react";
import { Mail, User as UserIcon, Shield, Key, X } from "lucide-react";
import { RoleName } from "../../types";

type UserFormState = {
    id?: number;
    username: string;
    email: string;
    full_name: string;
    password?: string;
    roles: RoleName[];
    is_active: boolean;
};

const EMPTY_FORM: UserFormState = {
    username: "",
    email: "",
    full_name: "",
    roles: [],
    is_active: true,
};

type UserFormModalProps = {
    isOpen: boolean;
    onClose: () => void;
    mode: "create" | "edit";
    initialData?: UserFormState;
    availableRoles: { id: number; name: RoleName }[];
    onSubmit: (data: UserFormState) => Promise<void>;
    isSubmitting: boolean;
};

export default function UserFormModal({
    isOpen,
    onClose,
    mode,
    initialData,
    availableRoles,
    onSubmit,
    isSubmitting,
}: UserFormModalProps) {
    const [formData, setFormData] = useState<UserFormState>(EMPTY_FORM);

    useEffect(() => {
        if (isOpen) {
            if (mode === "edit" && initialData) {
                setFormData(initialData);
            } else {
                setFormData(EMPTY_FORM);
            }
        }
    }, [isOpen, mode, initialData]);

    const toggleRole = (role: RoleName) => {
        setFormData((prev) => {
            if (prev.roles.includes(role)) {
                return { ...prev, roles: prev.roles.filter((r) => r !== role) };
            }
            return { ...prev, roles: [...prev.roles, role] };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSubmit(formData);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div
                className="bg-[var(--panel)] rounded-[var(--radius-lg)] shadow-2xl w-full max-w-xl border border-[var(--line)] flex flex-col max-h-[90vh] overflow-hidden"
                role="dialog"
                aria-modal="true"
            >
                <header className="p-6 border-b border-[var(--line)] flex justify-between items-center bg-[var(--panel-soft)]/50">
                    <h3 className="section-title">
                        {mode === "create" ? "Neuen Benutzer anlegen" : "Benutzer bearbeiten"}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors p-1 rounded hover:bg-[var(--panel-soft)]"
                        aria-label="Schließen"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </header>

                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <form id="user-form-modal" className="space-y-6" onSubmit={handleSubmit}>
                        {/* Extended attributes removed for simplicity as per requirements analysis, keeping core fields */}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {mode === "create" && (
                                <div className="space-y-2">
                                    <label className="form-label-standard text-[var(--ink)] flex items-center gap-2">
                                        <UserIcon className="w-4 h-4 text-[var(--muted)]" /> Benutzername *
                                    </label>
                                    <input
                                        className="input w-full bg-[var(--bg)]"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        required
                                        minLength={3}
                                        placeholder="z.B. max.mustermann"
                                        autoFocus
                                    />
                                    <p className="text-xs text-[var(--muted)] pl-1">Eindeutiger Login-Name</p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="form-label-standard text-[var(--ink)] flex items-center gap-2">
                                    <UserIcon className="w-4 h-4 text-[var(--muted)]" /> Voller Name
                                </label>
                                <input
                                    className="input w-full bg-[var(--bg)]"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    placeholder="Max Mustermann"
                                />
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <label className="form-label-standard text-[var(--ink)] flex items-center gap-2">
                                    <Mail className="w-4 h-4 text-[var(--muted)]" /> E-Mail Adresse
                                </label>
                                <input
                                    type="email"
                                    className="input w-full bg-[var(--bg)]"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="max@firma.de"
                                />
                            </div>

                            {mode === "create" && (
                                <div className="space-y-2 md:col-span-2">
                                    <label className="form-label-standard text-[var(--ink)] flex items-center gap-2">
                                        <Key className="w-4 h-4 text-[var(--muted)]" /> Initial-Passwort *
                                    </label>
                                    <input
                                        type="password"
                                        className="input w-full bg-[var(--bg)]"
                                        value={formData.password || ""}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        required={mode === "create"}
                                        minLength={8}
                                        placeholder="Mindestens 8 Zeichen"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="space-y-3 pt-2">
                            <label className="form-label-standard text-[var(--ink)] flex items-center gap-2">
                                <Shield className="w-4 h-4 text-[var(--muted)]" /> Rollen zuweisen
                            </label>
                            <div className="grid grid-cols-2 gap-3 p-4 bg-[var(--bg)] rounded-lg border border-[var(--line)]">
                                {availableRoles.map((role) => (
                                    <label key={role.id} className="flex flex-row items-center gap-3 cursor-pointer group select-none p-2 rounded-md hover:bg-[var(--panel-soft)] transition-colors !flex">
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 cursor-pointer accent-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                                            checked={formData.roles.includes(role.name)}
                                            onChange={() => toggleRole(role.name)}
                                        />
                                        <span
                                            className={`text-sm transition-colors ${formData.roles.includes(role.name)
                                                ? "text-[var(--ink)] font-medium"
                                                : "text-[var(--muted)] group-hover:text-[var(--ink)]"
                                                }`}
                                        >
                                            {role.name}
                                        </span>
                                    </label>
                                ))}
                            </div>
                            <p className="text-xs text-[var(--muted)]">Rollen definieren grundlegende Zugriffsebenen.</p>
                        </div>

                        <div className="flex items-center space-x-2 pt-2 border-t border-[var(--line)] mt-4">
                            <input
                                type="checkbox"
                                id="is_active_modal"
                                className="checkbox"
                                checked={formData.is_active}
                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                            />
                            <label htmlFor="is_active_modal" className="form-label-standard text-[var(--ink)] cursor-pointer select-none">
                                Benutzerkonto ist aktiv
                            </label>
                        </div>
                    </form>
                </div>

                <footer className="p-6 border-t border-[var(--line)] bg-[var(--panel-soft)]/50 flex justify-end gap-3 rounded-b-[var(--radius-lg)]">
                    <button type="button" className="btn btn-ghost" onClick={onClose}>
                        Abbrechen
                    </button>
                    <button
                        type="submit"
                        form="user-form-modal"
                        className="btn btn-primary shadow-lg shadow-blue-500/20"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Wird gespeichert..." : "Speichern"}
                    </button>
                </footer>
            </div>
        </div>
    );
}
