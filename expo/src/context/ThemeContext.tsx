import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { AppTheme, buildTheme, ThemeMode } from "@/src/theme/theme";

const KEY = "coachflow:theme";

export const [ThemeProvider, useTheme] = createContextHook(() => {
  const system = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(system === "light" ? "light" : "dark");
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(KEY);
        if (v === "light" || v === "dark") setMode(v);
      } catch (e) {
        console.log("[theme] hydrate error", e);
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  const persist = useCallback(async (m: ThemeMode) => {
    setMode(m);
    try {
      await AsyncStorage.setItem(KEY, m);
    } catch (e) {
      console.log("[theme] persist error", e);
    }
  }, []);

  const toggle = useCallback(() => {
    persist(mode === "dark" ? "light" : "dark");
  }, [mode, persist]);

  const theme: AppTheme = buildTheme(mode);
  return { theme, mode, setMode: persist, toggle, hydrated };
});
