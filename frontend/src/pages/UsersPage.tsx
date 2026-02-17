import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Shield,
  Lock,
  Unlock,
  X,
  Check,
  MoreVertical,
  Filter,
  User as UserIcon,
  Mail,
  Key,
  ShieldCheck,
  AlertCircle
} from "lucide-react";

import { fetchPermissions, fetchRoles, updateRolePermissions } from "../services/rbacApi";
import { useAuthStore } from "../stores/authStore";
import {
  changeUserPassword,
  createUser,
  deleteUser,
  fetchUsers,
  updateUser,
} from "../services/usersApi";
import type { Role, RoleName, User } from "../types";

const ROLE_OPTIONS: RoleName[] = [
  "admin",
  "lagerleiter",
  "lagermitarbeiter",
  "einkauf",
  "versand",
  "controller",
  "auditor",
];

type UserFormState = {
  id?: number; // Present only for edit
  username: string;
  email: string;
  full_name: string;
  password?: string; // Present only for create or password change
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

function toggleRole(roles: RoleName[], role: RoleName): RoleName[] {
  if (roles.includes(role)) {
    return roles.filter((item) => item !== role);
  }
  return [...roles, role];
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);

  // UI State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [formData, setFormData] = useState<UserFormState>(EMPTY_FORM);
  const [searchQuery, setSearchQuery] = useState("");
  const [passwordChangeId, setPasswordChangeId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");

  // Role Management State
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedRolePermissions, setSelectedRolePermissions] = useState<string[]>([]);
  const [permissionSearch, setPermissionSearch] = useState("");

  // Data Queries
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: fetchUsers });
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: fetchRoles });
  const permissionsQuery = useQuery({ queryKey: ["permissions"], queryFn: fetchPermissions });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      setIsModalOpen(false);
      setFormData(EMPTY_FORM);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: number; payload: Parameters<typeof updateUser>[1] }) =>
      updateUser(userId, payload),
    onSuccess: async () => {
      setIsModalOpen(false);
      setFormData(EMPTY_FORM);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: number; password: string }) =>
      changeUserPassword(userId, { new_password: password }),
    onSuccess: async () => {
      setPasswordChangeId(null);
      setNewPassword("");
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const updateRolePermissionsMutation = useMutation({
    mutationFn: ({ roleId, permissionCodes }: { roleId: number; permissionCodes: string[] }) =>
      updateRolePermissions(roleId, permissionCodes),
    onSuccess: async (role) => {
      setSelectedRolePermissions(role.permissions);
      await queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });

  // Derived State
  const filteredUsers = useMemo(() => {
    if (!usersQuery.data) return [];
    if (!searchQuery) return usersQuery.data;
    const lowerQuery = searchQuery.toLowerCase();
    return usersQuery.data.filter(
      (user) =>
        user.username.toLowerCase().includes(lowerQuery) ||
        (user.email ?? "").toLowerCase().includes(lowerQuery) ||
        (user.full_name ?? "").toLowerCase().includes(lowerQuery)
    );
  }, [usersQuery.data, searchQuery]);

  const selectedRole = useMemo(
    () => rolesQuery.data?.find((role) => role.id === selectedRoleId) ?? null,
    [rolesQuery.data, selectedRoleId]
  );

  const filteredPermissions = useMemo(() => {
    if (!permissionsQuery.data) return [];
    if (!permissionSearch) return permissionsQuery.data;
    const lowerQuery = permissionSearch.toLowerCase();
    return permissionsQuery.data.filter(
      (p) =>
        p.code.toLowerCase().includes(lowerQuery) ||
        (p.description ?? "").toLowerCase().includes(lowerQuery)
    );
  }, [permissionsQuery.data, permissionSearch]);

  // Effects
  useEffect(() => {
    if (!rolesQuery.data || rolesQuery.data.length === 0) return;
    if (selectedRoleId === null) {
      setSelectedRoleId(rolesQuery.data[0].id);
      setSelectedRolePermissions(rolesQuery.data[0].permissions);
      return;
    }
    const role = rolesQuery.data.find((row) => row.id === selectedRoleId);
    if (role) {
      setSelectedRolePermissions(role.permissions);
    }
  }, [rolesQuery.data, selectedRoleId]);

  // Handlers
  const handleOpenCreate = () => {
    setModalMode("create");
    setFormData(EMPTY_FORM);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setModalMode("edit");
    setFormData({
      id: user.id,
      username: user.username,
      email: user.email ?? "",
      full_name: user.full_name ?? "",
      roles: [...user.roles],
      is_active: user.is_active,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (modalMode === "create") {
      await createMutation.mutateAsync({
        username: formData.username.trim(),
        email: formData.email.trim() || null,
        full_name: formData.full_name.trim() || null,
        password: formData.password || "", // Required for create
        roles: formData.roles,
        is_active: formData.is_active,
      });
    } else {
      if (!formData.id) return;
      await updateMutation.mutateAsync({
        userId: formData.id,
        payload: {
          email: formData.email.trim() || null,
          full_name: formData.full_name.trim() || null,
          roles: formData.roles,
          is_active: formData.is_active,
        },
      });
    }
  };

  const handleDelete = async (user: User) => {
    if (!window.confirm(`Benutzer "${user.username}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
      return;
    }
    await deleteMutation.mutateAsync(user.id);
  };

  const handleToggleStatus = async (user: User) => {
    await updateMutation.mutateAsync({
      userId: user.id,
      payload: { is_active: !user.is_active },
    });
  };

  const handleSaveRolePermissions = async () => {
    if (selectedRoleId === null) return;
    await updateRolePermissionsMutation.mutateAsync({
      roleId: selectedRoleId,
      permissionCodes: selectedRolePermissions,
    });
  };

  const togglePermissionCode = (role: Role | null, code: string) => {
    if (role && role.name === "admin") return;
    setSelectedRolePermissions((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]
    );
  };

  return (
    <section className="page" data-testid="users-page">
      <div className="flex flex-col gap-8 max-w-7xl mx-auto">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="page-title">Benutzerverwaltung</h2>
          <p className="section-subtitle mt-1">Verwalten Sie Benutzer, Rollen und Zugriffsrechte.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="btn btn-primary flex items-center gap-2 shadow-lg shadow-blue-500/20"
          data-testid="users-create-btn"
        >
          <Plus className="w-4 h-4" />
          Benutzer anlegen
        </button>
      </div>

      {/* Main Content: Users List */}
      <div className="bg-[var(--panel)] rounded-[var(--radius-lg)] border border-[var(--line)] shadow-sm overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-[var(--line)] flex flex-col sm:flex-row gap-4 justify-between items-center bg-[var(--panel-soft)]/50">
          <div className="relative w-full sm:w-96">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
            <input
              className="input input-leading-icon w-full bg-[var(--bg)]"
              placeholder="Suchen nach Name, Email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="text-sm text-[var(--muted)] font-medium">
            {filteredUsers.length} Benutzer
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left" data-testid="users-table">
            <thead className="table-head-standard bg-[var(--panel-soft)] border-b border-[var(--line)]">
              <tr>
                <th className="px-6 py-4">Benutzer</th>
                <th className="px-6 py-4">Rollen</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-[var(--muted)]">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="w-8 h-8 opacity-20" />
                      <p>Keine Benutzer gefunden.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="group hover:bg-[var(--panel-soft)]/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center text-blue-600 font-semibold border border-blue-100 shadow-sm">
                          {user.username.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-[var(--ink)]">{user.full_name || user.username}</div>
                          <div className="text-xs text-[var(--muted)]">{user.email || "Keine Email"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {user.roles.length > 0 ? (
                          user.roles.map((role) => (
                            <span
                              key={role}
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border
                                ${role === 'admin' 
                                  ? "bg-purple-50 text-purple-700 border-purple-200" 
                                  : "bg-[var(--bg)] text-[var(--muted)] border-[var(--line)]"}`}
                            >
                              {role}
                            </span>
                          ))
                        ) : (
                          <span className="text-[var(--muted)] italic text-xs">Keine Rollen</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border
                          ${user.is_active
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-red-50 text-red-700 border-red-200"
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? "bg-emerald-500" : "bg-red-500"}`} />
                        {user.is_active ? "Aktiv" : "Gesperrt"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          className="btn btn-icon btn-ghost btn-sm"
                          onClick={() => setPasswordChangeId(user.id)}
                          title="Passwort ändern"
                        >
                          <Key className="w-4 h-4 text-[var(--muted)] hover:text-amber-600" />
                        </button>
                        <button
                          className="btn btn-icon btn-ghost btn-sm"
                          onClick={() => handleToggleStatus(user)}
                          title={user.is_active ? "Benutzer sperren" : "Benutzer aktivieren"}
                        >
                          {user.is_active ? (
                            <Lock className="w-4 h-4 text-[var(--muted)] hover:text-orange-600" />
                          ) : (
                            <Unlock className="w-4 h-4 text-[var(--muted)] hover:text-emerald-600" />
                          )}
                        </button>
                        <button
                          className="btn btn-icon btn-ghost btn-sm"
                          onClick={() => handleOpenEdit(user)}
                          title="Bearbeiten"
                        >
                          <Edit2 className="w-4 h-4 text-[var(--muted)] hover:text-blue-600" />
                        </button>
                        <button
                          className="btn btn-icon btn-ghost btn-sm"
                          disabled={user.id === currentUser?.id}
                          onClick={() => handleDelete(user)}
                          title={user.id === currentUser?.id ? "Kann nicht gelöscht werden" : "Löschen"}
                        >
                          <Trash2 className={`w-4 h-4 ${user.id === currentUser?.id ? "text-gray-300" : "text-[var(--muted)] hover:text-red-600"}`} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Management Panel */}
      <article className="bg-[var(--panel)] rounded-[var(--radius-lg)] border border-[var(--line)] shadow-sm overflow-hidden" data-testid="roles-permissions-panel">
        <div className="p-6 border-b border-[var(--line)] bg-[var(--panel-soft)]/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-100 text-indigo-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="section-title">Rollenkonfiguration</h3>
              <p className="text-sm text-[var(--muted)]">Detaillierte Berechtigungssteuerung pro Rolle.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <select
              className="input w-full md:w-48 bg-[var(--bg)]"
              value={selectedRoleId ?? ""}
              onChange={(event) => setSelectedRoleId(Number(event.target.value))}
            >
              {(rolesQuery.data ?? []).map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              onClick={() => void handleSaveRolePermissions()}
              disabled={selectedRole?.name === "admin" || updateRolePermissionsMutation.isPending}
            >
              {updateRolePermissionsMutation.isPending ? "Speichert..." : "Speichern"}
            </button>
          </div>
        </div>

        <div className="p-6">
          {selectedRole?.name === "admin" && (
            <div className="mb-6 p-4 bg-purple-50 border border-purple-100 rounded-lg flex items-center gap-3 text-purple-800 text-sm">
              <Shield className="w-5 h-5 text-purple-600" />
              <p>Die <strong>admin</strong> Rolle hat automatisch Zugriff auf alle Systembereiche und kann nicht eingeschränkt werden.</p>
            </div>
          )}

          <div className="mb-4">
            <input
              className="input w-full"
              placeholder="Berechtigungen filtern..."
              value={permissionSearch}
              onChange={(e) => setPermissionSearch(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {filteredPermissions.map((permission) => (
              <label
                key={permission.code}
                className={`group flex items-start space-x-3 p-3 rounded-lg border transition-all
                  ${selectedRolePermissions.includes(permission.code) 
                    ? "bg-blue-50/50 border-blue-100" 
                    : "bg-[var(--bg)] border-transparent hover:border-[var(--line)] hover:bg-[var(--panel-soft)]"}
                  ${selectedRole?.name === "admin" ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="pt-0.5">
                   <input
                    type="checkbox"
                    className="checkbox"
                    checked={selectedRolePermissions.includes(permission.code)}
                    onChange={() => togglePermissionCode(selectedRole ?? null, permission.code)}
                    disabled={selectedRole?.name === "admin"}
                  />
                </div>
                <div className="grid gap-0.5 min-w-0">
                  <span className={`text-sm font-medium truncate ${selectedRolePermissions.includes(permission.code) ? "text-blue-700" : "text-[var(--ink)]"}`}>
                    {permission.code}
                  </span>
                  {permission.description && (
                    <span className="text-xs text-[var(--muted)] line-clamp-2 leading-relaxed">
                      {permission.description}
                    </span>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      </article>

      {/* User Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--panel)] rounded-[var(--radius-lg)] shadow-2xl w-full max-w-xl border border-[var(--line)] flex flex-col max-h-[90vh]">
            <header className="p-6 border-b border-[var(--line)] flex justify-between items-center">
              <h3 className="section-title">
                {modalMode === "create" ? "Neuen Benutzer anlegen" : "Benutzer bearbeiten"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </header>

            <div className="p-6 overflow-y-auto">
              <form id="user-form" className="space-y-5" onSubmit={handleSubmit}>
                {modalMode === "create" && (
                  <div className="space-y-2">
                    <label className="form-label-standard text-[var(--ink)] flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-[var(--muted)]" /> Benutzername *
                    </label>
                    <input
                      className="input w-full"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      required
                      minLength={3}
                      placeholder="z.B. max.mustermann"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="form-label-standard text-[var(--ink)] flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-[var(--muted)]" /> Voller Name
                  </label>
                  <input
                    className="input w-full"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Max Mustermann"
                  />
                </div>

                <div className="space-y-2">
                  <label className="form-label-standard text-[var(--ink)] flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[var(--muted)]" /> E-Mail Addresse
                  </label>
                  <input
                    type="email"
                    className="input w-full"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="max@firma.de"
                  />
                </div>

                {modalMode === "create" && (
                  <div className="space-y-2">
                    <label className="form-label-standard text-[var(--ink)] flex items-center gap-2">
                      <Key className="w-4 h-4 text-[var(--muted)]" /> Initial-Passwort *
                    </label>
                    <input
                      type="password"
                      className="input w-full"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={8}
                      placeholder="Mindestens 8 Zeichen"
                    />
                  </div>
                )}

                <div className="space-y-3">
                  <label className="form-label-standard text-[var(--ink)] flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[var(--muted)]" /> Rollen zuweisen
                  </label>
                  <div className="grid grid-cols-2 gap-3 p-4 bg-[var(--panel-soft)] rounded-lg border border-[var(--line)]">
                    {ROLE_OPTIONS.map((role) => (
                      <label key={role} className="flex items-center space-x-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={formData.roles.includes(role)}
                          onChange={() =>
                            setFormData((prev) => ({
                              ...prev,
                              roles: toggleRole(prev.roles, role),
                            }))
                          }
                        />
                        <span className="text-sm text-[var(--ink)] group-hover:text-blue-600 transition-colors">{role}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    className="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  <label htmlFor="is_active" className="form-label-standard text-[var(--ink)] cursor-pointer">
                    Benutzerkonto ist aktiv
                  </label>
                </div>
              </form>
            </div>

            <footer className="p-6 border-t border-[var(--line)] bg-[var(--panel-soft)]/30 flex justify-end gap-3">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setIsModalOpen(false)}
              >
                Abbrechen
              </button>
              <button
                type="submit"
                form="user-form"
                className="btn btn-primary"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) ? "Wird gespeichert..." : "Speichern"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {passwordChangeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--panel)] rounded-[var(--radius-lg)] shadow-2xl w-full max-w-md border border-[var(--line)]">
            <header className="p-6 border-b border-[var(--line)] flex justify-between items-center">
              <h3 className="section-title">Passwort ändern</h3>
              <button onClick={() => setPasswordChangeId(null)} className="text-[var(--muted)] hover:text-[var(--ink)]">
                <X className="w-5 h-5" />
              </button>
            </header>
            <div className="p-6 space-y-4">
              <p className="text-sm text-[var(--muted)]">
                Setzen Sie ein neues Passwort für den ausgewählten Benutzer.
              </p>
              <div className="space-y-2">
                <label className="form-label-standard text-[var(--ink)]">Neues Passwort</label>
                <input
                  type="password"
                  className="input w-full"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 Zeichen"
                  autoFocus
                />
              </div>
            </div>
            <footer className="p-6 border-t border-[var(--line)] bg-[var(--panel-soft)]/30 flex justify-end gap-3">
              <button onClick={() => setPasswordChangeId(null)} className="btn btn-ghost">Abbrechen</button>
              <button
                onClick={() => {
                  if (newPassword.length >= 8) {
                    changePasswordMutation.mutate({ userId: passwordChangeId, password: newPassword });
                  }
                }}
                className="btn btn-primary"
                disabled={newPassword.length < 8 || changePasswordMutation.isPending}
              >
                Passwort ändern
              </button>
            </footer>
          </div>
        </div>
      )}
      </div>
    </section>
  );
}
