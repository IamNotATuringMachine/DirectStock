import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
  username: string;
  email: string;
  full_name: string;
  password: string;
  roles: RoleName[];
  is_active: boolean;
};

const EMPTY_FORM: UserFormState = {
  username: "",
  email: "",
  full_name: "",
  password: "",
  roles: [],
  is_active: true,
};

type UserEditState = {
  id: number;
  email: string;
  full_name: string;
  roles: RoleName[];
  is_active: boolean;
};

function toggleRole(roles: RoleName[], role: RoleName): RoleName[] {
  if (roles.includes(role)) {
    return roles.filter((item) => item !== role);
  }
  return [...roles, role];
}

function toEditState(user: User): UserEditState {
  return {
    id: user.id,
    email: user.email ?? "",
    full_name: user.full_name ?? "",
    roles: [...user.roles],
    is_active: user.is_active,
  };
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);

  const [createForm, setCreateForm] = useState<UserFormState>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<UserEditState | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedRolePermissions, setSelectedRolePermissions] = useState<string[]>([]);

  const usersQuery = useQuery({ queryKey: ["users"], queryFn: fetchUsers });
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: fetchRoles });
  const permissionsQuery = useQuery({ queryKey: ["permissions"], queryFn: fetchPermissions });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      setCreateForm(EMPTY_FORM);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: number; payload: Parameters<typeof updateUser>[1] }) =>
      updateUser(userId, payload),
    onSuccess: async (user) => {
      setEditForm(toEditState(user));
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: number; password: string }) =>
      changeUserPassword(userId, { new_password: password }),
    onSuccess: async () => {
      setNewPassword("");
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: async () => {
      setEditForm(null);
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

  const selectedUser = useMemo(
    () => usersQuery.data?.find((user) => user.id === editForm?.id) ?? null,
    [usersQuery.data, editForm?.id]
  );

  const selectedRole = useMemo(
    () => rolesQuery.data?.find((role) => role.id === selectedRoleId) ?? null,
    [rolesQuery.data, selectedRoleId]
  );

  useEffect(() => {
    if (!rolesQuery.data || rolesQuery.data.length === 0) {
      return;
    }
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

  const onCreateSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await createMutation.mutateAsync({
      username: createForm.username.trim(),
      email: createForm.email.trim() || null,
      full_name: createForm.full_name.trim() || null,
      password: createForm.password,
      roles: createForm.roles,
      is_active: createForm.is_active,
    });
  };

  const onEditSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editForm) {
      return;
    }
    await updateMutation.mutateAsync({
      userId: editForm.id,
      payload: {
        email: editForm.email.trim() || null,
        full_name: editForm.full_name.trim() || null,
        roles: editForm.roles,
        is_active: editForm.is_active,
      },
    });
  };

  const onPasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editForm || newPassword.trim().length < 8) {
      return;
    }
    await changePasswordMutation.mutateAsync({ userId: editForm.id, password: newPassword.trim() });
  };

  const onDelete = async (user: User) => {
    if (!window.confirm(`Benutzer ${user.username} wirklich löschen?`)) {
      return;
    }
    await deleteMutation.mutateAsync(user.id);
  };

  const onSaveRolePermissions = async () => {
    if (selectedRoleId === null) {
      return;
    }
    await updateRolePermissionsMutation.mutateAsync({
      roleId: selectedRoleId,
      permissionCodes: selectedRolePermissions,
    });
  };

  const togglePermissionCode = (role: Role | null, code: string) => {
    if (role && role.name === "admin") {
      return;
    }
    setSelectedRolePermissions((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]
    );
  };

  return (
    <section className="panel" data-testid="users-page">
      <header className="panel-header">
        <div>
          <h2>Benutzerverwaltung</h2>
          <p className="panel-subtitle">Admin-CRUD für Benutzer, Rollen und Berechtigungen.</p>
        </div>
      </header>

      <div className="warehouse-grid">
        <article className="subpanel">
          <h3>Benutzer anlegen</h3>
          <form className="form-grid" onSubmit={(event) => void onCreateSubmit(event)} data-testid="users-create-form">
            <label>
              Benutzername
              <input
                className="input"
                value={createForm.username}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, username: event.target.value }))}
                minLength={3}
                required
              />
            </label>
            <label>
              E-Mail
              <input
                className="input"
                type="email"
                value={createForm.email}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </label>
            <label>
              Voller Name
              <input
                className="input"
                value={createForm.full_name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, full_name: event.target.value }))}
              />
            </label>
            <label>
              Initial-Passwort
              <input
                className="input"
                type="password"
                value={createForm.password}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
                minLength={8}
                required
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={createForm.is_active}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, is_active: event.target.checked }))}
              />
              Aktiv
            </label>
            <fieldset className="checkbox-grid">
              <legend>Rollen</legend>
              {ROLE_OPTIONS.map((role) => (
                <label key={role} className="checkbox">
                  <input
                    type="checkbox"
                    checked={createForm.roles.includes(role)}
                    onChange={() =>
                      setCreateForm((prev) => ({
                        ...prev,
                        roles: toggleRole(prev.roles, role),
                      }))
                    }
                  />
                  {role}
                </label>
              ))}
            </fieldset>
            <button className="btn" type="submit" disabled={createMutation.isPending}>
              Benutzer anlegen
            </button>
          </form>
        </article>

        <article className="subpanel">
          <h3>Benutzerliste</h3>
          <div className="table-wrap">
            <table className="products-table mobile-cards-table" data-testid="users-table">
              <thead>
                <tr>
                  <th>Benutzer</th>
                  <th>Rollen</th>
                  <th>Status</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {(usersQuery.data ?? []).map((user) => (
                  <tr key={user.id}>
                    <td data-label="Benutzer">
                      <strong>{user.username}</strong>
                      <div>{user.email ?? "-"}</div>
                      <div>{user.full_name ?? "-"}</div>
                    </td>
                    <td data-label="Rollen">{user.roles.join(", ") || "-"}</td>
                    <td data-label="Status">{user.is_active ? "aktiv" : "gesperrt"}</td>
                    <td data-label="Aktionen" className="actions-cell">
                      <button className="btn" type="button" onClick={() => setEditForm(toEditState(user))}>
                        Bearbeiten
                      </button>
                      <button
                        className="btn"
                        type="button"
                        onClick={() =>
                          void updateMutation.mutateAsync({
                            userId: user.id,
                            payload: { is_active: !user.is_active },
                          })
                        }
                      >
                        {user.is_active ? "Sperren" : "Aktivieren"}
                      </button>
                      <button
                        className="btn danger"
                        type="button"
                        disabled={user.id === currentUser?.id}
                        onClick={() => void onDelete(user)}
                      >
                        Löschen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      {editForm ? (
        <article className="subpanel" data-testid="users-edit-panel">
          <h3>Benutzer bearbeiten: {selectedUser?.username ?? editForm.id}</h3>
          <form className="form-grid" onSubmit={(event) => void onEditSubmit(event)}>
            <label>
              E-Mail
              <input
                className="input"
                type="email"
                value={editForm.email}
                onChange={(event) => setEditForm((prev) => (prev ? { ...prev, email: event.target.value } : prev))}
              />
            </label>
            <label>
              Voller Name
              <input
                className="input"
                value={editForm.full_name}
                onChange={(event) =>
                  setEditForm((prev) => (prev ? { ...prev, full_name: event.target.value } : prev))
                }
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={editForm.is_active}
                onChange={(event) =>
                  setEditForm((prev) => (prev ? { ...prev, is_active: event.target.checked } : prev))
                }
              />
              Aktiv
            </label>
            <fieldset className="checkbox-grid">
              <legend>Rollen</legend>
              {ROLE_OPTIONS.map((role) => (
                <label key={role} className="checkbox">
                  <input
                    type="checkbox"
                    checked={editForm.roles.includes(role)}
                    onChange={() =>
                      setEditForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              roles: toggleRole(prev.roles, role),
                            }
                          : prev
                      )
                    }
                  />
                  {role}
                </label>
              ))}
            </fieldset>
            <div className="actions-cell">
              <button className="btn" type="submit" disabled={updateMutation.isPending}>
                Speichern
              </button>
              <button className="btn" type="button" onClick={() => setEditForm(null)}>
                Abbrechen
              </button>
            </div>
          </form>

          <form className="form-grid" onSubmit={(event) => void onPasswordSubmit(event)}>
            <label>
              Neues Passwort
              <input
                className="input"
                type="password"
                value={newPassword}
                minLength={8}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <button className="btn" type="submit" disabled={changePasswordMutation.isPending || newPassword.trim().length < 8}>
              Passwort setzen
            </button>
          </form>
        </article>
      ) : null}

      <article className="subpanel" data-testid="roles-permissions-panel">
        <h3>Rollen und Rechte</h3>
        <div className="inline-form">
          <select
            className="input"
            value={selectedRoleId ?? ""}
            onChange={(event) => setSelectedRoleId(Number(event.target.value))}
          >
            {(rolesQuery.data ?? []).map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          <button className="btn" type="button" onClick={() => void onSaveRolePermissions()}>
            Rechte speichern
          </button>
        </div>

        <p className="panel-subtitle">Ausgewählte Rolle: {selectedRole?.name ?? "-"}</p>

        <div className="checkbox-grid" style={{ maxHeight: 280, overflow: "auto" }}>
          {(permissionsQuery.data ?? []).map((permission) => (
            <label key={permission.code} className="checkbox">
              <input
                type="checkbox"
                checked={selectedRolePermissions.includes(permission.code)}
                onChange={() => togglePermissionCode(selectedRole ?? null, permission.code)}
                disabled={selectedRole?.name === "admin"}
              />
              {permission.code}
            </label>
          ))}
        </div>
      </article>
    </section>
  );
}
