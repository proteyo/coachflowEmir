import { router } from "expo-router";
import {
  Activity,
  Award,
  CheckCircle2,
  Circle,
  Dumbbell,
  Flame,
  Plus,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  XCircle,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Dimensions, View } from "react-native";
import { WeightChart } from "@/src/components/charts";
import {
  AppButton,
  AppCard,
  AppText,
  ScreenContainer,
  SectionHeader,
  StatCard,
  StreakPill,
} from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { useTheme } from "@/src/context/ThemeContext";
import {
  EXERCISE_LIBRARY,
  getExerciseName,
} from "@/src/data/exerciseLibrary";
import { useI18n } from "@/src/i18n/I18nContext";
import { apiGet } from "@/src/services/api";

type AppLangCode = "en" | "ru" | "kk";
type AttendanceStatus = "attended" | "missed" | "rest";

type ExerciseHistorySet = {
  id: string;
  clientId?: string;
  coachId?: string;
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

type ExerciseHistoryItem = {
  exerciseName: string;
  muscleGroup?: string | null;
  workoutId: string;
  createdAt: string;
  sets: ExerciseHistorySet[];
};

type MuscleSummary = {
  muscleGroup: string;
  exerciseCount: number;
  setCount: number;
  bestWeight: number;
  totalVolume: number;
  lastDate: string;
};

type WeightedExerciseProgress = {
  exerciseName: string;
  muscleGroup: string;
  firstWeight: number;
  lastWeight: number;
  bestWeight: number;
  bestReps: number;
  progress: number;
  setCount: number;
  totalVolume: number;
  lastDate: string;
};

type BodyweightExerciseProgress = {
  exerciseName: string;
  muscleGroup: string;
  sessions: number;
  setCount: number;
  totalReps: number;
  bestReps: number;
  lastDate: string;
};

const TEXT = {
  en: {
    intro:
      "Track your body weight, attendance, strength records and bodyweight achievements in one place.",
    latestBodyWeightChanges: "Your latest body weight changes over time.",
    attendance: "Attendance",
    thisMonth: "This month",
    attended: "Attended",
    missed: "Missed",
    rest: "Rest",
    currentStreak: "Current streak",
    best: "Best",
    days: "days",
    last28Days: "Last 28 days",
    attendanceHint: "Green — attended, red — missed, gray — rest.",
    strengthProgress: "Strength Progress",
    loadingStrength: "Loading strength progress...",
    noWeightedTitle: "No weighted strength results yet",
    noWeightedMessage:
      "Complete weighted exercises like bench press, squats or rows to see strength records here.",
    totalVolume: "Total volume",
    weightedSets: "Weighted sets",
    exercises: "exercises",
    weightTimesReps: "weight × reps",
    bestStrengthProgress: "Best strength progress",
    biggestImprovement: "Biggest improvement by working weight.",
    bestSet: "Best set",
    bestWeight: "Best weight",
    muscleFocus: "Muscle Focus",
    muscleFocusHint: "Weighted training volume by muscle group.",
    personalRecords: "Personal Records",
    personalRecordsHint: "Only exercises with real working weight are shown here.",
    bodyweightAchievements: "Bodyweight Achievements",
    loadingBodyweight: "Loading bodyweight results...",
    noBodyweightTitle: "No bodyweight achievements yet",
    noBodyweightMessage:
      "Complete push-ups, pull-ups, planks, mobility or cardio exercises to see them here.",
    bodyweightSets: "Bodyweight sets",
    withoutKgRecords: "without kg records",
    totalReps: "Total reps",
    topBodyweightExercise: "Top bodyweight exercise",
    sessions: "sessions",
    last: "Last",
    noWeightHistoryTitle: "No weight history yet",
    noWeightHistoryMessage:
      "Add your first weight entry to start tracking body composition progress.",
    first: "First",
    progress: "Progress",
    sets: "Sets",
    reps: "Reps",
    bestSetShort: "Best set",
    volume: "volume",
    weightedSetsShort: "weighted sets",
    progressKg: "progress",
    kg: "kg",
    other: "Other",
  },
  ru: {
    intro:
      "Здесь собраны вес тела, посещаемость, силовые рекорды и достижения в упражнениях без веса.",
    latestBodyWeightChanges: "Последние изменения веса тела по датам.",
    attendance: "Посещаемость",
    thisMonth: "Этот месяц",
    attended: "Был",
    missed: "Пропуск",
    rest: "Отдых",
    currentStreak: "Текущая серия",
    best: "Лучшая",
    days: "дн.",
    last28Days: "Последние 28 дней",
    attendanceHint: "Зелёный — был, красный — пропуск, серый — отдых.",
    strengthProgress: "Силовой прогресс",
    loadingStrength: "Загружаем силовой прогресс...",
    noWeightedTitle: "Пока нет силовых результатов",
    noWeightedMessage:
      "Выполните упражнения с весом, например жим, присед или тягу, чтобы увидеть силовые рекорды.",
    totalVolume: "Общий объём",
    weightedSets: "Подходы с весом",
    exercises: "упражнений",
    weightTimesReps: "вес × повторы",
    bestStrengthProgress: "Лучший силовой прогресс",
    biggestImprovement: "Самый большой рост рабочего веса.",
    bestSet: "Лучший подход",
    bestWeight: "Лучший вес",
    muscleFocus: "Фокус по мышцам",
    muscleFocusHint: "Объём силовой работы по группам мышц.",
    personalRecords: "Личные рекорды",
    personalRecordsHint: "Здесь показаны только упражнения с реальным рабочим весом.",
    bodyweightAchievements: "Достижения без веса",
    loadingBodyweight: "Загружаем результаты без веса...",
    noBodyweightTitle: "Пока нет достижений без веса",
    noBodyweightMessage:
      "Выполните отжимания, подтягивания, пресс, растяжку или кардио, чтобы увидеть достижения здесь.",
    bodyweightSets: "Подходы без веса",
    withoutKgRecords: "без записи кг",
    totalReps: "Всего повторов",
    topBodyweightExercise: "Лучшее упражнение без веса",
    sessions: "сессий",
    last: "Последний раз",
    noWeightHistoryTitle: "Истории веса пока нет",
    noWeightHistoryMessage:
      "Добавьте первую запись веса, чтобы начать отслеживать прогресс формы.",
    first: "Первый",
    progress: "Прогресс",
    sets: "Подходы",
    reps: "Повторы",
    bestSetShort: "Лучший",
    volume: "объём",
    weightedSetsShort: "подходов с весом",
    progressKg: "прогресс",
    kg: "кг",
    other: "Другое",
  },
  kk: {
    intro:
      "Бұл жерде дене салмағы, қатысу, күш рекордтары және өз салмағымен орындалған жаттығулар нәтижелері жиналады.",
    latestBodyWeightChanges: "Дене салмағының соңғы өзгерістері.",
    attendance: "Қатысу",
    thisMonth: "Осы ай",
    attended: "Қатысты",
    missed: "Қалдырды",
    rest: "Демалыс",
    currentStreak: "Қазіргі серия",
    best: "Үздік",
    days: "күн",
    last28Days: "Соңғы 28 күн",
    attendanceHint: "Жасыл — қатысты, қызыл — қалдырды, сұр — демалыс.",
    strengthProgress: "Күш прогресі",
    loadingStrength: "Күш прогресі жүктелуде...",
    noWeightedTitle: "Әзірге салмақпен нәтиже жоқ",
    noWeightedMessage:
      "Жим, присед немесе тарту сияқты салмақпен жаттығуларды орындасаңыз, рекордтар осында шығады.",
    totalVolume: "Жалпы көлем",
    weightedSets: "Салмақпен сеттер",
    exercises: "жаттығу",
    weightTimesReps: "салмақ × қайталау",
    bestStrengthProgress: "Ең жақсы күш прогресі",
    biggestImprovement: "Жұмыс салмағы бойынша ең үлкен өсім.",
    bestSet: "Ең жақсы сет",
    bestWeight: "Ең жақсы салмақ",
    muscleFocus: "Бұлшықет фокусы",
    muscleFocusHint: "Бұлшықет топтары бойынша күш жаттығуларының көлемі.",
    personalRecords: "Жеке рекордтар",
    personalRecordsHint: "Мұнда тек нақты жұмыс салмағы бар жаттығулар көрсетіледі.",
    bodyweightAchievements: "Өз салмағымен жетістіктер",
    loadingBodyweight: "Өз салмағымен нәтижелер жүктелуде...",
    noBodyweightTitle: "Әзірге өз салмағымен жетістік жоқ",
    noBodyweightMessage:
      "Отжимание, подтягивание, пресс, созылу немесе кардио орындасаңыз, жетістіктер осында шығады.",
    bodyweightSets: "Салмақсыз сеттер",
    withoutKgRecords: "кг жазбасыз",
    totalReps: "Жалпы қайталау",
    topBodyweightExercise: "Ең жақсы салмақсыз жаттығу",
    sessions: "сессия",
    last: "Соңғы",
    noWeightHistoryTitle: "Салмақ тарихы әлі жоқ",
    noWeightHistoryMessage:
      "Дене прогресін бақылау үшін алғашқы салмақ жазбасын қосыңыз.",
    first: "Бірінші",
    progress: "Прогресс",
    sets: "Сеттер",
    reps: "Қайталау",
    bestSetShort: "Үздік",
    volume: "көлем",
    weightedSetsShort: "салмақпен сет",
    progressKg: "прогресс",
    kg: "кг",
    other: "Басқа",
  },
};

const BODYWEIGHT_KEYWORDS = [
  "pushup",
  "push-up",
  "push up",
  "pushups",
  "pullup",
  "pull-up",
  "pull up",
  "pullups",
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
  "burpee",
];

const EXERCISE_NAME_ALIASES: Record<string, string> = {
  "bench press": "Barbell Bench Press",
  "barbell bench press": "Barbell Bench Press",
  "barbell bench press medium grip": "Barbell Bench Press",
  "barbell bench press - medium grip": "Barbell Bench Press",
  "штанганы жатып сығымдау": "Barbell Bench Press",
  "жим лежа": "Barbell Bench Press",
  "жим лёжа": "Barbell Bench Press",

  "push-up": "Pushups",
  "push up": "Pushups",
  pushup: "Pushups",
  pushups: "Pushups",
  "отжимания": "Pushups",

  "cable fly": "Cable Crossover",
  "cable flyes": "Cable Crossover",
  "cable crossover": "Cable Crossover",
  "кроссовер": "Cable Crossover",

  "incline bench press": "Incline Barbell Bench Press",
  "incline barbell bench press": "Incline Barbell Bench Press",

  "decline bench press": "Decline Barbell Bench Press",
  "decline barbell bench press": "Decline Barbell Bench Press",

  "dumbbell bench press": "Dumbbell Bench Press",
  "dumbbell press": "Dumbbell Bench Press",

  "wide-grip barbell bench press": "Wide-Grip Barbell Bench Press",
  "wide grip barbell bench press": "Wide-Grip Barbell Bench Press",

  "lat pulldown": "Wide-Grip Lat Pulldown",
  "wide-grip lat pulldown": "Wide-Grip Lat Pulldown",
  "wide grip lat pulldown": "Wide-Grip Lat Pulldown",

  "barbell squat": "Barbell Squat",
  squat: "Barbell Squat",
  "leg press": "Leg Press",

  deadlift: "Deadlift",
  "clean deadlift": "Deadlift",

  "barbell row": "Bent Over Barbell Row",
  "bent over row": "Bent Over Barbell Row",
  "bent over barbell row": "Bent Over Barbell Row",

  "shoulder press": "Barbell Shoulder Press",
  "barbell shoulder press": "Barbell Shoulder Press",

  "barbell curl": "Barbell Curl",
  "bicep curl": "Dumbbell Bicep Curl",
  "dumbbell bicep curl": "Dumbbell Bicep Curl",

  "triceps pushdown": "Triceps Pushdown",
  "rope pushdown": "Triceps Pushdown - Rope Attachment",

  crunch: "Crunches",
  crunches: "Crunches",
  "air bike": "Air Bike",
};

function getLangSafe(lang: string): AppLangCode {
  if (lang === "ru" || lang === "kk" || lang === "en") return lang;
  return "en";
}

function normalizeExerciseNameForMatch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/[()]/g, "")
    .replace(/[-]+/g, " ")
    .replace(/\s+/g, " ");
}

function toLocalYMD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function getEntryTime(date: string, id: string) {
  const time = new Date(date).getTime();

  if (!Number.isNaN(time)) return time;

  const idNumber = Number(String(id).replace(/\D/g, ""));

  return Number.isNaN(idNumber) ? 0 : idNumber;
}

function formatEntryDate(date: string) {
  if (!date) return "";

  if (date.includes("T")) return date.slice(0, 10);

  return date;
}

function getSafeDate(value?: string) {
  const date = value ? new Date(value) : new Date(0);

  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function formatHistoryDate(value?: string, lang: AppLangCode = "en") {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return formatEntryDate(value);

  const locale = lang === "ru" ? "ru-RU" : lang === "kk" ? "kk-KZ" : "en-US";

  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
}

function normalizeMuscleGroup(value?: string | null) {
  const raw = (value ?? "Other").trim();

  if (!raw) return "Other";

  const map: Record<string, string> = {
    chest: "Chest",
    back: "Back",
    legs: "Legs",
    leg: "Legs",
    quads: "Legs",
    quadriceps: "Legs",
    hamstrings: "Legs",
    calves: "Legs",
    calf: "Legs",
    glutes: "Glutes",
    glute: "Glutes",
    shoulders: "Shoulders",
    shoulder: "Shoulders",
    delts: "Shoulders",
    biceps: "Biceps",
    bicep: "Biceps",
    triceps: "Triceps",
    tricep: "Triceps",
    abs: "Abs",
    core: "Abs",
    cardio: "Cardio",
    stretching: "Stretching",
    mobility: "Stretching",
  };

  return map[raw.toLowerCase()] ?? raw;
}

function getMuscleLabel(value: string | undefined | null, lang: AppLangCode) {
  const normalized = normalizeMuscleGroup(value);

  const ru: Record<string, string> = {
    Chest: "Грудь",
    Back: "Спина",
    Legs: "Ноги",
    Glutes: "Ягодицы",
    Shoulders: "Плечи",
    Biceps: "Бицепс",
    Triceps: "Трицепс",
    Abs: "Пресс",
    Cardio: "Кардио",
    Stretching: "Растяжка",
    Other: "Другое",
  };

  const kk: Record<string, string> = {
    Chest: "Кеуде",
    Back: "Арқа",
    Legs: "Аяқ",
    Glutes: "Бөксе",
    Shoulders: "Иық",
    Biceps: "Бицепс",
    Triceps: "Трицепс",
    Abs: "Іш бұлшықет",
    Cardio: "Кардио",
    Stretching: "Созылу",
    Other: "Басқа",
  };

  if (lang === "ru") return ru[normalized] ?? normalized;
  if (lang === "kk") return kk[normalized] ?? normalized;

  return normalized;
}

function isPositiveWeight(value?: number | null) {
  return value !== undefined && value !== null && Number(value) > 0;
}

function isBodyweightExercise(name?: string, muscleGroup?: string | null) {
  const n = normalizeExerciseNameForMatch(name ?? "");
  const g = (muscleGroup ?? "").toLowerCase();

  if (g === "cardio" || g === "stretching") return true;

  return BODYWEIGHT_KEYWORDS.some((keyword) =>
    n.includes(normalizeExerciseNameForMatch(keyword)),
  );
}

function getSetVolume(set: ExerciseHistorySet) {
  const weight = Number(set.weight ?? 0);
  const reps = Number(set.actualReps ?? 0);

  if (weight <= 0 || reps <= 0) return 0;

  return weight * reps;
}

function findLibraryExerciseByName(name: string) {
  const normalizedName = normalizeExerciseNameForMatch(name);
  const aliasTarget = EXERCISE_NAME_ALIASES[normalizedName];

  if (aliasTarget) {
    const aliasNormalized = normalizeExerciseNameForMatch(aliasTarget);

    const aliasMatch = EXERCISE_LIBRARY.find(
      (item) => normalizeExerciseNameForMatch(item.name) === aliasNormalized,
    );

    if (aliasMatch) return aliasMatch;
  }

  const exactMatch = EXERCISE_LIBRARY.find(
    (item) => normalizeExerciseNameForMatch(item.name) === normalizedName,
  );

  if (exactMatch) return exactMatch;

  const containsMatch = EXERCISE_LIBRARY.find((item) => {
    const libraryName = normalizeExerciseNameForMatch(item.name);

    return (
      libraryName.includes(normalizedName) || normalizedName.includes(libraryName)
    );
  });

  if (containsMatch) return containsMatch;

  return undefined;
}

function getTranslatedExerciseName(name: string, lang: AppLangCode) {
  const libraryItem = findLibraryExerciseByName(name);

  if (!libraryItem) return name;

  return getExerciseName(libraryItem, lang);
}

function normalizeBackendHistoryItem(item: any): ExerciseHistoryItem {
  const exerciseName = String(
    item.exerciseName ?? item.exercise_name ?? "Exercise",
  );

  const muscleGroup = item.muscleGroup ?? item.muscle_group ?? "Other";
  const workoutId = String(item.workoutId ?? item.workout_id ?? "");
  const createdAt =
    item.createdAt ?? item.created_at ?? new Date().toISOString();

  return {
    exerciseName,
    muscleGroup,
    workoutId,
    createdAt,
    sets: Array.isArray(item.sets)
      ? item.sets.map((set: any, index: number) => {
          const rawWeight =
            set.weight === undefined || set.weight === null
              ? null
              : Number(set.weight);

          return {
            id: String(set.id ?? `set_${index}`),
            clientId: set.clientId ?? set.client_id,
            coachId: set.coachId ?? set.coach_id,
            workoutId: String(set.workoutId ?? set.workout_id ?? workoutId),
            exerciseId: set.exerciseId ?? set.exercise_id ?? null,
            exerciseName: String(
              set.exerciseName ?? set.exercise_name ?? exerciseName,
            ),
            muscleGroup: set.muscleGroup ?? set.muscle_group ?? muscleGroup,
            setNumber: Number(set.setNumber ?? set.set_number ?? index + 1),
            targetReps: Number(set.targetReps ?? set.target_reps ?? 0),
            actualReps: Number(set.actualReps ?? set.actual_reps ?? 0),
            weight: rawWeight && rawWeight > 0 ? rawWeight : null,
            notes: set.notes ?? null,
            createdAt: set.createdAt ?? set.created_at ?? createdAt,
          };
        })
      : [],
  };
}

function buildFallbackHistoryFromLocalDB(
  db: any,
  clientId: string,
): ExerciseHistoryItem[] {
  const completedWorkouts = db.workouts
    .filter((workout: any) => workout.clientId === clientId && workout.completed)
    .slice()
    .sort((a: any, b: any) => {
      const at = getSafeDate(a.completedAt ?? a.date).getTime();
      const bt = getSafeDate(b.completedAt ?? b.date).getTime();

      return bt - at;
    });

  return completedWorkouts.flatMap((workout: any) => {
    const exercises = db.exercises.filter(
      (exercise: any) => exercise.workoutId === workout.id,
    );

    return exercises.map((exercise: any) => {
      const setCount = Math.max(1, Number(exercise.sets ?? 1));
      const createdAt =
        workout.completedAt ?? workout.date ?? new Date().toISOString();

      const exerciseWeight =
        exercise.weight !== undefined &&
        exercise.weight !== null &&
        Number(exercise.weight) > 0
          ? Number(exercise.weight)
          : null;

      return {
        exerciseName: exercise.name,
        muscleGroup: exercise.muscleGroup ?? "Other",
        workoutId: workout.id,
        createdAt,
        sets: Array.from({ length: setCount }).map((_, index) => ({
          id: `${exercise.id}_fallback_${index + 1}`,
          clientId,
          coachId: workout.coachId,
          workoutId: workout.id,
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          muscleGroup: exercise.muscleGroup ?? "Other",
          setNumber: index + 1,
          targetReps: Number(exercise.reps ?? 0),
          actualReps: Number(exercise.reps ?? 0),
          weight: exerciseWeight,
          notes: exercise.notes ?? null,
          createdAt,
        })),
      };
    });
  });
}

function getWeightedHistory(history: ExerciseHistoryItem[]) {
  return history
    .map((item) => ({
      ...item,
      sets: item.sets.filter((set) => isPositiveWeight(set.weight)),
    }))
    .filter((item) => item.sets.length > 0);
}

function getBodyweightHistory(history: ExerciseHistoryItem[]) {
  return history
    .map((item) => {
      const weightedSets = item.sets.filter((set) =>
        isPositiveWeight(set.weight),
      );

      const noWeightSets = item.sets.filter(
        (set) => !isPositiveWeight(set.weight),
      );

      const bodyweightByName = isBodyweightExercise(
        item.exerciseName,
        item.muscleGroup,
      );

      if (bodyweightByName) {
        return {
          ...item,
          sets: noWeightSets.length > 0 ? noWeightSets : item.sets,
        };
      }

      if (weightedSets.length === 0 && noWeightSets.length > 0) {
        return {
          ...item,
          sets: noWeightSets,
        };
      }

      return {
        ...item,
        sets: [],
      };
    })
    .filter((item) => item.sets.length > 0);
}

function buildMuscleSummaries(
  weightedHistory: ExerciseHistoryItem[],
): MuscleSummary[] {
  const map = new Map<string, MuscleSummary>();

  weightedHistory.forEach((item) => {
    const muscleGroup = normalizeMuscleGroup(item.muscleGroup);

    const current = map.get(muscleGroup) ?? {
      muscleGroup,
      exerciseCount: 0,
      setCount: 0,
      bestWeight: 0,
      totalVolume: 0,
      lastDate: item.createdAt,
    };

    current.exerciseCount += 1;
    current.setCount += item.sets.length;

    item.sets.forEach((set) => {
      const weight = Number(set.weight ?? 0);

      current.bestWeight = Math.max(current.bestWeight, weight);
      current.totalVolume += getSetVolume(set);
    });

    if (
      getSafeDate(item.createdAt).getTime() >
      getSafeDate(current.lastDate).getTime()
    ) {
      current.lastDate = item.createdAt;
    }

    map.set(muscleGroup, current);
  });

  return Array.from(map.values()).sort((a, b) => b.totalVolume - a.totalVolume);
}

function buildWeightedExerciseProgress(
  weightedHistory: ExerciseHistoryItem[],
): WeightedExerciseProgress[] {
  const grouped = new Map<string, ExerciseHistoryItem[]>();

  weightedHistory.forEach((item) => {
    const key = normalizeExerciseNameForMatch(item.exerciseName);
    const current = grouped.get(key) ?? [];

    current.push(item);
    grouped.set(key, current);
  });

  return Array.from(grouped.values())
    .map((items) => {
      const sorted = items
        .slice()
        .sort(
          (a, b) =>
            getSafeDate(a.createdAt).getTime() -
            getSafeDate(b.createdAt).getTime(),
        );

      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const allSets = sorted.flatMap((item) => item.sets ?? []);
      const firstSets = first?.sets ?? [];
      const lastSets = last?.sets ?? [];

      const firstWeight = Math.max(
        0,
        ...firstSets.map((set) => Number(set.weight ?? 0)),
      );

      const lastWeight = Math.max(
        0,
        ...lastSets.map((set) => Number(set.weight ?? 0)),
      );

      const bestSet = allSets
        .slice()
        .sort((a, b) => {
          const weightDiff = Number(b.weight ?? 0) - Number(a.weight ?? 0);

          if (weightDiff !== 0) return weightDiff;

          return Number(b.actualReps ?? 0) - Number(a.actualReps ?? 0);
        })[0];

      const bestWeight = Number(bestSet?.weight ?? 0);
      const bestReps = Number(bestSet?.actualReps ?? 0);
      const totalVolume = allSets.reduce(
        (sum, set) => sum + getSetVolume(set),
        0,
      );

      return {
        exerciseName: last?.exerciseName ?? "Exercise",
        muscleGroup: normalizeMuscleGroup(last?.muscleGroup ?? first?.muscleGroup),
        firstWeight,
        lastWeight,
        bestWeight,
        bestReps,
        progress: lastWeight - firstWeight,
        setCount: allSets.length,
        totalVolume,
        lastDate: last?.createdAt ?? "",
      };
    })
    .filter((item) => item.bestWeight > 0)
    .sort((a, b) => {
      const progressDiff = b.progress - a.progress;

      if (progressDiff !== 0) return progressDiff;

      return b.bestWeight - a.bestWeight;
    });
}

function buildBodyweightProgress(
  bodyweightHistory: ExerciseHistoryItem[],
): BodyweightExerciseProgress[] {
  const grouped = new Map<string, ExerciseHistoryItem[]>();

  bodyweightHistory.forEach((item) => {
    const key = normalizeExerciseNameForMatch(item.exerciseName);
    const current = grouped.get(key) ?? [];

    current.push(item);
    grouped.set(key, current);
  });

  return Array.from(grouped.values())
    .map((items) => {
      const sorted = items
        .slice()
        .sort(
          (a, b) =>
            getSafeDate(a.createdAt).getTime() -
            getSafeDate(b.createdAt).getTime(),
        );

      const last = sorted[sorted.length - 1];
      const allSets = sorted.flatMap((item) => item.sets ?? []);

      const totalReps = allSets.reduce(
        (sum, set) => sum + Math.max(0, Number(set.actualReps ?? 0)),
        0,
      );

      const bestReps = Math.max(
        0,
        ...allSets.map((set) => Number(set.actualReps ?? 0)),
      );

      return {
        exerciseName: last?.exerciseName ?? "Exercise",
        muscleGroup: normalizeMuscleGroup(last?.muscleGroup),
        sessions: sorted.length,
        setCount: allSets.length,
        totalReps,
        bestReps,
        lastDate: last?.createdAt ?? "",
      };
    })
    .filter((item) => item.setCount > 0)
    .sort((a, b) => {
      const repsDiff = b.totalReps - a.totalReps;

      if (repsDiff !== 0) return repsDiff;

      return b.bestReps - a.bestReps;
    });
}

export default function ClientProgress() {
  const { theme } = useTheme();
  const { t, lang } = useI18n();
  const { user, token } = useAuth();
  const { db } = useData();
  const w = Dimensions.get("window").width;

  const currentLang = getLangSafe(lang);
  const L = TEXT[currentLang];

  const [exerciseHistory, setExerciseHistory] = useState<ExerciseHistoryItem[]>(
    [],
  );

  const [historyLoading, setHistoryLoading] = useState<boolean>(false);

 const loadExerciseHistory = useCallback(async () => {
  if (!token || !user) return;

  try {
    setHistoryLoading(true);

    const res = await apiGet("/exercise-results/me/history", {
      token,
    });

    setExerciseHistory(
      Array.isArray(res) ? res.map(normalizeBackendHistoryItem) : [],
    );
  } catch (e) {
    console.log("[client-progress] load exercise history error", e);
    setExerciseHistory([]);
  } finally {
    setHistoryLoading(false);
  }
}, [token, user]);

  useEffect(() => {
    loadExerciseHistory();
  }, [loadExerciseHistory]);

  const data = useMemo(() => {
    if (!db || !user) return null;

    const profile = db.clientProfiles.find((c) => c.userId === user.id);

    const entriesAsc = db.progress
      .filter((p) => p.clientId === user.id)
      .slice()
      .sort((a, b) => {
        const timeA = getEntryTime(a.date, a.id);
        const timeB = getEntryTime(b.date, b.id);

        return timeA - timeB;
      });

    const entriesDesc = entriesAsc.slice().reverse();
    const latestEntry = entriesDesc[0];

    const latestWeight = latestEntry?.weight ?? profile?.currentWeight ?? 0;
    const startWeight = profile?.startWeight ?? latestWeight;

    const attendance = db.attendance
      .filter((a) => a.clientId === user.id)
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));

    const streak = db.streaks.find((s) => s.clientId === user.id);

    const attendanceGrid: {
      date: string;
      status?: AttendanceStatus;
    }[] = [];

    const today = new Date();

    for (let i = 27; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);

      const date = toLocalYMD(d);
      const found = attendance.find((a) => a.date === date);

      attendanceGrid.push({
        date,
        status: found?.status as AttendanceStatus | undefined,
      });
    }

    const attendedCount = attendanceGrid.filter(
      (a) => a.status === "attended",
    ).length;

    const missedCount = attendanceGrid.filter(
      (a) => a.status === "missed",
    ).length;

    const restCount = attendanceGrid.filter((a) => a.status === "rest").length;
    const markedCount = attendanceGrid.filter((a) => !!a.status).length;

    const attendanceRate =
      markedCount > 0 ? Math.round((attendedCount / markedCount) * 100) : 0;

    const fallbackHistory = buildFallbackHistoryFromLocalDB(db, user.id);

    const finalExerciseHistory =
      exerciseHistory.length > 0 ? exerciseHistory : fallbackHistory;

    const weightedHistory = getWeightedHistory(finalExerciseHistory);
    const bodyweightHistory = getBodyweightHistory(finalExerciseHistory);

    const muscleSummaries = buildMuscleSummaries(weightedHistory);
    const weightedProgress = buildWeightedExerciseProgress(weightedHistory);
    const bodyweightProgress = buildBodyweightProgress(bodyweightHistory);

    const totalStrengthVolume = muscleSummaries.reduce(
      (sum, item) => sum + item.totalVolume,
      0,
    );

    const totalWeightedSets = weightedHistory.reduce(
      (sum, item) => sum + item.sets.length,
      0,
    );

    const totalBodyweightSets = bodyweightProgress.reduce(
      (sum, item) => sum + item.setCount,
      0,
    );

    const totalBodyweightReps = bodyweightProgress.reduce(
      (sum, item) => sum + item.totalReps,
      0,
    );

    const bestStrengthProgress = weightedProgress[0];
    const bestBodyweightExercise = bodyweightProgress[0];

    return {
      profile,
      entriesAsc,
      entriesDesc,
      latestWeight,
      startWeight,

      attendance,
      attendanceGrid,
      attendedCount,
      missedCount,
      restCount,
      markedCount,
      attendanceRate,
      streak,

      exerciseHistory: finalExerciseHistory,
      weightedHistory,
      bodyweightHistory,
      muscleSummaries,
      weightedProgress,
      bodyweightProgress,
      totalStrengthVolume,
      totalWeightedSets,
      totalBodyweightSets,
      totalBodyweightReps,
      bestStrengthProgress,
      bestBodyweightExercise,
    };
  }, [db, user, exerciseHistory]);

  if (!db || !user || !data) return null;

  const change = data.latestWeight - data.startWeight;
  const losing = change < 0;
  const chartWidth = Math.max(260, w - 80);

  return (
    <ScreenContainer scroll>
      <View style={{ gap: 18 }}>
        <View>
          <SectionHeader title={t("progress.title")} />

          <AppText
            variant="small"
            color={theme.colors.textMuted}
            style={{ marginTop: -4 }}
          >
            {L.intro}
          </AppText>
        </View>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <StatCard
            label={t("progress.current")}
            value={`${data.latestWeight} ${t("common.kg")}`}
            hint={t("progress.latestWeight")}
          />

          <StatCard
            label={losing ? t("progress.lost") : t("progress.gained")}
            value={`${Math.abs(change).toFixed(1)} ${t("common.kg")}`}
            hint={`${t("progress.since")} ${data.startWeight} ${t("common.kg")}`}
            tone={losing ? "primary" : "warn"}
            icon={
              losing ? (
                <TrendingDown size={16} color="#fff" />
              ) : (
                <TrendingUp size={16} color="#fff" />
              )
            }
          />
        </View>

        <AppCard variant="elevated">
          <View style={{ gap: 12 }}>
            <View>
              <AppText variant="h3">{t("progress.weightTrend")}</AppText>

              <AppText variant="small" color={theme.colors.textMuted}>
                {L.latestBodyWeightChanges}
              </AppText>
            </View>

            <WeightChart values={data.entriesAsc} width={chartWidth} />
          </View>
        </AppCard>

        <AppButton
          title={t("progress.logWeight")}
          icon={<Plus size={18} color={theme.colors.primaryContrast} />}
          onPress={() => router.push("/add-weight")}
          fullWidth
        />

        <SectionHeader
          title={L.attendance}
          icon={<Flame color={theme.colors.fire} size={18} />}
        />

        <View style={{ flexDirection: "row", gap: 12 }}>
          <StatCard
            label={L.thisMonth}
            value={`${data.attendanceRate}%`}
            hint={`${data.attendedCount}/${Math.max(
              1,
              data.markedCount,
            )} ${L.attended.toLowerCase()}`}
            icon={<CheckCircle2 color={theme.colors.primary} size={16} />}
          />

          <StatCard
            label={L.currentStreak}
            value={data.streak?.currentStreak ?? 0}
            hint={`${L.best} ${data.streak?.bestStreak ?? 0} ${L.days}`}
            tone="fire"
            icon={<Flame color="#fff" size={16} fill="#fff" />}
          />
        </View>

        <AppCard variant="outline">
          <View style={{ gap: 14 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{L.last28Days}</AppText>

                <AppText variant="small" color={theme.colors.textMuted}>
                  {L.attendanceHint}
                </AppText>
              </View>

              <StreakPill count={data.streak?.currentStreak ?? 0} />
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {data.attendanceGrid.map((day) => {
                const isToday = day.date === toLocalYMD(new Date());

                const bg =
                  day.status === "attended"
                    ? theme.colors.primary
                    : day.status === "missed"
                      ? theme.colors.danger
                      : day.status === "rest"
                        ? theme.colors.surfaceAlt
                        : theme.colors.surface;

                const borderColor = isToday
                  ? theme.colors.fire
                  : theme.colors.borderSoft;

                return (
                  <View
                    key={day.date}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: bg,
                      borderWidth: isToday ? 2 : 1,
                      borderColor,
                    }}
                  >
                    {day.status === "attended" ? (
                      <CheckCircle2 color="#fff" size={15} />
                    ) : day.status === "missed" ? (
                      <XCircle color="#fff" size={15} />
                    ) : day.status === "rest" ? (
                      <Circle color={theme.colors.textMuted} size={14} />
                    ) : (
                      <AppText variant="caption" color={theme.colors.textFaint}>
                        {day.date.slice(8, 10)}
                      </AppText>
                    )}
                  </View>
                );
              })}
            </View>

            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <MiniStat
                label={L.attended}
                value={data.attendedCount}
                color={theme.colors.primary}
              />

              <MiniStat
                label={L.missed}
                value={data.missedCount}
                color={theme.colors.danger}
              />

              <MiniStat
                label={L.rest}
                value={data.restCount}
                color={theme.colors.textMuted}
              />
            </View>
          </View>
        </AppCard>

        <SectionHeader
          title={L.strengthProgress}
          icon={<Trophy color={theme.colors.primary} size={18} />}
        />

        {historyLoading ? (
          <AppCard variant="outline">
            <AppText variant="small" color={theme.colors.textMuted}>
              {L.loadingStrength}
            </AppText>
          </AppCard>
        ) : data.weightedProgress.length === 0 ? (
          <EmptyAnalyticsCard title={L.noWeightedTitle} message={L.noWeightedMessage} />
        ) : (
          <>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <StatCard
                label={L.totalVolume}
                value={`${Math.round(data.totalStrengthVolume)}${L.kg}`}
                hint={L.weightTimesReps}
                icon={<TrendingUp color={theme.colors.primary} size={16} />}
              />

              <StatCard
                label={L.weightedSets}
                value={data.totalWeightedSets}
                hint={`${data.weightedProgress.length} ${L.exercises}`}
                icon={<Award color={theme.colors.fire} size={16} />}
              />
            </View>

            {data.bestStrengthProgress ? (
              <AppCard variant="elevated">
                <View style={{ gap: 12 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 14,
                        backgroundColor: "rgba(255,176,32,0.16)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Trophy color={theme.colors.fire} size={22} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <AppText variant="h3">{L.bestStrengthProgress}</AppText>

                      <AppText variant="small" color={theme.colors.textMuted}>
                        {L.biggestImprovement}
                      </AppText>
                    </View>
                  </View>

                  <View
                    style={{
                      padding: 14,
                      borderRadius: theme.radius.md,
                      backgroundColor: theme.colors.surfaceAlt,
                      gap: 6,
                    }}
                  >
                    <AppText variant="h3">
                      {getTranslatedExerciseName(
                        data.bestStrengthProgress.exerciseName,
                        currentLang,
                      )}
                    </AppText>

                    <AppText variant="small" color={theme.colors.textMuted}>
                      {getMuscleLabel(
                        data.bestStrengthProgress.muscleGroup,
                        currentLang,
                      )}{" "}
                      · {L.bestSet} {data.bestStrengthProgress.bestWeight}
                      {L.kg} × {data.bestStrengthProgress.bestReps}
                    </AppText>

                    <AppText
                      variant="bodyStrong"
                      color={
                        data.bestStrengthProgress.progress >= 0
                          ? theme.colors.success
                          : theme.colors.danger
                      }
                    >
                      {data.bestStrengthProgress.progress >= 0 ? "+" : ""}
                      {data.bestStrengthProgress.progress.toFixed(1)}
                      {L.kg} {L.progressKg}
                    </AppText>
                  </View>
                </View>
              </AppCard>
            ) : null}

            <View style={{ gap: 10 }}>
              <View>
                <AppText variant="h3">{L.muscleFocus}</AppText>

                <AppText variant="small" color={theme.colors.textMuted}>
                  {L.muscleFocusHint}
                </AppText>
              </View>

              {data.muscleSummaries.slice(0, 6).map((item) => (
                <MuscleFocusCard
                  key={item.muscleGroup}
                  item={item}
                  maxVolume={data.muscleSummaries[0]?.totalVolume ?? 1}
                />
              ))}
            </View>

            <View style={{ gap: 10 }}>
              <View>
                <AppText variant="h3">{L.personalRecords}</AppText>

                <AppText variant="small" color={theme.colors.textMuted}>
                  {L.personalRecordsHint}
                </AppText>
              </View>

              {data.weightedProgress.slice(0, 8).map((item) => (
                <WeightedRecordCard key={item.exerciseName} item={item} />
              ))}
            </View>
          </>
        )}

        <SectionHeader
          title={L.bodyweightAchievements}
          icon={<Activity color={theme.colors.accent} size={18} />}
        />

        {historyLoading ? (
          <AppCard variant="outline">
            <AppText variant="small" color={theme.colors.textMuted}>
              {L.loadingBodyweight}
            </AppText>
          </AppCard>
        ) : data.bodyweightProgress.length === 0 ? (
          <EmptyAnalyticsCard
            title={L.noBodyweightTitle}
            message={L.noBodyweightMessage}
          />
        ) : (
          <>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <StatCard
                label={L.bodyweightSets}
                value={data.totalBodyweightSets}
                hint={L.withoutKgRecords}
                icon={<Dumbbell color={theme.colors.accent} size={16} />}
              />

              <StatCard
                label={L.totalReps}
                value={data.totalBodyweightReps}
                hint={`${data.bodyweightProgress.length} ${L.exercises}`}
                icon={<Target color={theme.colors.fire} size={16} />}
              />
            </View>

            {data.bestBodyweightExercise ? (
              <BodyweightCard item={data.bestBodyweightExercise} highlighted />
            ) : null}

            <View style={{ gap: 10 }}>
              {data.bodyweightProgress.slice(0, 6).map((item) => (
                <BodyweightCard key={item.exerciseName} item={item} />
              ))}
            </View>
          </>
        )}

        <SectionHeader title={t("progress.history")} />

        <View style={{ gap: 8 }}>
          {data.entriesDesc.length === 0 ? (
            <EmptyAnalyticsCard
              title={L.noWeightHistoryTitle}
              message={L.noWeightHistoryMessage}
            />
          ) : (
            data.entriesDesc.map((e, i, arr) => {
              const prevOlder = arr[i + 1];
              const diff = prevOlder ? e.weight - prevOlder.weight : 0;

              return (
                <AppCard key={e.id} variant="outline">
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <View>
                      <AppText variant="bodyStrong">
                        {e.weight} {t("common.kg")}
                      </AppText>

                      <AppText variant="small" color={theme.colors.textMuted}>
                        {formatEntryDate(e.date)}
                      </AppText>
                    </View>

                    {prevOlder ? (
                      <AppText
                        variant="bodyStrong"
                        color={
                          diff <= 0 ? theme.colors.success : theme.colors.warn
                        }
                      >
                        {diff > 0 ? "+" : ""}
                        {diff.toFixed(1)} {t("common.kg")}
                      </AppText>
                    ) : (
                      <AppText variant="small" color={theme.colors.textMuted}>
                        {t("progress.start")}
                      </AppText>
                    )}
                  </View>

                  {e.notes ? (
                    <AppText
                      variant="small"
                      color={theme.colors.textMuted}
                      style={{ marginTop: 6 }}
                    >
                      {e.notes}
                    </AppText>
                  ) : null}
                </AppCard>
              );
            })
          )}
        </View>

        <View style={{ height: 24 }} />
      </View>
    </ScreenContainer>
  );
}

function WeightedRecordCard({ item }: { item: WeightedExerciseProgress }) {
  const { theme } = useTheme();
  const { lang } = useI18n();

  const currentLang = getLangSafe(lang);
  const L = TEXT[currentLang];

  return (
    <AppCard variant="outline">
      <View style={{ gap: 10 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">
              {getTranslatedExerciseName(item.exerciseName, currentLang)}
            </AppText>

            <AppText variant="small" color={theme.colors.textMuted}>
              {getMuscleLabel(item.muscleGroup, currentLang)} · {item.setCount}{" "}
              {L.weightedSetsShort}
            </AppText>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <AppText variant="bodyStrong">
              {item.bestWeight}
              {L.kg}
            </AppText>

            <AppText variant="caption" color={theme.colors.textMuted}>
              {L.best}
            </AppText>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <MiniMetric
            label={L.first}
            value={item.firstWeight ? `${item.firstWeight}${L.kg}` : "—"}
          />

          <MiniMetric
            label={L.last}
            value={item.lastWeight ? `${item.lastWeight}${L.kg}` : "—"}
          />

          <MiniMetric
            label={L.progress}
            value={`${item.progress >= 0 ? "+" : ""}${item.progress.toFixed(
              1,
            )}${L.kg}`}
            positive={item.progress >= 0}
          />
        </View>

        <AppText variant="caption" color={theme.colors.textMuted}>
          {L.bestSet}: {item.bestWeight}
          {L.kg} × {item.bestReps} · {L.volume}:{" "}
          {Math.round(item.totalVolume)}
          {L.kg} · {L.last}: {formatHistoryDate(item.lastDate, currentLang)}
        </AppText>
      </View>
    </AppCard>
  );
}

function BodyweightCard({
  item,
  highlighted,
}: {
  item: BodyweightExerciseProgress;
  highlighted?: boolean;
}) {
  const { theme } = useTheme();
  const { lang } = useI18n();

  const currentLang = getLangSafe(lang);
  const L = TEXT[currentLang];

  return (
    <AppCard variant={highlighted ? "elevated" : "outline"}>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
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
            <Activity color={theme.colors.accent} size={20} />
          </View>

          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">
              {highlighted
                ? L.topBodyweightExercise
                : getTranslatedExerciseName(item.exerciseName, currentLang)}
            </AppText>

            <AppText variant="small" color={theme.colors.textMuted}>
              {highlighted
                ? getTranslatedExerciseName(item.exerciseName, currentLang)
                : getMuscleLabel(item.muscleGroup, currentLang)}
            </AppText>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <MiniMetric label={L.sets} value={String(item.setCount)} />
          <MiniMetric label={L.reps} value={String(item.totalReps)} />
          <MiniMetric
            label={L.bestSetShort}
            value={`${item.bestReps} ${L.reps.toLowerCase()}`}
            positive
          />
        </View>

        <AppText variant="caption" color={theme.colors.textMuted}>
          {item.sessions} {L.sessions} · {L.last}:{" "}
          {formatHistoryDate(item.lastDate, currentLang)}
        </AppText>
      </View>
    </AppCard>
  );
}

function MuscleFocusCard({
  item,
  maxVolume,
}: {
  item: MuscleSummary;
  maxVolume: number;
}) {
  const { theme } = useTheme();
  const { lang } = useI18n();

  const currentLang = getLangSafe(lang);
  const L = TEXT[currentLang];

  const percent = Math.min(
    100,
    (item.totalVolume / Math.max(1, maxVolume)) * 100,
  );

  return (
    <AppCard variant="outline">
      <View style={{ gap: 8 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">
              {getMuscleLabel(item.muscleGroup, currentLang)}
            </AppText>

            <AppText variant="small" color={theme.colors.textMuted}>
              {item.exerciseCount} {L.exercises} · {item.setCount}{" "}
              {L.weightedSetsShort}
            </AppText>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <AppText variant="bodyStrong">
              {Math.round(item.totalVolume)}
              {L.kg}
            </AppText>

            <AppText variant="caption" color={theme.colors.textMuted}>
              {L.volume}
            </AppText>
          </View>
        </View>

        <View
          style={{
            height: 8,
            borderRadius: 999,
            backgroundColor: theme.colors.surfaceAlt,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${percent}%`,
              height: 8,
              borderRadius: 999,
              backgroundColor: theme.colors.primary,
            }}
          />
        </View>

        <AppText variant="caption" color={theme.colors.textMuted}>
          {L.bestWeight}: {item.bestWeight}
          {L.kg} · {L.last}: {formatHistoryDate(item.lastDate, currentLang)}
        </AppText>
      </View>
    </AppCard>
  );
}

function MiniMetric({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: theme.radius.md,
        backgroundColor:
          positive === undefined
            ? theme.colors.surfaceAlt
            : positive
              ? "rgba(22,199,132,0.12)"
              : "rgba(255,73,73,0.12)",
      }}
    >
      <AppText variant="caption" color={theme.colors.textMuted}>
        {label}
      </AppText>

      <AppText
        variant="small"
        color={
          positive === undefined
            ? theme.colors.text
            : positive
              ? theme.colors.success
              : theme.colors.danger
        }
        style={{ fontWeight: "800" }}
      >
        {value}
      </AppText>
    </View>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View
      style={{
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: `${color}22`,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
        }}
      />

      <AppText variant="caption" style={{ fontWeight: "700" }}>
        {label}: {value}
      </AppText>
    </View>
  );
}

function EmptyAnalyticsCard({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  const { theme } = useTheme();

  return (
    <AppCard variant="outline">
      <View style={{ gap: 6 }}>
        <AppText variant="bodyStrong">{title}</AppText>

        <AppText variant="small" color={theme.colors.textMuted}>
          {message}
        </AppText>
      </View>
    </AppCard>
  );
}