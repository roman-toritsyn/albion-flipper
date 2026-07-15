"use client";

import type { CityFilter, QualityFilter } from "@/components/SecondaryFilters";
import type { SortTab } from "@/components/SortTabs";
import {
  DEFAULT_FILTER_PREFS,
  type FilterPrefs,
  readStoredFilterPrefs,
  writeStoredFilterPrefs,
} from "@/lib/filterPrefs";
import { useCallback, useEffect, useState } from "react";

export type UseFilterPrefsResult = FilterPrefs & {
  setThreshold: (v: number) => void;
  setTaxRate: (v: number) => void;
  setMaxAge: (v: number) => void;
  setCityFilter: (v: CityFilter) => void;
  setQualityFilter: (v: QualityFilter) => void;
  setSortTab: (v: SortTab) => void;
};

export function useFilterPrefs(): UseFilterPrefsResult {
  const [prefs, setPrefs] = useState<FilterPrefs>(DEFAULT_FILTER_PREFS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPrefs(readStoredFilterPrefs());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    writeStoredFilterPrefs(prefs);
  }, [prefs, ready]);

  const patch = useCallback((partial: Partial<FilterPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...partial }));
  }, []);

  const setThreshold = useCallback((threshold: number) => patch({ threshold }), [patch]);
  const setTaxRate = useCallback((taxRate: number) => patch({ taxRate }), [patch]);
  const setMaxAge = useCallback((maxAge: number) => patch({ maxAge }), [patch]);
  const setCityFilter = useCallback((cityFilter: CityFilter) => patch({ cityFilter }), [patch]);
  const setQualityFilter = useCallback(
    (qualityFilter: QualityFilter) => patch({ qualityFilter }),
    [patch],
  );
  const setSortTab = useCallback((sortTab: SortTab) => patch({ sortTab }), [patch]);

  return {
    ...prefs,
    setThreshold,
    setTaxRate,
    setMaxAge,
    setCityFilter,
    setQualityFilter,
    setSortTab,
  };
}
