import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, matchPath } from "react-router-dom";
import { ChevronRight, LogOut, Menu, Moon, Sun, User, X } from "lucide-react";

import OfflineSyncPanel from "./offline/OfflineSyncPanel";
import PwaStatus from "./pwa/PwaStatus";
import directServicesLogo from "../assets/directservices-logo-only-letter.png";
import { routeCatalog, navigableRoutes } from "../routing/routeCatalog";
import { fetchMyUiPreferences, updateMyUiPreferences } from "../services/uiPreferencesApi";
import { useAuthStore } from "../stores/authStore";
import { useUiPreferencesStore } from "../stores/uiPreferencesStore";

type NavItem = {
  to: string;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  requiredPermission: string;
};

const navItems: NavItem[] = navigableRoutes.map((route) => ({
  to: route.path,
  label: route.navLabel,
  shortLabel: route.shortLabel,
  icon: route.icon,
  requiredPermission: route.requiredPermission,
}));

const IDLE_LOGOUT_MS = 30 * 60 * 1000;

function canAccess(requiredPermission: string, granted: Set<string>) {
  return granted.has(requiredPermission);
}

function getPageTitle(pathname: string) {
  const exactMatch = routeCatalog.find((route) => route.path === pathname);
  if (exactMatch) {
    return exactMatch.title ?? exactMatch.navLabel;
  }

  for (const route of routeCatalog) {
    const matched = matchPath({ path: route.path, end: true }, pathname);
    if (matched) {
      return route.title ?? route.navLabel;
    }
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
            .filter((item) => canAccess(item.requiredPermission, grantedPermissions))
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
              {isMobileLayout ? isMobileNavOpen ? <X size={20} /> : <Menu size={20} /> : <Menu size={20} />}
            </button>

            <div className="topbar-title text-lg font-semibold tracking-tight text-[var(--ink)]">{currentTitle}</div>
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

            <div
              className="topbar-user flex items-center gap-3 px-3 py-1.5 rounded-full bg-[var(--panel-soft)] hover:bg-[var(--line)]/30 transition-colors cursor-default border border-[var(--line)]/50"
              title={`Angemeldet als ${user?.username}`}
            >
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
