import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LangCode, TRANSLATIONS, TranslationDict } from "@/src/i18n/translations";

const KEY = "coachflow:lang";

type Leaf<T> = T extends string ? string : { [K in keyof T]: Leaf<T[K]> };
type DotPath<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : DotPath<T[K], `${P}${K}.`>;
}[keyof T & string];

export type TKey = DotPath<TranslationDict>;

function get(obj: any, path: string): string {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in cur) cur = cur[p];
    else return path;
  }
  return typeof cur === "string" ? cur : path;
}

export const [I18nProvider, useI18n] = createContextHook(() => {
  const [lang, setLang] = useState<LangCode>("en");
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const v = (await AsyncStorage.getItem(KEY)) as LangCode | null;
        if (v === "en" || v === "ru" || v === "kk") setLang(v);
      } catch (e) {
        console.log("[i18n] hydrate err", e);
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  const setLanguage = useCallback(async (code: LangCode) => {
    setLang(code);
    try {
      await AsyncStorage.setItem(KEY, code);
    } catch (e) {
      console.log("[i18n] persist err", e);
    }
  }, []);

  const dict = TRANSLATIONS[lang];

  const t = useCallback(
    (key: TKey, params?: Record<string, string | number>) => {
      let s = get(dict as unknown as Leaf<TranslationDict>, key);
      if (params) {
        for (const k in params) {
          s = s.replace(`{${k}}`, String(params[k]));
        }
      }
      return s;
    },
    [dict],
  );

  return useMemo(
    () => ({ lang, setLanguage, t, hydrated }),
    [lang, setLanguage, t, hydrated],
  );
});
