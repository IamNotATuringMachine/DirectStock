import { expect, test } from "@playwright/test";

import { loginAsAdminApi } from "./helpers/api";

test("users access profile overrides role permissions with allow/deny", async ({ request }) => {
  const adminToken = await loginAsAdminApi(request);
  const marker = Date.now().toString();

  const roleName = `e2e_user_access_role_${marker}`;
  const createRole = await request.post("/api/roles", {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      name: roleName,
      description: "E2E user access profile role",
      permission_codes: ["module.permissions.read"],
    },
  });
  expect(createRole.ok()).toBeTruthy();

  const username = `e2e_user_access_${marker}`;
  const password = "E2eUserAccess123!";
  const createUser = await request.post("/api/users", {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      username,
      email: `${username}@example.com`,
      full_name: "E2E User Access Profile",
      password,
      roles: [roleName],
      is_active: true,
    },
  });
  expect(createUser.ok()).toBeTruthy();
  const userId = (await createUser.json()) as { id: number };

  const login = await request.post("/api/auth/login", {
    data: { username, password },
  });
  expect(login.ok()).toBeTruthy();
  const userToken = ((await login.json()) as { access_token: string }).access_token;

  const permissionsByRole = await request.get("/api/permissions", {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  expect(permissionsByRole.status()).toBe(200);

  const denyPermission = await request.put(`/api/users/${userId.id}/access-profile`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      roles: [roleName],
      allow_permissions: [],
      deny_permissions: ["module.permissions.read"],
    },
  });
  expect(denyPermission.status()).toBe(200);

  const permissionsDenied = await request.get("/api/permissions", {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  expect(permissionsDenied.status()).toBe(403);

  const allowPermission = await request.put(`/api/users/${userId.id}/access-profile`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      roles: [roleName],
      allow_permissions: ["module.permissions.read"],
      deny_permissions: [],
    },
  });
  expect(allowPermission.status()).toBe(200);

  const permissionsAllowedAgain = await request.get("/api/permissions", {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  expect(permissionsAllowedAgain.status()).toBe(200);
});
