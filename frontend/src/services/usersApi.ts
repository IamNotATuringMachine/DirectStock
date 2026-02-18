import { api } from "./api";
import type {
  User,
  UserAccessProfile,
  UserAccessProfileUpdatePayload,
  UserCreatePayload,
  UserListResponse,
  UserUpdatePayload,
} from "../types";

export async function fetchUsers(options?: { managedOnly?: boolean }): Promise<User[]> {
  const params = options?.managedOnly ? { managed_only: true } : undefined;
  const response = await api.get<UserListResponse>("/users", { params });
  return response.data.items;
}

export async function createUser(payload: UserCreatePayload): Promise<User> {
  const response = await api.post<User>("/users", payload);
  return response.data;
}

export async function updateUser(userId: number, payload: UserUpdatePayload): Promise<User> {
  const response = await api.put<User>(`/users/${userId}`, payload);
  return response.data;
}

export async function changeUserPassword(
  userId: number,
  payload: { new_password: string; current_password?: string | null }
): Promise<{ message: string }> {
  const response = await api.patch<{ message: string }>(`/users/${userId}/password`, payload);
  return response.data;
}

export async function deleteUser(userId: number): Promise<{ message: string }> {
  const response = await api.delete<{ message: string }>(`/users/${userId}`);
  return response.data;
}

export async function fetchUserAccessProfile(userId: number): Promise<UserAccessProfile> {
  const response = await api.get<UserAccessProfile>(`/users/${userId}/access-profile`);
  return response.data;
}

export async function updateUserAccessProfile(
  userId: number,
  payload: UserAccessProfileUpdatePayload
): Promise<UserAccessProfile> {
  const response = await api.put<UserAccessProfile>(`/users/${userId}/access-profile`, payload);
  return response.data;
}
