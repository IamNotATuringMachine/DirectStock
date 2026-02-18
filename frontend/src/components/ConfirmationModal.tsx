import { X, AlertTriangle } from "lucide-react";

type ConfirmationModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    isLoading?: boolean;
};

export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = "Bestätigen",
    cancelLabel = "Abbrechen",
    isDestructive = false,
    isLoading = false,
}: ConfirmationModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div
                className="bg-[var(--panel)] rounded-[var(--radius-lg)] shadow-2xl w-full max-w-md border border-[var(--line)] flex flex-col overflow-hidden"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirmation-title"
                aria-describedby="confirmation-desc"
            >
                <header className="p-6 pb-2 flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${isDestructive ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <h3 id="confirmation-title" className="text-lg font-semibold text-[var(--ink)]">
                            {title}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors p-1 rounded hover:bg-[var(--panel-soft)]"
                        aria-label="Schließen"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </header>

                <div className="px-6 py-4">
                    <p id="confirmation-desc" className="text-[var(--muted)]">
                        {message}
                    </p>
                </div>

                <footer className="p-6 pt-2 flex justify-end gap-3">
                    <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`btn ${isDestructive ? 'bg-red-600 hover:bg-red-700 text-white border-red-600' : 'btn-primary'}`}
                        disabled={isLoading}
                    >
                        {isLoading ? "Wird ausgeführt..." : confirmLabel}
                    </button>
                </footer>
            </div>
        </div>
    );
}
