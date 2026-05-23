import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPatch, apiPost } from "@/src/services/api";
import { FitnessLevel, GoalType, Role, User } from "@/src/types/models";

const TOKEN_KEY = "coachflow:token";
const REFRESH_TOKEN_KEY = "coachflow:refresh_token";
const USER_KEY = "coachflow:user";

type RegisterInput = {
  name: string;
  email: string;
  password: string;
  role: Role;

  age?: number;
  goalType?: GoalType;
  goal?: string;

  height?: number;
  startWeight?: number;
  currentWeight?: number;
  fitnessLevel?: FitnessLevel;
};

type AuthResult = {
  ok: boolean;
  error?: string;
};

function normalizeUser(apiUser: any): User {
  return {
    id: String(apiUser.id),
    email: apiUser.email,
    name: apiUser.name,
    role: apiUser.role,
    phone: apiUser.phone ?? undefined,
    avatarUrl: apiUser.avatarUrl ?? apiUser.avatar_url ?? undefined,
    clientCode: apiUser.clientCode ?? apiUser.client_code ?? undefined,
    createdAt:
      apiUser.createdAt ?? apiUser.created_at ?? new Date().toISOString(),
  };
}

function extractErrorMessage(error: any, fallback: string): string {
  const detail = error?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];

    if (typeof first?.msg === "string") {
      return first.msg;
    }
  }

  if (typeof error?.message === "string") {
    return error.message;
  }

  return fallback;
}

function getNormalizedGoalForStorage(input: RegisterInput) {
  if (input.role !== "client") {
    return {
      goalType: undefined,
      goal: undefined,
    };
  }

  const goalType = input.goalType ?? "custom";

  return {
    goalType,
    goal: goalType === "custom" ? input.goal?.trim() || "" : goalType,
  };
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const persistAuth = useCallback(
    async (nextUser: User, accessToken: string, refresh?: string | null) => {
      setUser(nextUser);
      setToken(accessToken);
      setRefreshToken(refresh ?? null);

      await AsyncStorage.setItem(TOKEN_KEY, accessToken);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(nextUser));

      if (refresh) {
        await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refresh);
      } else {
        await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
      }
    },
    [],
  );

  const clearAuth = useCallback(async () => {
    setUser(null);
    setToken(null);
    setRefreshToken(null);

    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
  }, []);

  const refreshSession = useCallback(
    async (savedRefreshToken: string): Promise<boolean> => {
      try {
        const res = await apiPost("/auth/refresh", {
          refresh_token: savedRefreshToken,
        });

        const accessToken = res.token ?? res.access_token;
        const nextRefresh = res.refresh_token ?? res.refreshToken ?? null;
        const normalizedUser = normalizeUser(res.user);

        if (!accessToken) {
          await clearAuth();
          return false;
        }

        await persistAuth(normalizedUser, accessToken, nextRefresh);

        return true;
      } catch (error) {
        console.log("[auth] refresh session failed", error);
        await clearAuth();
        return false;
      }
    },
    [clearAuth, persistAuth],
  );

  useEffect(() => {
    (async () => {
      try {
        const [savedToken, savedRefresh] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(REFRESH_TOKEN_KEY),
        ]);

        if (!savedToken && !savedRefresh) {
          await clearAuth();
          return;
        }

        if (savedToken) {
          try {
            const me = await apiGet("/auth/me", { token: savedToken });
            const normalizedUser = normalizeUser(me);

            setToken(savedToken);
            setRefreshToken(savedRefresh);
            setUser(normalizedUser);

            await AsyncStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
            return;
          } catch (error) {
            console.log("[auth] saved access token invalid", error);
          }
        }

        if (savedRefresh) {
          await refreshSession(savedRefresh);
          return;
        }

        await clearAuth();
      } catch (error) {
        console.log("[auth] hydrate error", error);
        await clearAuth();
      } finally {
        setLoading(false);
      }
    })();
  }, [clearAuth, refreshSession]);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      try {
        const res = await apiPost("/auth/login", {
          email: email.trim().toLowerCase(),
          password,
        });

        const accessToken = res.token ?? res.access_token;
        const refresh = res.refresh_token ?? res.refreshToken ?? null;
        const normalizedUser = normalizeUser(res.user);

        if (!accessToken) {
          return {
            ok: false,
            error: "Login failed",
          };
        }

        await persistAuth(normalizedUser, accessToken, refresh);

        return { ok: true };
      } catch (error: any) {
        return {
          ok: false,
          error: extractErrorMessage(error, "Login failed"),
        };
      }
    },
    [persistAuth],
  );

  const register = useCallback(
    async (input: RegisterInput): Promise<AuthResult> => {
      try {
        const normalizedGoal = getNormalizedGoalForStorage(input);

        const res = await apiPost("/auth/register", {
          name: input.name.trim(),
          email: input.email.trim().toLowerCase(),
          password: input.password,
          role: input.role,
          age: input.age,
          goal: normalizedGoal.goal,
          goal_type: normalizedGoal.goalType,
        });

        const accessToken = res.token ?? res.access_token;
        const refresh = res.refresh_token ?? res.refreshToken ?? null;
        const normalizedUser = normalizeUser(res.user);

        if (!accessToken) {
          return {
            ok: false,
            error: "Registration failed",
          };
        }

        await persistAuth(normalizedUser, accessToken, refresh);

        if (input.role === "client") {
          try {
            await apiPatch(
              "/users/me/client-profile",
              {
                goal: normalizedGoal.goal,
                goal_type: normalizedGoal.goalType,
                age: input.age,
                height: input.height ?? 0,
                start_weight: input.startWeight ?? input.currentWeight ?? 0,
                current_weight: input.currentWeight ?? input.startWeight ?? 0,
                fitness_level: input.fitnessLevel ?? "beginner",
              },
              { token: accessToken },
            );
          } catch (profileError) {
            console.log("[auth] register profile patch error", profileError);
          }
        }

        return { ok: true };
      } catch (error: any) {
        return {
          ok: false,
          error: extractErrorMessage(error, "Registration failed"),
        };
      }
    },
    [persistAuth],
  );

  const forgotPassword = useCallback(
    async (email: string): Promise<AuthResult> => {
      try {
        await apiPost("/auth/forgot-password", {
          email: email.trim().toLowerCase(),
        });

        return { ok: true };
      } catch (error: any) {
        return {
          ok: false,
          error: extractErrorMessage(
            error,
            "Could not send password reset instructions",
          ),
        };
      }
    },
    [],
  );

  const resetPassword = useCallback(
    async (resetToken: string, newPassword: string): Promise<AuthResult> => {
      try {
        await apiPost("/auth/reset-password", {
          token: resetToken.trim(),
          new_password: newPassword,
        });

        return { ok: true };
      } catch (error: any) {
        return {
          ok: false,
          error: extractErrorMessage(error, "Could not reset password"),
        };
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    await clearAuth();
  }, [clearAuth]);

  const updateMe = useCallback(
    async (patch: Partial<User>) => {
      if (!user || !token) return;

      try {
        const res = await apiPatch(
          "/users/me",
          {
            name: patch.name,
            phone: patch.phone,
            avatar_url: patch.avatarUrl,
          },
          { token },
        );

        const nextUser: User = {
          ...user,
          ...normalizeUser({ ...user, ...res }),
        };

        setUser(nextUser);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      } catch (error) {
        console.log("[auth] updateMe error", error);
      }
    },
    [user, token],
  );

  return useMemo(
    () => ({
      user,
      token,
      refreshToken,
      loading,

      login,
      register,
      forgotPassword,
      resetPassword,
      logout,
      updateMe,
    }),
    [
      user,
      token,
      refreshToken,
      loading,
      login,
      register,
      forgotPassword,
      resetPassword,
      logout,
      updateMe,
    ],
  );
});