import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Upload,
  Trash2,
  Download,
  Hash,
  Tag,
  Calendar,
  HardDrive
} from "lucide-react";

import { buildDocumentDownloadUrl, deleteDocument, fetchDocuments, uploadDocument } from "../services/documentsApi";

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const [entityType, setEntityType] = useState("purchase_order");
  const [entityId, setEntityId] = useState("1");
  const [documentType, setDocumentType] = useState("attachment");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const documentsQuery = useQuery({
    queryKey: ["documents", entityType, entityId, documentType],
    queryFn: () =>
      fetchDocuments({
        entity_type: entityType,
        entity_id: Number(entityId),
        document_type: documentType,
      }),
  });

  const uploadMutation = useMutation({
    mutationFn: uploadDocument,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      setSelectedFile(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const onUpload = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedFile) {
      return;
    }

    await uploadMutation.mutateAsync({
      entity_type: entityType,
      entity_id: Number(entityId),
      document_type: documentType,
      file: selectedFile,
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <section className="page flex flex-col gap-6" data-testid="documents-page">
      {/* Header Section */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="page-title">Dokumente</h2>
          <p className="section-subtitle mt-1">
            Dateien hochladen, versionieren und herunterladen.
          </p>
        </div>
      </header>

      {/* Upload Form Panel */}
      <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] p-4 shadow-sm">
        <h3 className="section-title mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5 text-[var(--accent)]" />
          Neues Dokument hochladen
        </h3>
        <form
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end"
          onSubmit={(event) => void onUpload(event)}
          data-testid="documents-upload-form"
        >
          {/* Entity Type */}
          <div className="space-y-1.5">
            <label className="form-label-standard flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[var(--muted)]" />
              Entity Type
            </label>
            <div className="relative">
              <input
                className="input w-full"
                value={entityType}
                onChange={(event) => setEntityType(event.target.value)}
                data-testid="documents-entity-type"
                placeholder="z.B. purchase_order"
              />
            </div>
          </div>

          {/* Entity ID */}
          <div className="space-y-1.5">
            <label className="form-label-standard flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-[var(--muted)]" />
              Entity ID
            </label>
            <div className="relative">
              <input
                className="input w-full"
                type="number"
                value={entityId}
                onChange={(event) => setEntityId(event.target.value)}
                data-testid="documents-entity-id"
                placeholder="ID"
              />
            </div>
          </div>

          {/* Document Type */}
          <div className="space-y-1.5">
            <label className="form-label-standard flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[var(--muted)]" />
              Document Type
            </label>
            <div className="relative">
              <input
                className="input w-full"
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value)}
                data-testid="documents-document-type"
                placeholder="z.B. attachment"
              />
            </div>
          </div>

          {/* File Input */}
          <div className="space-y-1.5">
            <label className="form-label-standard flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-[var(--muted)]" />
              Datei
            </label>
            <div className="relative">
              <input
                className="input w-full file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[var(--accent)] file:text-white hover:file:bg-[var(--accent-hover)] text-xs text-[var(--muted)] cursor-pointer"
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                data-testid="documents-file-input"
              />
            </div>
          </div>

          {/* Upload Button */}
          <button
            className="btn btn-primary w-full shadow-sm hover:shadow transition-all duration-200 justify-center h-[38px]"
            type="submit"
            disabled={uploadMutation.isPending || !selectedFile}
            data-testid="documents-upload-btn"
          >
            {uploadMutation.isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Lade...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Hochladen
              </span>
            )}
          </button>
        </form>
      </div>

      {/* Documents List */}
      <div className="bg-[var(--panel)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-[var(--line)] flex items-center justify-between">
          <h3 className="font-semibold text-[var(--ink)] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--muted)]" />
            Dokumentenliste
          </h3>
          <span className="text-xs font-medium text-[var(--muted)] bg-[var(--bg)] px-2 py-1 rounded-full border border-[var(--line)]">
            {documentsQuery.data?.items.length ?? 0} Dateien
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" data-testid="documents-list">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--panel-soft)] text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                <th className="px-6 py-3 w-24">Version</th>
                <th className="px-6 py-3 min-w-[200px]">Name</th>
                <th className="px-6 py-3">Typ</th>
                <th className="px-6 py-3 text-right">Größe</th>
                <th className="px-6 py-3 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {(documentsQuery.data?.items ?? []).map((item) => (
                <tr
                  key={item.id}
                  className="group hover:bg-[var(--panel-soft)] transition-colors duration-150"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
                      v{item.version}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-[var(--ink)] truncate block" title={item.file_name}>
                        {item.file_name}
                      </span>
                      <span className="text-xs text-[var(--muted)] uppercase truncate">
                        {item.mime_type}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--ink)] whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] text-xs">
                      <Tag className="w-3 h-3 opacity-60" />
                      {item.document_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--muted)] text-right whitespace-nowrap font-mono">
                    {formatFileSize(item.file_size)}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <a
                        className="p-2 text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--bg)] rounded-md transition-colors"
                        href={buildDocumentDownloadUrl(item.id)}
                        target="_blank"
                        rel="noreferrer"
                        data-testid={`document-download-${item.id}`}
                        title="Herunterladen"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        className="p-2 text-[var(--muted)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50"
                        onClick={() => void deleteMutation.mutateAsync(item.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`document-delete-${item.id}`}
                        title="Löschen"
                      >
                        {deleteMutation.isPending ? (
                          <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!documentsQuery.isLoading && (documentsQuery.data?.items.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[var(--muted)] italic">
                    <div className="flex flex-col items-center gap-3">
                      <FileText className="w-10 h-10 opacity-20" />
                      <p>Keine Dokumente gefunden.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
