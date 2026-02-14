import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuthStore } from "../stores/authStore";
import {
  changeUserPassword,
  createUser,
  deleteUser,
  fetchUsers,
  updateUser,
} from "../services/usersApi";
import type { RoleName, User } from "../types";

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

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

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

  const createError = createMutation.error instanceof Error ? createMutation.error.message : null;
  const updateError = updateMutation.error instanceof Error ? updateMutation.error.message : null;
  const passwordError =
    changePasswordMutation.error instanceof Error ? changePasswordMutation.error.message : null;
  const deleteError = deleteMutation.error instanceof Error ? deleteMutation.error.message : null;

  const selectedUser = useMemo(
    () => usersQuery.data?.find((user) => user.id === editForm?.id) ?? null,
    [usersQuery.data, editForm?.id]
  );

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
    if (!window.confirm(`Benutzer ${user.username} wirklich loeschen?`)) {
      return;
    }
    await deleteMutation.mutateAsync(user.id);
  };

  return (
    <section className="panel" data-testid="users-page">
      <header className="panel-header">
        <div>
          <h2>Benutzerverwaltung</h2>
          <p className="panel-subtitle">Admin-CRUD fuer Benutzer, Rollen, Aktivstatus und Passwort-Aktion.</p>
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
                data-testid="users-create-username"
              />
            </label>
            <label>
              E-Mail
              <input
                className="input"
                type="email"
                value={createForm.email}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
                data-testid="users-create-email"
              />
            </label>
            <label>
              Voller Name
              <input
                className="input"
                value={createForm.full_name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, full_name: event.target.value }))}
                data-testid="users-create-full-name"
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
                data-testid="users-create-password"
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
            {createError ? <p className="error-text">{createError}</p> : null}
            <button className="btn" type="submit" disabled={createMutation.isPending} data-testid="users-create-submit">
              Benutzer anlegen
            </button>
          </form>
        </article>

        <article className="subpanel">
          <h3>Benutzerliste</h3>
          <div className="table-wrap">
            <table className="inventory-table" data-testid="users-table">
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
                  <tr key={user.id} data-testid={`users-row-${user.id}`}>
                    <td data-label="Benutzer">
                      <strong>{user.username}</strong>
                      <div>{user.email ?? "-"}</div>
                      <div>{user.full_name ?? "-"}</div>
                    </td>
                    <td data-label="Rollen">{user.roles.join(", ") || "-"}</td>
                    <td data-label="Status">{user.is_active ? "aktiv" : "gesperrt"}</td>
                    <td data-label="Aktionen">
                      <div className="actions-cell">
                        <button
                          className="btn"
                          type="button"
                          onClick={() => setEditForm(toEditState(user))}
                          data-testid={`users-edit-${user.id}`}
                        >
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
                          data-testid={`users-toggle-active-${user.id}`}
                        >
                          {user.is_active ? "Sperren" : "Aktivieren"}
                        </button>
                        <button
                          className="btn danger"
                          type="button"
                          disabled={user.id === currentUser?.id}
                          onClick={() => void onDelete(user)}
                          data-testid={`users-delete-${user.id}`}
                        >
                          Loeschen
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!usersQuery.isLoading && (usersQuery.data?.length ?? 0) === 0 ? <p>Keine Benutzer vorhanden.</p> : null}
          </div>
          {deleteError ? <p className="error-text">{deleteError}</p> : null}
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
            {updateError ? <p className="error-text">{updateError}</p> : null}
            <div className="actions-cell">
              <button className="btn" type="submit" disabled={updateMutation.isPending} data-testid="users-edit-save">
                Speichern
              </button>
              <button className="btn" type="button" onClick={() => setEditForm(null)}>
                Abbrechen
              </button>
            </div>
          </form>

          <form className="form-grid" onSubmit={(event) => void onPasswordSubmit(event)} data-testid="users-password-form">
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
            {passwordError ? <p className="error-text">{passwordError}</p> : null}
            <button
              className="btn"
              type="submit"
              disabled={changePasswordMutation.isPending || newPassword.trim().length < 8}
              data-testid="users-password-submit"
            >
              Passwort setzen
            </button>
          </form>
        </article>
      ) : null}
    </section>
  );
}
