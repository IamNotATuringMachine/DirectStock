import type { LucideIcon } from "lucide-react";

import type { ProductCreateStep } from "../model";

type CreateStepMeta = {
  label: string;
  icon: LucideIcon;
  optional: boolean;
};

type ProductCreateStepperProps = {
  isCreateWizardMode: boolean;
  isEditMode: boolean;
  activeTab: ProductCreateStep;
  activeCreateStepIndex: number;
  createWizardStepCount: number;
  createWizardSteps: ProductCreateStep[];
  createStepMeta: Record<ProductCreateStep, CreateStepMeta>;
  navigateCreateWizardToStep: (step: ProductCreateStep) => void;
  setActiveTab: (tab: ProductCreateStep) => void;
};

export function ProductCreateStepper({
  isCreateWizardMode,
  isEditMode,
  activeTab,
  activeCreateStepIndex,
  createWizardStepCount,
  createWizardSteps,
  createStepMeta,
  navigateCreateWizardToStep,
  setActiveTab,
}: ProductCreateStepperProps) {
  if (!isCreateWizardMode) {
    return null;
  }

  return (
    <section
      className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 md:p-5 space-y-3"
      data-testid="product-create-stepper"
    >
      <p className="text-sm font-semibold text-[var(--ink)]">
        Schritt {Math.max(activeCreateStepIndex + 1, 1)} von {createWizardStepCount}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {createWizardSteps.map((step, index) => {
          const stepMeta = createStepMeta[step];
          const isActive = step === activeTab;
          const isReachableInCreate = isEditMode || step === "master";
          const isCompleted = activeCreateStepIndex > index;

          return (
            <button
              key={step}
              type="button"
              onClick={() => {
                if (isEditMode) {
                  navigateCreateWizardToStep(step);
                } else {
                  setActiveTab("master");
                }
              }}
              disabled={!isReachableInCreate}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                isActive
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                  : isCompleted
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-[var(--line)] text-[var(--muted)]"
              } ${!isReachableInCreate ? "opacity-60 cursor-not-allowed" : "hover:border-[var(--line-strong)]"}`}
              data-testid={`product-create-step-${step}`}
            >
              <stepMeta.icon size={14} />
              {stepMeta.label}
              {stepMeta.optional ? <span className="text-[10px] uppercase">Optional</span> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
