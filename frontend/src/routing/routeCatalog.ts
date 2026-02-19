import { routeCatalogEntries } from "./routeEntries";

export const routeCatalog = routeCatalogEntries;

export const navigableRoutes = routeCatalog.filter((route) => route.showInNav).sort((a, b) => a.priority - b.priority);
