import { FormEvent, useState } from "react";

import ExternalScannerListener from "./ExternalScannerListener";

type WorkflowScanInputProps = {
  enabled: boolean;
  isLoading: boolean;
  label: string;
  placeholder: string;
  onScan: (value: string, source: "manual" | "external") => Promise<void> | void;
  testIdPrefix: string;
};

export default function WorkflowScanInput({
  enabled,
  isLoading,
  label,
  placeholder,
  onScan,
  testIdPrefix,
}: WorkflowScanInputProps) {
  const [inputValue, setInputValue] = useState("");

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const value = inputValue.trim();
    if (!value || !enabled || isLoading) {
      return;
    }
    await onScan(value, "manual");
    setInputValue("");
  };

  return (
    <div className="workflow-scan">
      <ExternalScannerListener
        enabled={enabled && !isLoading}
        onScan={(value) => {
          void onScan(value, "external");
        }}
      />

      <p className="workflow-label">{label}</p>
      <form className="scan-form" onSubmit={(event) => void onSubmit(event)}>
        <input
          className="input scan-input"
          placeholder={placeholder}
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          disabled={!enabled || isLoading}
          data-testid={`${testIdPrefix}-input`}
        />
        <button
          className="btn workflow-btn"
          type="submit"
          disabled={!enabled || isLoading}
          data-testid={`${testIdPrefix}-submit`}
        >
          {isLoading ? "Suche..." : "Scannen"}
        </button>
      </form>
    </div>
  );
}
