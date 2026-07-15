"use client";

import {
  DEFAULT_REFINE_FILTER_PREFS,
  type RefineCityPreference,
  type RefineFamilyFilter,
  type RefineFilterPrefs,
  readStoredRefineFilterPrefs,
  writeStoredRefineFilterPrefs,
} from "@/lib/refineFilterPrefs";
import type { DailyProductionBonus, MarketSide } from "@/lib/refineFlips";
import { useCallback, useEffect, useState } from "react";

export type UseRefineFilterPrefsResult = RefineFilterPrefs & {
  setTaxRate: (v: number) => void;
  setMaxAge: (v: number) => void;
  setFamilyFilter: (v: RefineFamilyFilter) => void;
  setBuySide: (v: MarketSide) => void;
  setSellSide: (v: MarketSide) => void;
  setUseFocus: (v: boolean) => void;
  setDailyBonus: (v: DailyProductionBonus) => void;
  setRefineCity: (v: RefineCityPreference) => void;
};

export function useRefineFilterPrefs(): UseRefineFilterPrefsResult {
  const [prefs, setPrefs] = useState<RefineFilterPrefs>(DEFAULT_REFINE_FILTER_PREFS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPrefs(readStoredRefineFilterPrefs());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    writeStoredRefineFilterPrefs(prefs);
  }, [prefs, ready]);

  const patch = useCallback((partial: Partial<RefineFilterPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...partial }));
  }, []);

  const setTaxRate = useCallback((taxRate: number) => patch({ taxRate }), [patch]);
  const setMaxAge = useCallback((maxAge: number) => patch({ maxAge }), [patch]);
  const setFamilyFilter = useCallback(
    (familyFilter: RefineFamilyFilter) => patch({ familyFilter }),
    [patch],
  );
  const setBuySide = useCallback((buySide: MarketSide) => patch({ buySide }), [patch]);
  const setSellSide = useCallback((sellSide: MarketSide) => patch({ sellSide }), [patch]);
  const setUseFocus = useCallback((useFocus: boolean) => patch({ useFocus }), [patch]);
  const setDailyBonus = useCallback(
    (dailyBonus: DailyProductionBonus) => patch({ dailyBonus }),
    [patch],
  );
  const setRefineCity = useCallback(
    (refineCity: RefineCityPreference) => patch({ refineCity }),
    [patch],
  );

  return {
    ...prefs,
    setTaxRate,
    setMaxAge,
    setFamilyFilter,
    setBuySide,
    setSellSide,
    setUseFocus,
    setDailyBonus,
    setRefineCity,
  };
}
