import { Edit2, Key, Lock, Search, Shield, Trash2, Unlock } from "lucide-react";

import type { User } from "../../../types";
import { getUserInitials } from "../model";

type UsersTableProps = {
  users: User[];
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  currentUserId?: number;
  onOpenPermissions: (user: User) => void;
  onOpenPassword: (user: User) => void;
  onToggleStatus: (user: User) => void;
  onOpenEdit: (user: User) => void;
  onDelete: (user: User) => void;
};

export function UsersTable({
  users,
  searchQuery,
  onSearchQueryChange,
  currentUserId,
  onOpenPermissions,
  onOpenPassword,
  onToggleStatus,
  onOpenEdit,
  onDelete,
}: UsersTableProps) {
  return (
    <div className="bg-[var(--panel)] rounded-[var(--radius-lg)] border border-[var(--line)] shadow-sm overflow-hidden flex flex-col">
      <div className="p-4 border-b border-[var(--line)] flex flex-col sm:flex-row gap-4 justify-between items-center bg-[var(--panel-soft)]/50">
        <div className="relative w-full sm:w-96">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
          <input
            className="input input-leading-icon w-full bg-[var(--bg)]"
            placeholder="Suchen nach Name, Email..."
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
        </div>
        <div className="text-sm text-[var(--muted)] font-medium">{users.length} Benutzer</div>
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
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-[var(--muted)]">
                  <div className="flex flex-col items-center gap-2">
                    <Search className="w-8 h-8 opacity-20" />
                    <p>Keine Benutzer gefunden.</p>
                  </div>
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="group hover:bg-[var(--panel-soft)]/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center text-blue-600 font-semibold border border-blue-100 shadow-sm">
                        {getUserInitials(user)}
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
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${
                              role === "admin"
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
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                        user.is_active
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-red-50 text-red-700 border-red-200"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? "bg-emerald-500" : "bg-red-500"}`} />
                      {user.is_active ? "Aktiv" : "Gesperrt"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        className="btn btn-icon btn-ghost btn-sm"
                        onClick={() => onOpenPermissions(user)}
                        title="Berechtigungen verwalten"
                      >
                        <Shield className="w-4 h-4 text-[var(--muted)] hover:text-indigo-600" />
                      </button>
                      <button
                        className="btn btn-icon btn-ghost btn-sm"
                        onClick={() => onOpenPassword(user)}
                        title="Passwort ändern"
                      >
                        <Key className="w-4 h-4 text-[var(--muted)] hover:text-amber-600" />
                      </button>
                      <button
                        className="btn btn-icon btn-ghost btn-sm"
                        onClick={() => onToggleStatus(user)}
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
                        onClick={() => onOpenEdit(user)}
                        title="Bearbeiten"
                      >
                        <Edit2 className="w-4 h-4 text-[var(--muted)] hover:text-blue-600" />
                      </button>
                      <button
                        className="btn btn-icon btn-ghost btn-sm"
                        disabled={user.id === currentUserId}
                        onClick={() => onDelete(user)}
                        title={user.id === currentUserId ? "Kann nicht gelöscht werden" : "Löschen"}
                      >
                        <Trash2
                          className={`w-4 h-4 ${
                            user.id === currentUserId ? "text-gray-300" : "text-[var(--muted)] hover:text-red-600"
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
  );
}
