import { ArrowLeft, FileText } from "lucide-react";
import { Link } from "react-router-dom";

type ProductFormHeaderProps = {
  title: string;
  isEditMode: boolean;
  isCreateWizardFlow: boolean;
  productId: number | null;
};

export function ProductFormHeader({ title, isEditMode, isCreateWizardFlow, productId }: ProductFormHeaderProps) {
  return (
    <header className="panel-header flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div className="flex items-center gap-4">
        <Link to="/products" className="btn bg-[var(--panel)] shadow-sm" title="Zurück zur Liste">
          <ArrowLeft size={18} className="text-[var(--accent)]" />
          Zur Liste
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="page-title">{isEditMode && productId !== null ? `${title} #${productId}` : title}</h1>
            {isEditMode ? (
              <span className="px-2.5 py-0.5 rounded-md bg-[var(--panel-strong)] border border-[var(--line)] text-xs font-mono text-[var(--muted)]">
                ID: {productId}
              </span>
            ) : null}
          </div>
          <p className="section-subtitle mt-1">
            {isCreateWizardFlow
              ? "Der Artikel wurde angelegt. Ergänzen Sie jetzt optional Preise, Lagerdaten und Lieferanten."
              : isEditMode
                ? "Verwalten Sie hier alle Stammdaten, Lagerbestände und Lieferantenbeziehungen."
                : "Füllen Sie das Formular aus, um einen neuen Artikel im System zu registrieren."}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {isEditMode ? (
          <Link to={`/products/${productId}`} className="btn bg-[var(--panel)] shadow-sm">
            <FileText size={18} className="text-[var(--accent)]" />
            Zur Detailseite
          </Link>
        ) : null}
      </div>
    </header>
  );
}
