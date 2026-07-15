"use client";

import {
  DEFAULT_LOCALE,
  MESSAGES,
  STORAGE_KEY,
  isAppLocale,
  itemLangFor,
  localeOption,
} from "@/lib/i18n/locales";
import type { AppLocale, MessageKey } from "@/lib/i18n/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Vars = Record<string, string | number>;

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (key: MessageKey, vars?: Vars) => string;
  itemLang: ReturnType<typeof itemLangFor>;
  htmlLang: string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function formatMessage(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] !== undefined ? String(vars[key]) : `{${key}}`,
  );
}

function readStoredLocale(): AppLocale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && isAppLocale(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLocaleState(readStoredLocale());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const opt = localeOption(locale);
    document.documentElement.lang = opt.htmlLang;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* ignore */
    }
  }, [locale, ready]);

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: Vars) => {
      const table = MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
      return formatMessage(table[key] ?? MESSAGES.en[key] ?? key, vars);
    },
    [locale],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      itemLang: itemLangFor(locale),
      htmlLang: localeOption(locale).htmlLang,
    }),
    [locale, setLocale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
