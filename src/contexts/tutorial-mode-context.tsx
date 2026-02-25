"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "revizo-tutorial-mode";

interface TutorialModeContextValue {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  toggle: () => void;
}

const TutorialModeContext = createContext<TutorialModeContextValue | null>(null);

export function useTutorialMode(): TutorialModeContextValue {
  const ctx = useContext(TutorialModeContext);
  if (!ctx) {
    throw new Error("useTutorialMode must be used within TutorialModeProvider");
  }
  return ctx;
}

export function TutorialModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setEnabledState(stored === "true");
    } catch {
      // ignore
    }
  }, []);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabledState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const value: TutorialModeContextValue = {
    enabled,
    setEnabled,
    toggle,
  };

  return (
    <TutorialModeContext.Provider value={value}>
      {children}
    </TutorialModeContext.Provider>
  );
}
