"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import en from "@/locales/en.json";
import zh from "@/locales/zh.json";

export type Lang = "zh" | "en";

const DICTS: Record<Lang, Record<string, string>> = { zh, en };
const KEY = "red-anchor-lang";

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue>({
  lang: "zh",
  setLang: () => undefined,
  t: (key) => key,
});

function fill(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ""));
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("zh");

  const apply = useCallback((next: Lang) => {
    setLangState(next);
    document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
  }, []);

  const setLang = useCallback((next: Lang) => {
    window.localStorage.setItem(KEY, next);
    apply(next);
  }, [apply]);

  useEffect(() => {
    const stored = window.localStorage.getItem(KEY);
    if (stored === "en" || stored === "zh") apply(stored);
  }, [apply]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => fill(DICTS[lang][key] || DICTS.zh[key] || key, vars),
    [lang],
  );

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex border border-slate-600 text-xs" aria-label="EN / CN">
      <button type="button" onClick={() => setLang("en")} className={`min-h-8 px-2 ${lang === "en" ? "bg-anchor text-white" : "text-slate-300"}`}>
        EN
      </button>
      <button type="button" onClick={() => setLang("zh")} className={`min-h-8 px-2 ${lang === "zh" ? "bg-anchor text-white" : "text-slate-300"}`}>
        CN
      </button>
    </div>
  );
}
