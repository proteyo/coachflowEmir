import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useData } from "@/src/context/DataContext";
import { GoalType, Role, User } from "@/src/types/models";

const TOKEN_KEY = "coachflow:token";
const USER_KEY = "coachflow:user";

function genClientCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `CFL-${s}`;
}

function makeToken(userId: string): string {
  // Mock JWT-ish token (header.payload.signature) for local auth.
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(
    JSON.stringify({ sub: userId, iat: Math.floor(Date.now() / 1000) }),
  );
  return `${header}.${payload}.local`;
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const { db, update, ready } = useData();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      try {
        const [t, u] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (t) setToken(t);
        if (u) setUser(JSON.parse(u) as User);
      } catch (e) {
        console.log("[auth] hydrate err", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persistAuth = useCallback(async (u: User, t: string) => {
    setUser(u);
    setToken(t);
    await AsyncStorage.setItem(TOKEN_KEY, t);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(u));
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
      if (!db) return { ok: false, error: "Database not ready" };
      const found = db.users.find(
        (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
      );
      if (!found) return { ok: false, error: "Account not found" };
      if (found.password !== password) return { ok: false, error: "Wrong password" };
      const t = makeToken(found.id);
      await persistAuth(found, t);
      return { ok: true };
    },
    [db, persistAuth],
  );

  const register = useCallback(
    async (input: {
      name: string;
      email: string;
      password: string;
      role: Role;
      age?: number;
      goalType?: GoalType;
      goal?: string;
    }): Promise<{ ok: boolean; error?: string }> => {
      if (!db) return { ok: false, error: "Database not ready" };
      const exists = db.users.find(
        (u) => u.email.toLowerCase() === input.email.trim().toLowerCase(),
      );
      if (exists) return { ok: false, error: "Email already registered" };
      const id = `u_${Date.now()}`;
      const isClient = input.role === "client";
      const newUser: User = {
        id,
        email: input.email.trim().toLowerCase(),
        password: input.password,
        name: input.name.trim(),
        role: input.role,
        clientCode: isClient ? genClientCode() : undefined,
        createdAt: new Date().toISOString(),
      };
      update((d) => ({
        ...d,
        users: [...d.users, newUser],
        notifications: [
          ...d.notifications,
          {
            userId: id,
            workoutReminders: true,
            supplementReminders: true,
            messageNotifications: true,
            weeklyGoalReminders: true,
          },
        ],
        ...(input.role === "coach"
          ? {
              coachProfiles: [
                ...d.coachProfiles,
                {
                  userId: id,
                  specialty: "Personal Training",
                  bio: "",
                  experienceYears: 0,
                  achievements: [],
                  certificates: [],
                  rating: 5,
                },
              ],
              subscriptions: [
                ...d.subscriptions,
                {
                  id: `sub_${id}`,
                  coachId: id,
                  planName: "CoachFlow Monthly",
                  price: 2490,
                  currency: "KZT",
                  status: "inactive",
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : {
              clientProfiles: [
                ...d.clientProfiles,
                {
                  userId: id,
                  coachId: "",
                  goal: input.goal ?? "",
                  goalType: input.goalType,
                  startWeight: 0,
                  currentWeight: 0,
                  height: 0,
                  age: input.age,
                  fitnessLevel: "beginner" as const,
                  createdAt: new Date().toISOString(),
                },
              ],
              streaks: [
                ...d.streaks,
                { clientId: id, currentStreak: 0, bestStreak: 0 },
              ],
            }),
      }));
      const t = makeToken(id);
      await persistAuth(newUser, t);
      return { ok: true };
    },
    [db, update, persistAuth],
  );

  const logout = useCallback(async () => {
    setUser(null);
    setToken(null);
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
  }, []);

  const updateMe = useCallback(
    (patch: Partial<User>) => {
      if (!user) return;
      const next: User = { ...user, ...patch };
      setUser(next);
      AsyncStorage.setItem(USER_KEY, JSON.stringify(next));
      update((d) => ({
        ...d,
        users: d.users.map((u) => (u.id === user.id ? { ...u, ...patch } : u)),
      }));
    },
    [user, update],
  );

  return useMemo(
    () => ({ user, token, loading: loading || !ready, login, register, logout, updateMe }),
    [user, token, loading, ready, login, register, logout, updateMe],
  );
});
