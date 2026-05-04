import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildSeed } from "@/src/data/seed";
import { DBShape } from "@/src/types/models";

const DB_KEY = "coachflow:db:v2";

async function loadDB(): Promise<DBShape> {
  try {
    const raw = await AsyncStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DBShape;
      if (parsed?.meta?.seeded) return parsed;
    }
  } catch (e) {
    console.log("[db] load error", e);
  }
  const seed = buildSeed();
  try {
    await AsyncStorage.setItem(DB_KEY, JSON.stringify(seed));
  } catch (e) {
    console.log("[db] seed write error", e);
  }
  return seed;
}

export const [DataProvider, useData] = createContextHook(() => {
  const [db, setDB] = useState<DBShape | null>(null);

  useEffect(() => {
    loadDB().then(setDB);
  }, []);

  const persist = useCallback(async (next: DBShape) => {
    setDB(next);
    try {
      await AsyncStorage.setItem(DB_KEY, JSON.stringify(next));
    } catch (e) {
      console.log("[db] persist err", e);
    }
  }, []);

  const update = useCallback(
    (mutator: (d: DBShape) => DBShape) => {
      setDB((current) => {
        if (!current) return current;
        const next = mutator(current);
        AsyncStorage.setItem(DB_KEY, JSON.stringify(next)).catch((e) =>
          console.log("[db] persist err", e),
        );
        return next;
      });
    },
    [],
  );

  const reset = useCallback(async () => {
    await AsyncStorage.removeItem(DB_KEY);
    const seed = buildSeed();
    await persist(seed);
  }, [persist]);

  return useMemo(() => ({ db, update, reset, ready: !!db }), [db, update, reset]);
});
