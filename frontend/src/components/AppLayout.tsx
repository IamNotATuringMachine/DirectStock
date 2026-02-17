import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, matchPath } from "react-router-dom";
import {
  Menu,
  X,
  Moon,
  Sun,
  LogOut,
  User,
  ChevronRight,
  LayoutDashboard,
  Package,
  Factory,
  Combine,
  ClipboardList,
  ShoppingCart,
  Truck,
  RotateCcw,
  CheckSquare,
  FileText,
  History,
  BarChart3,
  Bell,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowRightLeft,
  Warehouse,
  ScanBarcode,
  Briefcase,
  FileSpreadsheet,
  Receipt,
  Users,
  Building2,
} from "lucide-react";

import OfflineSyncPanel from "./offline/OfflineSyncPanel";
import PwaStatus from "./pwa/PwaStatus";
import directServicesLogo from "../assets/directservices-logo-only-letter.png";
import { fetchMyUiPreferences, updateMyUiPreferences } from "../services/uiPreferencesApi";
import { useAuthStore } from "../stores/authStore";
import { useUiPreferencesStore } from "../stores/uiPreferencesStore";

type NavItem = {
  to: string;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  requiredPermissions?: string[];
};

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", shortLabel: "DB", icon: LayoutDashboard, requiredPermissions: ["page.dashboard.view"] },
  { to: "/products", label: "Artikelstamm", shortLabel: "AR", icon: Package, requiredPermissions: ["page.products.view"] },
  { to: "/warehouse", label: "Lagerstruktur", shortLabel: "LG", icon: Factory, requiredPermissions: ["page.warehouse.view"] },
  { to: "/inventory", label: "Bestandsübersicht", shortLabel: "BS", icon: Combine, requiredPermissions: ["page.inventory.view"] },
  { to: "/inventory-counts", label: "Inventur", shortLabel: "IV", icon: ClipboardList, requiredPermissions: ["page.inventory-counts.view"] },
  { to: "/purchasing", label: "Einkauf", shortLabel: "EK", icon: ShoppingCart, requiredPermissions: ["page.purchasing.view"] },
  { to: "/picking", label: "Kommissionierung", shortLabel: "PK", icon: CheckSquare, requiredPermissions: ["page.picking.view"] },
  { to: "/returns", label: "Retouren", shortLabel: "RT", icon: RotateCcw, requiredPermissions: ["page.returns.view"] },
  { to: "/approvals", label: "Genehmigungen", shortLabel: "GN", icon: CheckSquare, requiredPermissions: ["page.approvals.view"] },
  { to: "/documents", label: "Dokumente", shortLabel: "DM", icon: FileText, requiredPermissions: ["page.documents.view"] },
  { to: "/audit-trail", label: "Audit-Trail", shortLabel: "AT", icon: History, requiredPermissions: ["page.audit-trail.view"] },
  { to: "/reports", label: "Berichte", shortLabel: "RP", icon: BarChart3, requiredPermissions: ["page.reports.view"] },
  { to: "/alerts", label: "Warnungen", shortLabel: "AL", icon: Bell, requiredPermissions: ["page.alerts.view"] },
  { to: "/goods-receipt", label: "Wareneingang", shortLabel: "WE", icon: ArrowDownToLine, requiredPermissions: ["page.goods-receipt.view"] },
  { to: "/goods-issue", label: "Warenausgang", shortLabel: "WA", icon: ArrowUpFromLine, requiredPermissions: ["page.goods-issue.view"] },
  { to: "/stock-transfer", label: "Umlagerung", shortLabel: "UM", icon: ArrowRightLeft, requiredPermissions: ["page.stock-transfer.view"] },
  {
    to: "/inter-warehouse-transfer",
    label: "Zwischenlager",
    shortLabel: "IW",
    icon: Warehouse,
    requiredPermissions: ["page.inter-warehouse-transfer.view"],
  },
  { to: "/shipping", label: "Versand", shortLabel: "SH", icon: Truck, requiredPermissions: ["page.shipping.view"] },
  { to: "/customers", label: "Kunden", shortLabel: "KD", icon: Building2, requiredPermissions: ["page.customers.view"] },
  { to: "/scanner", label: "Scanner", shortLabel: "SC", icon: ScanBarcode, requiredPermissions: ["page.scanner.view"] },
  { to: "/services", label: "Dienstleistungen", shortLabel: "SV", icon: Briefcase, requiredPermissions: ["page.services.view"] },
  { to: "/sales-orders", label: "Verkaufsaufträge", shortLabel: "SO", icon: FileSpreadsheet, requiredPermissions: ["page.sales-orders.view"] },
  { to: "/invoices", label: "Rechnungen", shortLabel: "RE", icon: Receipt, requiredPermissions: ["page.invoices.view"] },
  { to: "/users", label: "Benutzerverwaltung", shortLabel: "BU", icon: Users, requiredPermissions: ["page.users.view"] },
];

const IDLE_LOGOUT_MS = 30 * 60 * 1000;

function canAccess(requiredPermissions: string[] | undefined, granted: Set<string>) {
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true;
  }
  return requiredPermissions.some((permission) => granted.has(permission));
}

function getPageTitle(pathname: string) {
  // Exact match first
  const exactMatch = navItems.find((item) => item.to === pathname);
  if (exactMatch) return exactMatch.label;

  // Sub-route matching logic
  // /products/:id -> Artikelstamm / Details
  // /products/new -> Artikelstamm / Neu
  if (pathname.startsWith("/products/")) {
    if (pathname.endsWith("/new")) return "Artikelstamm / Neu";
    if (pathname.endsWith("/edit")) return "Artikelstamm / Bearbeiten";
    return "Artikelstamm / Details";
  }

  // Generic fallback if partially matching a known root
  const rootMatch = navItems.find(item => pathname.startsWith(item.to) && item.to !== "/");
  if (rootMatch) {
    return `${rootMatch.label} / ...`
  }

  return "DirectStock";
}

export default function AppLayout() {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const logout = useAuthStore((state) => state.logout);
  const location = useLocation();

  const theme = useUiPreferencesStore((state) => state.theme);
  const compactMode = useUiPreferencesStore((state) => state.compact_mode);
  const showHelp = useUiPreferencesStore((state) => state.show_help);
  const setPreferences = useUiPreferencesStore((state) => state.setPreferences);
  const setTheme = useUiPreferencesStore((state) => state.setTheme);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 1100px)").matches : false
  );
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const hasLoadedUiPreferencesRef = useRef(false);

  const grantedPermissions = useMemo(() => new Set(user?.permissions ?? []), [user?.permissions]);

  useEffect(() => {
    if (!accessToken) {
      hasLoadedUiPreferencesRef.current = false;
      return;
    }
    if (hasLoadedUiPreferencesRef.current) {
      return;
    }
    hasLoadedUiPreferencesRef.current = true;
    void fetchMyUiPreferences()
      .then((payload) => setPreferences(payload))
      .catch(() => undefined);
  }, [accessToken, setPreferences]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1100px)");
    const onChange = (event: MediaQueryListEvent) => {
      setIsMobileLayout(event.matches);
    };

    mediaQuery.addEventListener("change", onChange);
    setIsMobileLayout(mediaQuery.matches);

    return () => {
      mediaQuery.removeEventListener("change", onChange);
    };
  }, []);

  useEffect(() => {
    if (!isMobileLayout) {
      setIsMobileNavOpen(false);
    }
  }, [isMobileLayout]);

  useEffect(() => {
    if (isMobileLayout) {
      setIsMobileNavOpen(false);
    }
  }, [isMobileLayout, location.pathname]);

  useEffect(() => {
    if (!(isMobileLayout && isMobileNavOpen)) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileNavOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isMobileLayout, isMobileNavOpen]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let timeoutId: number | null = null;
    const resetIdleTimer = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => {
        void logout();
      }, IDLE_LOGOUT_MS);
    };

    const activityEvents: Array<keyof WindowEventMap> = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetIdleTimer, { passive: true }));
    resetIdleTimer();

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, resetIdleTimer as EventListenerOrEventListenerObject)
      );
    };
  }, [accessToken, logout]);

  const onToggleNavigation = () => {
    if (isMobileLayout) {
      setIsMobileNavOpen((value) => !value);
      return;
    }

    setIsSidebarCollapsed((value) => !value);
  };

  const onToggleTheme = async () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    try {
      await updateMyUiPreferences({
        theme: nextTheme,
        compact_mode: compactMode,
        show_help: showHelp,
      });
    } catch {
      // local preference remains as fallback when backend call fails.
    }
  };

  const shellClassName = [
    "shell",
    !isMobileLayout && isSidebarCollapsed ? "sidebar-collapsed" : "",
    isMobileLayout ? "mobile-layout" : "",
    isMobileLayout && isMobileNavOpen ? "mobile-nav-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const currentTitle = useMemo(() => getPageTitle(location.pathname), [location.pathname]);

  return (
    <div className={shellClassName} data-testid="app-shell">
      {isMobileLayout ? (
        <button
          className="sidebar-overlay"
          onClick={() => setIsMobileNavOpen(false)}
          aria-label="Navigation schließen"
          type="button"
        />
      ) : null}
      <aside className="sidebar">
        <div className="brand">
          {isSidebarCollapsed ? (
            <img src={directServicesLogo} alt="DS" className="brand-logo-collapsed" />
          ) : (
            "DirectStock"
          )}
        </div>
        <nav>
          {navItems
            .filter((item) => canAccess(item.requiredPermissions, grantedPermissions))
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                aria-label={item.label}
                title={item.label}
                onClick={() => {
                  if (isMobileLayout) {
                    setIsMobileNavOpen(false);
                  }
                }}
              >
                <item.icon size={20} aria-hidden="true" className="nav-icon" />
                {!isSidebarCollapsed && <span className="nav-link-label">{item.label}</span>}
              </NavLink>
            ))}
        </nav>
        {isMobileLayout ? (
          <div className="sidebar-utilities" data-testid="sidebar-utilities">
            <button
              className="btn width-full justify-start"
              type="button"
              onClick={() => void onToggleTheme()}
              data-testid="theme-toggle-btn"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              Design: {theme}
            </button>
            <OfflineSyncPanel />
          </div>
        ) : null}
      </aside>
      <div className="content-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-btn sidebar-toggle"
              onClick={onToggleNavigation}
              data-testid="sidebar-toggle"
              title={
                isMobileLayout
                  ? isMobileNavOpen
                    ? "Navigation schließen"
                    : "Navigation öffnen"
                  : isSidebarCollapsed
                    ? "Sidebar erweitern"
                    : "Sidebar einklappen"
              }
              aria-label="Toggle Navigation"
            >
              {isMobileLayout ? (isMobileNavOpen ? <X size={20} /> : <Menu size={20} />) : <Menu size={20} />}
            </button>

            <div className="topbar-title text-lg font-semibold tracking-tight text-[var(--ink)]">
              {currentTitle}
            </div>
          </div>

          <div className="topbar-right flex items-center gap-3" data-testid="topbar-right">
            {!isMobileLayout ? (
              <button
                className="icon-btn w-9 h-9 rounded-full hover:bg-[var(--panel-soft)] transition-colors"
                type="button"
                onClick={() => void onToggleTheme()}
                data-testid="theme-toggle-btn"
                title={`Design umstellen (${theme === "dark" ? "Hell" : "Dunkel"})`}
              >
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            ) : null}

            <PwaStatus compact={isMobileLayout} />

            <div className="h-6 w-px bg-[var(--line)] mx-2"></div>

            <div className="topbar-user flex items-center gap-3 px-3 py-1.5 rounded-full bg-[var(--panel-soft)] hover:bg-[var(--line)]/30 transition-colors cursor-default border border-[var(--line)]/50" title={`Angemeldet als ${user?.username}`}>
              <div className="user-avatar w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shadow-sm">
                <User size={16} />
              </div>
              {!isMobileLayout && (
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-[var(--ink)] leading-none">{user?.username ?? "-"}</span>
                  <span className="text-xs text-[var(--muted)] leading-none mt-0.5 uppercase tracking-wide text-[10px]">
                    {user?.roles.includes("admin") ? "Administrator" : "Benutzer"}
                  </span>
                </div>
              )}
            </div>

            <button
              className="icon-btn danger-hover w-9 h-9 rounded-full hover:bg-red-50 text-[var(--muted)] hover:text-red-600 transition-colors ml-1"
              onClick={() => void logout()}
              data-testid="logout-btn"
              title="Abmelden"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
