import { Plus } from "lucide-react";

type UsersHeaderProps = {
  onOpenCreate: () => void;
};

export function UsersHeader({ onOpenCreate }: UsersHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h2 className="page-title">Benutzerverwaltung</h2>
        <p className="section-subtitle mt-1">Verwalten Sie Benutzer und Zugriffsrechte.</p>
      </div>
      <button
        onClick={onOpenCreate}
        className="btn btn-primary flex items-center gap-2 shadow-lg shadow-blue-500/20"
        data-testid="users-create-btn"
      >
        <Plus className="w-4 h-4" />
        Benutzer anlegen
      </button>
    </div>
  );
}
