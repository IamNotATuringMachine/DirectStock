import type { ComponentType } from "react";

export type AppRouteDefinition = {
  path: string;
  pageSlug: string;
  requiredPermission: string;
  navLabel: string;
  shortLabel: string;
  icon: ComponentType;
  showInNav: boolean;
  priority: number;
  component: ComponentType;
  title?: string;
};
