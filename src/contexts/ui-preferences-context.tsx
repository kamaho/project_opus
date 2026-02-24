"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  type UiPreferences,
  type NumberFormatPreference,
  type DateFormatPreference,
  DEFAULT_UI_PREFERENCES,
  loadUiPreferences,
  saveUiPreferences,
  formatNumber as fmtNumber,
  formatAbsNumber as fmtAbsNumber,
  formatDate as fmtDate,
  formatDateTime as fmtDateTime,
} from "@/lib/ui-preferences";

interface UiPreferencesContextValue {
  preferences: UiPreferences;
  setPreferences: (next: UiPreferences | ((prev: UiPreferences) => UiPreferences)) => void;
  updateTablePreferences: (patch: Partial<UiPreferences["table"]>) => void;
  updateTypographyPreferences: (patch: Partial<UiPreferences["typography"]>) => void;
  updateFormattingPreferences: (patch: Partial<UiPreferences["formatting"]>) => void;
}

const UiPreferencesContext = createContext<UiPreferencesContextValue | null>(
  null
);

export function useUiPreferences(): UiPreferencesContextValue {
  const ctx = useContext(UiPreferencesContext);
  if (!ctx) {
    throw new Error(
      "useUiPreferences must be used within UiPreferencesProvider"
    );
  }
  return ctx;
}

/** Class names for table, thead, and tr based on preferences. Use on all data tables for consistent appearance. */
export interface TableAppearance {
  tableClass: string;
  theadClass: string;
  rowBorderClass: string;
  rowAlternateClass: string;
}

const TABLE_APPEARANCE_DIVIDERS: TableAppearance = {
  tableClass:
    "[&_th]:border-r [&_td]:border-r [&_th]:border-border/80 [&_td]:border-border/80 [&_th:last-child]:border-r-0 [&_td:last-child]:border-r-0",
  theadClass: "border-b border-border",
  rowBorderClass: "border-t border-border",
  rowAlternateClass: "bg-muted/45",
};

const TABLE_APPEARANCE_MINIMAL: TableAppearance = {
  tableClass: "",
  theadClass: "",
  rowBorderClass: "",
  rowAlternateClass: "",
};

export function useTableAppearance(): TableAppearance {
  const { preferences } = useUiPreferences();
  return useMemo(
    () =>
      preferences.table.visibleDividers
        ? TABLE_APPEARANCE_DIVIDERS
        : TABLE_APPEARANCE_MINIMAL,
    [preferences.table.visibleDividers]
  );
}

export interface FormattingHelpers {
  /** Format number with 2 decimals per user preference (e.g. 1 234,56) */
  fmtNum: (n: number) => string;
  /** Format |n| with 2 decimals per user preference */
  fmtAbs: (n: number) => string;
  /** Format a date string (yyyy-MM-dd) per user preference */
  fmtDate: (value: string | Date) => string;
  /** Format a datetime string per user preference */
  fmtDateTime: (value: string | Date) => string;
  numberPref: NumberFormatPreference;
  datePref: DateFormatPreference;
}

export function useFormatting(): FormattingHelpers {
  const { preferences } = useUiPreferences();
  const { numberFormat, dateFormat } = preferences.formatting;
  return useMemo<FormattingHelpers>(
    () => ({
      fmtNum: (n) => fmtNumber(n, numberFormat),
      fmtAbs: (n) => fmtAbsNumber(n, numberFormat),
      fmtDate: (v) => fmtDate(v, dateFormat),
      fmtDateTime: (v) => fmtDateTime(v, dateFormat),
      numberPref: numberFormat,
      datePref: dateFormat,
    }),
    [numberFormat, dateFormat]
  );
}

interface UiPreferencesProviderProps {
  children: ReactNode;
}

export function UiPreferencesProvider({ children }: UiPreferencesProviderProps) {
  const [preferences, setPreferencesState] = useState<UiPreferences>(
    () => DEFAULT_UI_PREFERENCES
  );

  useEffect(() => {
    setPreferencesState(loadUiPreferences());
  }, []);

  const setPreferences = useCallback((next: UiPreferences | ((prev: UiPreferences) => UiPreferences)) => {
    setPreferencesState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      saveUiPreferences(resolved);
      return resolved;
    });
  }, []);

  const updateTablePreferences = useCallback(
    (patch: Partial<UiPreferences["table"]>) => {
      setPreferences((prev) => ({
        ...prev,
        table: { ...prev.table, ...patch },
      }));
    },
    [setPreferences]
  );

  const updateTypographyPreferences = useCallback(
    (patch: Partial<UiPreferences["typography"]>) => {
      setPreferences((prev) => ({
        ...prev,
        typography: { ...prev.typography, ...patch },
      }));
    },
    [setPreferences]
  );

  const updateFormattingPreferences = useCallback(
    (patch: Partial<UiPreferences["formatting"]>) => {
      setPreferences((prev) => ({
        ...prev,
        formatting: { ...prev.formatting, ...patch },
      }));
    },
    [setPreferences]
  );

  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute("data-text-size", preferences.typography.textSize);
    el.setAttribute("data-text-weight", preferences.typography.textWeight);
    return () => {
      el.removeAttribute("data-text-size");
      el.removeAttribute("data-text-weight");
    };
  }, [preferences.typography.textSize, preferences.typography.textWeight]);

  const value = useMemo<UiPreferencesContextValue>(
    () => ({
      preferences,
      setPreferences,
      updateTablePreferences,
      updateTypographyPreferences,
      updateFormattingPreferences,
    }),
    [preferences, setPreferences, updateTablePreferences, updateTypographyPreferences, updateFormattingPreferences]
  );

  return (
    <UiPreferencesContext.Provider value={value}>
      {children}
    </UiPreferencesContext.Provider>
  );
}
