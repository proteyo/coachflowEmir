import { router } from "expo-router";
import { ChevronLeft, ChevronRight, Dumbbell, Pill } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import {
  AppCard,
  AppEmptyState,
  AppText,
  ScreenContainer,
} from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function ClientSchedule() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const { db } = useData();
  const [selected, setSelected] = useState<string>(ymd(new Date()));
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  });

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      }),
    [weekStart],
  );

  const workout = useMemo(() => {
    if (!db || !user) return null;
    return db.workouts.find((w) => w.clientId === user.id && w.date === selected) ?? null;
  }, [db, user, selected]);

  const exercises = workout ? db?.exercises.filter((e) => e.workoutId === workout.id) ?? [] : [];

  const supps = useMemo(() => {
    if (!db || !user) return [];
    const plan = db.supplementPlans.find((p) => p.clientId === user.id);
    if (!plan) return [];
    return db.supplementItems.filter((s) => s.planId === plan.id);
  }, [db, user]);

  return (
    <ScreenContainer scroll>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginVertical: 8,
        }}
      >
        <Pressable
          onPress={() => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() - 7);
            setWeekStart(d);
          }}
        >
          <ChevronLeft color={theme.colors.text} size={22} />
        </Pressable>
        <AppText variant="h3">
          {t("schedule.weekOf", { label: weekStart.toDateString().slice(4, 10) })}
        </AppText>
        <Pressable
          onPress={() => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + 7);
            setWeekStart(d);
          }}
        >
          <ChevronRight color={theme.colors.text} size={22} />
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        {days.map((d) => {
          const k = ymd(d);
          const isSel = selected === k;
          const has = db?.workouts.some((w) => w.clientId === user?.id && w.date === k);
          return (
            <Pressable
              key={k}
              onPress={() => setSelected(k)}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 14,
                alignItems: "center",
                backgroundColor: isSel ? theme.colors.primary : theme.colors.surface,
                borderWidth: 1,
                borderColor: isSel ? theme.colors.primary : theme.colors.border,
                gap: 4,
              }}
            >
              <AppText
                variant="caption"
                color={isSel ? theme.colors.primaryContrast : theme.colors.textMuted}
              >
                {d.toLocaleDateString("en", { weekday: "short" }).toUpperCase()}
              </AppText>
              <AppText
                variant="bodyStrong"
                color={isSel ? theme.colors.primaryContrast : theme.colors.text}
              >
                {d.getDate()}
              </AppText>
              {has ? (
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: isSel ? "#fff" : theme.colors.primary,
                  }}
                />
              ) : (
                <View style={{ height: 6 }} />
              )}
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: 18, gap: 14 }}>
        <AppText variant="h3">{t("schedule.workout")}</AppText>
        {workout ? (
          <Pressable onPress={() => router.push(`/workout/${workout.id}`)}>
            <AppCard variant="elevated">
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Dumbbell color={theme.colors.primary} size={22} />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">{workout.name}</AppText>
                  <AppText variant="small" color={theme.colors.textMuted}>
                    {workout.time ? `${workout.time} · ` : ""}
                    {exercises.length} {t("workouts.exercises").toLowerCase()} · {workout.durationMinutes}m
                  </AppText>
                </View>
              </View>
              <View style={{ marginTop: 12, gap: 6 }}>
                {exercises.slice(0, 4).map((e) => (
                  <AppText key={e.id} variant="small" color={theme.colors.textMuted}>
                    · {e.name} — {e.sets}×{e.reps}
                  </AppText>
                ))}
              </View>
            </AppCard>
          </Pressable>
        ) : (
          <AppCard variant="outline">
            <AppEmptyState title={t("workouts.restDay")} message={t("workouts.noWorkout")} />
          </AppCard>
        )}

        <AppText variant="h3">{t("schedule.supplements")}</AppText>
        {supps.length === 0 ? (
          <AppCard variant="outline">
            <AppText variant="small" color={theme.colors.textMuted}>
              {t("schedule.noPlan")}
            </AppText>
          </AppCard>
        ) : (
          <AppCard padded={false} variant="outline">
            {supps.map((s, idx) => (
              <View
                key={s.id}
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
                <Pill color={theme.colors.accent} size={18} />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">{s.name}</AppText>
                  <AppText variant="small" color={theme.colors.textMuted}>
                    {s.dosage} · {s.specificTimes.join(", ")}
                  </AppText>
                </View>
              </View>
            ))}
          </AppCard>
        )}
      </View>
    </ScreenContainer>
  );
}
