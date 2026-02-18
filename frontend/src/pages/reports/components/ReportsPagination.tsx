import { ChevronLeft, ChevronRight } from "lucide-react";

type ReportsPaginationProps = {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
};

export function ReportsPagination({ page, totalPages, onPrev, onNext }: ReportsPaginationProps) {
  return (
    <div className="flex items-center justify-between border-t border-[var(--line)] pt-4">
      <span className="text-sm text-[var(--muted)]">
        Seite <span className="font-medium text-[var(--ink)]">{page}</span> von{" "}
        <span className="font-medium text-[var(--ink)]">{totalPages}</span>
      </span>
      <div className="flex gap-2">
        <button className="btn bg-[var(--panel)]" disabled={page <= 1} onClick={onPrev} data-testid="reports-prev-page-btn">
          <ChevronLeft className="w-4 h-4" />
          Zurück
        </button>
        <button
          className="btn bg-[var(--panel)]"
          disabled={page >= totalPages}
          onClick={onNext}
          data-testid="reports-next-page-btn"
        >
          Weiter
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
