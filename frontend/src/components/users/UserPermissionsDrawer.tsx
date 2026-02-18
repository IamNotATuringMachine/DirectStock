import { useEffect, useMemo, useState } from "react";
import { X, Search, Shield, Info, Check, Ban, Minus } from "lucide-react";
import { RoleName, User, Permission } from "../../types";
import { presentPermission } from "../../utils/permissionPresentation";

type PermissionMode = "inherit" | "allow" | "deny";

type UserPermissionsDrawerProps = {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
    allRoles: { id: number; name: RoleName }[];
    allPermissions: Permission[];
    currentRoles: RoleName[];
    initialPermissionModes: Record<string, PermissionMode>;
    onSave: (roles: RoleName[], allowPermissions: string[], denyPermissions: string[]) => Promise<void>;
    isSaving: boolean;
};

export default function UserPermissionsDrawer({
  isOpen,
  onClose,
  user,
  allRoles,
  allPermissions,
  currentRoles,
  initialPermissionModes,
  onSave,
  isSaving,
}: UserPermissionsDrawerProps) {
  const [selectedRoles, setSelectedRoles] = useState<RoleName[]>([]);
  const [permissionModes, setPermissionModes] = useState<Record<string, PermissionMode>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "modified">("all");

  useEffect(() => {
    if (isOpen && user) {
      setSelectedRoles(currentRoles);
      setPermissionModes(initialPermissionModes);
      setSearchQuery("");
      setActiveTab("all");
    }
  }, [isOpen, user, currentRoles, initialPermissionModes]);

  const toggleRole = (role: RoleName) => {
    setSelectedRoles((prev) => {
      if (prev.includes(role)) {
        return prev.filter((r) => r !== role);
      }
      return [...prev, role];
    });
  };

  const setMode = (code: string, mode: PermissionMode) => {
    setPermissionModes((prev) => {
      if (mode === "inherit") {
        const { [code]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [code]: mode };
    });
  };

  const getMode = (code: string): PermissionMode => permissionModes[code] ?? "inherit";

  const handleSave = async () => {
    const allowPermissions = Object.entries(permissionModes)
      .filter(([, mode]) => mode === "allow")
      .map(([code]) => code);

    const denyPermissions = Object.entries(permissionModes)
      .filter(([, mode]) => mode === "deny")
      .map(([code]) => code);

    await onSave(selectedRoles, allowPermissions, denyPermissions);
  };

  const presentedPermissions = useMemo(
    () =>
      allPermissions.map((permission) => ({
        permission,
        presentation: presentPermission(permission),
      })),
    [allPermissions]
  );

  const filteredPermissions = useMemo(() => {
    let filtered = presentedPermissions;

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter((row) => row.presentation.searchText.includes(lowerQuery));
    }

    if (activeTab === "modified") {
      filtered = filtered.filter((row) => (permissionModes[row.permission.code] ?? "inherit") !== "inherit");
    }

    return filtered;
  }, [presentedPermissions, searchQuery, activeTab, permissionModes]);

  const modifiedCount = Object.keys(permissionModes).length;

  if (!isOpen || !user) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 w-full md:w-[640px] z-50 bg-[var(--panel)] shadow-2xl border-l border-[var(--line)] transform transition-transform duration-300 ease-in-out flex flex-col">
        <header className="p-6 border-b border-[var(--line)] bg-[var(--panel-soft)]/50">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold text-[var(--ink)] flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                Berechtigungen verwalten
              </h2>
              <p className="text-sm text-[var(--muted)] mt-1">
                Fuer Benutzer <span className="font-medium text-[var(--ink)]">{user.username}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--panel-soft)] rounded-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-[var(--bg)] p-4 rounded-lg border border-[var(--line)]">
            <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">Zugewiesene Rollen</h3>
            <div className="flex flex-wrap gap-2">
              {allRoles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => toggleRole(role.name)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    selectedRoles.includes(role.name)
                      ? "bg-blue-50 text-blue-700 border-blue-200 ring-1 ring-blue-200"
                      : "bg-[var(--panel)] text-[var(--muted)] border-[var(--line)] hover:border-gray-300"
                  }`}
                >
                  {role.name}
                </button>
              ))}
            </div>
            <p className="text-xs text-[var(--muted)] mt-3">
              Rollen sind optional. Rechte koennen auch direkt am Benutzer gesetzt werden.
            </p>
          </div>
        </header>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-4 border-b border-[var(--line)] flex flex-col sm:flex-row gap-4 items-center bg-[var(--panel)]">
            <div className="relative flex-1 w-full">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
              <input
                className="input input-leading-icon w-full bg-[var(--bg)]"
                placeholder="Nach Bereich oder Recht suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex bg-[var(--bg)] p-1 rounded-lg border border-[var(--line)] shrink-0">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  activeTab === "all"
                    ? "bg-[var(--panel)] text-[var(--ink)] shadow-sm border border-[var(--line)]"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                Alle
              </button>
              <button
                onClick={() => setActiveTab("modified")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                  activeTab === "modified"
                    ? "bg-[var(--panel)] text-[var(--ink)] shadow-sm border border-[var(--line)]"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                Angepasst
                {modifiedCount > 0 && (
                  <span className="w-4 h-4 flex items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[10px]">
                    {modifiedCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-[var(--bg)]">
            {filteredPermissions.length === 0 ? (
              <div className="text-center py-12 text-[var(--muted)]">
                <Info className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p>Keine Berechtigungen gefunden.</p>
              </div>
            ) : (
              filteredPermissions.map(({ permission, presentation }) => {
                const mode = getMode(permission.code);
                return (
                  <div
                    key={permission.code}
                    className={`p-3 rounded-lg border transition-all ${
                      mode !== "inherit"
                        ? "bg-[var(--panel)] border-blue-200 ring-1 ring-blue-50"
                        : "bg-[var(--panel)] border-[var(--line)]"
                    }`}
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--ink)]">{presentation.title}</span>
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] bg-[var(--bg)] border border-[var(--line)] rounded px-1.5 py-0.5">
                            {presentation.category}
                          </span>
                          {mode === "allow" && (
                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Erlaubt</span>
                          )}
                          {mode === "deny" && (
                            <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Verweigert</span>
                          )}
                        </div>
                        <p className="text-sm text-[var(--muted)] mt-1">{presentation.subtitle}</p>
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-[var(--muted)] hover:text-[var(--ink)]">
                            Technischen Code anzeigen
                          </summary>
                          <code className="font-mono text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 inline-block mt-1">
                            {permission.code}
                          </code>
                        </details>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                        <button
                          onClick={() => setMode(permission.code, "inherit")}
                          className={`px-2 py-1.5 rounded border text-xs flex items-center justify-center gap-1.5 transition-all ${
                            mode === "inherit"
                              ? "bg-white text-[var(--ink)] shadow-sm border-[var(--line)]"
                              : "text-[var(--muted)] hover:text-[var(--ink)] border-[var(--line)]"
                          }`}
                        >
                          <Minus className="w-3.5 h-3.5" />
                          Standard
                        </button>
                        <button
                          onClick={() => setMode(permission.code, "allow")}
                          className={`px-2 py-1.5 rounded border text-xs flex items-center justify-center gap-1.5 transition-all ${
                            mode === "allow"
                              ? "bg-emerald-50 text-emerald-700 shadow-sm border-emerald-200"
                              : "text-[var(--muted)] hover:text-emerald-700 border-[var(--line)]"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          Erlauben
                        </button>
                        <button
                          onClick={() => setMode(permission.code, "deny")}
                          className={`px-2 py-1.5 rounded border text-xs flex items-center justify-center gap-1.5 transition-all ${
                            mode === "deny"
                              ? "bg-red-50 text-red-700 shadow-sm border-red-200"
                              : "text-[var(--muted)] hover:text-red-700 border-[var(--line)]"
                          }`}
                        >
                          <Ban className="w-3.5 h-3.5" />
                          Verbieten
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <footer className="p-6 border-t border-[var(--line)] bg-[var(--panel-soft)]/50 flex justify-end gap-3">
          <button onClick={onClose} className="btn btn-ghost">
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn btn-primary shadow-lg shadow-blue-500/20 w-full sm:w-auto"
          >
            {isSaving ? "Einstellungen werden gespeichert..." : "Aenderungen speichern"}
          </button>
        </footer>
      </div>
    </>
  );
}
