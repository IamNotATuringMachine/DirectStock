import { FormEvent } from "react";

import type { WarehouseZoneType } from "../../types";

type BinBatchCreateDialogProps = {
  canWrite: boolean;
  selectedZoneId: number | null;
  batchPrefix: string;
  aisleTo: number;
  shelfTo: number;
  levelTo: number;
  isPending: boolean;
  onBatchPrefixChange: (value: string) => void;
  onAisleToChange: (value: number) => void;
  onShelfToChange: (value: number) => void;
  onLevelToChange: (value: number) => void;
  onSubmit: (event: FormEvent) => Promise<void> | void;
};

const _binType: WarehouseZoneType = "storage";

export default function BinBatchCreateDialog({
  canWrite,
  selectedZoneId,
  batchPrefix,
  aisleTo,
  shelfTo,
  levelTo,
  isPending,
  onBatchPrefixChange,
  onAisleToChange,
  onShelfToChange,
  onLevelToChange,
  onSubmit,
}: BinBatchCreateDialogProps) {
  if (!canWrite || !selectedZoneId) {
    return null;
  }

  return (
    <div className="subpanel" data-testid="warehouse-batch-create-dialog">
      <h4>Batch-Erstellung</h4>
      <p className="panel-subtitle">Typ: {_binType}. Format: Prefix-Aisle-Shelf-Level.</p>
      <form className="batch-grid" onSubmit={(event) => void onSubmit(event)}>
        <input
          className="input"
          value={batchPrefix}
          onChange={(event) => onBatchPrefixChange(event.target.value)}
          aria-label="Prefix"
        />
        <input
          className="input"
          type="number"
          min={1}
          value={aisleTo}
          onChange={(event) => onAisleToChange(Number(event.target.value))}
          aria-label="Aisle To"
        />
        <input
          className="input"
          type="number"
          min={1}
          value={shelfTo}
          onChange={(event) => onShelfToChange(Number(event.target.value))}
          aria-label="Shelf To"
        />
        <input
          className="input"
          type="number"
          min={1}
          value={levelTo}
          onChange={(event) => onLevelToChange(Number(event.target.value))}
          aria-label="Level To"
        />
        <button className="btn" type="submit" disabled={isPending}>
          Batch anlegen
        </button>
      </form>
    </div>
  );
}
