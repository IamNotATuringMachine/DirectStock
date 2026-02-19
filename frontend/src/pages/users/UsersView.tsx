import type { User } from "../../types";
import { UsersHeader } from "./components/UsersHeader";
import { UsersPasswordModal } from "./components/UsersPasswordModal";
import { UsersTable } from "./components/UsersTable";

type UsersViewProps = {
  users: User[];
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  currentUserId?: number;
  onOpenCreate: () => void;
  onOpenPermissions: (user: User) => void;
  onOpenPassword: (user: User) => void;
  onToggleStatus: (user: User) => void;
  onOpenEdit: (user: User) => void;
  onDelete: (user: User) => void;
  passwordChangeId: number | null;
  newPassword: string;
  onNewPasswordChange: (value: string) => void;
  onClosePasswordModal: () => void;
  onConfirmPasswordChange: () => void;
  passwordMutationPending: boolean;
};

export function UsersView({
  users,
  searchQuery,
  onSearchQueryChange,
  currentUserId,
  onOpenCreate,
  onOpenPermissions,
  onOpenPassword,
  onToggleStatus,
  onOpenEdit,
  onDelete,
  passwordChangeId,
  newPassword,
  onNewPasswordChange,
  onClosePasswordModal,
  onConfirmPasswordChange,
  passwordMutationPending,
}: UsersViewProps) {
  return (
    <section className="page" data-testid="users-page">
      <div className="flex flex-col gap-8 max-w-7xl mx-auto">
        <UsersHeader onOpenCreate={onOpenCreate} />

        <UsersTable
          users={users}
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange}
          currentUserId={currentUserId}
          onOpenPermissions={onOpenPermissions}
          onOpenPassword={onOpenPassword}
          onToggleStatus={onToggleStatus}
          onOpenEdit={onOpenEdit}
          onDelete={onDelete}
        />

        <UsersPasswordModal
          passwordChangeId={passwordChangeId}
          newPassword={newPassword}
          onNewPasswordChange={onNewPasswordChange}
          onClose={onClosePasswordModal}
          onConfirm={onConfirmPasswordChange}
          isSubmitting={passwordMutationPending}
        />
      </div>
    </section>
  );
}
