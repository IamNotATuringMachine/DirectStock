import { api } from "./api";
import type { DocumentFile, DocumentFileListResponse } from "../types";

export async function fetchDocuments(params?: {
  entity_type?: string;
  entity_id?: number;
  document_type?: string;
}): Promise<DocumentFileListResponse> {
  const response = await api.get<DocumentFileListResponse>("/documents", { params });
  return response.data;
}

export async function uploadDocument(payload: {
  entity_type: string;
  entity_id: number;
  document_type: string;
  file: File;
}): Promise<DocumentFile> {
  const formData = new FormData();
  formData.set("entity_type", payload.entity_type);
  formData.set("entity_id", String(payload.entity_id));
  formData.set("document_type", payload.document_type);
  formData.set("file", payload.file);

  const response = await api.post<DocumentFile>("/documents", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function deleteDocument(documentId: number): Promise<void> {
  await api.delete(`/documents/${documentId}`);
}

export function buildDocumentDownloadUrl(documentId: number): string {
  return `/api/documents/${documentId}/download`;
}
