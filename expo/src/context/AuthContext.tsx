import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiGet, apiPatch, apiPost } from "@/src/services/api";
import {
  FitnessLevel,
  Gender,
  GoalType,
  Role,
  User,
} from "@/src/types/models";

const TOKEN_KEY = "coachflow:token";
const REFRESH_TOKEN_KEY = "coachflow:refresh_token";
const USER_KEY = "coachflow:user";
const PENDING_REGISTER_PROFILE_KEY = "coachflow:pending_register_profile";

type RegisterInput = {
  name: string;
  email: string;
  password: string;
  role: Role;

  gender?: Gender;
  age?: number;
  goalType?: GoalType;
  goal?: string;

  height?: number;
  startWeight?: number;
  currentWeight?: number;
  fitnessLevel?: FitnessLevel;
};

type PendingClientProfilePatch = {
  role: Role;
  gender?: Gender;
  goal?: string;
  goalType?: GoalType;
  age?: number;
  height?: number;
  startWeight?: number;
  currentWeight?: number;
  fitnessLevel?: FitnessLevel;
};

type AuthResult = {
  ok: boolean;
  error?: string;
  email?: string;
  emailVerificationRequired?: boolean;
  message?: string;
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
    lastSeenAt: apiUser.lastSeenAt ?? apiUser.last_seen_at ?? undefined,
    isOnline: Boolean(apiUser.isOnline ?? apiUser.is_online ?? false),
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

function cleanEmail(email: string): string {
  return email.trim().toLowerCase();
}

function cleanVerificationCode(code: string): string {
  return code.replace(/\D/g, "").slice(0, 6);
}

function normalizeGender(value?: Gender): Gender {
  return value === "female" ? "female" : "male";
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

  const patchPendingClientProfile = useCallback(
    async (accessToken: string) => {
      try {
        const raw = await AsyncStorage.getItem(PENDING_REGISTER_PROFILE_KEY);

        if (!raw) return;

        const pending = JSON.parse(raw) as PendingClientProfilePatch;

        if (pending.role !== "client") {
          await AsyncStorage.removeItem(PENDING_REGISTER_PROFILE_KEY);
          return;
        }

        await apiPatch(
          "/users/me/client-profile",
          {
            gender: normalizeGender(pending.gender),
            goal: pending.goal,
            goal_type: pending.goalType,
            age: pending.age,
            height: pending.height ?? 0,
            start_weight: pending.startWeight ?? pending.currentWeight ?? 0,
            current_weight: pending.currentWeight ?? pending.startWeight ?? 0,
            fitness_level: pending.fitnessLevel ?? "beginner",
          },
          { token: accessToken },
        );

        await AsyncStorage.removeItem(PENDING_REGISTER_PROFILE_KEY);
      } catch (profileError) {
        console.log("[auth] pending client profile patch error", profileError);
      }
    },
    [],
  );

  const refreshSession = useCallback(
    async (savedRefreshToken: string): Promise<boolean> => {
      try {
        const res = await apiPost("/auth/refresh", {
          refresh_token: savedRefreshToken,
        });

        const accessToken = res.token ?? res.access_token;
        const nextRefresh = res.refresh_token ?? res.refreshToken ?? null;

        if (!accessToken || !res.user) {
          await clearAuth();
          return false;
        }

        const normalizedUser = normalizeUser(res.user);

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
    let mounted = true;

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

            if (!mounted) return;

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
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [clearAuth, refreshSession]);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      try {
        const res = await apiPost("/auth/login", {
          email: cleanEmail(email),
          password,
        });

        const accessToken = res.token ?? res.access_token;
        const refresh = res.refresh_token ?? res.refreshToken ?? null;

        if (!accessToken || !res.user) {
          return {
            ok: false,
            error: "Login failed",
          };
        }

        const normalizedUser = normalizeUser(res.user);

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
        const email = cleanEmail(input.email);
        const gender = normalizeGender(input.gender);

        const res = await apiPost("/auth/register", {
          name: input.name.trim(),
          email,
          password: input.password,
          role: input.role,
          gender: input.role === "client" ? gender : undefined,
          age: input.age,
          goal: normalizedGoal.goal,
          goal_type: normalizedGoal.goalType,
        });

        if (input.role === "client") {
          const pendingPatch: PendingClientProfilePatch = {
            role: input.role,
            gender,
            goal: normalizedGoal.goal,
            goalType: normalizedGoal.goalType,
            age: input.age,
            height: input.height,
            startWeight: input.startWeight,
            currentWeight: input.currentWeight,
            fitnessLevel: input.fitnessLevel,
          };

          await AsyncStorage.setItem(
            PENDING_REGISTER_PROFILE_KEY,
            JSON.stringify(pendingPatch),
          );
        } else {
          await AsyncStorage.removeItem(PENDING_REGISTER_PROFILE_KEY);
        }

        return {
          ok: true,
          email: res.email ?? email,
          emailVerificationRequired:
            res.emailVerificationRequired ??
            res.email_verification_required ??
            true,
          message:
            res.message ??
            "Verification code has been sent to your email.",
        };
      } catch (error: any) {
        return {
          ok: false,
          error: extractErrorMessage(error, "Registration failed"),
        };
      }
    },
    [],
  );

  const verifyEmail = useCallback(
    async (email: string, code: string): Promise<AuthResult> => {
      try {
        const cleanedCode = cleanVerificationCode(code);

        if (cleanedCode.length !== 6) {
          return {
            ok: false,
            error: "Verification code must contain 6 digits",
          };
        }

        const res = await apiPost("/auth/verify-email", {
          email: cleanEmail(email),
          code: cleanedCode,
        });

        const accessToken = res.token ?? res.access_token;
        const refresh = res.refresh_token ?? res.refreshToken ?? null;

        if (!accessToken || !res.user) {
          return {
            ok: false,
            error: "Email verification failed",
          };
        }

        const normalizedUser = normalizeUser(res.user);

        await persistAuth(normalizedUser, accessToken, refresh);
        await patchPendingClientProfile(accessToken);

        return { ok: true };
      } catch (error: any) {
        return {
          ok: false,
          error: extractErrorMessage(error, "Email verification failed"),
        };
      }
    },
    [persistAuth, patchPendingClientProfile],
  );

  const resendVerificationCode = useCallback(
    async (email: string): Promise<AuthResult> => {
      try {
        const res = await apiPost("/auth/resend-verification-code", {
          email: cleanEmail(email),
        });

        return {
          ok: true,
          email: res.email ?? cleanEmail(email),
          emailVerificationRequired:
            res.emailVerificationRequired ??
            res.email_verification_required ??
            true,
          message:
            res.message ??
            "Verification code has been sent to your email.",
        };
      } catch (error: any) {
        return {
          ok: false,
          error: extractErrorMessage(
            error,
            "Could not resend verification code",
          ),
        };
      }
    },
    [],
  );

  const forgotPassword = useCallback(
    async (email: string): Promise<AuthResult> => {
      try {
        await apiPost("/auth/forgot-password", {
          email: cleanEmail(email),
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
      verifyEmail,
      resendVerificationCode,
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
      verifyEmail,
      resendVerificationCode,
      forgotPassword,
      resetPassword,
      logout,
      updateMe,
    ],
  );
});