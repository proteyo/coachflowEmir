import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  Activity,
  CheckCircle2,
  Pause,
  Play,
  Square,
  Timer,
  Weight,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import {
  AppButton,
  AppCard,
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
import { apiPatch, apiPost } from "@/src/services/api";
import SubscriptionGate from "@/src/components/SubscriptionGate";

type SetResultInput = {
  weight: string;
  reps: string;
};

type ExerciseResultDraft = Record<string, SetResultInput[]>;

type WorkoutSessionState = {
  seconds: number;
  doneSet: Record<string, number>;
  resultDraft: ExerciseResultDraft;
  running: boolean;
  startedAt?: string;
  completed: boolean;
  savedAt: string;
};

type WorkoutExerciseLike = {
  id: string;
  sets: number;
  reps: number;
  restSeconds?: number;
  weight?: number;
  name?: string;
  muscleGroup?: string;
  imageUrl?: string;
};

const BODYWEIGHT_KEYWORDS = [
  "pushup",
  "push-up",
  "pullup",
  "pull-up",
  "chin-up",
  "chin up",
  "dip",
  "dips",
  "plank",
  "crunch",
  "sit-up",
  "sit up",
  "air bike",
  "mountain climber",
  "jump",
  "rope",
  "running",
  "treadmill",
  "cycling",
  "bicycling",
  "elliptical",
  "stretch",
  "mobility",
  "cat",
  "child",
  "hamstring",
  "cobra",
  "bodyweight",
];

const WEIGHTED_KEYWORDS = [
  "barbell",
  "dumbbell",
  "bench press",
  "deadlift",
  "squat",
  "leg press",
  "curl",
  "pulldown",
  "machine",
  "cable",
  "press",
  "extension",
  "raise",
  "thrust",
  "shrug",
];

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;

  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function toLocalYMD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function getSessionKey(workoutId: string) {
  return `coachflow:workout-session:${workoutId}`;
}

function cleanExerciseName(name?: string) {
  return (name ?? "").trim().toLowerCase();
}

function shouldRequireWeight(exercise: WorkoutExerciseLike) {
  const name = cleanExerciseName(exercise.name);
  const group = (exercise.muscleGroup ?? "").toLowerCase();

  if (
    exercise.weight !== undefined &&
    exercise.weight !== null &&
    exercise.weight > 0
  ) {
    return true;
  }

  if (group === "cardio" || group === "stretching") {
    return false;
  }

  if (BODYWEIGHT_KEYWORDS.some((key) => name.includes(key))) {
    return false;
  }

  if (WEIGHTED_KEYWORDS.some((key) => name.includes(key))) {
    return true;
  }

  return !["abs", "core"].includes(group);
}

function buildCompletedDoneSet(exercises: { id: string; sets: number }[]) {
  const completedDoneSet: Record<string, number> = {};

  exercises.forEach((exercise) => {
    completedDoneSet[exercise.id] = exercise.sets;
  });

  return completedDoneSet;
}

function buildDefaultResultDraft(
  exercises: WorkoutExerciseLike[],
): ExerciseResultDraft {
  const draft: ExerciseResultDraft = {};

  exercises.forEach((exercise) => {
    const weighted = shouldRequireWeight(exercise);

    draft[exercise.id] = Array.from({ length: exercise.sets }).map(() => ({
      weight:
        weighted &&
        exercise.weight !== undefined &&
        exercise.weight !== null &&
        exercise.weight > 0
          ? String(exercise.weight)
          : "",
      reps: String(exercise.reps || 10),
    }));
  });

  return draft;
}

function normalizeResultDraft(
  current: ExerciseResultDraft,
  exercises: WorkoutExerciseLike[],
): ExerciseResultDraft {
  const next: ExerciseResultDraft = {};

  exercises.forEach((exercise) => {
    const weighted = shouldRequireWeight(exercise);
    const oldRows = current[exercise.id] ?? [];

    next[exercise.id] = Array.from({ length: exercise.sets }).map(
      (_, index) => {
        const old = oldRows[index];

        return {
          weight:
            old?.weight ??
            (weighted &&
            exercise.weight !== undefined &&
            exercise.weight !== null &&
            exercise.weight > 0
              ? String(exercise.weight)
              : ""),
          reps: old?.reps ?? String(exercise.reps || 10),
        };
      },
    );
  });

  return next;
}

function calculateSavedSeconds(session: WorkoutSessionState) {
  if (!session.running || !session.startedAt) {
    return session.seconds ?? 0;
  }

  const startedTime = new Date(session.startedAt).getTime();

  if (Number.isNaN(startedTime)) {
    return session.seconds ?? 0;
  }

  const elapsed = Math.floor((Date.now() - startedTime) / 1000);

  return (session.seconds ?? 0) + Math.max(0, elapsed);
}

function parseNumber(value: string) {
  const normalized = value.replace(",", ".").trim();
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function hasValidWeight(value: string) {
  const parsed = parseNumber(value);
  return parsed !== undefined && parsed > 0;
}

function hasValidReps(value: string) {
  const parsed = parseNumber(value);
  return parsed !== undefined && Math.round(parsed) > 0;
}

function getFramesFromImageUrl(imageUrl?: string): string[] {
  if (!imageUrl) return [];

  if (imageUrl.includes("/0.jpg")) {
    return [imageUrl, imageUrl.replace("/0.jpg", "/1.jpg")];
  }

  return [imageUrl];
}

function findLibraryExercise(exercise: WorkoutExerciseLike) {
  if (exercise.imageUrl) {
    const byImage = EXERCISE_LIBRARY.find(
      (item) =>
        item.imageUrl === exercise.imageUrl ||
        getExerciseAnimationFrames(item).includes(exercise.imageUrl ?? ""),
    );

    if (byImage) return byImage;
  }

  if (exercise.name) {
    const cleanName = exercise.name.trim().toLowerCase();

    const byName = EXERCISE_LIBRARY.find(
      (item) => item.name.trim().toLowerCase() === cleanName,
    );

    if (byName) return byName;
  }

  return undefined;
}

function getMuscleGroupLabel(group: string | undefined, t: (key: any) => string) {
  if (!group) return "";

  if (group === "Chest") return t("exerciseLib.chest");
  if (group === "Back") return t("exerciseLib.back");
  if (group === "Legs") return t("exerciseLib.legs");
  if (group === "Glutes") return t("exerciseLib.glutes");
  if (group === "Shoulders") return t("exerciseLib.shoulders");
  if (group === "Biceps") return t("exerciseLib.biceps");
  if (group === "Triceps") return t("exerciseLib.triceps");
  if (group === "Abs") return t("exerciseLib.abs");
  if (group === "Cardio") return t("exerciseLib.cardio");
  if (group === "Stretching") return t("exerciseLib.stretching");

  return group;
}

function getLocalText(
  lang: string,
  values: {
    en: string;
    ru: string;
    kk: string;
  },
) {
  if (lang === "ru") return values.ru;
  if (lang === "kk") return values.kk;

  return values.en;
}

function ExerciseAnimatedImage({
  frames,
  height = 150,
}: {
  frames: string[];
  height?: number;
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
          height,
          width: "100%",
          backgroundColor: theme.colors.surfaceAlt,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Activity color={theme.colors.textMuted} size={28} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: safeFrames[index] }}
      recyclingKey={safeFrames[index]}
      style={{
        height,
        width: "100%",
        backgroundColor: theme.colors.surfaceAlt,
      }}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={120}
    />
  );
}

export default function WorkoutPlayer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workoutId = String(id ?? "");

  const { theme } = useTheme();
  const { t, lang } = useI18n();
  const { user, token } = useAuth();
  const { db, update, refreshFromBackend } = useData();

  const [seconds, setSeconds] = useState<number>(0);
  const [running, setRunning] = useState<boolean>(false);
  const [startedAt, setStartedAt] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState<boolean>(false);
  const [doneSet, setDoneSet] = useState<Record<string, number>>({});
  const [resultDraft, setResultDraft] = useState<ExerciseResultDraft>({});
  const [hydrated, setHydrated] = useState<boolean>(false);

  const workout = useMemo(
    () => db?.workouts.find((item) => item.id === workoutId),
    [db, workoutId],
  );

  const exercises = useMemo(
    () =>
      workout
        ? db?.exercises.filter((item) => item.workoutId === workout.id) ?? []
        : [],
    [db, workout],
  );

  const isCompleted = Boolean(workout?.completed);

  const totalSets = exercises.reduce((acc, exercise) => acc + exercise.sets, 0);
  const completedSets = Object.values(doneSet).reduce((a, b) => a + b, 0);
  const progress = totalSets ? completedSets / totalSets : 0;

  const text = {
    workoutError: getLocalText(lang, {
      en: "Workout error",
      ru: "Ошибка тренировки",
      kk: "Жаттығу қатесі",
    }),
    noExercises: getLocalText(lang, {
      en: "This workout has no exercises.",
      ru: "В этой тренировке нет упражнений.",
      kk: "Бұл жаттығуда жаттығулар жоқ.",
    }),
    setsNotCompleted: getLocalText(lang, {
      en: "Sets not completed",
      ru: "Подходы не завершены",
      kk: "Сеттер аяқталмаған",
    }),
    markAllSets: getLocalText(lang, {
      en: `Please mark all sets as completed before finishing. Completed ${completedSets}/${totalSets}.`,
      ru: `Перед завершением отметьте все подходы. Выполнено ${completedSets}/${totalSets}.`,
      kk: `Аяқтамас бұрын барлық сеттерді белгілеңіз. Орындалды ${completedSets}/${totalSets}.`,
    }),
    repsRequired: getLocalText(lang, {
      en: "Reps required",
      ru: "Нужны повторы",
      kk: "Қайталау қажет",
    }),
    weightRequired: getLocalText(lang, {
      en: "Weight required",
      ru: "Нужен вес",
      kk: "Салмақ қажет",
    }),
    completedLocked: getLocalText(lang, {
      en: "Workout completed. Results are locked.",
      ru: "Тренировка завершена. Результаты заблокированы.",
      kk: "Жаттығу аяқталды. Нәтижелер бұғатталған.",
    }),
    completeHint: getLocalText(lang, {
      en: "Complete every set and enter valid reps. Weighted exercises require weight.",
      ru: "Выполните каждый подход и укажите повторы. Для упражнений с весом нужен вес.",
      kk: "Әр сетты аяқтап, дұрыс қайталау енгізіңіз. Салмақпен жаттығуларға салмақ керек.",
    }),
    setsCompleted: getLocalText(lang, {
      en: "sets completed",
      ru: "подходов выполнено",
      kk: "сет орындалды",
    }),
    weighted: getLocalText(lang, {
      en: "Weighted",
      ru: "С весом",
      kk: "Салмақпен",
    }),
    bodyweight: getLocalText(lang, {
      en: "Bodyweight",
      ru: "Собственный вес",
      kk: "Өз салмағы",
    }),
    plan: getLocalText(lang, {
      en: "Plan",
      ru: "План",
      kk: "Жоспар",
    }),
    rest: getLocalText(lang, {
      en: "rest",
      ru: "отдых",
      kk: "демалыс",
    }),
    bodyweightHint: getLocalText(lang, {
      en: "This exercise is saved as bodyweight. No kg record will be created.",
      ru: "Это упражнение сохраняется как собственный вес. Запись в кг не создаётся.",
      kk: "Бұл жаттығу өз салмағымен сақталады. Кг жазбасы жасалмайды.",
    }),
    set: getLocalText(lang, {
      en: "Set",
      ru: "Подход",
      kk: "Сет",
    }),
    target: getLocalText(lang, {
      en: "target",
      ru: "цель",
      kk: "мақсат",
    }),
    reps: getLocalText(lang, {
      en: "reps",
      ru: "повт.",
      kk: "қайт.",
    }),
    weightKg: getLocalText(lang, {
      en: "WEIGHT KG",
      ru: "ВЕС КГ",
      kk: "САЛМАҚ КГ",
    }),
    repsUpper: getLocalText(lang, {
      en: "REPS",
      ru: "ПОВТОРЫ",
      kk: "ҚАЙТАЛАУ",
    }),
    exampleWeight: getLocalText(lang, {
      en: "Example: 60",
      ru: "Например: 60",
      kk: "Мысалы: 60",
    }),
    required: getLocalText(lang, {
      en: "Required",
      ru: "Обязательно",
      kk: "Міндетті",
    }),
    finishWorkout: getLocalText(lang, {
      en: "Finish workout",
      ru: "Завершить тренировку",
      kk: "Жаттығуды аяқтау",
    }),
    workoutCompleted: getLocalText(lang, {
      en: "Workout completed",
      ru: "Тренировка завершена",
      kk: "Жаттығу аяқталды",
    }),
    saving: getLocalText(lang, {
      en: "Saving...",
      ru: "Сохранение...",
      kk: "Сақталуда...",
    }),
  };

  useEffect(() => {
    if (!workoutId) return;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(getSessionKey(workoutId));

        if (raw) {
          const saved = JSON.parse(raw) as WorkoutSessionState;
          const restoredSeconds = calculateSavedSeconds(saved);

          setSeconds(restoredSeconds);
          setDoneSet(saved.doneSet ?? {});
          setResultDraft(normalizeResultDraft(saved.resultDraft ?? {}, exercises));

          if (saved.running && !saved.completed && !workout?.completed) {
            setRunning(true);
            setStartedAt(new Date().toISOString());
          } else {
            setRunning(false);
            setStartedAt(undefined);
          }
        } else if (workout?.completed) {
          setSeconds(Math.max(0, (workout.durationMinutes ?? 0) * 60));
          setRunning(false);
          setStartedAt(undefined);
          setDoneSet(buildCompletedDoneSet(exercises));
          setResultDraft(buildDefaultResultDraft(exercises));
        } else {
          setSeconds(0);
          setRunning(false);
          setStartedAt(undefined);
          setDoneSet({});
          setResultDraft(buildDefaultResultDraft(exercises));
        }
      } catch (e) {
        console.log("[workout] load session err", e);
      } finally {
        setHydrated(true);
      }
    })();
  }, [workoutId, workout?.completed, workout?.durationMinutes, exercises]);

  useEffect(() => {
    if (!running || isCompleted) return;

    const timer = setInterval(() => {
      setSeconds((currentSeconds) => currentSeconds + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [running, isCompleted]);

  useEffect(() => {
    if (!isCompleted) return;

    setRunning(false);
    setStartedAt(undefined);

    if (exercises.length > 0) {
      setDoneSet(buildCompletedDoneSet(exercises));
      setResultDraft((current) => normalizeResultDraft(current, exercises));
    }
  }, [isCompleted, exercises]);

  useEffect(() => {
    if (!hydrated || !workoutId) return;

    const session: WorkoutSessionState = {
      seconds,
      doneSet,
      resultDraft,
      running: running && !isCompleted,
      startedAt:
        running && !isCompleted
          ? startedAt ?? new Date().toISOString()
          : undefined,
      completed: isCompleted,
      savedAt: new Date().toISOString(),
    };

    AsyncStorage.setItem(getSessionKey(workoutId), JSON.stringify(session)).catch(
      (e) => console.log("[workout] save session err", e),
    );
  }, [
    seconds,
    doneSet,
    resultDraft,
    running,
    startedAt,
    hydrated,
    workoutId,
    isCompleted,
  ]);

  if (!workout) return null;

  const toggleTimer = () => {
    if (isCompleted || saving) return;

    setRunning((current) => {
      if (current) {
        setStartedAt(undefined);
        return false;
      }

      setStartedAt(new Date().toISOString());
      return true;
    });
  };

  const resetSession = async () => {
    if (isCompleted || saving) return;

    setRunning(false);
    setStartedAt(undefined);
    setSeconds(0);
    setDoneSet({});
    setResultDraft(buildDefaultResultDraft(exercises));

    try {
      await AsyncStorage.removeItem(getSessionKey(workout.id));
    } catch (e) {
      console.log("[workout] reset session err", e);
    }
  };

  const updateSetResult = (
    exerciseId: string,
    setIndex: number,
    field: "weight" | "reps",
    value: string,
  ) => {
    if (isCompleted || saving) return;

    setResultDraft((current) => {
      const exercise = exercises.find((item) => item.id === exerciseId);
      const weighted = exercise ? shouldRequireWeight(exercise) : false;

      const existingRows =
        current[exerciseId] ??
        Array.from({ length: exercise?.sets ?? 0 }).map(() => ({
          weight:
            weighted &&
            exercise?.weight !== undefined &&
            exercise?.weight !== null &&
            exercise.weight > 0
              ? String(exercise.weight)
              : "",
          reps: String(exercise?.reps || 10),
        }));

      return {
        ...current,
        [exerciseId]: existingRows.map((row, index) =>
          index === setIndex ? { ...row, [field]: value } : row,
        ),
      };
    });
  };

  const validateBeforeFinish = () => {
    if (exercises.length === 0) {
      Alert.alert(text.workoutError, text.noExercises);
      return false;
    }

    if (completedSets < totalSets) {
      Alert.alert(text.setsNotCompleted, text.markAllSets);
      return false;
    }

    for (const exercise of exercises) {
      const weighted = shouldRequireWeight(exercise);
      const rows = resultDraft[exercise.id] ?? [];
      const libraryExercise = findLibraryExercise(exercise);
      const translatedExerciseName = libraryExercise
        ? getExerciseName(libraryExercise, lang)
        : exercise.name;

      for (let index = 0; index < exercise.sets; index++) {
        const row = rows[index];

        if (!row || !hasValidReps(row.reps)) {
          Alert.alert(
            text.repsRequired,
            `${translatedExerciseName}, ${text.set.toLowerCase()} ${
              index + 1
            }: ${text.reps.toLowerCase()} > 0.`,
          );
          return false;
        }

        if (weighted && !hasValidWeight(row.weight)) {
          Alert.alert(
            text.weightRequired,
            `${translatedExerciseName}, ${text.set.toLowerCase()} ${
              index + 1
            }: ${text.weightRequired.toLowerCase()}.`,
          );
          return false;
        }
      }
    }

    return true;
  };

  const buildExerciseResultsPayload = () => {
    return exercises.flatMap((exercise) => {
      const weighted = shouldRequireWeight(exercise);
      const rows = resultDraft[exercise.id] ?? [];

      return Array.from({ length: exercise.sets }).map((_, index) => {
        const row = rows[index];
        const parsedWeight = parseNumber(row?.weight ?? "");
        const parsedReps = parseNumber(row?.reps ?? "");

        return {
          workout_id: workout.id,
          exercise_id: exercise.id,
          exercise_name: exercise.name,
          muscle_group: exercise.muscleGroup ?? undefined,
          set_number: index + 1,
          target_reps: exercise.reps || 10,
          actual_reps:
            parsedReps !== undefined && parsedReps > 0
              ? Math.round(parsedReps)
              : exercise.reps || 10,
          weight:
            weighted && parsedWeight !== undefined && parsedWeight > 0
              ? parsedWeight
              : undefined,
          notes: undefined,
        };
      });
    });
  };

  const finish = async () => {
    if (!user || !token || saving || isCompleted) return;

    if (!validateBeforeFinish()) return;

    const minutes = Math.max(1, Math.round(seconds / 60));
    const completedDoneSet = buildCompletedDoneSet(exercises);
    const exerciseResults = buildExerciseResultsPayload();

    try {
      setSaving(true);
      setRunning(false);
      setStartedAt(undefined);

      if (exerciseResults.length > 0) {
        try {
          await apiPost(
            "/exercise-results/bulk",
            {
              results: exerciseResults,
            },
            { token },
          );
        } catch (e) {
          console.log("[workout] exercise results save skipped", e);
        }
      }

      await apiPost(`/workouts/${workout.id}/complete`, undefined, { token });

      const currentGoal = db?.weeklyGoals.find(
        (goal) => goal.clientId === user.id,
      );

      if (currentGoal) {
        try {
          await apiPatch(
            `/weekly-goals/${currentGoal.id}`,
            {
              completed_minutes: currentGoal.completedMinutes + minutes,
              completed_workouts: currentGoal.completedWorkouts + 1,
            },
            { token },
          );
        } catch (e) {
          console.log("[workout] weekly goal update skipped", e);
        }
      }

      try {
        await apiPost("/streak/activity", undefined, { token });
      } catch (e) {
        console.log("[workout] streak update skipped", e);
      }

      setDoneSet(completedDoneSet);

      await AsyncStorage.setItem(
        getSessionKey(workout.id),
        JSON.stringify({
          seconds,
          doneSet: completedDoneSet,
          resultDraft,
          running: false,
          startedAt: undefined,
          completed: true,
          savedAt: new Date().toISOString(),
        } satisfies WorkoutSessionState),
      );

      update((currentData) => ({
        ...currentData,
        workouts: currentData.workouts.map((item) =>
          item.id === workout.id
            ? {
                ...item,
                completed: true,
                completedAt: new Date().toISOString(),
                durationMinutes: minutes,
              }
            : item,
        ),
      }));

      await refreshFromBackend();

      router.back();
    } catch (e) {
      console.log("[workout] finish error", e);

      setDoneSet(completedDoneSet);

      await AsyncStorage.setItem(
        getSessionKey(workout.id),
        JSON.stringify({
          seconds,
          doneSet: completedDoneSet,
          resultDraft,
          running: false,
          startedAt: undefined,
          completed: true,
          savedAt: new Date().toISOString(),
        } satisfies WorkoutSessionState),
      );

      update((currentData) => ({
        ...currentData,
        workouts: currentData.workouts.map((item) =>
          item.id === workout.id
            ? {
                ...item,
                completed: true,
                completedAt: new Date().toISOString(),
                durationMinutes: minutes,
              }
            : item,
        ),
        weeklyGoals: currentData.weeklyGoals.map((goal) =>
          user && goal.clientId === user.id
            ? {
                ...goal,
                completedMinutes: goal.completedMinutes + minutes,
                completedWorkouts: goal.completedWorkouts + 1,
              }
            : goal,
        ),
        streaks: currentData.streaks.map((streak) =>
          user && streak.clientId === user.id
            ? {
                ...streak,
                currentStreak: streak.currentStreak + 1,
                bestStreak: Math.max(
                  streak.bestStreak,
                  streak.currentStreak + 1,
                ),
                lastActivityDate: toLocalYMD(new Date()),
              }
            : streak,
        ),
      }));

      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
  <SubscriptionGate>
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
                onPress={toggleTimer}
                disabled={saving || isCompleted}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor:
                    saving || isCompleted
                      ? theme.colors.textMuted
                      : theme.colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: saving || isCompleted ? 0.55 : 1,
                }}
              >
                {running ? (
                  <Pause color={theme.colors.primaryContrast} size={20} />
                ) : (
                  <Play
                    color={theme.colors.primaryContrast}
                    size={20}
                    fill={theme.colors.primaryContrast}
                  />
                )}
              </Pressable>

              <Pressable
                onPress={resetSession}
                disabled={saving || isCompleted}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: theme.colors.surfaceAlt,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: saving || isCompleted ? 0.45 : 1,
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

          <AppText
            variant="small"
            color={theme.colors.textMuted}
            style={{ marginTop: 6 }}
          >
            {completedSets}/{totalSets} {text.setsCompleted}
          </AppText>

          {isCompleted ? (
            <AppText
              variant="small"
              color={theme.colors.success}
              style={{ marginTop: 6 }}
            >
              {text.completedLocked}
            </AppText>
          ) : (
            <AppText
              variant="small"
              color={theme.colors.textMuted}
              style={{ marginTop: 6 }}
            >
              {text.completeHint}
            </AppText>
          )}
        </AppCard>

        <View style={{ marginTop: 14, gap: 12 }}>
          {exercises.map((exercise) => {
            const done = doneSet[exercise.id] ?? 0;
            const rows = resultDraft[exercise.id] ?? [];
            const weighted = shouldRequireWeight(exercise);
            const libraryExercise = findLibraryExercise(exercise);

            const translatedExerciseName = libraryExercise
              ? getExerciseName(libraryExercise, lang)
              : exercise.name;

            const frames = libraryExercise
              ? getExerciseAnimationFrames(libraryExercise)
              : getFramesFromImageUrl(exercise.imageUrl);

            const translatedMuscleGroup = getMuscleGroupLabel(
              exercise.muscleGroup,
              t,
            );

            return (
              <AppCard key={exercise.id} variant="outline" padded={false}>
                <ExerciseAnimatedImage frames={frames} height={150} />

                <View style={{ padding: 14, gap: 8 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <AppText variant="bodyStrong" style={{ flex: 1 }}>
                      {translatedExerciseName}
                    </AppText>

                    <View
                      style={{
                        paddingVertical: 4,
                        paddingHorizontal: 8,
                        borderRadius: 999,
                        backgroundColor: weighted
                          ? "rgba(22,199,132,0.14)"
                          : "rgba(139,92,246,0.14)",
                      }}
                    >
                      <AppText
                        variant="caption"
                        color={weighted ? theme.colors.primary : theme.colors.accent}
                        style={{ fontWeight: "800" }}
                      >
                        {weighted ? text.weighted : text.bodyweight}
                      </AppText>
                    </View>
                  </View>

                  <AppText variant="small" color={theme.colors.textMuted}>
                    {translatedMuscleGroup} · {text.plan}: {exercise.sets} ×{" "}
                    {exercise.reps} · {text.rest} {exercise.restSeconds ?? 0}
                    s{weighted && exercise.weight ? ` · ${exercise.weight}kg` : ""}
                  </AppText>

                  {!weighted ? (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        padding: 10,
                        borderRadius: theme.radius.md,
                        backgroundColor: theme.colors.surfaceAlt,
                      }}
                    >
                      <Weight color={theme.colors.accent} size={16} />

                      <AppText variant="small" color={theme.colors.textMuted}>
                        {text.bodyweightHint}
                      </AppText>
                    </View>
                  ) : null}

                  <View style={{ gap: 8, marginTop: 4 }}>
                    {Array.from({ length: exercise.sets }).map((_, index) => {
                      const ok = index < done;

                      const row = rows[index] ?? {
                        weight:
                          weighted &&
                          exercise.weight !== undefined &&
                          exercise.weight !== null &&
                          exercise.weight > 0
                            ? String(exercise.weight)
                            : "",
                        reps: String(exercise.reps || 10),
                      };

                      const invalidWeight = weighted && !hasValidWeight(row.weight);
                      const invalidReps = !hasValidReps(row.reps);

                      return (
                        <View
                          key={index}
                          style={{
                            padding: 10,
                            borderRadius: 14,
                            backgroundColor: ok
                              ? "rgba(22,199,132,0.12)"
                              : theme.colors.surfaceAlt,
                            borderWidth: 1,
                            borderColor: ok
                              ? theme.colors.primary
                              : theme.colors.borderSoft,
                            gap: 8,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <Pressable
                              disabled={saving || isCompleted}
                              onPress={() => {
                                if (saving || isCompleted) return;

                                if (invalidReps) {
                                  Alert.alert(
                                    text.repsRequired,
                                    `${text.set} ${index + 1}: ${
                                      text.reps
                                    } > 0.`,
                                  );
                                  return;
                                }

                                if (invalidWeight) {
                                  Alert.alert(
                                    text.weightRequired,
                                    `${text.set} ${index + 1}: ${
                                      text.weightRequired
                                    }.`,
                                  );
                                  return;
                                }

                                setDoneSet((current) => ({
                                  ...current,
                                  [exercise.id]:
                                    index + 1 === done ? index : index + 1,
                                }));
                              }}
                              style={{
                                paddingVertical: 6,
                                paddingHorizontal: 12,
                                borderRadius: 10,
                                backgroundColor: ok
                                  ? theme.colors.primary
                                  : theme.colors.surface,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 5,
                                opacity: saving || isCompleted ? 0.75 : 1,
                              }}
                            >
                              {ok ? (
                                <CheckCircle2
                                  size={14}
                                  color={theme.colors.primaryContrast}
                                />
                              ) : null}

                              <AppText
                                variant="small"
                                color={
                                  ok
                                    ? theme.colors.primaryContrast
                                    : theme.colors.text
                                }
                                style={{ fontWeight: "700" }}
                              >
                                {text.set} {index + 1}
                              </AppText>
                            </Pressable>

                            <AppText
                              variant="caption"
                              color={theme.colors.textMuted}
                            >
                              {text.target} {exercise.reps} {text.reps}
                            </AppText>
                          </View>

                          <View style={{ flexDirection: "row", gap: 8 }}>
                            {weighted ? (
                              <View style={{ flex: 1 }}>
                                <AppText
                                  variant="caption"
                                  color={theme.colors.textMuted}
                                  style={{ marginBottom: 4 }}
                                >
                                  {text.weightKg}
                                </AppText>

                                <TextInput
                                  value={row.weight}
                                  editable={!saving && !isCompleted}
                                  onChangeText={(value) =>
                                    updateSetResult(
                                      exercise.id,
                                      index,
                                      "weight",
                                      value,
                                    )
                                  }
                                  keyboardType="decimal-pad"
                                  placeholder={text.exampleWeight}
                                  placeholderTextColor={theme.colors.textFaint}
                                  style={{
                                    minHeight: 42,
                                    borderRadius: 12,
                                    paddingHorizontal: 12,
                                    backgroundColor: theme.colors.inputBg,
                                    color: theme.colors.text,
                                    borderWidth: 1,
                                    borderColor: invalidWeight
                                      ? theme.colors.danger
                                      : theme.colors.borderSoft,
                                  }}
                                />

                                {invalidWeight ? (
                                  <AppText
                                    variant="caption"
                                    color={theme.colors.danger}
                                    style={{ marginTop: 4 }}
                                  >
                                    {text.required}
                                  </AppText>
                                ) : null}
                              </View>
                            ) : null}

                            <View style={{ flex: 1 }}>
                              <AppText
                                variant="caption"
                                color={theme.colors.textMuted}
                                style={{ marginBottom: 4 }}
                              >
                                {text.repsUpper}
                              </AppText>

                              <TextInput
                                value={row.reps}
                                editable={!saving && !isCompleted}
                                onChangeText={(value) =>
                                  updateSetResult(
                                    exercise.id,
                                    index,
                                    "reps",
                                    value,
                                  )
                                }
                                keyboardType="number-pad"
                                placeholder={String(exercise.reps || 10)}
                                placeholderTextColor={theme.colors.textFaint}
                                style={{
                                  minHeight: 42,
                                  borderRadius: 12,
                                  paddingHorizontal: 12,
                                  backgroundColor: theme.colors.inputBg,
                                  color: theme.colors.text,
                                  borderWidth: 1,
                                  borderColor: invalidReps
                                    ? theme.colors.danger
                                    : theme.colors.borderSoft,
                                }}
                              />

                              {invalidReps ? (
                                <AppText
                                  variant="caption"
                                  color={theme.colors.danger}
                                  style={{ marginTop: 4 }}
                                >
                                  {text.required}
                                </AppText>
                              ) : null}
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </AppCard>
            );
          })}
        </View>

        <View style={{ marginTop: 18, marginBottom: 24 }}>
          <AppButton
            title={
              isCompleted
                ? text.workoutCompleted
                : saving
                  ? text.saving
                  : text.finishWorkout
            }
            size="lg"
            onPress={finish}
            fullWidth
          />
        </View>
      </View>
    </ScreenContainer>
  </SubscriptionGate>
);
}