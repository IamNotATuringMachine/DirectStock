import { describe, expect, it } from "vitest";

import { commandsForPostCheckProfile } from "../src/post-checks.js";

describe("post-check profiles", () => {
  it("returns fast profile commands", () => {
    const commands = commandsForPostCheckProfile("fast");
    expect(commands).toEqual([
      "./scripts/check_refactor_scope_allowlist.sh",
      "./scripts/check_file_size_limits.sh",
    ]);
  });

  it("returns governance profile commands", () => {
    const commands = commandsForPostCheckProfile("governance");
    expect(commands).toContain("./scripts/agent_governance_check.sh");
    expect(commands).toContain("python3 scripts/check_mcp_profile_parity.py --strict --format json");
    expect(commands).toContain("python3 scripts/check_provider_capabilities.py --provider all --format json");
  });

  it("returns full profile commands", () => {
    const commands = commandsForPostCheckProfile("full");
    expect(commands[commands.length - 1]).toContain("./scripts/run_golden_tasks.sh");
  });
});
