import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  Check,
  ChevronLeft,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";

import SubscriptionGate from "@/src/components/SubscriptionGate";
import {
  AppButton,
  AppCard,
  AppChip,
  AppInput,
  AppText,
  ScreenContainer,
} from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { useTheme } from "@/src/context/ThemeContext";
import {
  AppLangCode,
  EXERCISE_LIBRARY,
  getExerciseAnimationFrames,
  getExerciseDescription,
  getExerciseName,
  LibraryExercise,
  MuscleGroup,
} from "@/src/data/exerciseLibrary";
import { useI18n } from "@/src/i18n/I18nContext";
import { apiGet, apiPatch, apiPost } from "@/src/services/api";
import { Exercise } from "@/src/types/models";

interface DraftExercise {
  id: string;
  libId?: string;
  name: string;
  sets: number;
  reps: number;
  restSeconds: number;
  weight?: number;
  requiresWeight: boolean;
  notes?: string;
  imageUrl?: string;
  gifUrl?: string;
  animationFrames?: string[];
  muscleGroup?: string;
}

type LatestExerciseSet = {
  id: string;
  clientId: string;
  coachId: string;
  workoutId: string;
  exerciseId?: string | null;
  exerciseName: string;
  muscleGroup?: string | null;
  setNumber: number;
  targetReps: number;
  actualReps: number;
  weight?: number | null;
  notes?: string | null;
  createdAt: string;
};

type LatestExerciseResult = {
  exerciseName: string;
  muscleGroup?: string | null;
  workoutId: string;
  createdAt: string;
  sets: LatestExerciseSet[];
};

const MUSCLE_FILTERS: (MuscleGroup | "All")[] = [
  "All",
  "Chest",
  "Back",
  "Legs",
  "Glutes",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Abs",
  "Cardio",
  "Stretching",
];

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
  "yoga",
  "burpee",
  "bodyweight",
  "leg raises",
  "hanging leg raise",
  "hyperextension",
  "raise",
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
  "thrust",
  "shrug",
];

const DEFAULT_EXERCISE_IMAGE =
  "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&auto=format&fit=crop&q=80";

function getLangSafe(lang: string): AppLangCode {
  if (lang === "ru" || lang === "kk" || lang === "en") return lang;

  return "en";
}

function parsePositiveInt(value: string, fallback: number) {
  const parsed = parseInt(value.replace(/[^0-9]/g, ""), 10);

  if (!Number.isFinite(parsed)) return fallback;

  return Math.max(0, parsed);
}

function parsePositiveFloat(value: string, fallback: number) {
  const parsed = parseFloat(value.replace(",", ".").replace(/[^0-9.]/g, ""));

  if (!Number.isFinite(parsed)) return fallback;

  return Math.max(0, parsed);
}

function shouldRequireWeight(name: string, muscleGroup?: string) {
  const n = name.toLowerCase();
  const group = muscleGroup?.toLowerCase();

  if (group === "cardio" || group === "stretching") return false;

  if (BODYWEIGHT_KEYWORDS.some((word) => n.includes(word))) return false;

  if (WEIGHTED_KEYWORDS.some((word) => n.includes(word))) return true;

  return !["abs", "core"].includes(group ?? "");
}

function getDefaultWeight(name: string, muscleGroup?: string) {
  return shouldRequireWeight(name, muscleGroup) ? 20 : undefined;
}

function normalizeHistory(raw: any): LatestExerciseResult | null {
  if (!raw || typeof raw !== "object") return null;

  const setsRaw = Array.isArray(raw.sets) ? raw.sets : [];

  return {
    exerciseName: String(raw.exerciseName ?? raw.exercise_name ?? ""),
    muscleGroup: raw.muscleGroup ?? raw.muscle_group ?? null,
    workoutId: String(raw.workoutId ?? raw.workout_id ?? ""),
    createdAt: String(
      raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
    ),
    sets: setsRaw.map((set: any) => ({
      id: String(set.id),
      clientId: String(set.clientId ?? set.client_id ?? ""),
      coachId: String(set.coachId ?? set.coach_id ?? ""),
      workoutId: String(set.workoutId ?? set.workout_id ?? ""),
      exerciseId: set.exerciseId ?? set.exercise_id ?? null,
      exerciseName: String(
        set.exerciseName ?? set.exercise_name ?? raw.exerciseName ?? "",
      ),
      muscleGroup:
        set.muscleGroup ?? set.muscle_group ?? raw.muscleGroup ?? null,
      setNumber: Number(set.setNumber ?? set.set_number ?? 0),
      targetReps: Number(set.targetReps ?? set.target_reps ?? 0),
      actualReps: Number(set.actualReps ?? set.actual_reps ?? 0),
      weight:
        set.weight === undefined || set.weight === null
          ? null
          : Number(set.weight),
      notes: set.notes ?? null,
      createdAt: String(
        set.createdAt ??
          set.created_at ??
          raw.createdAt ??
          new Date().toISOString(),
      ),
    })),
  };
}

function getFramesFromDraft(exercise: DraftExercise) {
  if (exercise.gifUrl) return [exercise.gifUrl];

  if (exercise.animationFrames?.length) {
    return Array.from(new Set(exercise.animationFrames.filter(Boolean)));
  }

  if (exercise.libId) {
    const lib = EXERCISE_LIBRARY.find((item) => item.id === exercise.libId);

    if (lib) return getExerciseAnimationFrames(lib);
  }

  if (exercise.imageUrl?.includes("/0.jpg")) {
    return [exercise.imageUrl, exercise.imageUrl.replace("/0.jpg", "/1.jpg")];
  }

  return exercise.imageUrl ? [exercise.imageUrl] : [DEFAULT_EXERCISE_IMAGE];
}

function ExerciseAnimatedImage({
  frames,
  size = 56,
  radius = 16,
}: {
  frames: string[];
  size?: number;
  radius?: number;
}) {
  const safeFrames = frames.filter(Boolean);
  const safeFramesKey = safeFrames.join("|");
  const [frameIndex, setFrameIndex] = useState<number>(0);

  useEffect(() => {
    setFrameIndex(0);

    if (safeFrames.length <= 1) return;

    const timer = setInterval(() => {
      setFrameIndex((current) => (current + 1) % safeFrames.length);
    }, 650);

    return () => clearInterval(timer);
  }, [safeFramesKey, safeFrames.length]);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: "hidden",
        backgroundColor: "rgba(148,163,184,0.12)",
      }}
    >
      <Image
        source={{ uri: safeFrames[frameIndex] ?? DEFAULT_EXERCISE_IMAGE }}
        recyclingKey={safeFrames[frameIndex] ?? DEFAULT_EXERCISE_IMAGE}
        style={{ width: size, height: size }}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={120}
      />
    </View>
  );
}

function createDraftFromLibrary(exercise: LibraryExercise): DraftExercise {
  const requiresWeight = shouldRequireWeight(
    exercise.name,
    exercise.muscleGroup,
  );

  return {
    id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    libId: exercise.id,
    name: exercise.name,
    sets: exercise.defaultSets ?? 3,
    reps: exercise.defaultReps ?? 10,
    restSeconds: exercise.defaultRestSeconds ?? 60,
    weight: getDefaultWeight(exercise.name, exercise.muscleGroup),
    requiresWeight,
    notes: "",
    imageUrl: exercise.imageUrl,
    gifUrl: exercise.gifUrl,
    animationFrames: getExerciseAnimationFrames(exercise),
    muscleGroup: exercise.muscleGroup,
  };
}

function createDraftFromExisting(exercise: Exercise): DraftExercise {
  const libraryExercise = EXERCISE_LIBRARY.find(
    (item) =>
      item.name.trim().toLowerCase() === exercise.name.trim().toLowerCase() ||
      item.imageUrl === exercise.imageUrl,
  );

  const requiresWeight =
    (exercise as any).requiresWeight ??
    (exercise.weight !== undefined && exercise.weight !== null
      ? true
      : shouldRequireWeight(
          exercise.name,
          exercise.muscleGroup ?? libraryExercise?.muscleGroup,
        ));

  return {
    id: exercise.id,
    libId: libraryExercise?.id,
    name: exercise.name,
    sets: exercise.sets,
    reps: exercise.reps,
    restSeconds: exercise.restSeconds,
    weight: requiresWeight
  ? exercise.weight ?? getDefaultWeight(exercise.name, exercise.muscleGroup ?? undefined)
  : undefined,
    requiresWeight,
    notes: exercise.notes ?? undefined,
    imageUrl: exercise.imageUrl ?? libraryExercise?.imageUrl,
    gifUrl: (exercise as any).gifUrl ?? (exercise as any).gif_url ?? libraryExercise?.gifUrl,
    animationFrames:
      (exercise as any).animationFrames ??
      (exercise as any).animation_frames ??
      (libraryExercise ? getExerciseAnimationFrames(libraryExercise) : undefined),
muscleGroup: exercise.muscleGroup ?? libraryExercise?.muscleGroup ?? undefined,  };
}

function buildWorkoutPayload(params: {
  clientId: string;
  name: string;
  date: string;
  time: string;
  durationMinutes: number;
  notes: string;
  exercises: DraftExercise[];
}) {
  return {
    client_id: params.clientId,
    name: params.name.trim(),
    date: params.date.trim(),
    time: params.time.trim() || undefined,
    duration_minutes: params.durationMinutes,
    description: params.notes.trim() || undefined,
    exercises: params.exercises.map((exercise) => ({
      id: exercise.id.startsWith("draft_") ? undefined : exercise.id,
      name: exercise.name.trim(),
      sets: exercise.sets,
      reps: exercise.reps,
      rest_seconds: exercise.restSeconds,
      weight: exercise.requiresWeight ? exercise.weight : undefined,
      notes: exercise.notes?.trim() || undefined,
      image_url: exercise.imageUrl,
      muscle_group: exercise.muscleGroup,
    })),
  };
}

function getHistoryTitle(lang: string) {
  if (lang === "ru") return "Последний результат";
  if (lang === "kk") return "Соңғы нәтиже";

  return "Latest result";
}

function getNoHistoryText(lang: string) {
  if (lang === "ru") {
    return "Истории пока нет. После выполнения упражнения здесь появятся прошлые подходы.";
  }

  if (lang === "kk") {
    return "Әзірге тарих жоқ. Жаттығуды орындағаннан кейін соңғы сеттер осында шығады.";
  }

  return "No history yet. After this exercise is completed, previous sets will appear here.";
}

function getLoadingHistoryText(lang: string) {
  if (lang === "ru") return "Загружаем историю...";
  if (lang === "kk") return "Тарих жүктелуде...";

  return "Loading history...";
}

function getHistoryErrorText(lang: string) {
  if (lang === "ru") return "Не удалось загрузить историю упражнения.";
  if (lang === "kk") return "Жаттығу тарихын жүктеу мүмкін болмады.";

  return "Could not load exercise history.";
}

function getBestLabel(lang: string) {
  if (lang === "ru") return "Лучший";
  if (lang === "kk") return "Үздік";

  return "Best";
}

function getAddExerciseButtonLabel(lang: string) {
  if (lang === "ru") return "Добавить упражнение";
  if (lang === "kk") return "Жаттығу қосу";

  return "Add exercise";
}

function getWorkoutAutoNameNotice(lang: string) {
  if (lang === "ru") {
    return "Название тренировки не было введено, поэтому приложение автоматически создало понятное название по упражнениям.";
  }

  if (lang === "kk") {
    return "Жаттығу атауы енгізілмеді, сондықтан қолданба жаттығуларға қарап атауды автоматты түрде құрды.";
  }

  return "Workout name was empty, so the app automatically created a clear name from the selected exercises.";
}

function buildAutoWorkoutName(params: {
  exercises: DraftExercise[];
  date: string;
  lang: string;
}) {
  const firstExercise = params.exercises[0]?.name?.trim();

  if (!firstExercise) {
    if (params.lang === "ru") return `Тренировка · ${params.date}`;
    if (params.lang === "kk") return `Жаттығу · ${params.date}`;

    return `Workout · ${params.date}`;
  }

  const extraCount = Math.max(0, params.exercises.length - 1);

  if (params.lang === "ru") {
    return extraCount > 0
      ? `${firstExercise} + ещё ${extraCount} · ${params.date}`
      : `${firstExercise} · ${params.date}`;
  }

  if (params.lang === "kk") {
    return extraCount > 0
      ? `${firstExercise} + тағы ${extraCount} · ${params.date}`
      : `${firstExercise} · ${params.date}`;
  }

  return extraCount > 0
    ? `${firstExercise} + ${extraCount} more · ${params.date}`
    : `${firstExercise} · ${params.date}`;
}

function makeLocalId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildLocalExercises(workoutId: string, exercises: DraftExercise[]): Exercise[] {
  return exercises.map((exercise, index) => ({
    id: exercise.id.startsWith("draft_")
      ? makeLocalId("local_exercise")
      : exercise.id,
    workoutId,
    libraryExerciseId: exercise.libId ?? null,
    name: exercise.name.trim(),
    sets: Math.max(1, exercise.sets),
    reps: Math.max(1, exercise.reps),
    restSeconds: Math.max(0, exercise.restSeconds),
    weight: exercise.requiresWeight ? exercise.weight : undefined,
    notes: exercise.notes?.trim() || undefined,
    imageUrl: exercise.imageUrl,
    gifUrl: exercise.gifUrl,
    animationFrames: exercise.animationFrames,
    muscleGroup: exercise.muscleGroup,
    order: index + 1,
  } as Exercise));
}

function getNoClientText(lang: string) {
  if (lang === "ru") return "Клиент не выбран.";
  if (lang === "kk") return "Клиент таңдалмаған.";

  return "Client is not selected.";
}

export default function AddWorkout() {
  const { theme } = useTheme();
  const { t, lang } = useI18n();
  const tt = (key: string) => t(key as any);
  const appLang = getLangSafe(lang);
  const { user, token } = useAuth();
  const { db, update, refreshFromBackend } = useData();
  const params = useLocalSearchParams<{
    clientId?: string;
    workoutId?: string;
  }>();

  const clientId = typeof params.clientId === "string" ? params.clientId : "";
  const workoutId =
    typeof params.workoutId === "string" ? params.workoutId : "";
  const editing = !!workoutId;

  const existingWorkout = useMemo(() => {
    if (!db || !workoutId) return undefined;

    return db.workouts.find((workout) => workout.id === workoutId);
  }, [db, workoutId]);

  const targetClientId = existingWorkout?.clientId ?? clientId;

  const existingExercises = useMemo(() => {
    if (!db || !workoutId) return [];

    return db.exercises.filter((exercise) => exercise.workoutId === workoutId);
  }, [db, workoutId]);

  const client = useMemo(() => {
    if (!db || !targetClientId) return undefined;

    return db.users.find((item) => item.id === targetClientId);
  }, [db, targetClientId]);

  const now = useMemo(() => new Date(), []);
  const defaultDate = useMemo(() => now.toISOString().slice(0, 10), [now]);
  const defaultTime = useMemo(() => {
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");

    return `${hours}:${minutes}`;
  }, [now]);

  const [name, setName] = useState<string>(existingWorkout?.name ?? "");
  const [date, setDate] = useState<string>(
    existingWorkout?.date ?? defaultDate,
  );
  const [time, setTime] = useState<string>(
    existingWorkout?.time ?? defaultTime,
  );
  const [duration, setDuration] = useState<string>(
    String(existingWorkout?.durationMinutes ?? 45),
  );
  const [notes, setNotes] = useState<string>(existingWorkout?.description ?? "");
  const [draft, setDraft] = useState<DraftExercise[]>(() =>
    existingExercises.map(createDraftFromExisting),
  );
  const [saving, setSaving] = useState<boolean>(false);
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);
  const [historyByName, setHistoryByName] = useState<
    Record<string, LatestExerciseResult | null>
  >({});
  const [historyLoadingName, setHistoryLoadingName] = useState<string | null>(
    null,
  );
  const [historyErrorName, setHistoryErrorName] = useState<string | null>(null);

  useEffect(() => {
    if (!existingWorkout) return;

    setName(existingWorkout.name ?? "");
    setDate(existingWorkout.date ?? defaultDate);
    setTime(existingWorkout.time ?? defaultTime);
    setDuration(String(existingWorkout.durationMinutes ?? 45));
    setNotes(existingWorkout.description ?? "");
    setDraft(existingExercises.map(createDraftFromExisting));
  }, [existingWorkout?.id, existingExercises.length, defaultDate, defaultTime]);

  const uniqueDraftExerciseNames = useMemo(
    () => Array.from(new Set(draft.map((exercise) => exercise.name))).join("|"),
    [draft],
  );

  useEffect(() => {
    if (!targetClientId || !token || !uniqueDraftExerciseNames) return;

    const names = uniqueDraftExerciseNames.split("|").filter(Boolean);
    const missing = names.filter(
      (exerciseName) => !(exerciseName in historyByName),
    );

    if (missing.length === 0) return;

    let cancelled = false;

    const load = async () => {
      for (const exerciseName of missing) {
        if (cancelled) return;

        try {
          setHistoryLoadingName(exerciseName);
          setHistoryErrorName(null);

          const data = await apiGet(
            `/exercise-results/latest?client_id=${encodeURIComponent(
              targetClientId,
            )}&exercise_name=${encodeURIComponent(exerciseName)}`,
            { token },
          );

          if (cancelled) return;

          setHistoryByName((current) => ({
            ...current,
            [exerciseName]: normalizeHistory(data),
          }));
        } catch (e) {
          console.log("[add-workout] load exercise history error", e);

          if (cancelled) return;

          setHistoryErrorName(exerciseName);
          setHistoryByName((current) => ({
            ...current,
            [exerciseName]: null,
          }));
        } finally {
          if (!cancelled) setHistoryLoadingName(null);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [targetClientId, token, uniqueDraftExerciseNames]);

  const addFromLibrary = (ids: string[]) => {
    const picked = EXERCISE_LIBRARY.filter((exercise) =>
      ids.includes(exercise.id),
    );

    setDraft((current) => [...current, ...picked.map(createDraftFromLibrary)]);
  };

  const removeExercise = (id: string) => {
    setDraft((current) => current.filter((item) => item.id !== id));
  };

  const updateExercise = (id: string, patch: Partial<DraftExercise>) => {
    setDraft((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const save = async () => {
    if (saving) return;

    if (!user || !token) {
      Alert.alert(tt("profile.authErrorTitle"), tt("profile.loginAgainText"));
      return;
    }

    if (user.role !== "coach") {
      Alert.alert(
        tt("workouts.permissionDeniedTitle"),
        tt("workouts.onlyCoachesCanCreate"),
      );
      return;
    }

    if (!targetClientId) {
      Alert.alert(tt("workouts.errorTitle"), getNoClientText(lang));
      return;
    }

    if (!date.trim()) {
      Alert.alert(tt("workouts.errorTitle"), tt("workouts.dateRequired"));
      return;
    }

    if (draft.length === 0) {
      Alert.alert(
        tt("workouts.errorTitle"),
        tt("workouts.addAtLeastOneExercise"),
      );
      return;
    }

    const invalidWeight = draft.find(
      (exercise) =>
        exercise.requiresWeight && (!exercise.weight || exercise.weight <= 0),
    );

    if (invalidWeight) {
      Alert.alert(tt("workouts.requiredWeightError"), invalidWeight.name);
      return;
    }

    const durationMinutes = parsePositiveInt(duration, 45);
    const cleanName = name.trim();
    const finalWorkoutName =
      cleanName ||
      buildAutoWorkoutName({
        exercises: draft,
        date,
        lang,
      });

    if (!cleanName) {
      setName(finalWorkoutName);
    }

    try {
      setSaving(true);

      const workoutPayload = buildWorkoutPayload({
        clientId: targetClientId,
        name: finalWorkoutName,
        date,
        time,
        durationMinutes,
        notes,
        exercises: draft,
      });

      if (editing) {
        await apiPatch(`/workouts/${workoutId}`, workoutPayload, { token });
      } else {
        await apiPost("/workouts", workoutPayload, { token });
      }

      await refreshFromBackend();

      if (!cleanName) {
        Alert.alert(tt("workouts.saved"), getWorkoutAutoNameNotice(lang), [
          { text: tt("common.done"), onPress: () => router.back() },
        ]);
        return;
      }

      router.back();
    } catch (e: any) {
      console.log("[add-workout] save error", e);

      const localWorkoutId = editing ? workoutId : makeLocalId("local_workout");
      const localExercises = buildLocalExercises(localWorkoutId, draft);

      update((current) => ({
        ...current,
        workouts: [
          ...current.workouts.filter((workout) => workout.id !== localWorkoutId),
          {
            id: localWorkoutId,
            coachId: user.id,
            clientId: targetClientId,
            date: date.trim(),
            time: time.trim() || undefined,
            name: finalWorkoutName,
            description: notes.trim() || undefined,
            category: existingWorkout?.category ?? "Manual",
            completed: existingWorkout?.completed ?? false,
            completedAt: existingWorkout?.completedAt ?? undefined,
            durationMinutes,
            source: (existingWorkout as any)?.source ?? "manual",
            weeklyPlanId: (existingWorkout as any)?.weeklyPlanId ?? null,
            weeklyPlanTitle: (existingWorkout as any)?.weeklyPlanTitle ?? null,
            weeklyPlanDayIndex: (existingWorkout as any)?.weeklyPlanDayIndex ?? null,
            difficulty: (existingWorkout as any)?.difficulty ?? null,
            focus: (existingWorkout as any)?.focus ?? null,
            coachNotes: (existingWorkout as any)?.coachNotes ?? null,
          },
        ],
        exercises: [
          ...current.exercises.filter(
            (exercise) => exercise.workoutId !== localWorkoutId,
          ),
          ...localExercises,
        ],
      }));

      Alert.alert(
        tt("workouts.saved"),
        cleanName
          ? "Backend did not accept the request, so the workout was saved locally and can still be edited in the app."
          : getWorkoutAutoNameNotice(lang),
        [{ text: tt("common.done"), onPress: () => router.back() }],
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: editing ? tt("workouts.editWorkout") : tt("workouts.addWorkout"),
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <ChevronLeft color={theme.colors.text} size={24} />
            </Pressable>
          ),
        }}
      />

      <SubscriptionGate>
        <ScreenContainer scroll>
          <View style={{ gap: 14 }}>
            <View>
              <AppText variant="title">
                {editing ? tt("workouts.editWorkout") : tt("workouts.addWorkout")}
              </AppText>

              <AppText variant="small" color={theme.colors.textMuted}>
                {client
                  ? tt("workouts.forClient").replace("{name}", client.name)
                  : tt("workouts.createSession")}
              </AppText>
            </View>

            <AppInput
              label={tt("workouts.workoutName")}
              value={name}
              onChangeText={setName}
              placeholder={tt("workouts.workoutNamePlaceholder")}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              submitBehavior="submit"
            />

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <AppInput
                  label={tt("workouts.date")}
                  value={date}
                  onChangeText={(value) =>
                    setDate(value.replace(/[^0-9-]/g, ""))
                  }
                  placeholder="2026-05-14"
                  keyboardType="numbers-and-punctuation"
                  inputMode="text"
                  returnKeyType="next"
                  submitBehavior="submit"
                  maxLength={10}
                />
              </View>

              <View style={{ flex: 1 }}>
                <AppInput
                  label={tt("workouts.time")}
                  value={time}
                  onChangeText={(value) =>
                    setTime(value.replace(/[^0-9:]/g, ""))
                  }
                  placeholder="18:30"
                  keyboardType="numbers-and-punctuation"
                  inputMode="text"
                  returnKeyType="next"
                  submitBehavior="submit"
                  maxLength={5}
                />
              </View>
            </View>

            <AppInput
              label={tt("workouts.durationMinutes")}
              value={duration}
              onChangeText={(value) =>
                setDuration(value.replace(/[^0-9]/g, ""))
              }
              keyboardType="numeric"
              inputMode="numeric"
              returnKeyType="next"
              submitBehavior="submit"
              maxLength={3}
            />

            <AppInput
              label={tt("workouts.notes")}
              value={notes}
              onChangeText={setNotes}
              placeholder={tt("workouts.notesPlaceholder")}
              multiline
              autoCapitalize="sentences"
              autoCorrect
              returnKeyType="done"
              submitBehavior="blurAndSubmit"
              style={{
                minHeight: 92,
                textAlignVertical: "top",
                paddingTop: 10,
              }}
            />

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginTop: 4,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText variant="h2">{tt("workouts.exercises")}</AppText>

                <AppText variant="small" color={theme.colors.textMuted}>
                  {tt("workouts.chooseFromLibrary")}
                </AppText>
              </View>

              <AppButton
                title={getAddExerciseButtonLabel(lang)}
                size="sm"
                icon={<Plus color={theme.colors.primaryContrast} size={16} />}
                onPress={() => setPickerOpen(true)}
              />
            </View>

            {draft.length === 0 ? (
              <AppCard variant="outline">
                <AppText variant="small" color={theme.colors.textMuted}>
                  {tt("workouts.noExercisesYet")}
                </AppText>
              </AppCard>
            ) : null}

            <View style={{ gap: 12 }}>
              {draft.map((exercise, index) => {
                const libraryExercise = exercise.libId
                  ? EXERCISE_LIBRARY.find((item) => item.id === exercise.libId)
                  : undefined;

                const translatedName = libraryExercise
                  ? getExerciseName(libraryExercise, appLang)
                  : exercise.name;

                const frames = getFramesFromDraft(exercise);
                const history = historyByName[exercise.name];
                const loadingHistory = historyLoadingName === exercise.name;
                const hasHistoryError = historyErrorName === exercise.name;
                const bestWeight = history?.sets
                  ?.map((set) =>
                    set.weight === null || set.weight === undefined
                      ? 0
                      : Number(set.weight),
                  )
                  .filter((weight) => weight > 0)
                  .sort((a, b) => b - a)[0];

                return (
                  <AppCard key={exercise.id} variant="outline">
                    <View style={{ flexDirection: "row", gap: 12 }}>
                      <ExerciseAnimatedImage frames={frames} />

                      <View style={{ flex: 1, minWidth: 0 }}>
                        <AppText variant="bodyStrong" numberOfLines={1}>
                          {index + 1}. {translatedName}
                        </AppText>

                        <AppText
                          variant="small"
                          color={theme.colors.textMuted}
                          numberOfLines={1}
                        >
                          {exercise.muscleGroup ?? tt("workouts.customExercise")}
                        </AppText>
                      </View>

                      <Pressable
                        onPress={() => removeExercise(exercise.id)}
                        hitSlop={10}
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 17,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "rgba(255,73,73,0.10)",
                        }}
                      >
                        <Trash2 color={theme.colors.danger} size={17} />
                      </Pressable>
                    </View>

                    <View
                      style={{
                        marginTop: 12,
                        padding: 10,
                        borderRadius: theme.radius.md,
                        backgroundColor: theme.colors.surfaceAlt,
                        gap: 6,
                      }}
                    >
                      <AppText variant="bodyStrong">
                        {getHistoryTitle(lang)}
                      </AppText>

                      {loadingHistory ? (
                        <AppText
                          variant="small"
                          color={theme.colors.textMuted}
                        >
                          {getLoadingHistoryText(lang)}
                        </AppText>
                      ) : hasHistoryError ? (
                        <AppText variant="small" color={theme.colors.danger}>
                          {getHistoryErrorText(lang)}
                        </AppText>
                      ) : history?.sets?.length ? (
                        <View style={{ gap: 6 }}>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode={
                              Platform.OS === "ios" ? "interactive" : "on-drag"
                            }
                            contentContainerStyle={{ gap: 8 }}
                          >
                            {history.sets.map((set) => (
                              <View
                                key={set.id}
                                style={{
                                  minWidth: 96,
                                  padding: 10,
                                  borderRadius: theme.radius.md,
                                  backgroundColor: theme.colors.surface,
                                  borderWidth: 1,
                                  borderColor: theme.colors.borderSoft,
                                }}
                              >
                                <AppText
                                  variant="caption"
                                  color={theme.colors.textMuted}
                                >
                                  Set {set.setNumber}
                                </AppText>

                                <AppText variant="bodyStrong">
                                  {set.actualReps}/{set.targetReps} reps
                                </AppText>

                                {set.weight ? (
                                  <AppText
                                    variant="caption"
                                    color={theme.colors.textMuted}
                                  >
                                    {set.weight} kg
                                  </AppText>
                                ) : null}
                              </View>
                            ))}
                          </ScrollView>

                          {bestWeight ? (
                            <AppText
                              variant="caption"
                              color={theme.colors.primary}
                            >
                              {getBestLabel(lang)}: {bestWeight} kg
                            </AppText>
                          ) : null}
                        </View>
                      ) : (
                        <AppText
                          variant="small"
                          color={theme.colors.textMuted}
                        >
                          {getNoHistoryText(lang)}
                        </AppText>
                      )}
                    </View>

                    <View style={{ marginTop: 12, gap: 8 }}>
                      <AppText variant="caption" color={theme.colors.textMuted}>
                        {tt("workouts.weightMode")}
                      </AppText>

                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <Pressable
                          onPress={() =>
                            updateExercise(exercise.id, {
                              requiresWeight: true,
                              weight:
                                exercise.weight ??
                                getDefaultWeight(
                                  exercise.name,
                                  exercise.muscleGroup,
                                ) ??
                                20,
                            })
                          }
                          style={{
                            flex: 1,
                            paddingVertical: 10,
                            borderRadius: theme.radius.md,
                            alignItems: "center",
                            backgroundColor: exercise.requiresWeight
                              ? "rgba(22,199,132,0.16)"
                              : theme.colors.inputBg,
                            borderWidth: 1,
                            borderColor: exercise.requiresWeight
                              ? theme.colors.primary
                              : theme.colors.borderSoft,
                          }}
                        >
                          <AppText
                            variant="small"
                            color={
                              exercise.requiresWeight
                                ? theme.colors.primary
                                : theme.colors.textMuted
                            }
                            style={{ fontWeight: "800" }}
                          >
                            {tt("workouts.weighted")}
                          </AppText>
                        </Pressable>

                        <Pressable
                          onPress={() =>
                            updateExercise(exercise.id, {
                              requiresWeight: false,
                              weight: undefined,
                            })
                          }
                          style={{
                            flex: 1,
                            paddingVertical: 10,
                            borderRadius: theme.radius.md,
                            alignItems: "center",
                            backgroundColor: !exercise.requiresWeight
                              ? "rgba(139,92,246,0.16)"
                              : theme.colors.inputBg,
                            borderWidth: 1,
                            borderColor: !exercise.requiresWeight
                              ? theme.colors.accent
                              : theme.colors.borderSoft,
                          }}
                        >
                          <AppText
                            variant="small"
                            color={
                              !exercise.requiresWeight
                                ? theme.colors.accent
                                : theme.colors.textMuted
                            }
                            style={{ fontWeight: "800" }}
                          >
                            {tt("workouts.bodyweight")}
                          </AppText>
                        </Pressable>
                      </View>

                      <AppText variant="caption" color={theme.colors.textMuted}>
                        {exercise.requiresWeight
                          ? tt("workouts.weightRequiredHint")
                          : tt("workouts.noWeightSavedHint")}
                      </AppText>
                    </View>

                    <View
                      style={{ flexDirection: "row", gap: 8, marginTop: 10 }}
                    >
                      <NumField
                        label={tt("workouts.sets")}
                        value={exercise.sets}
                        onChange={(value) =>
                          updateExercise(exercise.id, { sets: value })
                        }
                      />

                      <NumField
                        label={tt("workouts.reps")}
                        value={exercise.reps}
                        onChange={(value) =>
                          updateExercise(exercise.id, { reps: value })
                        }
                      />

                      <NumField
                        label={tt("workouts.rest")}
                        value={exercise.restSeconds}
                        onChange={(value) =>
                          updateExercise(exercise.id, { restSeconds: value })
                        }
                      />
                    </View>

                    {exercise.requiresWeight ? (
                      <View style={{ marginTop: 10 }}>
                        <DecimalField
                          label={tt("workouts.weight")}
                          value={exercise.weight}
                          onChange={(value) =>
                            updateExercise(exercise.id, {
                              weight: value > 0 ? value : undefined,
                            })
                          }
                        />

                        {!exercise.weight || exercise.weight <= 0 ? (
                          <AppText
                            variant="caption"
                            color={theme.colors.danger}
                            style={{ marginTop: 6 }}
                          >
                            {tt("workouts.requiredWeightError")}
                          </AppText>
                        ) : null}
                      </View>
                    ) : null}

                    <TextInput
                      placeholder={tt("workouts.notes")}
                      placeholderTextColor={theme.colors.textFaint}
                      value={exercise.notes ?? ""}
                      onChangeText={(value) =>
                        updateExercise(exercise.id, { notes: value })
                      }
                      multiline
                      autoCapitalize="sentences"
                      autoCorrect
                      returnKeyType="done"
                      submitBehavior="blurAndSubmit"
                      style={{
                        marginTop: 8,
                        backgroundColor: theme.colors.inputBg,
                        borderRadius: theme.radius.md,
                        paddingHorizontal: 12,
                        paddingVertical: Platform.OS === "android" ? 8 : 10,
                        color: theme.colors.text,
                        fontSize: 13,
                        minHeight: 76,
                        textAlignVertical: "top",
                      }}
                    />
                  </AppCard>
                );
              })}
            </View>

            <View style={{ marginTop: 16, marginBottom: 32 }}>
              <AppButton
                title={saving ? tt("common.loading") : tt("workouts.save")}
                size="lg"
                loading={saving}
                disabled={saving}
                onPress={save}
                fullWidth
              />
            </View>
          </View>

          <ExerciseLibraryPicker
            visible={pickerOpen}
            onClose={() => setPickerOpen(false)}
            onAdd={(ids) => {
              addFromLibrary(ids);
              setPickerOpen(false);
            }}
          />
        </ScreenContainer>
      </SubscriptionGate>
    </>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const { theme } = useTheme();

  return (
    <View style={{ flex: 1 }}>
      <AppText variant="caption" color={theme.colors.textMuted}>
        {label}
      </AppText>

      <TextInput
        value={String(value)}
        onChangeText={(value) =>
          onChange(parsePositiveInt(value.replace(/[^0-9]/g, ""), 0))
        }
        keyboardType="numeric"
        inputMode="numeric"
        returnKeyType="next"
        submitBehavior="submit"
        selectTextOnFocus
        maxLength={3}
        style={{
          backgroundColor: theme.colors.inputBg,
          borderRadius: theme.radius.md,
          paddingHorizontal: 10,
          paddingVertical: Platform.OS === "android" ? 8 : 10,
          color: theme.colors.text,
          fontSize: 14,
          fontWeight: "700",
          marginTop: 4,
        }}
      />
    </View>
  );
}

function DecimalField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (value: number) => void;
}) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const tt = (key: string) => t(key as any);

  return (
    <View>
      <AppText variant="caption" color={theme.colors.textMuted}>
        {label}
      </AppText>

      <TextInput
        value={value !== undefined && value !== null ? String(value) : ""}
        onChangeText={(newValue) =>
          onChange(parsePositiveFloat(newValue.replace(/[^0-9.,]/g, ""), 0))
        }
        keyboardType="decimal-pad"
        inputMode="decimal"
        returnKeyType="next"
        submitBehavior="submit"
        selectTextOnFocus
        maxLength={6}
        placeholder={tt("workouts.weightExample")}
        placeholderTextColor={theme.colors.textFaint}
        style={{
          backgroundColor: theme.colors.inputBg,
          borderRadius: theme.radius.md,
          paddingHorizontal: 10,
          paddingVertical: Platform.OS === "android" ? 8 : 10,
          color: theme.colors.text,
          fontSize: 14,
          fontWeight: "700",
          marginTop: 4,
        }}
      />
    </View>
  );
}

function ExerciseLibraryPicker({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (ids: string[]) => void;
}) {
  const { theme } = useTheme();
  const { t, lang } = useI18n();
  const tt = (key: string) => t(key as any);

  const appLang = getLangSafe(lang);

  const [q, setQ] = useState<string>("");
  const [filter, setFilter] = useState<MuscleGroup | "All">("All");
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) {
      setSelected([]);
      setQ("");
      setFilter("All");
    }
  }, [visible]);

  const getMuscleGroupLabel = (group: MuscleGroup | "All") => {
    if (group === "All") return tt("exerciseLib.all");
    if (group === "Chest") return tt("exerciseLib.chest");
    if (group === "Back") return tt("exerciseLib.back");
    if (group === "Legs") return tt("exerciseLib.legs");
    if (group === "Glutes") return tt("exerciseLib.glutes");
    if (group === "Shoulders") return tt("exerciseLib.shoulders");
    if (group === "Biceps") return tt("exerciseLib.biceps");
    if (group === "Triceps") return tt("exerciseLib.triceps");
    if (group === "Abs") return tt("exerciseLib.abs");
    if (group === "Cardio") return tt("exerciseLib.cardio");
    if (group === "Stretching") return tt("exerciseLib.stretching");

    return group;
  };

  const filtered = useMemo(() => {
    return EXERCISE_LIBRARY.filter((exercise) => {
      const translatedName = getExerciseName(exercise, appLang).toLowerCase();
      const englishName = exercise.name.toLowerCase();
      const translatedDescription = getExerciseDescription(
        exercise,
        appLang,
      ).toLowerCase();
      const englishDescription = exercise.description.toLowerCase();
      const query = q.trim().toLowerCase();

      if (filter !== "All" && exercise.muscleGroup !== filter) return false;

      if (
        query &&
        !translatedName.includes(query) &&
        !englishName.includes(query) &&
        !translatedDescription.includes(query) &&
        !englishDescription.includes(query)
      ) {
        return false;
      }

      return true;
    });
  }, [q, filter, appLang]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: theme.colors.bg }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
          <View
            style={{
              paddingTop: 56,
              paddingHorizontal: 16,
              paddingBottom: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.borderSoft,
              gap: 12,
            }}
          >
            <Pressable onPress={onClose} hitSlop={8}>
              <X color={theme.colors.text} size={22} />
            </Pressable>

            <AppText
              variant="h3"
              numberOfLines={1}
              style={{ flex: 1, textAlign: "center" }}
            >
              {tt("workouts.library")}
            </AppText>

            <Pressable
              onPress={() => onAdd(selected)}
              disabled={selected.length === 0}
              hitSlop={8}
              style={{ opacity: selected.length === 0 ? 0.4 : 1 }}
            >
              <AppText variant="bodyStrong" color={theme.colors.primary}>
                {tt("common.add")}
                {selected.length > 0 ? ` (${selected.length})` : ""}
              </AppText>
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <AppInput
              placeholder={tt("common.search")}
              value={q}
              onChangeText={setQ}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              returnKeyType="search"
              submitBehavior="blurAndSubmit"
              onSubmitEditing={Keyboard.dismiss}
              leftIcon={<Search color={theme.colors.textMuted} size={18} />}
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={
                Platform.OS === "ios" ? "interactive" : "on-drag"
              }
              contentContainerStyle={{ gap: 8, paddingVertical: 12 }}
            >
              {MUSCLE_FILTERS.map((muscle) => (
                <AppChip
                  key={muscle}
                  label={getMuscleGroupLabel(muscle)}
                  active={filter === muscle}
                  onPress={() => {
                    Keyboard.dismiss();
                    setFilter(muscle);
                  }}
                />
              ))}
            </ScrollView>
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={
              Platform.OS === "ios" ? "interactive" : "on-drag"
            }
            contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 96 }}
            renderItem={({ item }) => {
              const selectedExercise = selected.includes(item.id);
              const autoWeighted = shouldRequireWeight(
                item.name,
                item.muscleGroup,
              );
              const frames = getExerciseAnimationFrames(item);

              return (
                <Pressable
                  onPress={() =>
                    setSelected((currentSelected) =>
                      selectedExercise
                        ? currentSelected.filter((id) => id !== item.id)
                        : [...currentSelected, item.id],
                    )
                  }
                >
                  <AppCard
                    variant="outline"
                    style={{
                      borderColor: selectedExercise
                        ? theme.colors.primary
                        : theme.colors.border,
                      borderWidth: selectedExercise ? 2 : 1,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <ExerciseAnimatedImage
                        frames={frames}
                        size={60}
                        radius={14}
                      />

                      <View style={{ flex: 1, minWidth: 0 }}>
                        <AppText variant="bodyStrong" numberOfLines={1}>
                          {getExerciseName(item, appLang)}
                        </AppText>

                        <AppText
                          variant="caption"
                          color={theme.colors.textMuted}
                          numberOfLines={1}
                        >
                          {getMuscleGroupLabel(item.muscleGroup)} ·{" "}
                          {item.defaultSets}×{item.defaultReps}
                        </AppText>

                        <AppText
                          variant="caption"
                          color={
                            autoWeighted
                              ? theme.colors.primary
                              : theme.colors.accent
                          }
                          style={{ marginTop: 2, fontWeight: "700" }}
                          numberOfLines={1}
                        >
                          {autoWeighted
                            ? tt("workouts.weightedByDefault")
                            : tt("workouts.bodyweightByDefault")}
                        </AppText>

                        <AppText
                          variant="caption"
                          color={theme.colors.textFaint}
                          numberOfLines={1}
                          style={{ marginTop: 2 }}
                        >
                          {getExerciseDescription(item, appLang)}
                        </AppText>
                      </View>

                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: selectedExercise
                            ? theme.colors.primary
                            : theme.colors.surfaceAlt,
                        }}
                      >
                        {selectedExercise ? (
                          <Check
                            color={theme.colors.primaryContrast}
                            size={16}
                          />
                        ) : null}
                      </View>
                    </View>
                  </AppCard>
                </Pressable>
              );
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
