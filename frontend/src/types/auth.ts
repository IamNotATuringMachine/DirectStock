export type RoleName = string;

export type AuthUser = {
  id: number;
  username: string;
  email: string | null;
  roles: RoleName[];
  permissions?: string[];
  is_active: boolean;
};

export type User = {
  id: number;
  username: string;
  email: string | null;
  full_name: string | null;
  is_active: boolean;
  roles: RoleName[];
  created_at: string;
  updated_at: string;
};

export type UserListResponse = {
  items: User[];
};

type PermissionOverrideEffect = "allow" | "deny";

export type UserAccessProfile = {
  user_id: number;
  username: string;
  roles: RoleName[];
  allow_permissions: string[];
  deny_permissions: string[];
  effective_permissions: string[];
};

export type UserAccessProfileUpdatePayload = {
  roles: RoleName[];
  allow_permissions: string[];
  deny_permissions: string[];
};

export type UserCreatePayload = {
  username: string;
  email?: string | null;
  full_name?: string | null;
  password: string;
  roles: RoleName[];
  is_active: boolean;
};

export type UserUpdatePayload = {
  email?: string | null;
  full_name?: string | null;
  is_active?: boolean;
  roles?: RoleName[];
};

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

type ApiError = {
  code: string;
  message: string;
  request_id: string;
  details?: unknown;
};
