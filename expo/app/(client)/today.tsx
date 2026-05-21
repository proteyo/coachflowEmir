import { Image } from "expo-image";
import { router } from "expo-router";
import {
  Activity,
  CheckCircle2,
  Circle,
  Clock3,
  Flame,
  Pill,
  Play,
  Target,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";

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
import {
  EXERCISE_LIBRARY,
  getExerciseAnimationFrames,
  getExerciseName,
} from "@/src/data/exerciseLibrary";
import { useI18n } from "@/src/i18n/I18nContext";
import { apiPost, toAbsoluteUrl } from "@/src/services/api";

type DayKey = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
type AppLangCode = "en" | "ru" | "kk";

const DAY_KEYS: DayKey[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ALL_DAYS: DayKey[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toLocalYMD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function getLocalDayKey(date: Date): DayKey {
  return DAY_KEYS[date.getDay()];
}

function normalizeDays(value: any): DayKey[] {
  if (!value) return ALL_DAYS;

  if (Array.isArray(value)) {
    const valid = value.filter((day) => ALL_DAYS.includes(day));
    return valid.length > 0 ? valid : ALL_DAYS;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        const valid = parsed.filter((day) => ALL_DAYS.includes(day));
        return valid.length > 0 ? valid : ALL_DAYS;
      }
    } catch {
      return ALL_DAYS;
    }
  }

  return ALL_DAYS;
}

function isSupplementActiveForDay(supplement: any, day: DayKey) {
  const days = normalizeDays(supplement.daysOfWeek ?? supplement.days_of_week);
  return days.includes(day);
}

function getDayLabel(day: DayKey, lang: string) {
  const labels: Record<DayKey, Record<string, string>> = {
    Mon: {
      en: "Mon",
      ru: "Пн",
      kk: "Дс",
    },
    Tue: {
      en: "Tue",
      ru: "Вт",
      kk: "Сс",
    },
    Wed: {
      en: "Wed",
      ru: "Ср",
      kk: "Ср",
    },
    Thu: {
      en: "Thu",
      ru: "Чт",
      kk: "Бс",
    },
    Fri: {
      en: "Fri",
      ru: "Пт",
      kk: "Жм",
    },
    Sat: {
      en: "Sat",
      ru: "Сб",
      kk: "Сн",
    },
    Sun: {
      en: "Sun",
      ru: "Вс",
      kk: "Жс",
    },
  };

  return labels[day][lang] ?? labels[day].en;
}

function formatActiveDays(supplement: any, lang: string) {
  const days = normalizeDays(supplement.daysOfWeek ?? supplement.days_of_week);

  if (days.length === 7) {
    if (lang === "ru") return "Каждый день";
    if (lang === "kk") return "Күн сайын";

    return "Every day";
  }

  return days.map((day) => getDayLabel(day, lang)).join(", ");
}

function formatTodayLabel(date: Date, lang: string) {
  const locale = lang === "ru" ? "ru-RU" : lang === "kk" ? "kk-KZ" : "en-US";

  return date.toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getMoreLabel(count: number, lang: string) {
  if (lang === "ru") return `ещё ${count}`;
  if (lang === "kk") return `тағы ${count}`;

  return `${count} more`;
}

function getTodaySupplementsHint(todayDay: DayKey, lang: string) {
  const day = getDayLabel(todayDay, lang);

  if (lang === "ru") {
    return `Сегодня ${day}. Показаны только добавки, запланированные на сегодня.`;
  }

  if (lang === "kk") {
    return `Бүгін ${day}. Бүгінге жоспарланған қоспалар ғана көрсетіледі.`;
  }

  return `Today is ${day}. Showing only supplements scheduled for today.`;
}

function getNoSupplementsTodayText(lang: string) {
  if (lang === "ru") return "На сегодня добавки не запланированы.";
  if (lang === "kk") return "Бүгінге қоспалар жоспарланбаған.";

  return "No supplements scheduled for today.";
}

function getAuthErrorTitle(lang: string) {
  if (lang === "ru") return "Ошибка авторизации";
  if (lang === "kk") return "Авторизация қатесі";

  return "Auth error";
}

function getLoginAgainText(lang: string) {
  if (lang === "ru") return "Пожалуйста, войдите снова.";
  if (lang === "kk") return "Қайта кіріңіз.";

  return "Please log in again.";
}

function getSupplementErrorTitle(lang: string) {
  if (lang === "ru") return "Ошибка добавки";
  if (lang === "kk") return "Қоспа қатесі";

  return "Supplement error";
}

function getSupplementErrorText(lang: string) {
  if (lang === "ru") return "Не удалось обновить запись по добавке.";
  if (lang === "kk") return "Қоспа жазбасын жаңарту мүмкін болмады.";

  return "Could not update supplement log.";
}

function getFramesFromImageUrl(imageUrl?: string): string[] {
  if (!imageUrl) return [];

  if (imageUrl.includes("/0.jpg")) {
    return [imageUrl, imageUrl.replace("/0.jpg", "/1.jpg")];
  }

  return [imageUrl];
}

function getLangSafe(lang: string): AppLangCode {
  if (lang === "ru" || lang === "kk" || lang === "en") return lang;
  return "en";
}

function pickText(...values: Array<string | null | undefined>) {
  return (
    values
      .find((value) => typeof value === "string" && value.trim().length > 0)
      ?.trim() ?? ""
  );
}

type LocalizedWorkoutLike = {
  name?: string | null;
  nameRu?: string | null;
  nameKk?: string | null;
  name_ru?: string | null;
  name_kk?: string | null;

  description?: string | null;
  descriptionRu?: string | null;
  descriptionKk?: string | null;
  description_ru?: string | null;
  description_kk?: string | null;

  weeklyPlanTitle?: string | null;
  weeklyPlanTitleRu?: string | null;
  weeklyPlanTitleKk?: string | null;
  weekly_plan_title?: string | null;
  weekly_plan_title_ru?: string | null;
  weekly_plan_title_kk?: string | null;

  source?: string | null;
};

type LocalizedExerciseLike = {
  name?: string | null;
  nameRu?: string | null;
  nameKk?: string | null;
  name_ru?: string | null;
  name_kk?: string | null;

  notes?: string | null;
  notesRu?: string | null;
  notesKk?: string | null;
  notes_ru?: string | null;
  notes_kk?: string | null;

  imageUrl?: string | null;
  image_url?: string | null;
  gifUrl?: string | null;
  gif_url?: string | null;
  animationFrames?: string | string[] | null;
  animation_frames?: string | string[] | null;
  muscleGroup?: string | null;
  muscle_group?: string | null;
  libraryExerciseId?: string | null;
  library_exercise_id?: string | null;
};

function getLocalizedWorkoutName(
  workout: LocalizedWorkoutLike,
  lang: AppLangCode,
) {
  if (lang === "ru") {
    return pickText(workout.nameRu, workout.name_ru, workout.name);
  }

  if (lang === "kk") {
    return pickText(workout.nameKk, workout.name_kk, workout.name);
  }

  return pickText(workout.name);
}

function getLocalizedWeeklyPlanTitle(
  workout: LocalizedWorkoutLike,
  lang: AppLangCode,
) {
  if (lang === "ru") {
    return pickText(
      workout.weeklyPlanTitleRu,
      workout.weekly_plan_title_ru,
      "Недельный план",
    );
  }

  if (lang === "kk") {
    return pickText(
      workout.weeklyPlanTitleKk,
      workout.weekly_plan_title_kk,
      "Апталық жоспар",
    );
  }

  return pickText(
    workout.weeklyPlanTitle,
    workout.weekly_plan_title,
    "Weekly plan",
  );
}

function getExerciseImageUrl(exercise: LocalizedExerciseLike) {
  return pickText(exercise.imageUrl, exercise.image_url);
}

function getExerciseGifUrl(exercise: LocalizedExerciseLike) {
  return pickText(exercise.gifUrl, exercise.gif_url);
}

function parseExerciseFrames(value: string | string[] | null | undefined) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0,
    );
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0,
        );
      }
    } catch {
      return value.trim().length > 0 ? [value] : [];
    }
  }

  return [];
}

function getExerciseFrames(exercise: LocalizedExerciseLike) {
  const explicitFrames = [
    ...parseExerciseFrames(exercise.animationFrames),
    ...parseExerciseFrames(exercise.animation_frames),
  ];

  if (explicitFrames.length > 0) return explicitFrames;

  const gifUrl = getExerciseGifUrl(exercise);
  if (gifUrl) return [gifUrl];

  return getFramesFromImageUrl(getExerciseImageUrl(exercise));
}

function getLocalizedExerciseName(
  exercise: LocalizedExerciseLike,
  lang: AppLangCode,
) {
  if (lang === "ru") {
    return pickText(exercise.nameRu, exercise.name_ru, exercise.name);
  }

  if (lang === "kk") {
    return pickText(exercise.nameKk, exercise.name_kk, exercise.name);
  }

  return pickText(exercise.name);
}

function findLibraryExercise(exercise: LocalizedExerciseLike) {
  const libraryExerciseId = pickText(
    exercise.libraryExerciseId,
    exercise.library_exercise_id,
  );

  if (libraryExerciseId) {
    const byId = EXERCISE_LIBRARY.find((item: any) => item.id === libraryExerciseId);

    if (byId) return byId;
  }

  const imageUrl = getExerciseImageUrl(exercise);

  if (imageUrl) {
    const byImage = EXERCISE_LIBRARY.find(
      (item) =>
        item.imageUrl === imageUrl ||
        getExerciseAnimationFrames(item).includes(imageUrl),
    );

    if (byImage) return byImage;
  }

  const exerciseName = pickText(exercise.name);

  if (exerciseName) {
    const cleanName = exerciseName.trim().toLowerCase();

    const byName = EXERCISE_LIBRARY.find(
      (item) => item.name.trim().toLowerCase() === cleanName,
    );

    if (byName) return byName;
  }

  return undefined;
}

function ExerciseAnimatedImage({
  frames,
  size = 42,
  radius = 12,
}: {
  frames: string[];
  size?: number;
  radius?: number;
}) {
  const { theme } = useTheme();
  const safeFrames = frames.filter(Boolean);
  const safeFramesKey = safeFrames.join("|");
  const [index, setIndex] = useState<number>(0);

  useEffect(() => {
    setIndex(0);

    if (safeFrames.length <= 1) return;

    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % safeFrames.length);
    }, 650);

    return () => clearInterval(timer);
  }, [safeFramesKey, safeFrames.length]);

  if (safeFrames.length === 0) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: theme.colors.surfaceAlt,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Activity color={theme.colors.textMuted} size={16} />
      </View>
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: "hidden",
        backgroundColor: theme.colors.surfaceAlt,
      }}
    >
      <Image
        source={{ uri: safeFrames[index] }}
        recyclingKey={safeFrames[index]}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
        }}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={120}
      />
    </View>
  );
}

export default function ClientToday() {
  const { theme } = useTheme();
  const { t, lang } = useI18n();
  const currentLang = getLangSafe(lang);
  const { user, token } = useAuth();
  const { db, update, refreshFromBackend } = useData();

  const currentDate = useMemo(() => new Date(), []);
  const today = useMemo(() => toLocalYMD(currentDate), [currentDate]);
  const todayDay = useMemo(() => getLocalDayKey(currentDate), [currentDate]);

  const [savingSuppKey, setSavingSuppKey] = useState<string | null>(null);

  const data = useMemo(() => {
    if (!db || !user) return null;

    const profile = db.clientProfiles.find((client) => client.userId === user.id);

    const workouts = db.workouts
      .filter((workout) => workout.clientId === user.id && workout.date === today)
      .slice()
      .sort((a, b) => {
        const at = a.time || "99:99";
        const bt = b.time || "99:99";
        return at.localeCompare(bt);
      });

    const exercisesByWorkout = workouts.reduce(
      (acc, workout) => {
        acc[workout.id] = db.exercises.filter(
          (exercise) => exercise.workoutId === workout.id,
        );

        return acc;
      },
      {} as Record<string, typeof db.exercises>,
    );

    const streak = db.streaks.find((item) => item.clientId === user.id);
    const weekly = db.weeklyGoals.find((item) => item.clientId === user.id);
    const plan = db.supplementPlans.find((item) => item.clientId === user.id);

    const allSupps = plan
      ? db.supplementItems.filter((item) => item.planId === plan.id)
      : [];

    const supps = allSupps.filter((item) =>
      isSupplementActiveForDay(item, todayDay),
    );

    const logsToday = db.supplementLogs.filter(
      (item) => item.clientId === user.id && item.date === today,
    );

    return {
      profile,
      workouts,
      exercisesByWorkout,
      streak,
      weekly,
      allSupps,
      supps,
      logsToday,
    };
  }, [db, user, today, todayDay]);

  if (!db || !user || !data) return null;

  const avatarUri = toAbsoluteUrl(user.avatarUrl);

  const toggleSupp = async (suppId: string, time: string) => {
    if (!user || !token) {
      Alert.alert(getAuthErrorTitle(currentLang), getLoginAgainText(currentLang));
      return;
    }

    const key = `${suppId}_${time}`;

    if (savingSuppKey) return;

    const existing = data.logsToday.find(
      (log) =>
        log.clientId === user.id &&
        log.supplementItemId === suppId &&
        log.date === today &&
        log.time === time,
    );

    const nextTaken = existing ? !existing.taken : true;

    try {
      setSavingSuppKey(key);

      const saved = await apiPost(
        "/supplements/logs",
        {
          supplement_item_id: suppId,
          date: today,
          time,
          taken: nextTaken,
        },
        { token },
      );

      update((currentData) => {
        const found = currentData.supplementLogs.find(
          (log) =>
            log.clientId === user.id &&
            log.supplementItemId === suppId &&
            log.date === today &&
            log.time === time,
        );

        if (found) {
          return {
            ...currentData,
            supplementLogs: currentData.supplementLogs.map((log) =>
              log.id === found.id
                ? {
                    ...log,
                    id: saved.id ?? log.id,
                    clientId: saved.clientId ?? saved.client_id ?? user.id,
                    supplementItemId:
                      saved.supplementItemId ??
                      saved.supplement_item_id ??
                      suppId,
                    date: saved.date ?? today,
                    time: saved.time ?? time,
                    taken: Boolean(saved.taken),
                  }
                : log,
            ),
          };
        }

        return {
          ...currentData,
          supplementLogs: [
            ...currentData.supplementLogs,
            {
              id:
                saved.id ??
                `sl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              clientId: saved.clientId ?? saved.client_id ?? user.id,
              supplementItemId:
                saved.supplementItemId ?? saved.supplement_item_id ?? suppId,
              date: saved.date ?? today,
              time: saved.time ?? time,
              taken: Boolean(saved.taken),
            },
          ],
        };
      });

      await refreshFromBackend();
    } catch (e: any) {
      console.log("[today] supplement log save error", e);

      Alert.alert(
        getSupplementErrorTitle(currentLang),
        e?.message || getSupplementErrorText(currentLang),
      );
    } finally {
      setSavingSuppKey(null);
    }
  };

  const weeklyProgress = data.weekly
    ? Math.min(
        1,
        data.weekly.completedMinutes / Math.max(1, data.weekly.targetMinutes),
      )
    : 0;

  const completedWorkoutCount = data.workouts.filter(
    (workout) => workout.completed,
  ).length;

  const totalWorkoutCount = data.workouts.length;

  return (
    <ScreenContainer scroll padded={false}>
      <GradientHeader height={250}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 6,
          }}
        >
          <View>
            <AppText variant="small" color="rgba(255,255,255,0.7)">
              {t("today.today")}
            </AppText>

            <AppText variant="title" color="#fff">
              {t("today.hey", { name: user.name.split(" ")[0] })}
            </AppText>

            <AppText
              variant="caption"
              color="rgba(255,255,255,0.72)"
              style={{ marginTop: 4 }}
            >
              {formatTodayLabel(currentDate, currentLang)}
            </AppText>
          </View>

          <AppAvatar uri={avatarUri} name={user.name} size={48} />
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 18,
            gap: 14,
          }}
        >
          <ProgressRing
            size={120}
            stroke={12}
            progress={weeklyProgress}
            label={`${Math.round(weeklyProgress * 100)}%`}
            sublabel={t("today.week")}
            color="#fff"
          />

          <View style={{ flex: 1, gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Flame color="#FF7A1A" size={18} fill="#FF7A1A" />

              <AppText variant="bodyStrong" color="#fff">
                {t("today.streakDays", {
                  n: data.streak?.currentStreak ?? 0,
                })}
              </AppText>
            </View>

            <AppText variant="small" color="rgba(255,255,255,0.8)">
              {t("today.bestDays", { n: data.streak?.bestStreak ?? 0 })}
            </AppText>

            {data.weekly ? (
              <AppText variant="small" color="rgba(255,255,255,0.8)">
                {data.weekly.completedMinutes}/{data.weekly.targetMinutes}{" "}
                {t("common.minutes")} · {data.weekly.completedWorkouts}/
                {data.weekly.targetWorkouts} {t("common.workouts")}
              </AppText>
            ) : null}

            {totalWorkoutCount > 0 ? (
              <View
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.14)",
                  alignSelf: "flex-start",
                }}
              >
                <AppText
                  variant="caption"
                  color="#fff"
                  style={{ fontWeight: "800" }}
                >
                  {completedWorkoutCount}/{totalWorkoutCount}{" "}
                  {t("common.workouts")}
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
      </GradientHeader>

      <View style={{ paddingHorizontal: 20, marginTop: 16, gap: 12 }}>
        <SectionHeader
          title={t("workouts.todays")}
          icon={<Activity color={theme.colors.primary} size={18} />}
        />

        {data.workouts.length > 0 ? (
          <View style={{ gap: 12 }}>
            {data.workouts.map((workout) => {
              const exercises = data.exercisesByWorkout[workout.id] ?? [];

              const previewExercises = exercises.slice(0, 2);
              const hiddenExerciseCount = Math.max(exercises.length - 2, 0);

              return (
                <Pressable
                  key={workout.id}
                  onPress={() => router.push(`/workout/${workout.id}`)}
                >
                  <AppCard variant="elevated">
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <AppText variant="h3" numberOfLines={1}>
                          {getLocalizedWorkoutName(workout, currentLang)}
                        </AppText>

                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            marginTop: 4,
                          }}
                        >
                          <Clock3 color={theme.colors.textMuted} size={14} />

                          <AppText
                            variant="small"
                            color={theme.colors.textMuted}
                            numberOfLines={1}
                            style={{ flex: 1 }}
                          >
                            {workout.time ? `${workout.time} · ` : ""}
                            {exercises.length}{" "}
                            {t("workouts.exercises").toLowerCase()} ·{" "}
                            {workout.durationMinutes ?? 0}
                            {t("common.minutes")}
                            {workout.source === "weekly_template"
                              ? ` · ${getLocalizedWeeklyPlanTitle(
                                  workout,
                                  currentLang,
                                )}`
                              : ""}
                          </AppText>
                        </View>

                        {previewExercises.length > 0 ? (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 8,
                              marginTop: 10,
                              flexWrap: "nowrap",
                              paddingRight: 4,
                            }}
                          >
                            {previewExercises.map((exercise) => {
                              const libraryExercise = findLibraryExercise(exercise);
                              const frames = libraryExercise
                                ? getExerciseAnimationFrames(libraryExercise)
                                : getExerciseFrames(exercise);

                              const translatedName = libraryExercise
                                ? getExerciseName(libraryExercise, currentLang)
                                : getLocalizedExerciseName(exercise, currentLang);

                              return (
                                <View
                                  key={exercise.id}
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 6,
                                    flex: 1,
                                    minWidth: 0,
                                    maxWidth: 112,
                                  }}
                                >
                                  <ExerciseAnimatedImage
                                    frames={frames}
                                    size={34}
                                    radius={10}
                                  />

                                  <AppText
                                    variant="caption"
                                    color={theme.colors.textMuted}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                    style={{ flex: 1, minWidth: 0 }}
                                  >
                                    {translatedName}
                                  </AppText>
                                </View>
                              );
                            })}
                          </View>
                        ) : null}

                        {hiddenExerciseCount > 0 ? (
                          <AppText
                            variant="caption"
                            color={theme.colors.textFaint}
                            style={{ marginTop: 6 }}
                            numberOfLines={1}
                          >
                            +{getMoreLabel(hiddenExerciseCount, currentLang)}
                          </AppText>
                        ) : null}
                      </View>

                      <View
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 26,
                          backgroundColor: workout.completed
                            ? theme.colors.success
                            : theme.colors.primary,
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {workout.completed ? (
                          <CheckCircle2 color="#fff" size={24} />
                        ) : (
                          <Play color="#fff" size={24} fill="#fff" />
                        )}
                      </View>
                    </View>
                  </AppCard>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <AppCard variant="outline">
            <AppText variant="small" color={theme.colors.textMuted}>
              {t("workouts.noToday")}
            </AppText>
          </AppCard>
        )}

        <SectionHeader
          title={t("supps.title")}
          icon={<Pill color={theme.colors.accent} size={18} />}
        />

        {data.allSupps.length > 0 ? (
          <AppText variant="caption" color={theme.colors.textMuted}>
            {getTodaySupplementsHint(todayDay, currentLang)}
          </AppText>
        ) : null}

        {data.supps.length === 0 ? (
          <AppCard variant="outline">
            <AppText variant="small" color={theme.colors.textMuted}>
              {data.allSupps.length > 0
                ? getNoSupplementsTodayText(currentLang)
                : t("supps.none")}
            </AppText>
          </AppCard>
        ) : (
          <AppCard padded={false} variant="outline">
            {data.supps.flatMap((supplement) =>
              supplement.specificTimes.map((time) => {
                const log = data.logsToday.find(
                  (item) =>
                    item.supplementItemId === supplement.id && item.time === time,
                );

                const taken = log?.taken === true;
                const key = `${supplement.id}_${time}`;
                const isSaving = savingSuppKey === key;

                return (
                  <Pressable
                    key={`${supplement.id}-${time}`}
                    onPress={() => toggleSupp(supplement.id, time)}
                    disabled={!!savingSuppKey}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderTopWidth: 1,
                      borderTopColor: theme.colors.borderSoft,
                      gap: 12,
                      opacity: isSaving ? 0.55 : 1,
                    }}
                  >
                    {taken ? (
                      <CheckCircle2 size={22} color={theme.colors.success} />
                    ) : (
                      <Circle size={22} color={theme.colors.textFaint} />
                    )}

                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyStrong">{supplement.name}</AppText>

                      <AppText variant="small" color={theme.colors.textMuted}>
                        {supplement.dosage} · {time}
                      </AppText>

                      <AppText variant="caption" color={theme.colors.textFaint}>
                        {formatActiveDays(supplement, currentLang)}
                      </AppText>
                    </View>

                    {isSaving ? (
                      <AppText variant="caption" color={theme.colors.textMuted}>
                        {t("common.loading")}
                      </AppText>
                    ) : null}
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
              <AppText
                variant="small"
                color={theme.colors.primary}
                style={{ fontWeight: "700" }}
              >
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
                  {t("today.target")} {data.weekly.targetMinutes}{" "}
                  {t("common.minutes")}
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