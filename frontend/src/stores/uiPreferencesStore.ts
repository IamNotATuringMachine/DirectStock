import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { ThemePreference } from "../types";

type UiPreferencesState = ThemePreference & {
  setPreferences: (payload: ThemePreference) => void;
  setTheme: (theme: ThemePreference["theme"]) => void;
};

function applyTheme(theme: ThemePreference["theme"]) {
  if (typeof document === "undefined") {
    return;
  }

  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.style.colorScheme = resolved;
}

export const useUiPreferencesStore = create<UiPreferencesState>()(
  persist(
    (set) => ({
      theme: "system",
      compact_mode: false,
      show_help: true,
      setPreferences: (payload) => {
        applyTheme(payload.theme);
        set(payload);
      },
      setTheme: (theme) => {
        applyTheme(theme);
        set((state) => ({ ...state, theme }));
      },
    }),
    {
      name: "directstock-ui-preferences",
      partialize: (state) => ({
        theme: state.theme,
        compact_mode: state.compact_mode,
        show_help: state.show_help,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.theme);
        }
      },
    }
  )
);
