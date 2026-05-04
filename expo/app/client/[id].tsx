import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  CheckCircle2,
  Circle,
  Dumbbell,
  Flame,
  MessageCircle,
  Pencil,
  Pill,
  Plus,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Alert, Dimensions, Pressable, View } from "react-native";
import { WeightChart } from "@/src/components/charts";
import {
  AppAvatar,
  AppButton,
  AppCard,
  AppEmptyState,
  AppText,
  ScreenContainer,
  StatCard,
  StreakPill,
  TabBarPill,
} from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { useSubscription } from "@/src/context/SubscriptionContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";

type Tab = "overview" | "workouts" | "supps" | "progress" | "attendance";

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function ClientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const { db, update } = useData();
  const { isActive } = useSubscription();
  const [tab, setTab] = useState<Tab>("overview");
  const w = Dimensions.get("window").width;

  const data = useMemo(() => {
    if (!db || !id) return null;
    const profile = db.clientProfiles.find((c) => c.userId === id);
    const u = db.users.find((x) => x.id === id);
    const workouts = db.workouts
      .filter((w) => w.clientId === id)
      .sort((a, b) => (a.date > b.date ? -1 : 1));
    const exercises = db.exercises;
    const plan = db.supplementPlans.find((p) => p.clientId === id);
    const supps = plan ? db.supplementItems.filter((s) => s.planId === plan.id) : [];
    const progress = db.progress.filter((p) => p.clientId === id);
    const streak = db.streaks.find((s) => s.clientId === id);
    const attendance = db.attendance.filter((a) => a.clientId === id);
    const weekly = db.weeklyGoals.find((w) => w.clientId === id);
    return { profile, u, workouts, exercises, plan, supps, progress, streak, attendance, weekly };
  }, [db, id]);

  if (!db || !user || !data?.profile || !data.u) return null;
  if (!isActive) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ title: data.u.name }} />
        <AppEmptyState
          title={t("subscription.required")}
          message={t("subscription.requiredMsg")}
          action={
            <AppButton title={t("subscription.activate")} onPress={() => router.push("/subscription")} />
          }
        />
      </ScreenContainer>
    );
  }

  const change = data.profile.currentWeight - data.profile.startWeight;
  const losing = change < 0;

  const setAttendance = (date: string, status: "attended" | "missed" | "rest") => {
    if (!user || !id) return;
    update((d) => {
      const exists = d.attendance.find((a) => a.clientId === id && a.date === date);
      if (exists) {
        return {
          ...d,
          attendance: d.attendance.map((a) => (a.id === exists.id ? { ...a, status } : a)),
        };
      }
      return {
        ...d,
        attendance: [
          ...d.attendance,
          {
            id: `att_${Date.now()}_${date}`,
            clientId: id,
            coachId: user.id,
            date,
            status,
          },
        ],
      };
    });
  };

  const promptAttendance = (date: string, current?: string) => {
    Alert.alert(
      date,
      current ? `Current: ${current}` : t("attendance.tapToMark"),
      [
        { text: t("attendance.attended"), onPress: () => setAttendance(date, "attended") },
        { text: t("attendance.missed"), onPress: () => setAttendance(date, "missed") },
        { text: t("attendance.rest"), onPress: () => setAttendance(date, "rest") },
        { text: t("common.cancel"), style: "cancel" },
      ],
      { cancelable: true },
    );
  };

  const addProgress = () => {
    Alert.prompt?.(
      t("progress.addWeight"),
      t("progress.enterWeight"),
      (text) => {
        const v = parseFloat(text ?? "");
        if (!v || v <= 0) return;
        update((d) => ({
          ...d,
          progress: [
            ...d.progress,
            {
              id: `pr_${Date.now()}`,
              clientId: id!,
              weight: v,
              date: new Date().toISOString().slice(0, 10),
              addedBy: user.id,
            },
          ],
          clientProfiles: d.clientProfiles.map((c) =>
            c.userId === id ? { ...c, currentWeight: v } : c,
          ),
        }));
      },
      "plain-text",
    );
  };

  const deleteWorkout = (wid: string) => {
    Alert.alert(t("workouts.confirmDelete"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => {
          update((d) => ({
            ...d,
            workouts: d.workouts.filter((w) => w.id !== wid),
            exercises: d.exercises.filter((e) => e.workoutId !== wid),
          }));
        },
      },
    ]);
  };

  // 28-day attendance grid (today on right)
  const gridDays: { date: string; status?: "attended" | "missed" | "rest" }[] = useMemo(() => {
    const out: { date: string; status?: "attended" | "missed" | "rest" }[] = [];
    const today = new Date();
    for (let i = 27; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const date = ymd(d);
      const a = data.attendance.find((x) => x.date === date);
      out.push({ date, status: a?.status });
    }
    return out;
  }, [data.attendance]);

  const monthAttendanceRate = useMemo(() => {
    const last = gridDays;
    const counted = last.filter((d) => d.status === "attended").length;
    return Math.round((counted / last.length) * 100);
  }, [gridDays]);

  return (
    <ScreenContainer scroll padded={false}>
      <Stack.Screen
        options={{
          title: data.u.name,
          headerRight: () => (
            <Pressable onPress={() => router.push(`/chat/${data.u!.id}`)}>
              <MessageCircle color={theme.colors.text} size={22} />
            </Pressable>
          ),
        }}
      />
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <AppAvatar uri={data.u.avatarUrl} name={data.u.name} size={64} ring />
          <View style={{ flex: 1 }}>
            <AppText variant="h2">{data.u.name}</AppText>
            <AppText variant="small" color={theme.colors.textMuted} numberOfLines={1}>
              {data.profile.goal}
            </AppText>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 6, alignItems: "center" }}>
              <StreakPill count={data.streak?.currentStreak ?? 0} />
              <AppText variant="caption" color={theme.colors.textMuted}>
                {data.profile.fitnessLevel.toUpperCase()}
              </AppText>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
          <StatCard
            label={t("progress.current")}
            value={`${data.profile.currentWeight}kg`}
            hint={`${t("progress.start")} ${data.profile.startWeight}kg`}
          />
          <StatCard
            label={losing ? t("progress.lost") : t("progress.gained")}
            value={`${Math.abs(change).toFixed(1)}kg`}
            hint={losing ? t("progress.cutting") : t("progress.building")}
            tone={losing ? "primary" : "warn"}
            icon={
              losing ? <TrendingDown color="#fff" size={16} /> : <TrendingUp color="#fff" size={16} />
            }
          />
        </View>

        <View style={{ marginTop: 14 }}>
          <TabBarPill
            options={[
              { key: "overview", label: t("clients.overview") },
              { key: "workouts", label: t("clients.workouts") },
              { key: "supps", label: t("clients.supps") },
              { key: "progress", label: t("clients.progress") },
              { key: "attendance", label: t("clients.attendance") },
            ]}
            active={tab}
            onChange={(k) => setTab(k as Tab)}
          />
        </View>

        <View style={{ marginTop: 16, gap: 12 }}>
          {tab === "overview" && (
            <>
              <AppCard variant="outline">
                <AppText variant="h3">{t("clients.profile")}</AppText>
                <View style={{ marginTop: 8, gap: 6 }}>
                  {data.profile.goal ? (
                    <AppText variant="small" color={theme.colors.textMuted}>
                      {t("clients.goal")}: {data.profile.goal}
                    </AppText>
                  ) : null}
                  <AppText variant="small" color={theme.colors.textMuted}>
                    {t("clients.height")}: {data.profile.height || "—"}cm · {t("clients.age")}: {data.profile.age ?? "—"}
                  </AppText>
                  <AppText variant="small" color={theme.colors.textMuted}>
                    Email: {data.u.email}
                    {data.u.clientCode ? ` · ${data.u.clientCode}` : ""}
                  </AppText>
                  {data.profile.healthNotes ? (
                    <AppText variant="small">{data.profile.healthNotes}</AppText>
                  ) : null}
                </View>
              </AppCard>
              {data.weekly ? (
                <AppCard variant="outline">
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Target color={theme.colors.fire} size={18} />
                    <AppText variant="h3">{t("clients.weeklyGoal")}</AppText>
                  </View>
                  <AppText variant="small" color={theme.colors.textMuted} style={{ marginTop: 4 }}>
                    {data.weekly.completedMinutes}/{data.weekly.targetMinutes} {t("common.minutes")} ·{" "}
                    {data.weekly.completedWorkouts}/{data.weekly.targetWorkouts} {t("common.workouts")}
                  </AppText>
                  <View
                    style={{
                      marginTop: 10,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: theme.colors.surfaceAlt,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        width: `${Math.min(
                          100,
                          (data.weekly.completedMinutes / Math.max(1, data.weekly.targetMinutes)) * 100,
                        )}%`,
                        height: 8,
                        backgroundColor: theme.colors.primary,
                      }}
                    />
                  </View>
                </AppCard>
              ) : null}
            </>
          )}

          {tab === "workouts" && (
            <View style={{ gap: 10 }}>
              <AppButton
                title={t("clients.addWorkout")}
                icon={<Plus size={18} color={theme.colors.primaryContrast} />}
                onPress={() => router.push(`/add-workout?clientId=${id}`)}
                fullWidth
              />
              {data.workouts.length === 0 ? (
                <AppEmptyState title={t("clients.noWorkouts")} />
              ) : (
                data.workouts.map((w) => {
                  const ex = data.exercises.filter((e) => e.workoutId === w.id);
                  return (
                    <AppCard key={w.id} variant="outline">
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <AppText variant="bodyStrong">{w.name}</AppText>
                          <AppText variant="small" color={theme.colors.textMuted}>
                            {w.date}{w.time ? ` · ${w.time}` : ""} · {ex.length} ex · {w.durationMinutes}m
                          </AppText>
                        </View>
                        {w.completed ? (
                          <CheckCircle2 color={theme.colors.success} size={20} />
                        ) : (
                          <Dumbbell color={theme.colors.textMuted} size={20} />
                        )}
                      </View>
                      <View style={{ flexDirection: "row", gap: 12, marginTop: 10 }}>
                        <Pressable
                          onPress={() => router.push(`/add-workout?workoutId=${w.id}`)}
                          hitSlop={8}
                          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                        >
                          <Pencil size={14} color={theme.colors.primary} />
                          <AppText variant="small" color={theme.colors.primary}>
                            {t("common.edit")}
                          </AppText>
                        </Pressable>
                        <Pressable
                          onPress={() => deleteWorkout(w.id)}
                          hitSlop={8}
                          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                        >
                          <Trash2 size={14} color={theme.colors.danger} />
                          <AppText variant="small" color={theme.colors.danger}>
                            {t("common.delete")}
                          </AppText>
                        </Pressable>
                      </View>
                    </AppCard>
                  );
                })
              )}
            </View>
          )}

          {tab === "supps" && (
            <View style={{ gap: 10 }}>
              <AppButton
                title={t("clients.addSupplement")}
                icon={<Plus size={18} color={theme.colors.primaryContrast} />}
                onPress={() => router.push(`/manage-supplements?clientId=${id}`)}
                fullWidth
              />
              {data.supps.length === 0 ? (
                <AppEmptyState title={t("clients.noSupps")} />
              ) : (
                data.supps.map((s) => (
                  <AppCard key={s.id} variant="outline">
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Pill color={theme.colors.accent} size={20} />
                      <View style={{ flex: 1 }}>
                        <AppText variant="bodyStrong">{s.name}</AppText>
                        <AppText variant="small" color={theme.colors.textMuted}>
                          {s.dosage} · {s.specificTimes.join(", ")}
                        </AppText>
                      </View>
                    </View>
                    {s.notes ? (
                      <AppText variant="small" color={theme.colors.textMuted} style={{ marginTop: 6 }}>
                        {s.notes}
                      </AppText>
                    ) : null}
                  </AppCard>
                ))
              )}
            </View>
          )}

          {tab === "progress" && (
            <>
              <AppCard variant="elevated">
                <AppText variant="h3" style={{ marginBottom: 8 }}>
                  {t("clients.weightTrend")}
                </AppText>
                <WeightChart values={data.progress} width={w - 80} />
              </AppCard>
              <AppButton
                title={t("clients.addWeightEntry")}
                icon={<Plus size={18} color={theme.colors.primaryContrast} />}
                onPress={addProgress}
                fullWidth
              />
              <View style={{ gap: 8 }}>
                {data.progress
                  .slice()
                  .reverse()
                  .map((p) => (
                    <AppCard key={p.id} variant="outline">
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <AppText variant="bodyStrong">{p.weight} kg</AppText>
                        <AppText variant="small" color={theme.colors.textMuted}>
                          {p.date}
                        </AppText>
                      </View>
                    </AppCard>
                  ))}
              </View>
            </>
          )}

          {tab === "attendance" && (
            <>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <StatCard
                  label={t("attendance.currentStreak")}
                  value={data.streak?.currentStreak ?? 0}
                  hint={`${t("attendance.bestStreak")} ${data.streak?.bestStreak ?? 0}`}
                  tone="fire"
                  icon={<Flame size={16} color="#fff" fill="#fff" />}
                />
                <StatCard
                  label={t("attendance.monthRate")}
                  value={`${monthAttendanceRate}%`}
                  hint={t("clients.attendance")}
                />
              </View>
              <AppText variant="caption" color={theme.colors.textMuted} style={{ marginTop: 4 }}>
                {t("attendance.tapToMark")}
              </AppText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {gridDays.map((d) => {
                  const isToday = d.date === ymd(new Date());
                  const bg =
                    d.status === "attended"
                      ? theme.colors.primary
                      : d.status === "rest"
                        ? theme.colors.surfaceAlt
                        : d.status === "missed"
                          ? theme.colors.danger
                          : theme.colors.surface;
                  return (
                    <Pressable
                      key={d.date}
                      onPress={() => promptAttendance(d.date, d.status)}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: bg,
                        borderWidth: isToday ? 2 : 1,
                        borderColor: isToday ? theme.colors.fire : theme.colors.border,
                      }}
                    >
                      {d.status === "attended" ? (
                        <Flame color="#fff" size={14} fill="#fff" />
                      ) : d.status === "rest" ? (
                        <Circle color={theme.colors.text} size={12} />
                      ) : d.status === "missed" ? (
                        <AppText variant="caption" color="#fff">
                          ✕
                        </AppText>
                      ) : (
                        <AppText variant="caption" color={theme.colors.textFaint}>
                          {d.date.slice(8, 10)}
                        </AppText>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </View>
        <View style={{ height: 32 }} />
      </View>
    </ScreenContainer>
  );
}
