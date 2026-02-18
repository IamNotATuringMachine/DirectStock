import type { Permission } from "../types";

export type PermissionPresentation = {
  title: string;
  subtitle: string;
  category: string;
  searchText: string;
};

const PAGE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  products: "Artikelstamm",
  warehouse: "Lagerstruktur",
  inventory: "Bestand",
  "inventory-counts": "Inventur",
  purchasing: "Einkauf",
  picking: "Picking",
  returns: "Retouren",
  approvals: "Genehmigungen",
  documents: "Dokumente",
  "audit-trail": "Audit Trail",
  reports: "Berichte",
  alerts: "Warnungen",
  "goods-receipt": "Wareneingang",
  "goods-issue": "Warenausgang",
  "stock-transfer": "Umlagerung",
  "inter-warehouse-transfer": "Inter-Warehouse Transfer",
  shipping: "Versand",
  customers: "Kunden",
  scanner: "Scanner",
  users: "Benutzerverwaltung",
  "sales-orders": "Verkaufsauftraege",
  invoices: "Rechnungen",
};

const MODULE_LABELS: Record<string, string> = {
  roles: "Rollen",
  permissions: "Berechtigungen",
  pages: "Seitenkatalog",
  ui_preferences: "Persoenliche Anzeigeeinstellungen",
  dashboard_config: "Dashboard-Konfiguration",
  pricing: "Preise",
  sales_orders: "Verkaufsauftraege",
  invoices: "Rechnungen",
  products: "Artikel",
  goods_receipts: "Wareneingang",
};

const ACTION_LABELS: Record<string, string> = {
  read: "Ansehen",
  write: "Bearbeiten",
  manage: "Verwalten",
  export: "Exportieren",
  manage_self: "Eigene Einstellungen anpassen",
  manage_role: "Rollen-Einstellungen anpassen",
  quick_create: "Schnell anlegen",
  view: "Ansehen",
};

const ACTION_HELP: Record<string, string> = {
  read: "Kann Daten in diesem Bereich lesen.",
  write: "Kann Daten anlegen, aendern oder abschliessen.",
  manage: "Kann Einstellungen und Zuweisungen verwalten.",
  export: "Kann Daten exportieren.",
  manage_self: "Kann nur eigene Einstellungen anpassen.",
  manage_role: "Kann Einstellungen fuer Rollen festlegen.",
  quick_create: "Kann direkt im Prozess neue Stammdaten anlegen.",
  view: "Kann Inhalte sehen.",
};

function humanizeIdentifier(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function pageLabel(slug: string): string {
  return PAGE_LABELS[slug] ?? humanizeIdentifier(slug);
}

function moduleLabel(key: string): string {
  return MODULE_LABELS[key] ?? humanizeIdentifier(key);
}

export function presentPermission(permission: Permission): PermissionPresentation {
  const pageMatch = permission.code.match(/^page\.([a-z0-9-]+)\.([a-z0-9_]+)$/);
  if (pageMatch) {
    const slug = pageMatch[1];
    const action = pageMatch[2];
    const pageName = pageLabel(slug);
    const actionName = ACTION_LABELS[action] ?? humanizeIdentifier(action);
    const title = `${pageName}: ${actionName}`;
    const subtitle =
      action === "view"
        ? `Kann die Seite "${pageName}" oeffnen und benutzen.`
        : `Kann auf der Seite "${pageName}" die Aktion "${actionName}" ausfuehren.`;
    return {
      title,
      subtitle,
      category: "Seitenzugriff",
      searchText: `${title} ${subtitle} ${permission.code} ${(permission.description ?? "")}`.toLowerCase(),
    };
  }

  const moduleMatch = permission.code.match(/^module\.([a-z0-9_]+)\.([a-z0-9_]+)$/);
  if (moduleMatch) {
    const moduleKey = moduleMatch[1];
    const action = moduleMatch[2];
    const moduleName = moduleLabel(moduleKey);
    const actionName = ACTION_LABELS[action] ?? humanizeIdentifier(action);
    const helpText = ACTION_HELP[action] ?? "Kann in diesem Bereich arbeiten.";
    const title = `${moduleName}: ${actionName}`;
    const subtitle = `${helpText} Bereich: ${moduleName}.`;
    return {
      title,
      subtitle,
      category: moduleName,
      searchText: `${title} ${subtitle} ${permission.code} ${(permission.description ?? "")}`.toLowerCase(),
    };
  }

  const fallbackTitle = permission.description ? humanizeIdentifier(permission.description) : permission.code;
  return {
    title: fallbackTitle,
    subtitle: "Technische Berechtigung.",
    category: "Sonstiges",
    searchText: `${fallbackTitle} ${permission.code} ${(permission.description ?? "")}`.toLowerCase(),
  };
}
