"use client";

import type { QualityFilter } from "@/components/SecondaryFilters";
import type { CraftBuyMode } from "@/lib/craftFlips";
import {
  DEFAULT_CRAFT_FILTER_PREFS,
  type CraftFamilyFilter,
  type CraftFilterPrefs,
  readStoredCraftFilterPrefs,
  writeStoredCraftFilterPrefs,
} from "@/lib/craftFilterPrefs";
import { useCallback, useEffect, useState } from "react";

export type UseCraftFilterPrefsResult = CraftFilterPrefs & {
  setThreshold: (v: number) => void;
  setTaxRate: (v: number) => void;
  setMaxAge: (v: number) => void;
  setQualityFilter: (v: QualityFilter) => void;
  setFamilyFilter: (v: CraftFamilyFilter) => void;
  setBuyMode: (v: CraftBuyMode) => void;
};

export function useCraftFilterPrefs(): UseCraftFilterPrefsResult {
  const [prefs, setPrefs] = useState<CraftFilterPrefs>(DEFAULT_CRAFT_FILTER_PREFS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPrefs(readStoredCraftFilterPrefs());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    writeStoredCraftFilterPrefs(prefs);
  }, [prefs, ready]);

  const patch = useCallback((partial: Partial<CraftFilterPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...partial }));
  }, []);

  const setThreshold = useCallback((threshold: number) => patch({ threshold }), [patch]);
  const setTaxRate = useCallback((taxRate: number) => patch({ taxRate }), [patch]);
  const setMaxAge = useCallback((maxAge: number) => patch({ maxAge }), [patch]);
  const setQualityFilter = useCallback(
    (qualityFilter: QualityFilter) => patch({ qualityFilter }),
    [patch],
  );
  const setFamilyFilter = useCallback(
    (familyFilter: CraftFamilyFilter) => patch({ familyFilter }),
    [patch],
  );
  const setBuyMode = useCallback((buyMode: CraftBuyMode) => patch({ buyMode }), [patch]);

  return {
    ...prefs,
    setThreshold,
    setTaxRate,
    setMaxAge,
    setQualityFilter,
    setFamilyFilter,
    setBuyMode,
  };
}
