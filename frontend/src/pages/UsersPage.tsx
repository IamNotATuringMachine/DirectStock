import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import ConfirmationModal from "../components/ConfirmationModal";
import UserFormModal from "../components/users/UserFormModal";
import UserPermissionsDrawer from "../components/users/UserPermissionsDrawer";
import { fetchPermissions, fetchRoles } from "../services/rbacApi";
import {
  changeUserPassword,
  createUser,
  deleteUser,
  fetchUserAccessProfile,
  fetchUsers,
  updateUser,
  updateUserAccessProfile,
} from "../services/usersApi";
import { useAuthStore } from "../stores/authStore";
import type { RoleName, User } from "../types";
import { UsersView } from "./users/UsersView";
import {
  EMPTY_DELETE_CONFIRMATION,
  type DeleteConfirmationState,
  type PermissionMode,
} from "./users/model";

type UserFormSubmitData = {
  username: string;
  email: string;
  full_name: string;
  password?: string;
  roles: RoleName[];
  is_active: boolean;
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);

  const [passwordChangeId, setPasswordChangeId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedManagedUserId, setSelectedManagedUserId] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmationState>(EMPTY_DELETE_CONFIRMATION);

  const usersQuery = useQuery({ queryKey: ["users"], queryFn: () => fetchUsers() });
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: fetchRoles });
  const permissionsQuery = useQuery({ queryKey: ["permissions"], queryFn: fetchPermissions });

  const accessProfileQuery = useQuery({
    queryKey: ["users", "access-profile", selectedManagedUserId],
    queryFn: () => fetchUserAccessProfile(selectedManagedUserId as number),
    enabled: selectedManagedUserId !== null && isDrawerOpen,
  });

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
    },
  });

  const filteredUsers = useMemo(() => {
    if (!usersQuery.data) {
      return [];
    }
    if (!searchQuery) {
      return usersQuery.data;
    }
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
    if (!accessProfileQuery.data) {
      return {};
    }
    const modes: Record<string, PermissionMode> = {};
    for (const code of accessProfileQuery.data.allow_permissions) {
      modes[code] = "allow";
    }
    for (const code of accessProfileQuery.data.deny_permissions) {
      modes[code] = "deny";
    }
    return modes;
  }, [accessProfileQuery.data]);

  const currentProfileRoles = useMemo(() => accessProfileQuery.data?.roles ?? [], [accessProfileQuery.data]);

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
    if (!deleteConfirmation.userId) {
      return;
    }
    await deleteMutation.mutateAsync(deleteConfirmation.userId);
    setDeleteConfirmation(EMPTY_DELETE_CONFIRMATION);
  };

  const handleToggleStatus = async (user: User) => {
    await updateMutation.mutateAsync({
      userId: user.id,
      payload: { is_active: !user.is_active },
    });
  };

  const handleUserFormSubmit = async (data: UserFormSubmitData) => {
    if (modalMode === "create") {
      await createMutation.mutateAsync({
        username: data.username.trim(),
        email: data.email.trim() || null,
        full_name: data.full_name.trim() || null,
        password: data.password || "",
        roles: data.roles,
        is_active: data.is_active,
      });
      return;
    }
    if (!selectedUserForEdit) {
      return;
    }
    await updateMutation.mutateAsync({
      userId: selectedUserForEdit.id,
      payload: {
        email: data.email.trim() || null,
        full_name: data.full_name.trim() || null,
        roles: data.roles,
        is_active: data.is_active,
      },
    });
  };

  const handlePermissionsSave = async (roles: RoleName[], allowPermissions: string[], denyPermissions: string[]) => {
    if (!selectedManagedUserId) {
      return;
    }
    await updateAccessProfileMutation.mutateAsync({
      userId: selectedManagedUserId,
      payload: {
        roles,
        allow_permissions: allowPermissions,
        deny_permissions: denyPermissions,
      },
    });
  };

  const handleConfirmPasswordChange = () => {
    if (!passwordChangeId || newPassword.length < 8) {
      return;
    }
    changePasswordMutation.mutate({ userId: passwordChangeId, password: newPassword });
  };

  return (
    <>
      <UsersView
        users={filteredUsers}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        currentUserId={currentUser?.id}
        onOpenCreate={handleOpenCreate}
        onOpenPermissions={handleOpenPermissions}
        onOpenPassword={(user) => setPasswordChangeId(user.id)}
        onToggleStatus={(user) => void handleToggleStatus(user)}
        onOpenEdit={handleOpenEdit}
        onDelete={handleDeleteClick}
        passwordChangeId={passwordChangeId}
        newPassword={newPassword}
        onNewPasswordChange={setNewPassword}
        onClosePasswordModal={() => setPasswordChangeId(null)}
        onConfirmPasswordChange={handleConfirmPasswordChange}
        passwordMutationPending={changePasswordMutation.isPending}
      />

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

      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        onClose={() => setDeleteConfirmation(EMPTY_DELETE_CONFIRMATION)}
        onConfirm={() => void handleConfirmDelete()}
        title="Benutzer löschen"
        message={`Möchten Sie den Benutzer "${deleteConfirmation.username}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
        confirmLabel="Löschen"
        isDestructive={true}
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}
