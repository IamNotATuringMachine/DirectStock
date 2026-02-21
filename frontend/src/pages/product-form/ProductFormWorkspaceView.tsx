import { AlertCircle } from "lucide-react";
import { ProductCreateStepper } from "./components/ProductCreateStepper";
import { ProductFormHeader } from "./components/ProductFormHeader";
import { ProductMasterSection } from "./components/ProductMasterSection";
import { ProductPricingSection } from "./components/ProductPricingSection";
import { ProductSuppliersSection } from "./components/ProductSuppliersSection";
import { ProductTabs } from "./components/ProductTabs";
import { ProductWarehouseSection } from "./components/ProductWarehouseSection";

export function ProductFormWorkspaceView({ vm }: { vm: any }) {
  const {
    title,
    isEditMode,
    isCreateWizardFlow,
    productId,
    isAdmin,
    productQuery,
    isCreateWizardMode,
    activeTab,
    activeCreateStepIndex,
    createWizardStepCount,
    createWizardSteps,
    createStepMeta,
    navigateCreateWizardToStep,
    setActiveTab,
    canReadPricing,
    tabConfig,
  } = vm;

  return (
    <section className="page" data-testid="product-form-page">
      <div className="max-w-5xl mx-auto space-y-8">
        <ProductFormHeader
          title={title}
          isEditMode={isEditMode}
          isCreateWizardFlow={isCreateWizardFlow}
          productId={productId}
        />

        {!isAdmin ? (
          <div className="p-4 rounded-xl bg-red-50/50 border border-red-200 text-red-700 flex items-start gap-3 shadow-sm">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <p className="text-sm font-medium">Nur Administratoren sind berechtigt, Artikeldaten zu bearbeiten.</p>
          </div>
        ) : null}

        {isEditMode && productQuery.isError ? (
          <div className="p-4 rounded-xl bg-red-50/50 border border-red-200 text-red-700 flex items-start gap-3 shadow-sm">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <p className="text-sm font-medium">
              Es gab ein Problem beim Laden der Artikeldaten. Bitte versuchen Sie es erneut.
            </p>
          </div>
        ) : null}

        <ProductCreateStepper
          isCreateWizardMode={isCreateWizardMode}
          isEditMode={isEditMode}
          activeTab={activeTab}
          activeCreateStepIndex={activeCreateStepIndex}
          createWizardStepCount={createWizardStepCount}
          createWizardSteps={createWizardSteps}
          createStepMeta={createStepMeta}
          navigateCreateWizardToStep={navigateCreateWizardToStep}
          setActiveTab={setActiveTab}
        />

        <ProductTabs
          isCreateWizardMode={isCreateWizardMode}
          canReadPricing={canReadPricing}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tabConfig={tabConfig}
        />

        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <ProductMasterSection vm={vm} />
          <ProductWarehouseSection vm={vm} />
          <ProductPricingSection vm={vm} />
          <ProductSuppliersSection vm={vm} />
        </div>
      </div>
    </section>
  );
}
