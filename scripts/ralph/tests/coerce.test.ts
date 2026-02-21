import { describe, expect, it } from "vitest";

import { coerceEfficiencyMode, coerceThinkingVisibility } from "../src/lib/coerce.js";

describe("coerceThinkingVisibility", () => {
  it("defaults to full when value is undefined", () => {
    expect(coerceThinkingVisibility(undefined)).toBe("full");
  });

  it("accepts explicit supported values", () => {
    expect(coerceThinkingVisibility("summary")).toBe("summary");
    expect(coerceThinkingVisibility("hidden")).toBe("hidden");
    expect(coerceThinkingVisibility("full")).toBe("full");
  });

  it("throws for invalid values", () => {
    expect(() => coerceThinkingVisibility("verbose")).toThrow("Invalid thinking visibility: verbose");
  });
});

describe("coerceEfficiencyMode", () => {
  it("defaults to balanced when value is undefined", () => {
    expect(coerceEfficiencyMode(undefined)).toBe("balanced");
  });

  it("accepts explicit supported values", () => {
    expect(coerceEfficiencyMode("forensic")).toBe("forensic");
    expect(coerceEfficiencyMode("balanced")).toBe("balanced");
    expect(coerceEfficiencyMode("performance")).toBe("performance");
  });

  it("throws for invalid values", () => {
    expect(() => coerceEfficiencyMode("aggressive")).toThrow("Invalid efficiency mode: aggressive");
  });
});
