import { describe, expect, it } from "vitest";

import { buildProgram } from "../src/cli.js";

describe("cli", () => {
  it("registers ralph command with expected flags", () => {
    const program = buildProgram();
    const ralph = program.commands.find((command) => command.name() === "ralph");

    expect(ralph).toBeDefined();

    const optionFlags = ralph!.options.map((option) => option.long);
    expect(optionFlags).toContain("--dry-run");
    expect(optionFlags).toContain("--no-preset");
    expect(optionFlags).toContain("--no-auto-commit");
    expect(optionFlags).toContain("--allow-dirty");
    expect(optionFlags).toContain("--max-iterations");
    expect(optionFlags).toContain("--plan");
    expect(optionFlags).toContain("--session-strategy");
    expect(optionFlags).toContain("--post-check-profile");
    expect(optionFlags).toContain("--log-format");
    expect(optionFlags).toContain("--run-log-path");
    expect(optionFlags).toContain("--strict-provider-capabilities");
    expect(optionFlags).toContain("--plan-template");
  });
});
