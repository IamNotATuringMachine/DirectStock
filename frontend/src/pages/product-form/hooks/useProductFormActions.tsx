import { useMemo } from "react";
import { Check } from "lucide-react";
import type { NavigateFunction } from "react-router-dom";

import type { ProductCreateStep } from "../model";

type UseProductFormActionsParams = {
  navigate: NavigateFunction;
  isCreateWizardFlow: boolean;
  isEditMode: boolean;
  productId: number | null;
  activeTab: ProductCreateStep;
  createWizardSteps: ProductCreateStep[];
  setActiveTab: (tab: ProductCreateStep) => void;
};

export function useProductFormActions({
  navigate,
  isCreateWizardFlow,
  isEditMode,
  productId,
  activeTab,
  createWizardSteps,
  setActiveTab,
}: UseProductFormActionsParams) {
  const activeCreateStep = activeTab;
  const activeCreateStepIndex = createWizardSteps.indexOf(activeCreateStep);
  const createWizardStepCount = createWizardSteps.length;

  const nextCreateStep = useMemo(() => {
    return activeCreateStepIndex >= 0 && activeCreateStepIndex < createWizardSteps.length - 1
      ? createWizardSteps[activeCreateStepIndex + 1]
      : null;
  }, [activeCreateStepIndex, createWizardSteps]);

  const navigateCreateWizardToStep = (step: ProductCreateStep) => {
    if (!isEditMode || productId === null) {
      if (!isEditMode) {
        setActiveTab("master");
      }
      return;
    }
    navigate(`/products/${productId}/edit?flow=create&step=${step}`);
  };

  const onCreateWizardSkip = () => {
    if (!isCreateWizardFlow || !isEditMode) {
      return;
    }
    if (nextCreateStep) {
      navigateCreateWizardToStep(nextCreateStep);
      return;
    }
    navigate(`/products/${productId}`);
  };

  const onCreateWizardFinish = () => {
    if (!isCreateWizardFlow || !isEditMode) {
      return;
    }
    navigate(`/products/${productId}`);
  };

  const onCreateWizardStartNextProduct = () => {
    navigate("/products/new");
  };

  const renderCreateWizardFooter = (currentStep: ProductCreateStep) => {
    if (!isCreateWizardFlow || !isEditMode || currentStep === "master") {
      return null;
    }

    const currentStepIndex = createWizardSteps.indexOf(currentStep);
    const currentNextStep =
      currentStepIndex >= 0 && currentStepIndex < createWizardSteps.length - 1
        ? createWizardSteps[currentStepIndex + 1]
        : null;
    const currentIsLastStep = currentStepIndex === createWizardSteps.length - 1;

    return (
      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">
          {currentIsLastStep
            ? "Letzter Schritt. Sie können jetzt abschließen oder direkt einen weiteren Artikel anlegen."
            : "Optionaler Schritt. Speichern Sie bei Bedarf und gehen Sie dann weiter."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCreateWizardSkip}
            data-testid="product-create-skip"
          >
            {currentIsLastStep ? "Überspringen & abschließen" : "Überspringen"}
          </button>
          {currentIsLastStep ? (
            <>
              <button type="button" className="btn" onClick={onCreateWizardStartNextProduct}>
                Weiteren Artikel anlegen
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={onCreateWizardFinish}
                data-testid="product-create-finish"
              >
                Zur Detailseite
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (currentNextStep) {
                  navigateCreateWizardToStep(currentNextStep);
                }
              }}
              data-testid="product-create-next"
            >
              <Check size={14} /> Weiter
            </button>
          )}
        </div>
      </div>
    );
  };

  return {
    activeCreateStep,
    activeCreateStepIndex,
    createWizardStepCount,
    nextCreateStep,
    navigateCreateWizardToStep,
    onCreateWizardSkip,
    onCreateWizardFinish,
    onCreateWizardStartNextProduct,
    renderCreateWizardFooter,
  };
}
