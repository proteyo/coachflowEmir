import { Image } from "expo-image";
import { router } from "expo-router";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Dumbbell,
  Pill,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
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
import {
  EXERCISE_LIBRARY,
  getExerciseAnimationFrames,
  getExerciseName,
  MuscleGroup,
} from "@/src/data/exerciseLibrary";
import { useI18n } from "@/src/i18n/I18nContext";

type DayKey = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
type AppLangCode = "en" | "ru" | "kk";

const DAY_KEYS: DayKey[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ALL_DAYS: DayKey[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const LOCAL_TEXT = {
  en: {
    workout: "Workout",
    workouts: "workouts",
    workoutSingular: "workout",
    workoutPlural: "workouts",
    exercisePlural: "exercises",
    moreExercises: "more exercises",
    showingSupplementsFor: "Showing supplements scheduled for",
    everyDay: "Every day",
    noSupplementsForToday: "No supplements scheduled for this day.",
    weekDays: {
      Mon: "MON",
      Tue: "TUE",
      Wed: "WED",
      Thu: "THU",
      Fri: "FRI",
      Sat: "SAT",
      Sun: "SUN",
    },
    dayNames: {
      Mon: "Monday",
      Tue: "Tuesday",
      Wed: "Wednesday",
      Thu: "Thursday",
      Fri: "Friday",
      Sat: "Saturday",
      Sun: "Sunday",
    },
  },
  ru: {
    workout: "Тренировка",
    workouts: "тренировок",
    workoutSingular: "тренировка",
    workoutPlural: "тренировки",
    exercisePlural: "упражнений",
    moreExercises: "ещё упражнений",
    showingSupplementsFor: "Показаны добавки на",
    everyDay: "Каждый день",
    noSupplementsForToday: "На этот день добавки не запланированы.",
    weekDays: {
      Mon: "ПН",
      Tue: "ВТ",
      Wed: "СР",
      Thu: "ЧТ",
      Fri: "ПТ",
      Sat: "СБ",
      Sun: "ВС",
    },
    dayNames: {
      Mon: "понедельник",
      Tue: "вторник",
      Wed: "среду",
      Thu: "четверг",
      Fri: "пятницу",
      Sat: "субботу",
      Sun: "воскресенье",
    },
  },
  kk: {
    workout: "Жаттығу",
    workouts: "жаттығу",
    workoutSingular: "жаттығу",
    workoutPlural: "жаттығу",
    exercisePlural: "жаттығу",
    moreExercises: "қосымша жаттығу",
    showingSupplementsFor: "Қоспалар көрсетілген күн:",
    everyDay: "Күн сайын",
    noSupplementsForToday: "Бұл күнге қоспалар жоспарланбаған.",
    weekDays: {
      Mon: "ДС",
      Tue: "СС",
      Wed: "СР",
      Thu: "БС",
      Fri: "ЖМ",
      Sat: "СБ",
      Sun: "ЖК",
    },
    dayNames: {
      Mon: "дүйсенбі",
      Tue: "сейсенбі",
      Wed: "сәрсенбі",
      Thu: "бейсенбі",
      Fri: "жұма",
      Sat: "сенбі",
      Sun: "жексенбі",
    },
  },
};

function getLangSafe(lang: string): AppLangCode {
  if (lang === "ru" || lang === "kk" || lang === "en") return lang;
  return "en";
}

function toLocalYMD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function getLocalDayKey(date: Date): DayKey {
  return DAY_KEYS[date.getDay()];
}

function parseLocalYMD(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
  const safeMonth = Number.isFinite(month) ? month : new Date().getMonth() + 1;
  const safeDay = Number.isFinite(day) ? day : new Date().getDate();

  return new Date(safeYear, safeMonth - 1, safeDay, 12, 0, 0, 0);
}

function getWeekStart(date: Date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function addDays(date: Date, amount: number) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + amount);
  return d;
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

function isSupplementForDay(item: any, day: DayKey) {
  const days = normalizeDays(item.daysOfWeek ?? item.days_of_week);
  return days.includes(day);
}

function formatWeekLabel(date: Date, lang: AppLangCode) {
  const locale = lang === "ru" ? "ru-RU" : lang === "kk" ? "kk-KZ" : "en-US";

  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
}

function formatSelectedDate(value: string, lang: AppLangCode) {
  const locale = lang === "ru" ? "ru-RU" : lang === "kk" ? "kk-KZ" : "en-US";

  return parseLocalYMD(value).toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getPluralWorkoutText(count: number, lang: AppLangCode) {
  if (lang === "ru") {
    const mod10 = count % 10;
    const mod100 = count % 100;

    if (mod10 === 1 && mod100 !== 11) return "тренировка";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return "тренировки";
    }

    return "тренировок";
  }

  if (lang === "kk") return "жаттығу";

  return count === 1 ? "workout" : "workouts";
}

function getExerciseLibraryItem(exercise: any) {
  const name = String(exercise?.name ?? "").trim().toLowerCase();
  const imageUrl = String(exercise?.imageUrl ?? "");

  return (
    EXERCISE_LIBRARY.find((item) => item.id === exercise?.libId) ??
    EXERCISE_LIBRARY.find(
      (item) => item.name.trim().toLowerCase() === name,
    ) ??
    EXERCISE_LIBRARY.find((item) => item.imageUrl === imageUrl) ??
    undefined
  );
}

function getTranslatedExerciseName(exercise: any, lang: AppLangCode) {
  const libraryItem = getExerciseLibraryItem(exercise);

  if (libraryItem) {
    return getExerciseName(libraryItem, lang);
  }

  return exercise?.name ?? "";
}

function getExerciseFrames(exercise: any) {
  const libraryItem = getExerciseLibraryItem(exercise);

  if (libraryItem) {
    return getExerciseAnimationFrames(libraryItem);
  }

  const imageUrl = exercise?.imageUrl;

  if (!imageUrl) return [];

  if (typeof imageUrl === "string" && imageUrl.includes("/0.jpg")) {
    return [imageUrl, imageUrl.replace("/0.jpg", "/1.jpg")];
  }

  return [imageUrl];
}

function ExerciseAnimatedImage({
  frames,
  size = 44,
  radius = 12,
}: {
  frames: string[];
  size?: number;
  radius?: number;
}) {
  const { theme } = useTheme();
  const safeFrames = frames.filter(Boolean);
  const [index, setIndex] = useState<number>(0);

  useEffect(() => {
    setIndex(0);

    if (safeFrames.length <= 1) return;

    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % safeFrames.length);
    }, 650);

    return () => clearInterval(timer);
  }, [safeFrames.join("|")]);

  if (safeFrames.length === 0) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: "rgba(22,199,132,0.14)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Dumbbell color={theme.colors.primary} size={20} />
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

export default function ClientSchedule() {
  const { theme } = useTheme();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { db } = useData();

  const currentLang = getLangSafe(lang);
  const localText = LOCAL_TEXT[currentLang];

  const today = useMemo(() => new Date(), []);
  const [selected, setSelected] = useState<string>(toLocalYMD(today));
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(today));

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const selectedDate = useMemo(() => parseLocalYMD(selected), [selected]);

  const selectedDayKey = useMemo(
    () => getLocalDayKey(selectedDate),
    [selectedDate],
  );

  const selectedWorkouts = useMemo(() => {
    if (!db || !user) return [];

    return db.workouts
      .filter((workout) => workout.clientId === user.id && workout.date === selected)
      .slice()
      .sort((a, b) => {
        const at = a.time || "99:99";
        const bt = b.time || "99:99";

        return at.localeCompare(bt);
      });
  }, [db, user, selected]);

  const exercisesByWorkout = useMemo(() => {
    if (!db) return {};

    const map: Record<string, typeof db.exercises> = {};

    selectedWorkouts.forEach((workout) => {
      map[workout.id] = db.exercises.filter(
        (exercise) => exercise.workoutId === workout.id,
      );
    });

    return map;
  }, [db, selectedWorkouts]);

  const selectedSupplements = useMemo(() => {
    if (!db || !user) return [];

    const plan = db.supplementPlans.find((item) => item.clientId === user.id);

    if (!plan) return [];

    return db.supplementItems
      .filter((item) => item.planId === plan.id)
      .filter((item) => isSupplementForDay(item, selectedDayKey));
  }, [db, user, selectedDayKey]);

  const hasWorkoutOnDay = (dateKey: string) => {
    return Boolean(
      db?.workouts.some(
        (workout) => workout.clientId === user?.id && workout.date === dateKey,
      ),
    );
  };

  const hasSupplementsOnDay = (date: Date) => {
    if (!db || !user) return false;

    const dayKey = getLocalDayKey(date);
    const plan = db.supplementPlans.find((item) => item.clientId === user.id);

    if (!plan) return false;

    return db.supplementItems
      .filter((item) => item.planId === plan.id)
      .some((item) => isSupplementForDay(item, dayKey));
  };

  const selectedDateText = formatSelectedDate(selected, currentLang);

  return (
    <ScreenContainer scroll>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 4,
          marginBottom: 14,
        }}
      >
        <Pressable
          onPress={() => {
            const newWeekStart = addDays(weekStart, -7);
            setWeekStart(newWeekStart);
            setSelected(toLocalYMD(newWeekStart));
          }}
          hitSlop={10}
        >
          <ChevronLeft color={theme.colors.text} size={24} />
        </Pressable>

        <View style={{ alignItems: "center" }}>
          <AppText variant="h3">
            {t("schedule.weekOf", {
              label: formatWeekLabel(weekStart, currentLang),
            })}
          </AppText>

          <AppText variant="caption" color={theme.colors.textMuted}>
            {selectedDateText}
          </AppText>
        </View>

        <Pressable
          onPress={() => {
            const newWeekStart = addDays(weekStart, 7);
            setWeekStart(newWeekStart);
            setSelected(toLocalYMD(newWeekStart));
          }}
          hitSlop={10}
        >
          <ChevronRight color={theme.colors.text} size={24} />
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        {days.map((date) => {
          const key = toLocalYMD(date);
          const dayKey = getLocalDayKey(date);
          const isSelected = selected === key;
          const hasWorkout = hasWorkoutOnDay(key);
          const hasSupps = hasSupplementsOnDay(date);

          return (
            <Pressable
              key={key}
              onPress={() => setSelected(key)}
              style={{
                flex: 1,
                minHeight: 72,
                paddingVertical: 10,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isSelected
                  ? theme.colors.primary
                  : theme.colors.surface,
                borderWidth: 1,
                borderColor: isSelected
                  ? theme.colors.primary
                  : theme.colors.border,
              }}
            >
              <AppText
                variant="caption"
                color={
                  isSelected
                    ? theme.colors.primaryContrast
                    : theme.colors.textMuted
                }
                style={{ fontWeight: "800" }}
              >
                {localText.weekDays[dayKey]}
              </AppText>

              <AppText
                variant="bodyStrong"
                color={
                  isSelected ? theme.colors.primaryContrast : theme.colors.text
                }
                style={{ marginTop: 4 }}
              >
                {date.getDate()}
              </AppText>

              <View
                style={{
                  flexDirection: "row",
                  gap: 3,
                  marginTop: 6,
                  height: 6,
                }}
              >
                {hasWorkout ? (
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: isSelected
                        ? "#fff"
                        : theme.colors.primary,
                    }}
                  />
                ) : null}

                {hasSupps ? (
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: isSelected
                        ? "rgba(255,255,255,0.75)"
                        : theme.colors.accent,
                    }}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: 22, gap: 16 }}>
        <View>
          <AppText variant="h3">{t("schedule.workout")}</AppText>

          <AppText
            variant="small"
            color={theme.colors.textMuted}
            style={{ marginTop: 4 }}
          >
            {selectedWorkouts.length > 0
              ? `${selectedWorkouts.length} ${getPluralWorkoutText(
                  selectedWorkouts.length,
                  currentLang,
                )} · ${selectedDateText}`
              : selectedDateText}
          </AppText>
        </View>

        {selectedWorkouts.length > 0 ? (
          <View style={{ gap: 12 }}>
            {selectedWorkouts.map((workout) => {
              const exercises = exercisesByWorkout[workout.id] ?? [];

              return (
                <Pressable
                  key={workout.id}
                  onPress={() => router.push(`/workout/${workout.id}`)}
                >
                  <AppCard variant="elevated">
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 14,
                          backgroundColor: "rgba(22,199,132,0.14)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Dumbbell color={theme.colors.primary} size={22} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <AppText variant="bodyStrong">{workout.name}</AppText>

                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            marginTop: 3,
                          }}
                        >
                          <Clock3 color={theme.colors.textMuted} size={14} />

                          <AppText variant="small" color={theme.colors.textMuted}>
                            {workout.time ? `${workout.time} · ` : ""}
                            {exercises.length}{" "}
                            {t("workouts.exercises").toLowerCase()} ·{" "}
                            {workout.durationMinutes ?? 0}
                            {t("common.minutes")}
                          </AppText>
                        </View>
                      </View>
                    </View>

                    {exercises.length > 0 ? (
                      <View style={{ marginTop: 12, gap: 8 }}>
                        {exercises.slice(0, 4).map((exercise) => {
                          const translatedName = getTranslatedExerciseName(
                            exercise,
                            currentLang,
                          );

                          const frames = getExerciseFrames(exercise);

                          return (
                            <View
                              key={exercise.id}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 10,
                              }}
                            >
                              <ExerciseAnimatedImage
                                frames={frames}
                                size={42}
                                radius={12}
                              />

                              <View style={{ flex: 1 }}>
                                <AppText
                                  variant="small"
                                  color={theme.colors.text}
                                  style={{ fontWeight: "700" }}
                                  numberOfLines={1}
                                >
                                  {translatedName}
                                </AppText>

                                <AppText
                                  variant="caption"
                                  color={theme.colors.textMuted}
                                >
                                  {exercise.sets}×{exercise.reps}
                                  {exercise.weight
                                    ? ` · ${exercise.weight}${t("common.kg")}`
                                    : ""}
                                </AppText>
                              </View>
                            </View>
                          );
                        })}

                        {exercises.length > 4 ? (
                          <AppText variant="caption" color={theme.colors.textMuted}>
                            +{exercises.length - 4} {localText.moreExercises}
                          </AppText>
                        ) : null}
                      </View>
                    ) : null}
                  </AppCard>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <AppCard variant="outline">
            <AppEmptyState
              title={t("workouts.restDay")}
              message={t("workouts.noWorkout")}
            />
          </AppCard>
        )}

        <View>
          <AppText variant="h3">{t("schedule.supplements")}</AppText>

          <AppText
            variant="small"
            color={theme.colors.textMuted}
            style={{ marginTop: 4 }}
          >
            {localText.showingSupplementsFor} {localText.dayNames[selectedDayKey]}
          </AppText>
        </View>

        {selectedSupplements.length === 0 ? (
          <AppCard variant="outline">
            <AppText variant="small" color={theme.colors.textMuted}>
              {localText.noSupplementsForToday}
            </AppText>
          </AppCard>
        ) : (
          <AppCard padded={false} variant="outline">
            {selectedSupplements.map((supplement, index) => (
              <View
                key={supplement.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: theme.colors.borderSoft,
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 13,
                    backgroundColor: "rgba(139,92,246,0.14)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Pill color={theme.colors.accent} size={18} />
                </View>

                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">{supplement.name}</AppText>

                  <AppText variant="small" color={theme.colors.textMuted}>
                    {supplement.dosage} · {supplement.specificTimes.join(", ")}
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