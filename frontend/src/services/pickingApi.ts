import { api } from "./api";
import type { PickTask, PickWave, PickWaveDetail } from "../types";

export async function fetchPickWaves(): Promise<PickWave[]> {
  const response = await api.get<PickWave[]>("/pick-waves");
  return response.data;
}

export async function createPickWave(payload?: {
  wave_number?: string;
  goods_issue_ids?: number[];
  notes?: string;
}): Promise<PickWaveDetail> {
  const response = await api.post<PickWaveDetail>("/pick-waves", payload ?? {});
  return response.data;
}

export async function fetchPickWave(waveId: number): Promise<PickWaveDetail> {
  const response = await api.get<PickWaveDetail>(`/pick-waves/${waveId}`);
  return response.data;
}

export async function releasePickWave(waveId: number): Promise<PickWave> {
  const response = await api.post<PickWave>(`/pick-waves/${waveId}/release`);
  return response.data;
}

export async function completePickWave(waveId: number): Promise<PickWave> {
  const response = await api.post<PickWave>(`/pick-waves/${waveId}/complete`);
  return response.data;
}

export async function updatePickTask(
  taskId: number,
  payload: {
    status: "open" | "picked" | "skipped";
    picked_quantity?: string;
  }
): Promise<PickTask> {
  const response = await api.patch<PickTask>(`/pick-tasks/${taskId}`, payload);
  return response.data;
}
