"use client";

import {
  DEFAULT_UPGRADE_FILTER_PREFS,
  type UpgradeFamilyFilter,
  type UpgradeFilterPrefs,
  type UpgradeQualityFilter,
  readStoredUpgradeFilterPrefs,
  writeStoredUpgradeFilterPrefs,
} from "@/lib/upgradeFilterPrefs";
import type { UpgradeBuyCityPref, UpgradePathFilter } from "@/lib/upgradeFlips";
import { useCallback, useEffect, useState } from "react";

export type UseUpgradeFilterPrefsResult = UpgradeFilterPrefs & {
  setThreshold: (v: number) => void;
  setTaxRate: (v: number) => void;
  setMaxAge: (v: number) => void;
  setQualityFilter: (v: UpgradeQualityFilter) => void;
  setFamilyFilter: (v: UpgradeFamilyFilter) => void;
  setPathFilter: (v: UpgradePathFilter) => void;
  setBuyCity: (v: UpgradeBuyCityPref) => void;
};

export function useUpgradeFilterPrefs(): UseUpgradeFilterPrefsResult {
  const [prefs, setPrefs] = useState<UpgradeFilterPrefs>(
    DEFAULT_UPGRADE_FILTER_PREFS,
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPrefs(readStoredUpgradeFilterPrefs());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    writeStoredUpgradeFilterPrefs(prefs);
  }, [prefs, ready]);

  const patch = useCallback((partial: Partial<UpgradeFilterPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...partial }));
  }, []);

  return {
    ...prefs,
    setThreshold: useCallback((threshold: number) => patch({ threshold }), [patch]),
    setTaxRate: useCallback((taxRate: number) => patch({ taxRate }), [patch]),
    setMaxAge: useCallback((maxAge: number) => patch({ maxAge }), [patch]),
    setQualityFilter: useCallback(
      (qualityFilter: UpgradeQualityFilter) => patch({ qualityFilter }),
      [patch],
    ),
    setFamilyFilter: useCallback(
      (familyFilter: UpgradeFamilyFilter) => patch({ familyFilter }),
      [patch],
    ),
    setPathFilter: useCallback(
      (pathFilter: UpgradePathFilter) => patch({ pathFilter }),
      [patch],
    ),
    setBuyCity: useCallback(
      (buyCity: UpgradeBuyCityPref) => patch({ buyCity }),
      [patch],
    ),
  };
}
