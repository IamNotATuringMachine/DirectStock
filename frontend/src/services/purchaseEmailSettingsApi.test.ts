import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPut: vi.fn(),
}));

vi.mock("./api", () => ({
  api: {
    get: mocks.apiGet,
    put: mocks.apiPut,
  },
}));

import { fetchPurchaseEmailSettings, updatePurchaseEmailSettings } from "./purchaseEmailSettingsApi";

describe("purchaseEmailSettingsApi", () => {
  beforeEach(() => {
    mocks.apiGet.mockReset();
    mocks.apiPut.mockReset();
  });

  it("fetchPurchaseEmailSettings loads settings from backend endpoint", async () => {
    mocks.apiGet.mockResolvedValueOnce({ data: { active_profile_id: 1, profiles: [] } });

    await fetchPurchaseEmailSettings();

    expect(mocks.apiGet).toHaveBeenCalledWith("/purchase-email-settings");
  });

  it("updatePurchaseEmailSettings saves settings payload", async () => {
    const payload = {
      profiles: [
        {
          profile_name: "Gmail",
          is_active: true,
          smtp_enabled: true,
          smtp_host: "smtp.example.test",
          smtp_port: 587,
          smtp_username: "user",
          smtp_password: "secret",
          smtp_use_tls: true,
          from_address: "einkauf@example.test",
          reply_to_address: "antwort@example.test",
          sender_name: "Einkauf",
          imap_enabled: false,
          imap_port: 993,
          imap_mailbox: "INBOX",
          imap_use_ssl: true,
          poll_interval_seconds: 300,
        },
      ],
    };
    mocks.apiPut.mockResolvedValueOnce({ data: { active_profile_id: 1, profiles: [] } });

    await updatePurchaseEmailSettings(payload);

    expect(mocks.apiPut).toHaveBeenCalledWith("/purchase-email-settings", payload);
  });
});
