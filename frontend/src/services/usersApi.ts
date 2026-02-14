import { api } from "./api";
import type { User, UserCreatePayload, UserListResponse, UserUpdatePayload } from "../types";

export async function fetchUsers(): Promise<User[]> {
  const response = await api.get<UserListResponse>("/users");
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
