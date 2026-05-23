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
  Send,
  Star,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserMinus,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { WeightChart } from "@/src/components/charts";
import {
  AppAvatar,
  AppButton,
  AppCard,
  AppEmptyState,
  AppInput,
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
import {
  EXERCISE_LIBRARY,
  getExerciseName,
} from "@/src/data/exerciseLibrary";
import { useI18n } from "@/src/i18n/I18nContext";
import { apiDelete, apiGet, apiPost, toAbsoluteUrl } from "@/src/services/api";

type AppLangCode = "en" | "ru" | "kk";

type Tab =
  | "overview"
  | "workouts"
  | "supps"
  | "progress"
  | "attendance"
  | "history";

type DayKey = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

const ALL_DAYS: DayKey[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type ClientAssessment = {
  id: string;
  coachId: string;
  clientId: string;
  coachName?: string | null;
  clientName?: string | null;
  disciplineRating: number;
  progressRating: number;
  communicationRating: number;
  averageRating: number;
  comment?: string | null;
  createdAt: string;
  updatedAt: string;
};

type ExerciseHistorySet = {
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

type ExerciseHistoryItem = {
  exerciseName: string;
  muscleGroup?: string | null;
  workoutId: string;
  createdAt: string;
  sets: ExerciseHistorySet[];
};

type SupplementLogForCoach = {
  id: string;
  clientId: string;
  supplementItemId: string;
  date: string;
  time: string;
  taken: boolean;
};

type MuscleSummary = {
  muscleGroup: string;
  exerciseCount: number;
  setCount: number;
  bestWeight: number;
  totalVolume: number;
  lastDate: string;
};

type ExerciseProgressSummary = {
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

const EXERCISE_NAME_ALIASES: Record<string, string> = {
  "bench press": "Barbell Bench Press",
  "barbell bench press": "Barbell Bench Press",
  "barbell bench press medium grip": "Barbell Bench Press",
  "barbell bench press - medium grip": "Barbell Bench Press",
  "жим лежа": "Barbell Bench Press",
  "жим лёжа": "Barbell Bench Press",
  "штанганы жатып сығымдау": "Barbell Bench Press",

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

  squat: "Barbell Squat",
  "barbell squat": "Barbell Squat",
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

  return containsMatch;
}

function getTranslatedExerciseName(name: string, lang: AppLangCode) {
  const libraryItem = findLibraryExerciseByName(name);

  if (!libraryItem) return name;

  return getExerciseName(libraryItem, lang);
}
type LocalizedWorkoutLike = {
  name?: string | null;
  nameRu?: string | null;
  nameKk?: string | null;
  name_ru?: string | null;
  name_kk?: string | null;

  weeklyPlanTitle?: string | null;
  weeklyPlanTitleRu?: string | null;
  weeklyPlanTitleKk?: string | null;
  weekly_plan_title?: string | null;
  weekly_plan_title_ru?: string | null;
  weekly_plan_title_kk?: string | null;

  source?: string | null;
};

function pickText(...values: Array<string | null | undefined>) {
  return (
    values
      .find((value) => typeof value === "string" && value.trim().length > 0)
      ?.trim() ?? ""
  );
}

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

function getAssignWeeklyPlanLabel(lang: AppLangCode) {
  if (lang === "ru") return "Назначить недельный план";
  if (lang === "kk") return "Апталық жоспар тағайындау";

  return "Assign weekly plan";
}
function ymd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function formatHistoryDate(value?: string, lang: AppLangCode = "en") {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.includes("T") ? value.slice(0, 10) : value;
  }

  const locale = lang === "ru" ? "ru-RU" : lang === "kk" ? "kk-KZ" : "en-US";

  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getSafeDate(value?: string) {
  const date = value ? new Date(value) : new Date(0);

  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function getTodayDayKey(): DayKey {
  const day = new Date().getDay();

  if (day === 1) return "Mon";
  if (day === 2) return "Tue";
  if (day === 3) return "Wed";
  if (day === 4) return "Thu";
  if (day === 5) return "Fri";
  if (day === 6) return "Sat";

  return "Sun";
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

function getDayLabel(day: DayKey, t: (key: any) => string) {
  if (day === "Mon") return t("days.mon");
  if (day === "Tue") return t("days.tue");
  if (day === "Wed") return t("days.wed");
  if (day === "Thu") return t("days.thu");
  if (day === "Fri") return t("days.fri");
  if (day === "Sat") return t("days.sat");

  return t("days.sun");
}

function formatDays(value: any, t: (key: any) => string) {
  const days = normalizeDays(value);

  if (days.length === 7) return t("clientDetail.everyDay");

  const weekdays: DayKey[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const weekends: DayKey[] = ["Sat", "Sun"];

  if (days.length === 5 && weekdays.every((day) => days.includes(day))) {
    return t("clientDetail.weekdays");
  }

  if (days.length === 2 && weekends.every((day) => days.includes(day))) {
    return t("clientDetail.weekends");
  }

  return days.map((day) => getDayLabel(day, t)).join(", ");
}

function isActiveToday(value: any) {
  const todayDay = getTodayDayKey();

  return normalizeDays(value).includes(todayDay);
}

function normalizeSupplementLog(item: any): SupplementLogForCoach {
  return {
    id: String(item.id),
    clientId: String(item.clientId ?? item.client_id ?? ""),
    supplementItemId: String(
      item.supplementItemId ?? item.supplement_item_id ?? "",
    ),
    date: item.date,
    time: item.time,
    taken: Boolean(item.taken),
  };
}

function normalizeClientProgressEntry(item: any, clientId: string, addedBy: string) {
  const createdAt = new Date().toISOString();

  return {
    id: String(item.id ?? `pr_${Date.now()}_${Math.random().toString(16).slice(2)}`),
    clientId: String(item.clientId ?? item.client_id ?? clientId),
    weight: Number(item.weight ?? 0),
    date: String(item.date ?? item.createdAt ?? item.created_at ?? createdAt),
    notes: item.notes ?? undefined,
    addedBy: String(item.addedBy ?? item.added_by ?? addedBy),
  };
}

function sortProgressByDate<T extends { date: string }>(items: T[]) {
  return items.slice().sort((a, b) => {
    const aTime = getSafeDate(a.date).getTime();
    const bTime = getSafeDate(b.date).getTime();

    if (aTime !== bTime) return aTime - bTime;

    return a.date.localeCompare(b.date);
  });
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
            clientId: String(set.clientId ?? set.client_id ?? ""),
            coachId: String(set.coachId ?? set.coach_id ?? ""),
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

function getMuscleGroupLabel(value: string | null | undefined, t: (key: any) => string) {
  const group = normalizeMuscleGroup(value);

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

function getFitnessLevelLabel(value: string | undefined, t: (key: any) => string) {
  if (value === "beginner") return t("auth.fitnessBeginner");
  if (value === "intermediate") return t("auth.fitnessIntermediate");
  if (value === "advanced") return t("auth.fitnessAdvanced");

  return value ? value.toUpperCase() : "—";
}

function getGoalLabel(profile: any, t: (key: any) => string) {
  const goalType = profile?.goalType ?? profile?.goal_type;

  if (goalType === "lose_weight") return t("auth.goalLose");
  if (goalType === "gain_muscle") return t("auth.goalGain");
  if (goalType === "improve_mobility") return t("auth.goalMobility");
  if (goalType === "maintain_shape") return t("auth.goalMaintain");

  return profile?.goal || "—";
}

function getSetVolume(set: ExerciseHistorySet) {
  const weight = Number(set.weight ?? 0);
  const reps = Number(set.actualReps ?? 0);

  if (!weight || !reps) return 0;

  return weight * reps;
}

function buildMuscleSummaries(history: ExerciseHistoryItem[]): MuscleSummary[] {
  const map = new Map<string, MuscleSummary>();

  history.forEach((item) => {
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
      current.bestWeight = Math.max(current.bestWeight, Number(set.weight ?? 0));
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

function buildExerciseProgress(
  history: ExerciseHistoryItem[],
): ExerciseProgressSummary[] {
  const grouped = new Map<string, ExerciseHistoryItem[]>();

  history.forEach((item) => {
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
      const weightedSets = allSets.filter(
        (set) =>
          set.weight !== undefined &&
          set.weight !== null &&
          Number(set.weight) > 0,
      );

      const firstWeight = Math.max(
        0,
        ...(first?.sets ?? []).map((set) => Number(set.weight ?? 0)),
      );

      const lastWeight = Math.max(
        0,
        ...(last?.sets ?? []).map((set) => Number(set.weight ?? 0)),
      );

      const bestSet = weightedSets
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
        muscleGroup: normalizeMuscleGroup(
          last?.muscleGroup ?? first?.muscleGroup,
        ),
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
    .sort((a, b) => {
      const progressDiff = b.progress - a.progress;

      if (progressDiff !== 0) return progressDiff;

      return b.bestWeight - a.bestWeight;
    });
}

export default function ClientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const { t, lang } = useI18n();
  const { user, token } = useAuth();
  const { db, update, refreshFromBackend } = useData();
  const { isActive } = useSubscription();

  const currentLang = getLangSafe(lang);

  const [tab, setTab] = useState<Tab>("overview");
  const [removingClient, setRemovingClient] = useState<boolean>(false);
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<string | null>(
    null,
  );

  const [assessment, setAssessment] = useState<ClientAssessment | null>(null);
  const [assessmentOpen, setAssessmentOpen] = useState<boolean>(false);
  const [savingAssessment, setSavingAssessment] = useState<boolean>(false);

  const [disciplineRating, setDisciplineRating] = useState<number>(5);
  const [progressRating, setProgressRating] = useState<number>(5);
  const [communicationRating, setCommunicationRating] = useState<number>(5);
  const [assessmentComment, setAssessmentComment] = useState<string>("");

  const [exerciseHistory, setExerciseHistory] = useState<ExerciseHistoryItem[]>(
    [],
  );

  const [historyLoading, setHistoryLoading] = useState<boolean>(false);

  const [supplementLogsToday, setSupplementLogsToday] = useState<
    SupplementLogForCoach[]
  >([]);

  const [supplementLogsLoading, setSupplementLogsLoading] =
    useState<boolean>(false);

  const [weightModalOpen, setWeightModalOpen] = useState<boolean>(false);
  const [weightValue, setWeightValue] = useState<string>("");
  const [savingWeight, setSavingWeight] = useState<boolean>(false);
  const [weightError, setWeightError] = useState<string>("");
  const [progressLoading, setProgressLoading] = useState<boolean>(false);
  const [progressError, setProgressError] = useState<string>("");

  const w = Dimensions.get("window").width;
  const today = ymd(new Date());
  const todayDayKey = getTodayDayKey();

  const data = useMemo(() => {
    if (!db || !id) return null;

    const profile = db.clientProfiles.find((c) => c.userId === id);
    const u = db.users.find((x) => x.id === id);

    const workouts = db.workouts
      .filter((w) => w.clientId === id)
      .slice()
      .sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);

        if (dateCompare !== 0) return dateCompare;

        return (b.time ?? "").localeCompare(a.time ?? "");
      });

    const exercises = db.exercises;
    const plan = db.supplementPlans.find((p) => p.clientId === id);
    const supps = plan
      ? db.supplementItems.filter((s) => s.planId === plan.id)
      : [];

    const progress = sortProgressByDate(db.progress.filter((p) => p.clientId === id));
    const streak = db.streaks.find((s) => s.clientId === id);
    const attendance = db.attendance.filter((a) => a.clientId === id);
    const weekly = db.weeklyGoals.find((w) => w.clientId === id);

    return {
      profile,
      u,
      workouts,
      exercises,
      plan,
      supps,
      progress,
      streak,
      attendance,
      weekly,
    };
  }, [db, id]);

  const loadClientProgress = useCallback(async () => {
    if (!id || !token || user?.role !== "coach") return;

    try {
      setProgressLoading(true);
      setProgressError("");

      const res = await apiGet(`/progress?client_id=${id}`, { token });
      const backendProgress = Array.isArray(res) ? res : [];

      const normalizedProgress = sortProgressByDate(
        backendProgress
          .map((item: any) => normalizeClientProgressEntry(item, id, user.id))
          .filter((item) => Number.isFinite(item.weight) && item.weight > 0),
      );

      const latestWeight = normalizedProgress[normalizedProgress.length - 1]?.weight;

      update((d) => ({
        ...d,
        progress: [
          ...d.progress.filter((item) => item.clientId !== id),
          ...normalizedProgress,
        ],
        clientProfiles: d.clientProfiles.map((profile) =>
          profile.userId === id && latestWeight
            ? { ...profile, currentWeight: latestWeight }
            : profile,
        ),
      }));
    } catch (e: any) {
      console.log("[client-detail] load client progress error", e);
      setProgressError(
        e?.message ||
          "Could not load client weight progress. Please check backend permissions.",
      );
    } finally {
      setProgressLoading(false);
    }
  }, [id, token, user?.role, user?.id, update]);

  useEffect(() => {
    loadClientProgress();
  }, [loadClientProgress]);

  const gridDays: {
    date: string;
    status?: "attended" | "missed" | "rest";
  }[] = useMemo(() => {
    const out: {
      date: string;
      status?: "attended" | "missed" | "rest";
    }[] = [];

    const todayDate = new Date();
    const attendance = data?.attendance ?? [];

    for (let i = 27; i >= 0; i--) {
      const d = new Date(todayDate);

      d.setDate(todayDate.getDate() - i);

      const date = ymd(d);
      const a = attendance.find((x) => x.date === date);

      out.push({ date, status: a?.status });
    }

    return out;
  }, [data?.attendance]);

  const monthAttendanceRate = useMemo(() => {
    const marked = gridDays.filter((day) => !!day.status);
    const attended = marked.filter((day) => day.status === "attended").length;

    return Math.round((attended / Math.max(1, marked.length)) * 100);
  }, [gridDays]);

  const muscleSummaries = useMemo(
    () => buildMuscleSummaries(exerciseHistory),
    [exerciseHistory],
  );

  const exerciseProgress = useMemo(
    () => buildExerciseProgress(exerciseHistory),
    [exerciseHistory],
  );

  const totalHistoryVolume = useMemo(
    () => muscleSummaries.reduce((sum, item) => sum + item.totalVolume, 0),
    [muscleSummaries],
  );

  const totalHistorySets = useMemo(
    () => muscleSummaries.reduce((sum, item) => sum + item.setCount, 0),
    [muscleSummaries],
  );

  const strongestExercise = exerciseProgress[0];

  const loadAssessment = useCallback(async () => {
    if (!id || !token || user?.role !== "coach") return;

    try {
      const res = await apiGet(`/reviews/clients/${id}/assessment`, { token });

      setAssessment(res ?? null);
    } catch (e) {
      console.log("[client-detail] load assessment error", e);
    }
  }, [id, token, user?.role]);

  useEffect(() => {
    loadAssessment();
  }, [loadAssessment]);

  const loadExerciseHistory = useCallback(async () => {
    if (!id || !token || user?.role !== "coach") return;

    try {
      setHistoryLoading(true);

      const res = await apiGet(`/exercise-results/client/${id}/history`, {
        token,
      });

      setExerciseHistory(
        Array.isArray(res) ? res.map(normalizeBackendHistoryItem) : [],
      );
    } catch (e) {
      console.log("[client-detail] load exercise history error", e);
      setExerciseHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [id, token, user?.role]);

  useEffect(() => {
    loadExerciseHistory();
  }, [loadExerciseHistory]);

  const loadClientAttendance = useCallback(async () => {
    if (!id || !token || user?.role !== "coach") return;

    try {
      const res = await apiGet(`/attendance?client_id=${id}`, { token });
      const backendAttendance = Array.isArray(res) ? res : [];

      update((d) => ({
        ...d,
        attendance: [
          ...d.attendance.filter((a) => a.clientId !== id),
          ...backendAttendance.map((a: any) => ({
            id: String(a.id),
            clientId: String(a.clientId ?? a.client_id ?? id),
            coachId: String(a.coachId ?? a.coach_id ?? user.id),
            date: a.date,
            status: a.status,
            notes: a.notes ?? undefined,
          })),
        ],
      }));
    } catch (e) {
      console.log("[client-detail] load attendance error", e);
    }
  }, [id, token, user?.role, user?.id, update]);

  useEffect(() => {
    loadClientAttendance();
  }, [loadClientAttendance]);

  const loadClientSupplementLogs = useCallback(async () => {
    if (!id || !token || user?.role !== "coach") return;

    try {
      setSupplementLogsLoading(true);

      const res = await apiGet(
        `/supplements/logs?client_id=${id}&date=${today}`,
        { token },
      );

      const logs = Array.isArray(res) ? res.map(normalizeSupplementLog) : [];

      setSupplementLogsToday(logs);
    } catch (e) {
      console.log("[client-detail] load supplement logs error", e);
      setSupplementLogsToday([]);
    } finally {
      setSupplementLogsLoading(false);
    }
  }, [id, token, user?.role, today]);

  useEffect(() => {
    loadClientSupplementLogs();
  }, [loadClientSupplementLogs]);

  if (!db || !user || !data?.profile || !data.u) return null;

  const change = data.profile.currentWeight - data.profile.startWeight;
  const losing = change < 0;
  const translatedGoal = getGoalLabel(data.profile, t);

  const getSupplementLog = (supplementItemId: string, time: string) => {
    return supplementLogsToday.find(
      (log) =>
        log.supplementItemId === supplementItemId &&
        log.date === today &&
        log.time === time,
    );
  };

  const unlinkClientLocalFallback = () => {
  if (!id) return;

  update((d) => {
    const removedWorkoutIds = new Set(
      d.workouts
        .filter((workout) => workout.clientId === id)
        .map((workout) => workout.id),
    );

    const removedSupplementPlanIds = new Set(
      d.supplementPlans
        .filter((plan) => plan.clientId === id)
        .map((plan) => plan.id),
    );

    return {
      ...d,

      clientProfiles: d.clientProfiles.map((profile) =>
        profile.userId === id
          ? {
              ...profile,
              coachId: "",
            }
          : profile,
      ),

      workouts: d.workouts.filter((workout) => workout.clientId !== id),

      exercises: d.exercises.filter(
        (exercise) => !removedWorkoutIds.has(exercise.workoutId),
      ),

      supplementPlans: d.supplementPlans.filter(
        (plan) => plan.clientId !== id,
      ),

      supplementItems: d.supplementItems.filter(
        (item) => !removedSupplementPlanIds.has(item.planId),
      ),

      progress: d.progress.filter((entry) => entry.clientId !== id),

      streaks: d.streaks.filter((streak) => streak.clientId !== id),

      attendance: d.attendance.filter((entry) => entry.clientId !== id),

      weeklyGoals: d.weeklyGoals.filter((goal) => goal.clientId !== id),
    };
  });
};

  const removeClient = () => {
    if (!id || !token || removingClient) return;

    const clientName = data.u?.name ?? t("clientDetail.thisClient");

    Alert.alert(
      t("clientDetail.removeClientTitle"),
      t("clientDetail.removeClientMessage").replace("{name}", clientName),
      [
        {
          text: t("common.cancel"),
          style: "cancel",
        },
        {
          text: t("clientDetail.remove"),
          style: "destructive",
          onPress: async () => {
            try {
              setRemovingClient(true);

              await apiDelete(`/clients/${id}`, { token });

unlinkClientLocalFallback();

try {
  await refreshFromBackend();
} catch (refreshError) {
  console.log(
    "[client-detail] refresh after remove client failed",
    refreshError,
  );
}

unlinkClientLocalFallback();

router.replace("/(coach)/clients");
            } catch (e: any) {
              console.log("[client-detail] remove client error", e);

              unlinkClientLocalFallback();

              Alert.alert(
                t("clientDetail.removedLocallyTitle"),
                t("clientDetail.removedLocallyMessage"),
                [
                  {
                    text: t("common.done"),
                    onPress: () => router.replace("/(coach)/clients"),
                  },
                ],
              );
            } finally {
              setRemovingClient(false);
            }
          },
        },
      ],
    );
  };

  const setAttendance = async (
    date: string,
    status: "attended" | "missed" | "rest",
  ) => {
    if (!user || !id || !token) {
      Alert.alert(t("profile.authErrorTitle"), t("profile.loginAgainText"));
      return;
    }

    try {
      const saved = await apiPost(
        "/attendance",
        {
          client_id: id,
          date,
          status,
        },
        { token },
      );

      update((d) => {
        const exists = d.attendance.find(
          (a) => a.clientId === id && a.date === date,
        );

        if (exists) {
          return {
            ...d,
            attendance: d.attendance.map((a) =>
              a.id === exists.id
                ? {
                    ...a,
                    id: saved.id ?? a.id,
                    clientId: saved.clientId ?? id,
                    coachId: saved.coachId ?? user.id,
                    date: saved.date ?? date,
                    status: saved.status ?? status,
                    notes: saved.notes ?? a.notes,
                  }
                : a,
            ),
          };
        }

        return {
          ...d,
          attendance: [
            ...d.attendance,
            {
              id: saved.id ?? `att_${Date.now()}_${date}`,
              clientId: saved.clientId ?? id,
              coachId: saved.coachId ?? user.id,
              date: saved.date ?? date,
              status: saved.status ?? status,
              notes: saved.notes ?? undefined,
            },
          ],
        };
      });

      await loadClientAttendance();
    } catch (e: any) {
      console.log("[client-detail] attendance save error", e);

      Alert.alert(
        t("clientDetail.attendanceErrorTitle"),
        e?.message || t("clientDetail.attendanceErrorMessage"),
      );
    }
  };

  const promptAttendance = (date: string, current?: string) => {
    Alert.alert(
      date,
      current
        ? t("clientDetail.currentStatus").replace("{status}", current)
        : t("attendance.tapToMark"),
      [
        {
          text: t("attendance.attended"),
          onPress: () => setAttendance(date, "attended"),
        },
        {
          text: t("attendance.missed"),
          onPress: () => setAttendance(date, "missed"),
        },
        {
          text: t("attendance.rest"),
          onPress: () => setAttendance(date, "rest"),
        },
        { text: t("common.cancel"), style: "cancel" },
      ],
      { cancelable: true },
    );
  };

  const addProgress = () => {
    if (!id || !user || !token) {
      Alert.alert(t("profile.authErrorTitle"), t("profile.loginAgainText"));
      return;
    }

    const current = data?.profile?.currentWeight ?? "";

    setWeightValue(
      Number.isFinite(Number(current)) && Number(current) > 0
        ? String(current)
        : "",
    );

    setWeightError("");
    setWeightModalOpen(true);
  };

  const saveProgress = async () => {
    if (!id || !user || !token || savingWeight) return;

    const normalizedValue = weightValue.replace(",", ".").trim();
    const weight = Number.parseFloat(normalizedValue);

    if (!Number.isFinite(weight) || weight <= 0) {
      setWeightError(t("progress.enterWeight"));
      return;
    }

    if (weight < 20 || weight > 350) {
      setWeightError("Enter a realistic weight between 20 and 350 kg.");
      return;
    }

    const createdAt = new Date().toISOString();
    const localId = `pr_${Date.now()}`;

    try {
      setSavingWeight(true);
      setWeightError("");

      const saved = await apiPost(
        "/progress",
        {
          client_id: id,
          weight,
          date: createdAt,
        },
        { token },
      );

      const savedEntry = normalizeClientProgressEntry(
        saved ?? {
          id: localId,
          client_id: id,
          weight,
          date: createdAt,
          added_by: user.id,
        },
        id,
        user.id,
      );

      update((d) => ({
        ...d,
        progress: sortProgressByDate([
          ...d.progress.filter(
            (item) => item.clientId !== id || item.id !== savedEntry.id,
          ),
          savedEntry,
        ]),
        clientProfiles: d.clientProfiles.map((c) =>
          c.userId === id ? { ...c, currentWeight: savedEntry.weight } : c,
        ),
      }));

      await loadClientProgress();

      setWeightModalOpen(false);
      setWeightValue("");
    } catch (e: any) {
      console.log("[client-detail] add progress error", e);

      setWeightError(
        e?.message ||
          "Could not save weight entry. Please check backend progress permissions.",
      );
    } finally {
      setSavingWeight(false);
    }
  };

  const deleteWorkoutLocalFallback = (wid: string) => {
    update((d) => ({
      ...d,
      workouts: d.workouts.filter((w) => w.id !== wid),
      exercises: d.exercises.filter((e) => e.workoutId !== wid),
    }));
  };

  const deleteWorkout = (wid: string) => {
    if (!token || deletingWorkoutId) return;

    Alert.alert(t("workouts.confirmDelete"), undefined, [
      {
        text: t("common.cancel"),
        style: "cancel",
      },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            setDeletingWorkoutId(wid);

            await apiDelete(`/workouts/${wid}`, { token });
            await refreshFromBackend();
            await loadExerciseHistory();
          } catch (e) {
            console.log("[client-detail] delete workout error", e);

            deleteWorkoutLocalFallback(wid);

            Alert.alert(
              t("clientDetail.deletedLocallyTitle"),
              t("clientDetail.deletedLocallyMessage"),
            );
          } finally {
            setDeletingWorkoutId(null);
          }
        },
      },
    ]);
  };

  const openAssessment = () => {
    setDisciplineRating(assessment?.disciplineRating ?? 5);
    setProgressRating(assessment?.progressRating ?? 5);
    setCommunicationRating(assessment?.communicationRating ?? 5);
    setAssessmentComment(assessment?.comment ?? "");
    setAssessmentOpen(true);
  };

  const saveAssessment = async () => {
    if (!id || !token) {
      Alert.alert(t("profile.authErrorTitle"), t("profile.loginAgainText"));
      return;
    }

    try {
      setSavingAssessment(true);

      const saved = await apiPost(
        `/reviews/clients/${id}/assessment`,
        {
          disciplineRating,
          progressRating,
          communicationRating,
          comment: assessmentComment.trim() || undefined,
        },
        { token },
      );

      setAssessment(saved);
      await refreshFromBackend();

      setAssessmentOpen(false);

      Alert.alert(
        t("clientDetail.savedTitle"),
        t("clientDetail.assessmentSavedMessage"),
      );
    } catch (e: any) {
      console.log("[client-detail] save assessment error", e);

      Alert.alert(
        t("clientDetail.assessmentErrorTitle"),
        e?.message || t("clientDetail.assessmentErrorMessage"),
      );
    } finally {
      setSavingAssessment(false);
    }
  };

  if (!isActive) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ title: data.u.name }} />

        <AppEmptyState
          title={t("subscription.required")}
          message={t("subscription.requiredMsg")}
          action={
            <AppButton
              title={t("subscription.activate")}
              onPress={() => router.push("/subscription")}
            />
          }
        />
      </ScreenContainer>
    );
  }

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
          <AppAvatar
            uri={toAbsoluteUrl(data.u.avatarUrl)}
            name={data.u.name}
            size={64}
            ring
          />

          <View style={{ flex: 1 }}>
            <AppText variant="h2">{data.u.name}</AppText>

            <AppText
              variant="small"
              color={theme.colors.textMuted}
              numberOfLines={1}
            >
              {translatedGoal}
            </AppText>

            <View
              style={{
                flexDirection: "row",
                gap: 6,
                marginTop: 6,
                alignItems: "center",
              }}
            >
              <StreakPill count={data.streak?.currentStreak ?? 0} />

              <AppText variant="caption" color={theme.colors.textMuted}>
                {getFitnessLevelLabel(data.profile.fitnessLevel, t)}
              </AppText>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
          <StatCard
            label={t("progress.current")}
            value={`${data.profile.currentWeight}${t("common.kg")}`}
            hint={`${t("progress.start")} ${data.profile.startWeight}${t(
              "common.kg",
            )}`}
          />

          <StatCard
            label={losing ? t("progress.lost") : t("progress.gained")}
            value={`${Math.abs(change).toFixed(1)}${t("common.kg")}`}
            hint={losing ? t("progress.cutting") : t("progress.building")}
            tone={losing ? "primary" : "warn"}
            icon={
              losing ? (
                <TrendingDown color="#fff" size={16} />
              ) : (
                <TrendingUp color="#fff" size={16} />
              )
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
              { key: "history", label: t("clientDetail.history") },
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
                  {translatedGoal ? (
                    <AppText variant="small" color={theme.colors.textMuted}>
                      {t("clients.goal")}: {translatedGoal}
                    </AppText>
                  ) : null}

                  <AppText variant="small" color={theme.colors.textMuted}>
                    {t("clients.height")}: {data.profile.height || "—"}cm ·{" "}
                    {t("clients.age")}: {data.profile.age ?? "—"}
                  </AppText>

                  <AppText variant="small" color={theme.colors.textMuted}>
                    Email: {data.u.email}
                    {data.u.clientCode ? ` · ${data.u.clientCode}` : ""}
                  </AppText>

                  {data.profile.healthNotes ? (
                    <AppText variant="small">
                      {data.profile.healthNotes}
                    </AppText>
                  ) : null}
                </View>
              </AppCard>

              <AppCard variant="outline">
                <View style={{ gap: 10 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <AppText variant="h3">
                        {t("clientDetail.clientAssessment")}
                      </AppText>

                      <AppText
                        variant="small"
                        color={theme.colors.textMuted}
                        style={{ marginTop: 4 }}
                      >
                        {t("clientDetail.clientAssessmentText")}
                      </AppText>
                    </View>

                    <View
                      style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                    >
                      <Star color="#FFB020" size={18} fill="#FFB020" />

                      <AppText variant="bodyStrong">
                        {assessment ? assessment.averageRating.toFixed(1) : "—"}
                      </AppText>
                    </View>
                  </View>

                  {assessment ? (
                    <View style={{ gap: 6 }}>
                      <RatingLine
                        label={t("clientDetail.discipline")}
                        value={assessment.disciplineRating}
                      />

                      <RatingLine
                        label={t("clientDetail.progressRating")}
                        value={assessment.progressRating}
                      />

                      <RatingLine
                        label={t("clientDetail.communication")}
                        value={assessment.communicationRating}
                      />

                      {assessment.comment ? (
                        <AppText variant="small" style={{ marginTop: 4 }}>
                          {assessment.comment}
                        </AppText>
                      ) : null}
                    </View>
                  ) : (
                    <AppText variant="small" color={theme.colors.textMuted}>
                      {t("clientDetail.noAssessment")}
                    </AppText>
                  )}

                  <AppButton
                    title={
                      assessment
                        ? t("clientDetail.editAssessment")
                        : t("clientDetail.addAssessment")
                    }
                    variant="secondary"
                    icon={<Star size={18} color={theme.colors.text} />}
                    onPress={openAssessment}
                    fullWidth
                  />
                </View>
              </AppCard>

              <AppCard variant="outline">
                <View style={{ gap: 10 }}>
                  <AppText variant="h3">
                    {t("clientDetail.clientAccess")}
                  </AppText>

                  <AppText variant="small" color={theme.colors.textMuted}>
                    {t("clientDetail.clientAccessText")}
                  </AppText>

                  <AppButton
                    title={
                      removingClient
                        ? t("clientDetail.removing")
                        : t("clientDetail.removeClient")
                    }
                    variant="secondary"
                    icon={<UserMinus size={18} color={theme.colors.danger} />}
                    onPress={removeClient}
                    fullWidth
                  />
                </View>
              </AppCard>

              {data.weekly ? (
                <AppCard variant="outline">
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Target color={theme.colors.fire} size={18} />

                    <AppText variant="h3">{t("clients.weeklyGoal")}</AppText>
                  </View>

                  <AppText
                    variant="small"
                    color={theme.colors.textMuted}
                    style={{ marginTop: 4 }}
                  >
                    {data.weekly.completedMinutes}/{data.weekly.targetMinutes}{" "}
                    {t("common.minutes")} · {data.weekly.completedWorkouts}/
                    {data.weekly.targetWorkouts} {t("common.workouts")}
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
                          (data.weekly.completedMinutes /
                            Math.max(1, data.weekly.targetMinutes)) *
                            100,
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

              <AppButton
  title={getAssignWeeklyPlanLabel(currentLang)}
  variant="secondary"
  icon={<Target size={18} color={theme.colors.text} />}
  onPress={() =>
    router.push({
      pathname: "/assign-weekly-plan" as any,
      params: { clientId: String(id) },
    })
  }
  fullWidth
/>

              {data.workouts.length === 0 ? (
                <AppEmptyState title={t("clients.noWorkouts")} />
              ) : (
                data.workouts.map((workout) => {
                  const ex = data.exercises.filter(
                    (exercise) => exercise.workoutId === workout.id,
                  );

                  return (
                    <AppCard key={workout.id} variant="outline">
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <AppText variant="bodyStrong">
  {getLocalizedWorkoutName(workout, currentLang)}
</AppText>

<AppText variant="small" color={theme.colors.textMuted}>
  {workout.date}
  {workout.time ? ` · ${workout.time}` : ""} ·{" "}
  {ex.length} {t("workouts.exercises").toLowerCase()} ·{" "}
  {workout.durationMinutes}
  {t("common.minutes")}
  {workout.source === "weekly_template"
    ? ` · ${getLocalizedWeeklyPlanTitle(workout, currentLang)}`
    : ""}
</AppText>
                        </View>

                        {workout.completed ? (
                          <CheckCircle2 color={theme.colors.success} size={20} />
                        ) : (
                          <Dumbbell color={theme.colors.textMuted} size={20} />
                        )}
                      </View>

                      <View style={{ flexDirection: "row", gap: 12, marginTop: 10 }}>
                        <Pressable
                          onPress={() =>
                            router.push(`/add-workout?workoutId=${workout.id}`)
                          }
                          hitSlop={8}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Pencil size={14} color={theme.colors.primary} />

                          <AppText variant="small" color={theme.colors.primary}>
                            {t("common.edit")}
                          </AppText>
                        </Pressable>

                        <Pressable
                          onPress={() => deleteWorkout(workout.id)}
                          hitSlop={8}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Trash2 size={14} color={theme.colors.danger} />

                          <AppText variant="small" color={theme.colors.danger}>
                            {deletingWorkoutId === workout.id
                              ? t("clientDetail.deleting")
                              : t("common.delete")}
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

              <View
                style={{
                  padding: 12,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.surfaceAlt,
                }}
              >
                <AppText variant="small" color={theme.colors.textMuted}>
                  {t("common.today")}: {today} · {getDayLabel(todayDayKey, t)}
                  {supplementLogsLoading
                    ? ` · ${t("clientDetail.loadingLogs")}`
                    : ""}
                </AppText>
              </View>

              {data.supps.length === 0 ? (
                <AppEmptyState title={t("clients.noSupps")} />
              ) : (
                data.supps.map((supplement: any) => {
                  const days = normalizeDays(
                    supplement.daysOfWeek ?? supplement.days_of_week,
                  );

                  const activeToday = isActiveToday(days);

                  return (
                    <AppCard
                      key={supplement.id}
                      variant="outline"
                      style={{
                        opacity: activeToday ? 1 : 0.72,
                      }}
                    >
                      <View style={{ gap: 10 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <Pill color={theme.colors.accent} size={20} />

                          <View style={{ flex: 1 }}>
                            <AppText variant="bodyStrong">
                              {supplement.name}
                            </AppText>

                            <AppText variant="small" color={theme.colors.textMuted}>
                              {supplement.dosage} ·{" "}
                              {supplement.specificTimes.join(", ")}
                            </AppText>
                          </View>

                          <View
                            style={{
                              paddingVertical: 4,
                              paddingHorizontal: 8,
                              borderRadius: 999,
                              backgroundColor: activeToday
                                ? "rgba(22,199,132,0.14)"
                                : theme.colors.surfaceAlt,
                            }}
                          >
                            <AppText
                              variant="caption"
                              color={
                                activeToday
                                  ? theme.colors.success
                                  : theme.colors.textMuted
                              }
                              style={{ fontWeight: "700" }}
                            >
                              {activeToday
                                ? t("clientDetail.today")
                                : t("clientDetail.notToday")}
                            </AppText>
                          </View>
                        </View>

                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                          {days.map((day) => (
                            <View
                              key={day}
                              style={{
                                paddingVertical: 4,
                                paddingHorizontal: 8,
                                borderRadius: 999,
                                backgroundColor:
                                  day === todayDayKey
                                    ? "rgba(22,199,132,0.14)"
                                    : theme.colors.surfaceAlt,
                              }}
                            >
                              <AppText
                                variant="caption"
                                color={
                                  day === todayDayKey
                                    ? theme.colors.success
                                    : theme.colors.textMuted
                                }
                                style={{ fontWeight: "700" }}
                              >
                                {getDayLabel(day, t)}
                              </AppText>
                            </View>
                          ))}
                        </View>

                        <AppText variant="caption" color={theme.colors.textMuted}>
                          {t("clientDetail.schedule")}: {formatDays(days, t)}
                        </AppText>

                        {activeToday ? (
                          <View style={{ gap: 8 }}>
                            {supplement.specificTimes.map((time: string) => {
                              const log = getSupplementLog(supplement.id, time);
                              const taken = log?.taken === true;

                              return (
                                <View
                                  key={`${supplement.id}_${time}`}
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    paddingVertical: 8,
                                    paddingHorizontal: 10,
                                    borderRadius: theme.radius.md,
                                    backgroundColor: taken
                                      ? "rgba(22,199,132,0.12)"
                                      : theme.colors.surfaceAlt,
                                  }}
                                >
                                  <View
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      gap: 8,
                                    }}
                                  >
                                    {taken ? (
                                      <CheckCircle2
                                        color={theme.colors.success}
                                        size={18}
                                      />
                                    ) : (
                                      <Circle
                                        color={theme.colors.textMuted}
                                        size={18}
                                      />
                                    )}

                                    <AppText
                                      variant="small"
                                      style={{ fontWeight: "700" }}
                                    >
                                      {time}
                                    </AppText>
                                  </View>

                                  <AppText
                                    variant="small"
                                    color={
                                      taken
                                        ? theme.colors.success
                                        : theme.colors.textMuted
                                    }
                                    style={{ fontWeight: "700" }}
                                  >
                                    {taken
                                      ? t("clientDetail.taken")
                                      : t("clientDetail.notTaken")}
                                  </AppText>
                                </View>
                              );
                            })}
                          </View>
                        ) : (
                          <AppText variant="small" color={theme.colors.textMuted}>
                            {t("clientDetail.supplementNotScheduledToday")}
                          </AppText>
                        )}

                        {supplement.notes ? (
                          <AppText
                            variant="small"
                            color={theme.colors.textMuted}
                            style={{ marginTop: 2 }}
                          >
                            {supplement.notes}
                          </AppText>
                        ) : null}
                      </View>
                    </AppCard>
                  );
                })
              )}
            </View>
          )}

          {tab === "progress" && (
            <>
              <AppCard variant="elevated">
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 8,
                  }}
                >
                  <AppText variant="h3">{t("clients.weightTrend")}</AppText>

                  {progressLoading ? (
                    <AppText variant="caption" color={theme.colors.textMuted}>
                      Loading
                    </AppText>
                  ) : null}
                </View>

                {progressError ? (
                  <AppText
                    variant="small"
                    color={theme.colors.danger}
                    style={{ marginBottom: 8 }}
                  >
                    {progressError}
                  </AppText>
                ) : null}

                {data.progress.length === 0 ? (
                  <AppEmptyState
                    title="No weight entries yet"
                    message="Add the first weight entry to build the client progress chart."
                  />
                ) : (
                  <WeightChart values={data.progress} width={w - 80} />
                )}
              </AppCard>

              <AppButton
                title={t("clients.addWeightEntry")}
                icon={<Plus size={18} color={theme.colors.primaryContrast} />}
                onPress={addProgress}
                fullWidth
              />

              <View style={{ gap: 8 }}>
                {sortProgressByDate(data.progress)
                  .reverse()
                  .map((item) => (
                    <AppCard key={item.id} variant="outline">
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <AppText variant="bodyStrong">
                          {item.weight} {t("common.kg")}
                        </AppText>

                        <AppText variant="small" color={theme.colors.textMuted}>
                          {item.date.includes("T")
                            ? item.date.slice(0, 10)
                            : item.date}
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
                  hint={`${t("attendance.bestStreak")} ${
                    data.streak?.bestStreak ?? 0
                  }`}
                  tone="fire"
                  icon={<Flame size={16} color="#fff" fill="#fff" />}
                />

                <StatCard
                  label={t("attendance.monthRate")}
                  value={`${monthAttendanceRate}%`}
                  hint={t("clients.attendance")}
                />
              </View>

              <AppText
                variant="caption"
                color={theme.colors.textMuted}
                style={{ marginTop: 4 }}
              >
                {t("attendance.tapToMark")}
              </AppText>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {gridDays.map((day) => {
                  const isToday = day.date === ymd(new Date());

                  const bg =
                    day.status === "attended"
                      ? theme.colors.primary
                      : day.status === "rest"
                        ? theme.colors.surfaceAlt
                        : day.status === "missed"
                          ? theme.colors.danger
                          : theme.colors.surface;

                  return (
                    <Pressable
                      key={day.date}
                      onPress={() => promptAttendance(day.date, day.status)}
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
                      {day.status === "attended" ? (
                        <Flame color="#fff" size={14} fill="#fff" />
                      ) : day.status === "rest" ? (
                        <Circle color={theme.colors.text} size={12} />
                      ) : day.status === "missed" ? (
                        <AppText variant="caption" color="#fff">
                          ✕
                        </AppText>
                      ) : (
                        <AppText variant="caption" color={theme.colors.textFaint}>
                          {day.date.slice(8, 10)}
                        </AppText>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {tab === "history" && (
            <View style={{ gap: 12 }}>
              {historyLoading ? (
                <AppCard variant="outline">
                  <AppText variant="small" color={theme.colors.textMuted}>
                    {t("clientDetail.loadingExerciseHistory")}
                  </AppText>
                </AppCard>
              ) : exerciseHistory.length === 0 ? (
                <AppEmptyState
                  title={t("clientDetail.noExerciseHistory")}
                  message={t("clientDetail.noExerciseHistoryMessage")}
                />
              ) : (
                <>
                  <AppCard variant="outline">
                    <View style={{ gap: 10 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <TrendingUp color={theme.colors.primary} size={20} />

                        <AppText variant="h3">
                          {t("clientDetail.muscleProgressAnalytics")}
                        </AppText>
                      </View>

                      <AppText variant="small" color={theme.colors.textMuted}>
                        {t("clientDetail.muscleProgressAnalyticsText")}
                      </AppText>

                      <View style={{ flexDirection: "row", gap: 12 }}>
                        <StatCard
                          label={t("clientDetail.totalVolume")}
                          value={`${Math.round(totalHistoryVolume)}${t(
                            "common.kg",
                          )}`}
                          hint={t("clientDetail.weightTimesReps")}
                        />

                        <StatCard
                          label={t("clientDetail.totalSets")}
                          value={totalHistorySets}
                          hint={t("clientDetail.exercisesCount").replace(
                            "{n}",
                            String(exerciseProgress.length),
                          )}
                        />
                      </View>

                      {strongestExercise ? (
                        <View
                          style={{
                            padding: 12,
                            borderRadius: theme.radius.md,
                            backgroundColor: theme.colors.surfaceAlt,
                            gap: 4,
                          }}
                        >
                          <AppText variant="bodyStrong">
                            {t("clientDetail.strongestProgress")}
                          </AppText>

                          <AppText variant="small" color={theme.colors.textMuted}>
                            {getTranslatedExerciseName(
                              strongestExercise.exerciseName,
                              currentLang,
                            )}{" "}
                            · {getMuscleGroupLabel(strongestExercise.muscleGroup, t)}
                          </AppText>

                          <AppText
                            variant="small"
                            color={
                              strongestExercise.progress >= 0
                                ? theme.colors.success
                                : theme.colors.danger
                            }
                            style={{ fontWeight: "800" }}
                          >
                            {strongestExercise.progress >= 0 ? "+" : ""}
                            {strongestExercise.progress.toFixed(1)}
                            {t("common.kg")} · {t("clientDetail.best")}{" "}
                            {strongestExercise.bestWeight || "—"}
                            {t("common.kg")} ×{" "}
                            {strongestExercise.bestReps || "—"}
                          </AppText>
                        </View>
                      ) : null}
                    </View>
                  </AppCard>

                  <AppText variant="h3">
                    {t("clientDetail.muscleGroups")}
                  </AppText>

                  <View style={{ gap: 10 }}>
                    {muscleSummaries.map((item) => (
                      <AppCard key={item.muscleGroup} variant="outline">
                        <View style={{ gap: 8 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <View>
                              <AppText variant="bodyStrong">
                                {getMuscleGroupLabel(item.muscleGroup, t)}
                              </AppText>

                              <AppText variant="small" color={theme.colors.textMuted}>
                                {item.exerciseCount}{" "}
                                {t("workouts.exercises").toLowerCase()} ·{" "}
                                {item.setCount} {t("workouts.sets").toLowerCase()}
                              </AppText>
                            </View>

                            <View style={{ alignItems: "flex-end" }}>
                              <AppText variant="bodyStrong">
                                {Math.round(item.totalVolume)}
                                {t("common.kg")}
                              </AppText>

                              <AppText
                                variant="caption"
                                color={theme.colors.textMuted}
                              >
                                {t("clientDetail.volume")}
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
                                width: `${Math.min(
                                  100,
                                  (item.totalVolume /
                                    Math.max(
                                      1,
                                      muscleSummaries[0]?.totalVolume ?? 1,
                                    )) *
                                    100,
                                )}%`,
                                height: 8,
                                borderRadius: 999,
                                backgroundColor: theme.colors.primary,
                              }}
                            />
                          </View>

                          <AppText variant="caption" color={theme.colors.textMuted}>
                            {t("clientDetail.bestWeight")}: {" "}
                            {item.bestWeight || "—"}
                            {t("common.kg")} · {t("clientDetail.last")}: {" "}
                            {formatHistoryDate(item.lastDate, currentLang)}
                          </AppText>
                        </View>
                      </AppCard>
                    ))}
                  </View>

                  <AppText variant="h3">
                    {t("clientDetail.bestExercises")}
                  </AppText>

                  <View style={{ gap: 10 }}>
                    {exerciseProgress.slice(0, 8).map((item) => (
                      <AppCard key={item.exerciseName} variant="outline">
                        <View style={{ gap: 8 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              gap: 12,
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <AppText variant="bodyStrong">
                                {getTranslatedExerciseName(
                                  item.exerciseName,
                                  currentLang,
                                )}
                              </AppText>

                              <AppText variant="small" color={theme.colors.textMuted}>
                                {getMuscleGroupLabel(item.muscleGroup, t)} ·{" "}
                                {item.setCount} {t("workouts.sets").toLowerCase()}
                              </AppText>
                            </View>

                            <View style={{ alignItems: "flex-end" }}>
                              <AppText variant="bodyStrong">
                                {item.bestWeight || "—"}
                                {t("common.kg")}
                              </AppText>

                              <AppText
                                variant="caption"
                                color={theme.colors.textMuted}
                              >
                                {t("clientDetail.best")}
                              </AppText>
                            </View>
                          </View>

                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              gap: 8,
                            }}
                          >
                            <MiniMetric
                              label={t("clientDetail.first")}
                              value={
                                item.firstWeight
                                  ? `${item.firstWeight}${t("common.kg")}`
                                  : "—"
                              }
                            />

                            <MiniMetric
                              label={t("clientDetail.last")}
                              value={
                                item.lastWeight
                                  ? `${item.lastWeight}${t("common.kg")}`
                                  : "—"
                              }
                            />

                            <MiniMetric
                              label={t("clientDetail.progress")}
                              value={`${item.progress >= 0 ? "+" : ""}${item.progress.toFixed(
                                1,
                              )}${t("common.kg")}`}
                              positive={item.progress >= 0}
                            />
                          </View>

                          <AppText variant="caption" color={theme.colors.textMuted}>
                            {t("clientDetail.bestSet")}: {item.bestWeight || "—"}
                            {t("common.kg")} × {item.bestReps || "—"} ·{" "}
                            {t("clientDetail.volume")}: {" "}
                            {Math.round(item.totalVolume)}
                            {t("common.kg")} · {t("clientDetail.last")}: {" "}
                            {formatHistoryDate(item.lastDate, currentLang)}
                          </AppText>
                        </View>
                      </AppCard>
                    ))}
                  </View>

                  <AppText variant="h3">
                    {t("clientDetail.latestResults")}
                  </AppText>

                  <View style={{ gap: 10 }}>
                    {exerciseHistory.map((item) => {
                      const sortedSets = item.sets
                        .slice()
                        .sort((a, b) => a.setNumber - b.setNumber);

                      const resultText = sortedSets
                        .map((set) => {
                          const weight =
                            set.weight !== undefined && set.weight !== null
                              ? `${set.weight}${t("common.kg")}`
                              : t("clientDetail.noWeight");

                          return `${weight} × ${set.actualReps}`;
                        })
                        .join(" / ");

                      return (
                        <AppCard
                          key={`${item.exerciseName}_${item.workoutId}`}
                          variant="outline"
                        >
                          <View style={{ gap: 8 }}>
                            <View
                              style={{
                                flexDirection: "row",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                gap: 12,
                              }}
                            >
                              <View style={{ flex: 1 }}>
                                <AppText variant="bodyStrong">
                                  {getTranslatedExerciseName(
                                    item.exerciseName,
                                    currentLang,
                                  )}
                                </AppText>

                                <AppText
                                  variant="small"
                                  color={theme.colors.textMuted}
                                >
                                  {getMuscleGroupLabel(item.muscleGroup, t)}
                                </AppText>
                              </View>

                              <AppText
                                variant="caption"
                                color={theme.colors.textMuted}
                              >
                                {formatHistoryDate(item.createdAt, currentLang)}
                              </AppText>
                            </View>

                            <View
                              style={{
                                padding: 10,
                                borderRadius: theme.radius.md,
                                backgroundColor: theme.colors.surfaceAlt,
                              }}
                            >
                              <AppText variant="small" style={{ fontWeight: "700" }}>
                                {t("clientDetail.last")}: {" "}
                                {resultText || t("clientDetail.noSetDetails")}
                              </AppText>
                            </View>

                            <View style={{ gap: 4 }}>
                              {sortedSets.map((set) => (
                                <View
                                  key={set.id}
                                  style={{
                                    flexDirection: "row",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                >
                                  <AppText
                                    variant="caption"
                                    color={theme.colors.textMuted}
                                  >
                                    {t("workouts.sets")} {set.setNumber}
                                  </AppText>

                                  <AppText variant="caption">
                                    {set.weight ?? "—"} {t("common.kg")} ·{" "}
                                    {set.actualReps}/{set.targetReps}{" "}
                                    {t("workouts.reps").toLowerCase()}
                                  </AppText>
                                </View>
                              ))}
                            </View>
                          </View>
                        </AppCard>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          )}
        </View>

        <View style={{ height: 32 }} />
      </View>

      <WeightEntryModal
        visible={weightModalOpen}
        value={weightValue}
        saving={savingWeight}
        error={weightError}
        onChange={(value) => {
          setWeightValue(value);
          if (weightError) setWeightError("");
        }}
        onClose={() => {
          if (savingWeight) return;
          setWeightModalOpen(false);
          setWeightError("");
        }}
        onSave={saveProgress}
      />

      <AssessmentModal
        visible={assessmentOpen}
        saving={savingAssessment}
        disciplineRating={disciplineRating}
        setDisciplineRating={setDisciplineRating}
        progressRating={progressRating}
        setProgressRating={setProgressRating}
        communicationRating={communicationRating}
        setCommunicationRating={setCommunicationRating}
        comment={assessmentComment}
        setComment={setAssessmentComment}
        onClose={() => setAssessmentOpen(false)}
        onSave={saveAssessment}
      />
    </ScreenContainer>
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

function RatingLine({ label, value }: { label: string; value: number }) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
      }}
    >
      <AppText variant="small" color={theme.colors.textMuted}>
        {label}
      </AppText>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        {[1, 2, 3, 4, 5].map((item) => (
          <Star
            key={item}
            size={13}
            color="#FFB020"
            fill={item <= value ? "#FFB020" : "transparent"}
          />
        ))}
      </View>
    </View>
  );
}

function RatingPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const { theme } = useTheme();

  return (
    <View style={{ gap: 8 }}>
      <AppText variant="bodyStrong">{label}</AppText>

      <View style={{ flexDirection: "row", gap: 10 }}>
        {[1, 2, 3, 4, 5].map((item) => (
          <Pressable key={item} onPress={() => onChange(item)}>
            <Star
              size={32}
              color="#FFB020"
              fill={item <= value ? "#FFB020" : "transparent"}
            />
          </Pressable>
        ))}
      </View>

      <AppText variant="small" color={theme.colors.textMuted}>
        {value}/5
      </AppText>
    </View>
  );
}

function WeightEntryModal({
  visible,
  value,
  saving,
  error,
  onChange,
  onClose,
  onSave,
}: {
  visible: boolean;
  value: string;
  saving: boolean;
  error: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const { theme } = useTheme();
  const { t } = useI18n();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: 20,
          backgroundColor: "rgba(0,0,0,0.55)",
        }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
          onPress={onClose}
          disabled={saving}
        />

        <View
          style={{
            borderRadius: 24,
            padding: 18,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.borderSoft,
            gap: 14,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <AppText variant="h3">{t("progress.addWeight")}</AppText>

              <AppText
                variant="small"
                color={theme.colors.textMuted}
                style={{ marginTop: 4 }}
              >
                {t("progress.enterWeight")}
              </AppText>
            </View>

            <Pressable
              onPress={onClose}
              disabled={saving}
              hitSlop={8}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: theme.colors.surfaceAlt,
                opacity: saving ? 0.5 : 1,
              }}
            >
              <X color={theme.colors.text} size={18} />
            </Pressable>
          </View>

          <AppInput
            label={`${t("progress.current")} (${t("common.kg")})`}
            value={value}
            onChangeText={onChange}
            placeholder="82"
            keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
            onSubmitEditing={onSave}
          />

          {error ? (
            <AppText variant="small" color={theme.colors.danger}>
              {error}
            </AppText>
          ) : null}

          <View style={{ flexDirection: "row", gap: 10 }}>
            <AppButton
              title={t("common.cancel")}
              variant="secondary"
              onPress={onClose}
              disabled={saving}
              style={{ flex: 1 }}
            />

            <AppButton
              title={saving ? t("clientDetail.saving") : t("common.save")}
              onPress={onSave}
              loading={saving}
              disabled={saving}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function AssessmentModal({
  visible,
  saving,
  disciplineRating,
  setDisciplineRating,
  progressRating,
  setProgressRating,
  communicationRating,
  setCommunicationRating,
  comment,
  setComment,
  onClose,
  onSave,
}: {
  visible: boolean;
  saving: boolean;
  disciplineRating: number;
  setDisciplineRating: (v: number) => void;
  progressRating: number;
  setProgressRating: (v: number) => void;
  communicationRating: number;
  setCommunicationRating: (v: number) => void;
  comment: string;
  setComment: (v: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const { theme } = useTheme();
  const { t } = useI18n();

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: theme.colors.bg }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
          <View
            style={{
              paddingTop: 56,
              paddingHorizontal: 20,
              paddingBottom: 14,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.borderSoft,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Pressable onPress={handleClose} hitSlop={8} disabled={saving}>
              <X color={theme.colors.text} size={22} />
            </Pressable>

            <AppText variant="h3" numberOfLines={1} style={{ flex: 1, textAlign: "center" }}>
              {t("clientDetail.clientAssessment")}
            </AppText>

            <Pressable onPress={onSave} disabled={saving} hitSlop={8}>
              <Send
                color={saving ? theme.colors.textMuted : theme.colors.primary}
                size={20}
              />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 96 }}
          >
            <RatingPicker
              label={t("clientDetail.discipline")}
              value={disciplineRating}
              onChange={setDisciplineRating}
            />

            <RatingPicker
              label={t("clientDetail.progressRating")}
              value={progressRating}
              onChange={setProgressRating}
            />

            <RatingPicker
              label={t("clientDetail.communication")}
              value={communicationRating}
              onChange={setCommunicationRating}
            />

            <AppInput
              label={t("clientDetail.privateComment")}
              value={comment}
              onChangeText={setComment}
              placeholder={t("clientDetail.privateCommentPlaceholder")}
              multiline
              autoCapitalize="sentences"
              autoCorrect
              returnKeyType="done"
              submitBehavior="blurAndSubmit"
              onSubmitEditing={onSave}
              style={{
                minHeight: 110,
                textAlignVertical: "top",
                paddingTop: 10,
              }}
            />

            <AppButton
              title={
                saving
                  ? t("clientDetail.saving")
                  : t("clientDetail.saveAssessment")
              }
              loading={saving}
              disabled={saving}
              onPress={onSave}
              fullWidth
            />

            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}