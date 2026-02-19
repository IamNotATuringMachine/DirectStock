import { api } from "./api";
import type { Page, Permission, Role } from "../types";

export async function fetchPermissions(): Promise<Permission[]> {
  const response = await api.get<Permission[]>("/permissions");
  return response.data;
}

async function fetchPagesCatalog(): Promise<Page[]> {
  const response = await api.get<Page[]>("/pages");
  return response.data;
}

export async function fetchRoles(): Promise<Role[]> {
  const response = await api.get<Role[]>("/roles");
  return response.data;
}

async function createRole(payload: {
  name: string;
  description?: string | null;
  permission_codes: string[];
}): Promise<Role> {
  const response = await api.post<Role>("/roles", payload);
  return response.data;
}

async function updateRole(roleId: number, payload: { name?: string; description?: string | null }): Promise<Role> {
  const response = await api.put<Role>(`/roles/${roleId}`, payload);
  return response.data;
}

async function updateRolePermissions(roleId: number, permissionCodes: string[]): Promise<Role> {
  const response = await api.put<Role>(`/roles/${roleId}/permissions`, { permission_codes: permissionCodes });
  return response.data;
}

async function deleteRole(roleId: number): Promise<{ message: string }> {
  const response = await api.delete<{ message: string }>(`/roles/${roleId}`);
  return response.data;
}
