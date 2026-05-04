import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { CheckCircle2, Pause, Play, Square, Timer } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import {
  AppButton,
  AppCard,
  AppText,
  ScreenContainer,
} from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { useTheme } from "@/src/context/ThemeContext";

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function WorkoutPlayer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { db, update } = useData();
  const [seconds, setSeconds] = useState<number>(0);
  const [running, setRunning] = useState<boolean>(false);
  const [doneSet, setDoneSet] = useState<Record<string, number>>({});

  const workout = useMemo(() => db?.workouts.find((w) => w.id === id), [db, id]);
  const exercises = useMemo(
    () => (workout ? db?.exercises.filter((e) => e.workoutId === workout.id) ?? [] : []),
    [db, workout],
  );

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  if (!workout) return null;

  const totalSets = exercises.reduce((acc, e) => acc + e.sets, 0);
  const completedSets = Object.values(doneSet).reduce((a, b) => a + b, 0);
  const progress = totalSets ? completedSets / totalSets : 0;

  const finish = () => {
    update((d) => {
      const minutes = Math.max(1, Math.round(seconds / 60));
      return {
        ...d,
        workouts: d.workouts.map((w) =>
          w.id === workout.id
            ? {
                ...w,
                completed: true,
                completedAt: new Date().toISOString(),
                durationMinutes: minutes,
              }
            : w,
        ),
        weeklyGoals: d.weeklyGoals.map((g) =>
          user && g.clientId === user.id
            ? {
                ...g,
                completedMinutes: g.completedMinutes + minutes,
                completedWorkouts: g.completedWorkouts + 1,
              }
            : g,
        ),
        streaks: d.streaks.map((s) =>
          user && s.clientId === user.id
            ? {
                ...s,
                currentStreak: s.currentStreak + 1,
                bestStreak: Math.max(s.bestStreak, s.currentStreak + 1),
                lastActivityDate: new Date().toISOString().slice(0, 10),
              }
            : s,
        ),
      };
    });
    router.back();
  };

  return (
    <ScreenContainer scroll padded={false}>
      <Stack.Screen options={{ title: workout.name }} />
      <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        <AppCard variant="elevated">
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Timer color={theme.colors.primary} size={22} />
              <AppText variant="display">{fmt(seconds)}</AppText>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => setRunning((r) => !r)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: theme.colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {running ? (
                  <Pause color={theme.colors.primaryContrast} size={20} />
                ) : (
                  <Play color={theme.colors.primaryContrast} size={20} fill={theme.colors.primaryContrast} />
                )}
              </Pressable>
              <Pressable
                onPress={() => {
                  setRunning(false);
                  setSeconds(0);
                }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: theme.colors.surfaceAlt,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Square color={theme.colors.text} size={18} />
              </Pressable>
            </View>
          </View>
          <View
            style={{
              marginTop: 12,
              height: 6,
              backgroundColor: theme.colors.surfaceAlt,
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${Math.round(progress * 100)}%`,
                height: 6,
                backgroundColor: theme.colors.primary,
              }}
            />
          </View>
          <AppText variant="small" color={theme.colors.textMuted} style={{ marginTop: 6 }}>
            {completedSets}/{totalSets} sets completed
          </AppText>
        </AppCard>

        <View style={{ marginTop: 14, gap: 12 }}>
          {exercises.map((e) => {
            const done = doneSet[e.id] ?? 0;
            return (
              <AppCard key={e.id} variant="outline" padded={false}>
                {e.imageUrl ? (
                  <Image
                    source={{ uri: e.imageUrl }}
                    style={{ height: 100, width: "100%" }}
                    contentFit="cover"
                  />
                ) : null}
                <View style={{ padding: 14, gap: 6 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <AppText variant="bodyStrong">{e.name}</AppText>
                    <AppText variant="small" color={theme.colors.textMuted}>
                      {e.muscleGroup}
                    </AppText>
                  </View>
                  <AppText variant="small" color={theme.colors.textMuted}>
                    {e.sets} × {e.reps} · rest {e.restSeconds}s
                    {e.weight ? ` · ${e.weight}kg` : ""}
                  </AppText>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                      {Array.from({ length: e.sets }).map((_, idx) => {
                        const ok = idx < done;
                        return (
                          <Pressable
                            key={idx}
                            onPress={() =>
                              setDoneSet((d) => ({
                                ...d,
                                [e.id]: idx + 1 === done ? idx : idx + 1,
                              }))
                            }
                            style={{
                              paddingVertical: 6,
                              paddingHorizontal: 12,
                              borderRadius: 10,
                              backgroundColor: ok
                                ? theme.colors.primary
                                : theme.colors.surfaceAlt,
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            {ok ? (
                              <CheckCircle2 size={14} color={theme.colors.primaryContrast} />
                            ) : null}
                            <AppText
                              variant="small"
                              color={ok ? theme.colors.primaryContrast : theme.colors.text}
                              style={{ fontWeight: "700" }}
                            >
                              Set {idx + 1}
                            </AppText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              </AppCard>
            );
          })}
        </View>

        <View style={{ marginTop: 18, marginBottom: 24 }}>
          <AppButton title="Finish workout" size="lg" onPress={finish} fullWidth />
        </View>
      </View>
    </ScreenContainer>
  );
}
