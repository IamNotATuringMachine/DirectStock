import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Shield,
  Lock,
  Unlock,
  Key,
  X,
} from "lucide-react";

import { fetchPermissions, fetchRoles } from "../services/rbacApi";
import { useAuthStore } from "../stores/authStore";
import {
  changeUserPassword,
  createUser,
  deleteUser,
  fetchUserAccessProfile,
  fetchUsers,
  updateUser,
  updateUserAccessProfile,
} from "../services/usersApi";
import type { RoleName, User } from "../types";
import UserFormModal from "../components/users/UserFormModal";
import UserPermissionsDrawer from "../components/users/UserPermissionsDrawer";
import ConfirmationModal from "../components/ConfirmationModal";

type PermissionMode = "inherit" | "allow" | "deny";

export default function UsersPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);

  // -- State for User Form Modal --
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);

  // -- State for Password Change Modal --
  const [passwordChangeId, setPasswordChangeId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");

  // -- State for Permissions Drawer --
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedManagedUserId, setSelectedManagedUserId] = useState<number | null>(null);

  // -- Search State --
  const [searchQuery, setSearchQuery] = useState("");

  // -- State for Delete Confirmation --
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    userId: number | null;
    username: string;
  }>({
    isOpen: false,
    userId: null,
    username: "",
  });

  // -- Queries --
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: () => fetchUsers() });
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: fetchRoles });
  const permissionsQuery = useQuery({ queryKey: ["permissions"], queryFn: fetchPermissions });

  // Query specific access profile when a user is selected for permission management
  const accessProfileQuery = useQuery({
    queryKey: ["users", "access-profile", selectedManagedUserId],
    queryFn: () => fetchUserAccessProfile(selectedManagedUserId as number),
    enabled: selectedManagedUserId !== null && isDrawerOpen,
  });

  // -- Mutations --
  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      setIsModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: number; payload: Parameters<typeof updateUser>[1] }) =>
      updateUser(userId, payload),
    onSuccess: async () => {
      setIsModalOpen(false);
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

  const updateAccessProfileMutation = useMutation({
    mutationFn: ({
      userId,
      payload,
    }: {
      userId: number;
      payload: Parameters<typeof updateUserAccessProfile>[1];
    }) => updateUserAccessProfile(userId, payload),
    onSuccess: async (profile) => {
      await queryClient.invalidateQueries({ queryKey: ["users", "access-profile", profile.user_id] });
      // We explicitly do NOT close the drawer here to allow further edits, 
      // but you could close it if desired: setIsDrawerOpen(false);
    },
  });

  // -- Derived State --
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

  const selectedManagedUser = useMemo(
    () => usersQuery.data?.find((user) => user.id === selectedManagedUserId) ?? null,
    [usersQuery.data, selectedManagedUserId]
  );

  const initialPermissionModes = useMemo(() => {
    if (!accessProfileQuery.data) return {};
    const modes: Record<string, PermissionMode> = {};
    for (const code of accessProfileQuery.data.allow_permissions) {
      modes[code] = "allow";
    }
    for (const code of accessProfileQuery.data.deny_permissions) {
      modes[code] = "deny";
    }
    return modes;
  }, [accessProfileQuery.data]);

  const currentProfileRoles = useMemo(() => {
    return accessProfileQuery.data?.roles ?? [];
  }, [accessProfileQuery.data]);


  // -- Handlers --

  const handleOpenCreate = () => {
    setModalMode("create");
    setSelectedUserForEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setModalMode("edit");
    setSelectedUserForEdit(user);
    setIsModalOpen(true);
  };

  const handleOpenPermissions = (user: User) => {
    setSelectedManagedUserId(user.id);
    setIsDrawerOpen(true);
  };

  const handleDeleteClick = (user: User) => {
    setDeleteConfirmation({
      isOpen: true,
      userId: user.id,
      username: user.username,
    });
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmation.userId) {
      await deleteMutation.mutateAsync(deleteConfirmation.userId);
      setDeleteConfirmation({ isOpen: false, userId: null, username: "" });
    }
  };

  const handleToggleStatus = async (user: User) => {
    await updateMutation.mutateAsync({
      userId: user.id,
      payload: { is_active: !user.is_active },
    });
  };

  const handleUserFormSubmit = async (data: any) => {
    if (modalMode === "create") {
      await createMutation.mutateAsync({
        username: data.username.trim(),
        email: data.email.trim() || null,
        full_name: data.full_name.trim() || null,
        password: data.password || "",
        roles: data.roles,
        is_active: data.is_active,
      });
    } else {
      if (!selectedUserForEdit) return;
      await updateMutation.mutateAsync({
        userId: selectedUserForEdit.id,
        payload: {
          email: data.email.trim() || null,
          full_name: data.full_name.trim() || null,
          roles: data.roles,
          is_active: data.is_active,
        },
      });
    }
  };

  const handlePermissionsSave = async (roles: RoleName[], allow_permissions: string[], deny_permissions: string[]) => {
    if (!selectedManagedUserId) return;
    await updateAccessProfileMutation.mutateAsync({
      userId: selectedManagedUserId,
      payload: {
        roles,
        allow_permissions,
        deny_permissions,
      },
    });
  };

  return (
    <section className="page" data-testid="users-page">
      <div className="flex flex-col gap-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="page-title">Benutzerverwaltung</h2>
            <p className="section-subtitle mt-1">Verwalten Sie Benutzer und Zugriffsrechte.</p>
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

        <div className="bg-[var(--panel)] rounded-[var(--radius-lg)] border border-[var(--line)] shadow-sm overflow-hidden flex flex-col">
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
            <div className="text-sm text-[var(--muted)] font-medium">{filteredUsers.length} Benutzer</div>
          </div>

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
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${role === "admin"
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : "bg-[var(--bg)] text-[var(--muted)] border-[var(--line)]"
                                  }`}
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
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${user.is_active
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-red-50 text-red-700 border-red-200"
                            }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${user.is_active ? "bg-emerald-500" : "bg-red-500"
                              }`}
                          />
                          {user.is_active ? "Aktiv" : "Gesperrt"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            className="btn btn-icon btn-ghost btn-sm"
                            onClick={() => handleOpenPermissions(user)}
                            title="Berechtigungen verwalten"
                          >
                            <Shield className="w-4 h-4 text-[var(--muted)] hover:text-indigo-600" />
                          </button>
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
                            onClick={() => handleDeleteClick(user)}
                            title={user.id === currentUser?.id ? "Kann nicht gelöscht werden" : "Löschen"}
                          >
                            <Trash2
                              className={`w-4 h-4 ${user.id === currentUser?.id
                                ? "text-gray-300"
                                : "text-[var(--muted)] hover:text-red-600"
                                }`}
                            />
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

        {/* User Form Modal */}
        <UserFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          mode={modalMode}
          initialData={
            selectedUserForEdit
              ? {
                id: selectedUserForEdit.id,
                username: selectedUserForEdit.username,
                email: selectedUserForEdit.email ?? "",
                full_name: selectedUserForEdit.full_name ?? "",
                roles: selectedUserForEdit.roles,
                is_active: selectedUserForEdit.is_active,
              }
              : undefined
          }
          availableRoles={rolesQuery.data ?? []}
          onSubmit={handleUserFormSubmit}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
        />

        {/* Permissions Drawer */}
        <UserPermissionsDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          user={selectedManagedUser}
          allRoles={rolesQuery.data ?? []}
          allPermissions={permissionsQuery.data ?? []}
          currentRoles={currentProfileRoles}
          initialPermissionModes={initialPermissionModes}
          onSave={handlePermissionsSave}
          isSaving={updateAccessProfileMutation.isPending}
        />

        {/* Password Change Modal */}
        {passwordChangeId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[var(--panel)] rounded-[var(--radius-lg)] shadow-2xl w-full max-w-md border border-[var(--line)]">
              <header className="p-6 border-b border-[var(--line)] flex justify-between items-center">
                <h3 className="section-title">Passwort ändern</h3>
                <button
                  onClick={() => setPasswordChangeId(null)}
                  className="text-[var(--muted)] hover:text-[var(--ink)]"
                >
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
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 Zeichen"
                    autoFocus
                  />
                </div>
              </div>
              <footer className="p-6 border-t border-[var(--line)] bg-[var(--panel-soft)]/30 flex justify-end gap-3">
                <button onClick={() => setPasswordChangeId(null)} className="btn btn-ghost">
                  Abbrechen
                </button>
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

        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={deleteConfirmation.isOpen}
          onClose={() => setDeleteConfirmation({ isOpen: false, userId: null, username: "" })}
          onConfirm={handleConfirmDelete}
          title="Benutzer löschen"
          message={`Möchten Sie den Benutzer "${deleteConfirmation.username}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
          confirmLabel="Löschen"
          isDestructive={true}
          isLoading={deleteMutation.isPending}
        />
      </div>
    </section>
  );
}
