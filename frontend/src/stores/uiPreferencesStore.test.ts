import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUiPreferencesStore } from "./uiPreferencesStore";

function mockSystemDarkMode(isDark: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" ? isDark : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("uiPreferencesStore", () => {
  beforeEach(() => {
    (useUiPreferencesStore as unknown as { persist?: { clearStorage?: () => void } }).persist?.clearStorage?.();
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";
    useUiPreferencesStore.setState({
      theme: "system",
      compact_mode: false,
      show_help: true,
    });
  });

  it("applies explicit dark theme", () => {
    useUiPreferencesStore.getState().setTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("falls back to system preference when theme is system", () => {
    mockSystemDarkMode(true);
    useUiPreferencesStore.getState().setPreferences({
      theme: "system",
      compact_mode: true,
      show_help: false,
    });

    const state = useUiPreferencesStore.getState();
    expect(state.theme).toBe("system");
    expect(state.compact_mode).toBe(true);
    expect(state.show_help).toBe(false);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
