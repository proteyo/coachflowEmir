import { router } from "expo-router";
import { Minus, Plus } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { CircularGoalSelector } from "@/src/components/charts";
import {
  AppButton,
  AppCard,
  AppText,
  ScreenContainer,
} from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";
import { apiPatch, apiPost } from "@/src/services/api";

function toLocalYMD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function getWeekStart() {
  const weekStart = new Date();

  weekStart.setHours(12, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));

  return toLocalYMD(weekStart);
}

function normalizeWeeklyGoal(
  saved: any,
  fallback: {
    id?: string;
    clientId: string;
    weekStart: string;
    targetMinutes: number;
    completedMinutes: number;
    targetWorkouts: number;
    completedWorkouts: number;
  },
) {
  return {
    id: String(saved?.id ?? fallback.id ?? `wg_${fallback.clientId}`),
    clientId: String(saved?.clientId ?? saved?.client_id ?? fallback.clientId),
    weekStart: String(
      saved?.weekStart ?? saved?.week_start ?? fallback.weekStart,
    ),
    targetMinutes: Number(
      saved?.targetMinutes ?? saved?.target_minutes ?? fallback.targetMinutes,
    ),
    completedMinutes: Number(
      saved?.completedMinutes ??
        saved?.completed_minutes ??
        fallback.completedMinutes,
    ),
    targetWorkouts: Number(
      saved?.targetWorkouts ??
        saved?.target_workouts ??
        fallback.targetWorkouts,
    ),
    completedWorkouts: Number(
      saved?.completedWorkouts ??
        saved?.completed_workouts ??
        fallback.completedWorkouts,
    ),
  };
}

export default function WeeklyGoalsScreen() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const { user, token } = useAuth();
  const { db, update, refreshFromBackend } = useData();

  const existing = useMemo(() => {
    if (!db || !user) return null;

    return db.weeklyGoals.find((goal) => goal.clientId === user.id) ?? null;
  }, [db, user]);

  const [minutes, setMinutes] = useState<number>(
    existing?.targetMinutes ?? 240,
  );
  const [workouts, setWorkouts] = useState<number>(
    existing?.targetWorkouts ?? 4,
  );
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (!existing) return;

    setMinutes(existing.targetMinutes);
    setWorkouts(existing.targetWorkouts);
  }, [existing?.id, existing?.targetMinutes, existing?.targetWorkouts]);

  const adjustMinutes = (delta: number) => {
    setMinutes((current) => Math.max(30, Math.min(720, current + delta)));
  };

  const adjustWorkouts = (delta: number) => {
    setWorkouts((current) => Math.max(1, Math.min(14, current + delta)));
  };

  const saveLocalFallback = () => {
    if (!user) return;

    update((data) => {
      const weekStart = getWeekStart();

      const fallbackGoal = normalizeWeeklyGoal(null, {
        id: existing?.id,
        clientId: user.id,
        weekStart,
        targetMinutes: minutes,
        completedMinutes: existing?.completedMinutes ?? 0,
        targetWorkouts: workouts,
        completedWorkouts: existing?.completedWorkouts ?? 0,
      });

      const goalExists = data.weeklyGoals.some(
        (goal) => goal.clientId === user.id,
      );

      if (goalExists) {
        return {
          ...data,
          weeklyGoals: data.weeklyGoals.map((goal) =>
            goal.clientId === user.id ? fallbackGoal : goal,
          ),
        };
      }

      return {
        ...data,
        weeklyGoals: [...data.weeklyGoals, fallbackGoal],
      };
    });
  };

  const save = async () => {
    if (saving) return;

    if (!user || !token) {
      Alert.alert(t("profile.authErrorTitle"), t("profile.loginAgainText"));
      return;
    }

    if (user.role !== "client") {
      Alert.alert(
        t("weekly.permissionDeniedTitle"),
        t("weekly.onlyClientsCanSetGoals"),
      );
      return;
    }

    const weekStart = getWeekStart();

    try {
      setSaving(true);

      let saved: any;

      if (existing) {
        saved = await apiPatch(
          `/weekly-goals/${existing.id}`,
          {
            target_minutes: minutes,
            target_workouts: workouts,
          },
          { token },
        );
      } else {
        saved = await apiPost(
          "/weekly-goals",
          {
            week_start: weekStart,
            target_minutes: minutes,
            target_workouts: workouts,
          },
          { token },
        );
      }

      const normalizedGoal = normalizeWeeklyGoal(saved, {
        id: existing?.id,
        clientId: user.id,
        weekStart,
        targetMinutes: minutes,
        completedMinutes: existing?.completedMinutes ?? 0,
        targetWorkouts: workouts,
        completedWorkouts: existing?.completedWorkouts ?? 0,
      });

      update((data) => {
        const goalExists = data.weeklyGoals.some(
          (goal) => goal.clientId === user.id,
        );

        if (goalExists) {
          return {
            ...data,
            weeklyGoals: data.weeklyGoals.map((goal) =>
              goal.clientId === user.id ? normalizedGoal : goal,
            ),
          };
        }

        return {
          ...data,
          weeklyGoals: [...data.weeklyGoals, normalizedGoal],
        };
      });

      await refreshFromBackend();

      router.back();
    } catch (e: any) {
      console.log("[weekly-goals] save error", e);

      saveLocalFallback();

      Alert.alert(
        t("weekly.savedLocallyTitle"),
        e?.message || t("weekly.savedLocallyMessage"),
        [
          {
            text: t("common.done"),
            onPress: () => router.back(),
          },
        ],
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer scroll>
      <AppText variant="title" style={{ marginBottom: 6 }}>
        {t("weekly.title")}
      </AppText>

      <AppText variant="small" color={theme.colors.textMuted}>
        {t("weekly.subtitle")}
      </AppText>

      <View style={{ alignItems: "center", marginVertical: 24 }}>
        <CircularGoalSelector
          value={minutes}
          min={30}
          max={720}
          step={15}
          onChange={setMinutes}
          unit={t("weekly.perWeek")}
        />

        <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
          <Stepper onPress={() => adjustMinutes(-15)} icon="minus" />

          <Stepper onPress={() => adjustMinutes(15)} icon="plus" />
        </View>
      </View>

      <AppCard variant="outline">
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <AppText variant="bodyStrong">
              {t("weekly.workoutsPerWeek")}
            </AppText>

            <AppText variant="small" color={theme.colors.textMuted}>
              {t("weekly.sessions")}
            </AppText>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Stepper onPress={() => adjustWorkouts(-1)} icon="minus" />

            <AppText variant="title">{workouts}</AppText>

            <Stepper onPress={() => adjustWorkouts(1)} icon="plus" />
          </View>
        </View>
      </AppCard>

      <AppCard variant="outline" style={{ marginTop: 14 }}>
        <View style={{ gap: 8 }}>
          <AppText variant="bodyStrong">{t("weekly.summaryTitle")}</AppText>

          <AppText variant="small" color={theme.colors.textMuted}>
            {t("weekly.summaryText")
              .replace("{minutes}", String(minutes))
              .replace("{workouts}", String(workouts))}
          </AppText>

          {existing ? (
            <AppText variant="caption" color={theme.colors.primary}>
              {t("weekly.currentProgress")
                .replace(
                  "{completedMinutes}",
                  String(existing.completedMinutes ?? 0),
                )
                .replace("{targetMinutes}", String(existing.targetMinutes ?? 0))
                .replace(
                  "{completedWorkouts}",
                  String(existing.completedWorkouts ?? 0),
                )
                .replace(
                  "{targetWorkouts}",
                  String(existing.targetWorkouts ?? 0),
                )}
            </AppText>
          ) : null}
        </View>
      </AppCard>

      <View style={{ marginTop: 24 }}>
        <AppButton
          title={saving ? t("common.loading") : t("weekly.save")}
          size="lg"
          onPress={save}
          fullWidth
        />
      </View>
    </ScreenContainer>
  );
}

function Stepper({
  onPress,
  icon,
}: {
  onPress: () => void;
  icon: "plus" | "minus";
}) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: theme.colors.surfaceAlt,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {icon === "plus" ? (
        <Plus color={theme.colors.text} size={18} />
      ) : (
        <Minus color={theme.colors.text} size={18} />
      )}
    </Pressable>
  );
}