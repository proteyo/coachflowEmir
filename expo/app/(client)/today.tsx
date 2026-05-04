import { router } from "expo-router";
import {
  Activity,
  CheckCircle2,
  Circle,
  Flame,
  Pill,
  Play,
  Target,
} from "lucide-react-native";
import React, { useMemo } from "react";
import { Pressable, View } from "react-native";
import { ProgressRing } from "@/src/components/charts";
import {
  AppAvatar,
  AppCard,
  AppText,
  GradientHeader,
  ScreenContainer,
  SectionHeader,
  StreakPill,
} from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";

export default function ClientToday() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const { db, update } = useData();
  const today = new Date().toISOString().slice(0, 10);

  const data = useMemo(() => {
    if (!db || !user) return null;
    const profile = db.clientProfiles.find((c) => c.userId === user.id);
    const workout = db.workouts.find(
      (w) => w.clientId === user.id && w.date === today,
    );
    const exercises = workout
      ? db.exercises.filter((e) => e.workoutId === workout.id)
      : [];
    const streak = db.streaks.find((s) => s.clientId === user.id);
    const weekly = db.weeklyGoals.find((w) => w.clientId === user.id);
    const plan = db.supplementPlans.find((p) => p.clientId === user.id);
    const supps = plan
      ? db.supplementItems.filter((s) => s.planId === plan.id)
      : [];
    const logsToday = db.supplementLogs.filter(
      (l) => l.clientId === user.id && l.date === today,
    );
    return { profile, workout, exercises, streak, weekly, supps, logsToday };
  }, [db, user, today]);

  if (!db || !user || !data) return null;

  const toggleSupp = (suppId: string, time: string) => {
    update((d) => {
      const existing = d.supplementLogs.find(
        (l) =>
          l.clientId === user.id &&
          l.supplementItemId === suppId &&
          l.date === today &&
          l.time === time,
      );
      if (existing) {
        return {
          ...d,
          supplementLogs: d.supplementLogs.map((l) =>
            l.id === existing.id ? { ...l, taken: !l.taken } : l,
          ),
        };
      }
      return {
        ...d,
        supplementLogs: [
          ...d.supplementLogs,
          {
            id: `sl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            clientId: user.id,
            supplementItemId: suppId,
            date: today,
            time,
            taken: true,
          },
        ],
      };
    });
  };

  const weeklyProgress = data.weekly
    ? Math.min(1, data.weekly.completedMinutes / Math.max(1, data.weekly.targetMinutes))
    : 0;

  return (
    <ScreenContainer scroll padded={false}>
      <GradientHeader height={240}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
          <View>
            <AppText variant="small" color="rgba(255,255,255,0.7)">
              {t("today.today")}
            </AppText>
            <AppText variant="title" color="#fff">
              {t("today.hey", { name: user.name.split(" ")[0] })}
            </AppText>
          </View>
          <AppAvatar uri={user.avatarUrl} name={user.name} size={48} />
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 18, gap: 14 }}>
          <ProgressRing
            size={120}
            stroke={12}
            progress={weeklyProgress}
            label={`${Math.round(weeklyProgress * 100)}%`}
            sublabel="WEEK"
            color="#fff"
          />
          <View style={{ flex: 1, gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Flame color="#FF7A1A" size={18} fill="#FF7A1A" />
              <AppText variant="bodyStrong" color="#fff">
                {t("today.streakDays", { n: data.streak?.currentStreak ?? 0 })}
              </AppText>
            </View>
            <AppText variant="small" color="rgba(255,255,255,0.8)">
              {t("today.bestDays", { n: data.streak?.bestStreak ?? 0 })}
            </AppText>
            {data.weekly ? (
              <AppText variant="small" color="rgba(255,255,255,0.8)">
                {data.weekly.completedMinutes}/{data.weekly.targetMinutes} min ·{" "}
                {data.weekly.completedWorkouts}/{data.weekly.targetWorkouts} workouts
              </AppText>
            ) : null}
          </View>
        </View>
      </GradientHeader>

      <View style={{ paddingHorizontal: 20, marginTop: 16, gap: 12 }}>
        <SectionHeader
          title={t("workouts.todays")}
          icon={<Activity color={theme.colors.primary} size={18} />}
        />
        {data.workout ? (
          <Pressable onPress={() => router.push(`/workout/${data.workout!.id}`)}>
            <AppCard variant="elevated">
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ flex: 1 }}>
                  <AppText variant="h3">{data.workout.name}</AppText>
                  <AppText variant="small" color={theme.colors.textMuted}>
                    {data.workout.time ? `${data.workout.time} · ` : ""}
                    {data.exercises.length} {t("workouts.exercises").toLowerCase()} · {data.workout.durationMinutes}m
                  </AppText>
                </View>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: data.workout.completed
                      ? theme.colors.success
                      : theme.colors.primary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {data.workout.completed ? (
                    <CheckCircle2 color="#fff" size={22} />
                  ) : (
                    <Play color="#fff" size={22} fill="#fff" />
                  )}
                </View>
              </View>
            </AppCard>
          </Pressable>
        ) : (
          <AppCard variant="outline">
            <AppText variant="small" color={theme.colors.textMuted}>
              {t("workouts.noToday")}
            </AppText>
          </AppCard>
        )}

        <SectionHeader title={t("supps.title")} icon={<Pill color={theme.colors.accent} size={18} />} />
        {data.supps.length === 0 ? (
          <AppCard variant="outline">
            <AppText variant="small" color={theme.colors.textMuted}>
              {t("supps.none")}
            </AppText>
          </AppCard>
        ) : (
          <AppCard padded={false} variant="outline">
            {data.supps.map((s, idx) =>
              s.specificTimes.map((t) => {
                const log = data.logsToday.find(
                  (l) => l.supplementItemId === s.id && l.time === t,
                );
                const taken = log?.taken === true;
                return (
                  <Pressable
                    key={`${s.id}-${t}`}
                    onPress={() => toggleSupp(s.id, t)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderTopWidth: idx === 0 ? 0 : 1,
                      borderTopColor: theme.colors.borderSoft,
                      gap: 12,
                    }}
                  >
                    {taken ? (
                      <CheckCircle2 size={22} color={theme.colors.success} />
                    ) : (
                      <Circle size={22} color={theme.colors.textFaint} />
                    )}
                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyStrong">{s.name}</AppText>
                      <AppText variant="small" color={theme.colors.textMuted}>
                        {s.dosage} · {t}
                      </AppText>
                    </View>
                  </Pressable>
                );
              }),
            )}
          </AppCard>
        )}

        <SectionHeader
          title={t("today.weeklyGoal")}
          icon={<Target color={theme.colors.fire} size={18} />}
          action={
            <Pressable onPress={() => router.push("/weekly-goals")}>
              <AppText variant="small" color={theme.colors.primary} style={{ fontWeight: "700" }}>
                {t("today.edit")}
              </AppText>
            </Pressable>
          }
        />
        {data.weekly ? (
          <AppCard variant="outline">
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <ProgressRing
                size={88}
                stroke={10}
                progress={weeklyProgress}
                label={`${data.weekly.completedMinutes}`}
                sublabel={t("today.minLabel")}
              />
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <AppText variant="small" color={theme.colors.textMuted}>
                  {t("today.target")} {data.weekly.targetMinutes} {t("common.minutes")}
                </AppText>
                <StreakPill count={data.streak?.currentStreak ?? 0} />
              </View>
            </View>
          </AppCard>
        ) : null}

        <View style={{ height: 24 }} />
      </View>
    </ScreenContainer>
  );
}
