import path from "node:path";

import fs from "fs-extra";
import { describe, expect, it } from "vitest";

import { PlanSchema } from "../src/planner/plan-schema.js";

describe("template contract", () => {
  it("contains a valid plan example in ralph-plan-template.md", async () => {
    const templatePath = path.resolve(process.cwd(), "../../docs/guides/ralph-plan-template.md");
    const content = await fs.readFile(templatePath, "utf8");
    const jsonBlock = content.match(/```json\s*([\s\S]*?)```/i)?.[1];

    expect(jsonBlock, "JSON example not found in template").toBeTruthy();

    const parsed = JSON.parse(jsonBlock as string);
    expect(() => PlanSchema.parse(parsed)).not.toThrow();
  });
});
