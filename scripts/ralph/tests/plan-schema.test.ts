import os from "node:os";
import path from "node:path";

import fs from "fs-extra";
import { describe, expect, it } from "vitest";

import {
  PLAN_SCHEMA_VERSION,
  PlanSchema,
  PlannerDraftSchema,
  loadPlan,
  normalizeDraftToPlan,
  parsePlan,
  savePlan,
} from "../src/planner/plan-schema.js";

describe("plan schema", () => {
  it("normalizes a planner draft to executable plan", () => {
    const draft = PlannerDraftSchema.parse({
      goal: "Split big modules",
      steps: [
        {
          title: "Extract service",
          description: "Move business logic to service module",
          successCriteria: "npm test",
          type: "code",
          riskLevel: "medium",
        },
      ],
    });

    const plan = normalizeDraftToPlan({
      draft,
      provider: "OpenAI",
      model: "gpt-5.3-codex",
      totalIterations: 10,
      createdAt: "2026-02-19T00:00:00.000Z",
    });

    expect(plan.schemaVersion).toBe(PLAN_SCHEMA_VERSION);
    expect(plan.steps[0].id).toBe("step-01");
    expect(plan.steps[0].type).toBe("code");
    expect(plan.steps[0].riskLevel).toBe("medium");
    expect(() => PlanSchema.parse(plan)).not.toThrow();
  });

  it("migrates legacy 1.0 plans to 1.1", () => {
    const migrated = parsePlan({
      schemaVersion: "1.0.0",
      goal: "Goal",
      createdAt: new Date().toISOString(),
      steps: [
        {
          id: "step-01",
          title: "Step",
          description: "Desc",
          successCriteria: "true",
          status: "pending",
          attempts: 0,
          maxAttempts: 3,
        },
      ],
      metadata: {
        provider: "OpenAI",
        model: "gpt-5.3-codex",
        totalIterations: 5,
        completedIterations: 0,
      },
    });

    expect(migrated.schemaVersion).toBe("1.1.0");
    expect(migrated.steps[0].files).toEqual([]);
    expect(migrated.steps[0].rollbackHint.length).toBeGreaterThan(0);
  });

  it("persists and reloads a plan file", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ralph-plan-"));
    const planPath = path.join(tempDir, "ralph-plan.json");

    const plan = PlanSchema.parse({
      schemaVersion: "1.1.0",
      goal: "Goal",
      createdAt: new Date().toISOString(),
      steps: [
        {
          id: "step-01",
          title: "Step",
          description: "Desc",
          successCriteria: "true",
          status: "pending",
          attempts: 0,
          maxAttempts: 3,
          type: "code",
          files: [],
          riskLevel: "low",
          owner: "team",
          postChecks: [],
          rollbackHint: "git revert",
        },
      ],
      metadata: {
        provider: "OpenAI",
        model: "gpt-5.3-codex",
        totalIterations: 5,
        completedIterations: 0,
        resumeSessionId: "session-123",
      },
    });

    await savePlan(planPath, plan);
    const loaded = await loadPlan(planPath);

    expect(loaded.goal).toBe("Goal");
    expect(loaded.steps).toHaveLength(1);
    expect(loaded.metadata.resumeSessionId).toBe("session-123");
  });
});
