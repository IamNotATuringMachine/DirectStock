import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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

  return (
    <section className="panel" data-testid="documents-page">
      <header className="panel-header">
        <div>
          <h2>Dokumente</h2>
          <p className="panel-subtitle">Dateien hochladen, versionieren und herunterladen.</p>
        </div>
      </header>

      <article className="subpanel">
        <form className="form-grid" onSubmit={(event) => void onUpload(event)} data-testid="documents-upload-form">
          <label>
            Entity Type
            <input className="input" value={entityType} onChange={(event) => setEntityType(event.target.value)} data-testid="documents-entity-type" />
          </label>
          <label>
            Entity ID
            <input
              className="input"
              type="number"
              value={entityId}
              onChange={(event) => setEntityId(event.target.value)}
              data-testid="documents-entity-id"
            />
          </label>
          <label>
            Document Type
            <input
              className="input"
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value)}
              data-testid="documents-document-type"
            />
          </label>
          <label>
            Datei
            <input
              className="input"
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              data-testid="documents-file-input"
            />
          </label>
          <button className="btn" type="submit" disabled={uploadMutation.isPending || !selectedFile} data-testid="documents-upload-btn">
            Upload
          </button>
        </form>
      </article>

      <article className="subpanel">
        <h3>Liste</h3>
        <div className="list-stack" data-testid="documents-list">
          {(documentsQuery.data?.items ?? []).map((item) => (
            <div className="list-item static-item" key={item.id}>
              <strong>
                v{item.version} {item.file_name}
              </strong>
              <span>
                {item.document_type} | {item.mime_type} | {item.file_size} B
              </span>
              <div className="actions-cell">
                <a className="btn" href={buildDocumentDownloadUrl(item.id)} target="_blank" rel="noreferrer" data-testid={`document-download-${item.id}`}>
                  Download
                </a>
                <button
                  className="btn"
                  onClick={() => void deleteMutation.mutateAsync(item.id)}
                  disabled={deleteMutation.isPending}
                  data-testid={`document-delete-${item.id}`}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {!documentsQuery.isLoading && (documentsQuery.data?.items.length ?? 0) === 0 ? <p>Keine Dokumente gefunden.</p> : null}
        </div>
      </article>
    </section>
  );
}
