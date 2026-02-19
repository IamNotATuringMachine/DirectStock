import type { User } from "../../types";

export type PermissionMode = "inherit" | "allow" | "deny";

export type DeleteConfirmationState = {
  isOpen: boolean;
  userId: number | null;
  username: string;
};

export const EMPTY_DELETE_CONFIRMATION: DeleteConfirmationState = {
  isOpen: false,
  userId: null,
  username: "",
};

export const getUserInitials = (user: User): string => user.username.substring(0, 2).toUpperCase();
