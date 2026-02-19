import { ReturnsItemsPanel, type ReturnsItemsPanelProps } from "./components/ReturnsItemsPanel";
import { ReturnsOrdersPanel, type ReturnsOrdersPanelProps } from "./components/ReturnsOrdersPanel";
import { ReturnsWorkflowPanel, type ReturnsWorkflowPanelProps } from "./components/ReturnsWorkflowPanel";

type ReturnsViewProps = {
  ordersPanelProps: ReturnsOrdersPanelProps;
  itemsPanelProps: ReturnsItemsPanelProps;
  workflowPanelProps: ReturnsWorkflowPanelProps;
};

export function ReturnsView({ ordersPanelProps, itemsPanelProps, workflowPanelProps }: ReturnsViewProps) {
  return (
    <section className="page flex flex-col gap-6" data-testid="returns-page">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="page-title">Retourenmanagement</h2>
          <p className="section-subtitle mt-1 max-w-2xl">
            Erfassen und verwalten Sie Kundenretouren, steuern Sie den Prüfprozess und legen Sie die weitere Verwendung
            fest.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <ReturnsOrdersPanel {...ordersPanelProps} />
        <ReturnsItemsPanel {...itemsPanelProps} />
        <ReturnsWorkflowPanel {...workflowPanelProps} />
      </div>
    </section>
  );
}
