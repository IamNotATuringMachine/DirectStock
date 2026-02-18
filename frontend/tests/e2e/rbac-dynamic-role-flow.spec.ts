import { expect, test } from "@playwright/test";

import { loginAsAdminApi } from "./helpers/api";

test("rbac dynamic role flow creates a role and enforces permissions", async ({ request }) => {
  const adminToken = await loginAsAdminApi(request);
  const marker = Date.now().toString();

  const roleName = `e2e_role_${marker}`;
  const createRole = await request.post("/api/roles", {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      name: roleName,
      description: "E2E dynamic role",
      permission_codes: ["module.pages.read"],
    },
  });
  expect(createRole.ok()).toBeTruthy();

  const createUser = await request.post("/api/users", {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      username: `e2e_user_${marker}`,
      email: `e2e-${marker}@example.com`,
      full_name: "E2E RBAC User",
      password: "E2eRolePass123!",
      roles: [roleName],
      is_active: true,
    },
  });
  expect(createUser.ok()).toBeTruthy();

  const userLogin = await request.post("/api/auth/login", {
    data: {
      username: `e2e_user_${marker}`,
      password: "E2eRolePass123!",
    },
  });
  expect(userLogin.ok()).toBeTruthy();
  const userToken = ((await userLogin.json()) as { access_token: string }).access_token;

  const pages = await request.get("/api/pages", {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  expect(pages.status()).toBe(200);

  const roles = await request.get("/api/roles", {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  expect(roles.status()).toBe(403);
});
