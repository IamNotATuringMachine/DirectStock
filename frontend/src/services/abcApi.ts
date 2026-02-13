import { api } from "./api";
import type { AbcClassificationListResponse, AbcClassificationRun } from "../types";

export async function recomputeAbcClassification(payload?: {
  date_from?: string;
  date_to?: string;
}): Promise<AbcClassificationRun> {
  const response = await api.post<AbcClassificationRun>("/abc-classifications/recompute", payload ?? {});
  return response.data;
}

export async function fetchAbcClassification(runId?: number): Promise<AbcClassificationListResponse> {
  const response = await api.get<AbcClassificationListResponse>("/abc-classifications", {
    params: { run_id: runId },
  });
  return response.data;
}
