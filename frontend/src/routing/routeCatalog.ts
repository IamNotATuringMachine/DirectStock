import { routeCatalogEntries } from "./routeEntries";

export type { AppRouteDefinition } from "./routeTypes";

export const routeCatalog = routeCatalogEntries;

export const navigableRoutes = routeCatalog.filter((route) => route.showInNav).sort((a, b) => a.priority - b.priority);
