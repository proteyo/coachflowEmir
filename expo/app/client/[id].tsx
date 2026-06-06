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
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  AttendanceTrendChart,
  DistributionDonutChart,
  ExercisePerformanceLineChart,
  ExerciseProgressChart,
  MuscleGroupProgressChart,
  MuscleVolumeChart,
  RepRangePerformanceChart,
  SupplementAdherenceChart,
  WeightChart,
} from "@/src/components/charts";
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
  MUSCLE_GROUPS,
  getExerciseName,
  getMuscleGroupName,
    type MuscleGroup,
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
  | "history"
  | "results";

type DayKey = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
type WeightRange = 7 | 30 | "all";
type AttendanceStatus = "attended" | "missed" | "rest";
type AttendanceAction = AttendanceStatus | "clear";
type RepRangeKey = "all" | "1-5" | "6-8" | "9-10" | "11-15" | "16+";

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

function formatProgressDate(value?: string, lang: AppLangCode = "en") {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.includes("T") ? value.slice(0, 10) : value;
  }

  const locale = lang === "ru" ? "ru-RU" : lang === "kk" ? "kk-KZ" : "en-US";

  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getRangeDays(value: WeightRange) {
  return value === "all" ? undefined : value;
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getMonthKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");

  return `${y}-${m}`;
}

function getDateMonthKey(value: string) {
  const date = getSafeDate(value);

  if (date.getTime() === 0) {
    return value.slice(0, 7);
  }

  return getMonthKey(date);
}

function formatMonthTitle(date: Date, lang: AppLangCode = "en") {
  const locale = lang === "ru" ? "ru-RU" : lang === "kk" ? "kk-KZ" : "en-US";

  return date.toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

function formatAttendanceDialogDate(value: string, lang: AppLangCode = "en") {
  const date = getSafeDate(value);

  if (date.getTime() === 0) return value;

  const locale = lang === "ru" ? "ru-RU" : lang === "kk" ? "kk-KZ" : "en-US";

  return date.toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function buildMonthGrid(monthDate: Date) {
  const monthStart = getMonthStart(monthDate);
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const firstDay = monthStart.getDay();
  const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;

  const days: {
    date: string;
    dayOfMonth: number;
    inMonth: boolean;
  }[] = [];

  for (let i = 0; i < mondayOffset; i++) {
    const d = new Date(year, month, 1 - (mondayOffset - i));

    days.push({
      date: ymd(d),
      dayOfMonth: d.getDate(),
      inMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);

    days.push({
      date: ymd(d),
      dayOfMonth: day,
      inMonth: true,
    });
  }

  let nextMonthDay = 1;

  while (days.length % 7 !== 0) {
    const d = new Date(year, month + 1, nextMonthDay);

    days.push({
      date: ymd(d),
      dayOfMonth: d.getDate(),
      inMonth: false,
    });

    nextMonthDay += 1;
  }

  return days;
}

function getAttendanceStats(
  attendance: Array<{ date: string; status?: string }>,
  monthKey?: string,
) {
  const filtered = monthKey
    ? attendance.filter((item) => getDateMonthKey(item.date) === monthKey)
    : attendance;

  const attended = filtered.filter((item) => item.status === "attended").length;
  const missed = filtered.filter((item) => item.status === "missed").length;
  const rest = filtered.filter((item) => item.status === "rest").length;
  const counted = attended + missed;
  const rate = counted > 0 ? Math.round((attended / counted) * 100) : 0;

  return {
    attended,
    missed,
    rest,
    counted,
    marked: filtered.length,
    rate,
  };
}

function getAttendanceStatusLabel(
  status: AttendanceStatus | undefined,
  labels: {
    attended: string;
    missed: string;
    rest: string;
    notMarked: string;
  },
) {
  if (status === "attended") return labels.attended;
  if (status === "missed") return labels.missed;
  if (status === "rest") return labels.rest;

  return labels.notMarked;
}

function calculateAttendanceStreaks(
  attendance: Array<{ date: string; status?: string }>,
) {
  const todayKey = ymd(new Date());
  const sorted = attendance
    .filter((item) => item.date && item.date <= todayKey)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  let current = 0;
  let best = 0;

  sorted.forEach((item) => {
    if (item.status === "attended") {
      current += 1;
      best = Math.max(best, current);
      return;
    }

    if (item.status === "missed") {
      current = 0;
    }

    // rest days do not increase the streak, but they also do not break it
  });

  return {
    currentStreak: current,
    bestStreak: best,
  };
}

function getRepRangeLabel(key: RepRangeKey, lang: AppLangCode) {
  if (key === "all") {
    if (lang === "ru") return "Все повторы";
    if (lang === "kk") return "Барлық қайталау";
    return "All reps";
  }

  if (key === "16+") return "16+";

  return key;
}

function getRepRangeBounds(key: RepRangeKey) {
  if (key === "1-5") return { min: 1, max: 5 };
  if (key === "6-8") return { min: 6, max: 8 };
  if (key === "9-10") return { min: 9, max: 10 };
  if (key === "11-15") return { min: 11, max: 15 };
  if (key === "16+") return { min: 16, max: Number.POSITIVE_INFINITY };

  return { min: 0, max: Number.POSITIVE_INFINITY };
}

function matchesRepRange(reps: number, key: RepRangeKey) {
  if (key === "all") return true;

  const bounds = getRepRangeBounds(key);

  return reps >= bounds.min && reps <= bounds.max;
}

function formatShortChartDate(value?: string, lang: AppLangCode = "en") {
  if (!value) return "";

  const date = getSafeDate(value);

  if (date.getTime() === 0) return value.includes("T") ? value.slice(0, 10) : value;

  const locale = lang === "ru" ? "ru-RU" : lang === "kk" ? "kk-KZ" : "en-US";

  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
  });
}

function splitPreviousCurrent<T>(items: T[]) {
  const mid = Math.max(1, Math.floor(items.length / 2));

  return {
    previous: items.slice(0, mid),
    current: items.slice(mid),
  };
}

function getMetricValueFromSets(
  sets: Array<{ weight?: number | null; actualReps?: number; reps?: number }>,
) {
  const hasWeight = sets.some((set) => Number(set.weight ?? 0) > 0);

  if (hasWeight) {
    return Math.max(0, ...sets.map((set) => Number(set.weight ?? 0)));
  }

  return Math.max(
    0,
    ...sets.map((set) => Number(set.actualReps ?? set.reps ?? 0)),
  );
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
  const [weightRange, setWeightRange] = useState<WeightRange>(7);
  const [attendanceMonth, setAttendanceMonth] = useState<Date>(() =>
    getMonthStart(new Date()),
  );
  const [selectedMuscleGroupKey, setSelectedMuscleGroupKey] = useState<string>("all");
  const [selectedExerciseKey, setSelectedExerciseKey] = useState<string>("all");
  const [selectedRepRange, setSelectedRepRange] = useState<RepRangeKey>("all");
  const [exercisePickerOpen, setExercisePickerOpen] = useState<boolean>(false);
  const attendanceSyncSeq = useRef<Record<string, number>>({});

  const w = Dimensions.get("window").width;
  const calendarGap = 6;
  const calendarGridWidth = Math.min(w - 40, 336);
  const calendarDaySize = (calendarGridWidth - calendarGap * 6) / 7;
  const today = ymd(new Date());
  const todayDayKey = getTodayDayKey();

  const uiText = useMemo(() => {
    if (currentLang === "ru") {
      return {
        historyIntro: "Визуальная аналитика по объёму, группам мышц и прогрессу в упражнениях.",
        volumeDistribution: "Распределение объёма",
        topProgress: "Лучший прогресс",
        strengthMap: "Карта силы",
        exerciseDynamics: "Динамика упражнений",
        latestResultsTitle: "Последние результаты",
        latestResultsSubtitle: "Подходы, вес, повторы и выполнение цели по каждому упражнению.",
        sessionSummary: "Сводка тренировки",
        totalWork: "Объём",
        bestSetShort: "Лучший подход",
        completion: "Выполнение",
        target: "цель",
        actual: "факт",
        sets: "подходы",
        noWeightedData: "Пока нет данных с рабочим весом.",
        loading: "Загрузка",
        noWeightEntries: "Записей веса пока нет",
        noWeightEntriesText: "Добавьте первую запись, чтобы график стал полезным.",
        range7: "7 дней",
        range30: "30 дней",
        rangeAll: "Всё",
        shownEntries: "Показано записей",
        attendanceHistory: "История посещаемости",
        attendanceTrend: "Динамика посещаемости",
        attendanceTrendText: "Процент считается без дней отдыха: посетил / (посетил + пропустил).",
        previousMonth: "Предыдущий месяц",
        nextMonth: "Следующий месяц",
        currentMonth: "Текущий месяц",
        attendedLabel: "Посетил",
        missedLabel: "Пропустил",
        restLabel: "Отдых",
        notMarked: "Не отмечено",
        clearSelection: "Очистить выбор",
        markedDays: "Отмечено дней",
        countedDays: "Учитываемых дней",
        restDays: "Дней отдыха",
        noAttendanceHistory: "Истории посещаемости пока нет.",
        monthComparison: "Сравнение по месяцам",
        attendanceFormula: "Отдых не снижает процент посещаемости.",
        bestMonth: "Лучший месяц",
        weakMonth: "Слабый месяц",
        muscleFocus: "Фокус по мышцам",
        laggingMuscle: "Меньше всего объёма",
        balancedScore: "Баланс нагрузки",
        supplementAnalytics: "Соблюдение добавок",
        supplementAnalyticsText: "Показывает, насколько клиент выполняет план приёма добавок сегодня.",
        todaySupplements: "Добавки сегодня",
        quickTapHint: "Нажатие по дню быстро переключает статус: посетил → пропустил → отдых → очистить. Удержание открывает выбор.",
        trainingConsistency: "Дисциплина тренировок",
        performanceOverview: "Обзор результатов",
        latestWorkoutLoad: "Объём последней тренировки",
        muscleLoadChart: "График нагрузки по мышцам",
        exerciseProgressChart: "Прогресс упражнений клиента",
        muscleProgressByPeriod: "Прогресс групп по периодам",
        loadDistribution: "Круговая диаграмма нагрузки",
        exerciseDeepAnalysis: "Анализ выбранного упражнения",
        chooseExercise: "Выберите упражнение",
        chooseMuscleGroup: "Выберите группу мышц",
        exerciseDropdown: "Список упражнений",
        noExerciseResult: "По выбранному упражнению пока нет результатов.",
        chooseRepRange: "Фильтр повторений",
        allExercises: "Все упражнения",
        weightMetric: "Вес",
        repsMetric: "Повторы",
        previousCurrent: "Раньше / сейчас",
        repRangeAnalysis: "Диапазоны повторений",
        currentStreakLocal: "Серия считается по календарю",
        exerciseProgressInfo: "Показывает изменение результата по упражнениям, которые тренер назначал клиенту. Если прогресса пока нет, строка отмечается как без изменений.",
        chooseGroupFirst: "Сначала выберите группу мышц",
        backToGroups: "Назад к группам",
      };
    }

    if (currentLang === "kk") {
      return {
        historyIntro: "Көлем, бұлшықет топтары және жаттығу прогресі бойынша көрнекі аналитика.",
        volumeDistribution: "Көлем үлесі",
        topProgress: "Үздік прогресс",
        strengthMap: "Күш картасы",
        exerciseDynamics: "Жаттығу динамикасы",
        latestResultsTitle: "Соңғы нәтижелер",
        latestResultsSubtitle: "Әр жаттығу бойынша сеттер, салмақ, қайталау және мақсаттың орындалуы.",
        sessionSummary: "Жаттығу қорытындысы",
        totalWork: "Көлем",
        bestSetShort: "Үздік сет",
        completion: "Орындалуы",
        target: "мақсат",
        actual: "нақты",
        sets: "сеттер",
        noWeightedData: "Жұмыс салмағы бойынша деректер әлі жоқ.",
        loading: "Жүктелуде",
        noWeightEntries: "Салмақ жазбалары әлі жоқ",
        noWeightEntriesText: "График пайдалы болуы үшін алғашқы жазбаны қосыңыз.",
        range7: "7 күн",
        range30: "30 күн",
        rangeAll: "Барлығы",
        shownEntries: "Көрсетілген жазба",
        attendanceHistory: "Қатысу тарихы",
        attendanceTrend: "Қатысу динамикасы",
        attendanceTrendText: "Пайыз демалыс күндерін есептемейді: келді / (келді + қалды).",
        previousMonth: "Алдыңғы ай",
        nextMonth: "Келесі ай",
        currentMonth: "Ағымдағы ай",
        attendedLabel: "Келді",
        missedLabel: "Қалды",
        restLabel: "Демалыс",
        notMarked: "Белгіленбеген",
        clearSelection: "Таңдауды тазарту",
        markedDays: "Белгіленген күндер",
        countedDays: "Есептелетін күндер",
        restDays: "Демалыс күндері",
        noAttendanceHistory: "Қатысу тарихы әлі жоқ.",
        monthComparison: "Айлар бойынша салыстыру",
        attendanceFormula: "Демалыс қатысу пайызын төмендетпейді.",
        bestMonth: "Үздік ай",
        weakMonth: "Әлсіз ай",
        muscleFocus: "Бұлшықет фокусы",
        laggingMuscle: "Ең аз көлем",
        balancedScore: "Жүктеме балансы",
        supplementAnalytics: "Қоспаларды сақтау",
        supplementAnalyticsText: "Клиент бүгін қоспалар жоспарын қаншалықты орындағанын көрсетеді.",
        todaySupplements: "Бүгінгі қоспалар",
        quickTapHint: "Күнді басу статусты жылдам ауыстырады: келді → қалды → демалыс → тазарту. Ұстап тұру таңдауды ашады.",
        trainingConsistency: "Жаттығу тәртібі",
        performanceOverview: "Нәтижелер шолуы",
        latestWorkoutLoad: "Соңғы жаттығу көлемі",
        muscleLoadChart: "Бұлшықет жүктемесі графигі",
        exerciseProgressChart: "Клиент жаттығуларының прогресі",
        muscleProgressByPeriod: "Кезеңдер бойынша бұлшықет прогресі",
        loadDistribution: "Жүктеменің дөңгелек диаграммасы",
        exerciseDeepAnalysis: "Таңдалған жаттығуды талдау",
        chooseExercise: "Жаттығуды таңдаңыз",
        chooseMuscleGroup: "Бұлшықет тобын таңдаңыз",
        exerciseDropdown: "Жаттығулар тізімі",
        noExerciseResult: "Таңдалған жаттығу бойынша нәтиже әлі жоқ.",
        chooseRepRange: "Қайталау сүзгісі",
        allExercises: "Барлық жаттығулар",
        weightMetric: "Салмақ",
        repsMetric: "Қайталау",
        previousCurrent: "Бұрын / қазір",
        repRangeAnalysis: "Қайталау диапазондары",
        currentStreakLocal: "Серия күнтізбе бойынша есептеледі",
        exerciseProgressInfo: "Жаттықтырушы берген жаттығулар бойынша нәтиже өзгерісін көрсетеді. Прогресс әлі жоқ болса, өзгеріс жоқ деп белгіленеді.",
        chooseGroupFirst: "Алдымен бұлшықет тобын таңдаңыз",
        backToGroups: "Топтарға қайту",
      };
    }

    return {
      historyIntro: "Visual analytics for volume, muscle groups and exercise progress.",
      volumeDistribution: "Volume distribution",
      topProgress: "Top progress",
      strengthMap: "Strength map",
      exerciseDynamics: "Exercise dynamics",
      latestResultsTitle: "Latest results",
      latestResultsSubtitle: "Sets, weight, reps and target completion for every exercise.",
      sessionSummary: "Workout summary",
      totalWork: "Volume",
      bestSetShort: "Best set",
      completion: "Completion",
      target: "target",
      actual: "actual",
      sets: "sets",
      noWeightedData: "No weighted performance data yet.",
      loading: "Loading",
      noWeightEntries: "No weight entries yet",
      noWeightEntriesText: "Add the first weight entry to make the chart useful.",
      range7: "7 days",
      range30: "30 days",
      rangeAll: "All",
      shownEntries: "Shown entries",
      attendanceHistory: "Attendance history",
      attendanceTrend: "Attendance trend",
      attendanceTrendText: "Rate excludes rest days: attended / (attended + missed).",
      previousMonth: "Previous month",
      nextMonth: "Next month",
      currentMonth: "Current month",
      attendedLabel: "Attended",
      missedLabel: "Missed",
      restLabel: "Rest",
      notMarked: "Not marked",
      clearSelection: "Clear selection",
      markedDays: "Marked days",
      countedDays: "Counted days",
      restDays: "Rest days",
      noAttendanceHistory: "No attendance history yet.",
      monthComparison: "Monthly comparison",
      attendanceFormula: "Rest days do not lower attendance rate.",
      bestMonth: "Best month",
      weakMonth: "Weak month",
      muscleFocus: "Muscle focus",
      laggingMuscle: "Lowest volume",
      balancedScore: "Load balance",
      supplementAnalytics: "Supplement adherence",
      supplementAnalyticsText: "Shows how well the client follows today’s supplement plan.",
      todaySupplements: "Today’s supplements",
      quickTapHint: "Tap a day to cycle status: attended → missed → rest → clear. Hold to open the menu.",
      trainingConsistency: "Training consistency",
      performanceOverview: "Performance overview",
      latestWorkoutLoad: "Latest workout load",
      muscleLoadChart: "Muscle load chart",
      exerciseProgressChart: "Client exercise progress",
      muscleProgressByPeriod: "Muscle progress by period",
      loadDistribution: "Load distribution donut",
      exerciseDeepAnalysis: "Selected exercise analysis",
      chooseExercise: "Choose exercise",
      chooseMuscleGroup: "Choose muscle group",
      exerciseDropdown: "Exercise list",
      noExerciseResult: "No results for the selected exercise yet.",
      chooseRepRange: "Rep range filter",
      allExercises: "All exercises",
      weightMetric: "Weight",
      repsMetric: "Reps",
      previousCurrent: "Previous / current",
      repRangeAnalysis: "Rep range analysis",
      currentStreakLocal: "Streak is calculated from calendar",
      exerciseProgressInfo: "Shows result changes for exercises assigned by the coach. If there is no progress yet, the row is marked as no change.",
      chooseGroupFirst: "Choose a muscle group first",
      backToGroups: "Back to groups",
    };
  }, [currentLang]);


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

  const filteredProgress = useMemo(() => {
    const progress = sortProgressByDate(data?.progress ?? []);

    if (progress.length === 0 || weightRange === "all") {
      return progress;
    }

    const latest = progress[progress.length - 1];
    const latestTime = getSafeDate(latest.date).getTime();

    if (!latestTime) {
      return progress;
    }

    const startTime = latestTime - weightRange * 24 * 60 * 60 * 1000;

    return progress.filter((item) => getSafeDate(item.date).getTime() >= startTime);
  }, [data?.progress, weightRange]);

  const progressRangeOptions: { key: WeightRange; label: string }[] = useMemo(
    () => [
      { key: 7, label: uiText.range7 },
      { key: 30, label: uiText.range30 },
      { key: "all", label: uiText.rangeAll },
    ],
    [uiText.range7, uiText.range30, uiText.rangeAll],
  );

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

  const attendanceMonthKey = useMemo(
    () => getMonthKey(attendanceMonth),
    [attendanceMonth],
  );

  const attendanceMonthTitle = useMemo(
    () => formatMonthTitle(attendanceMonth, currentLang),
    [attendanceMonth, currentLang],
  );

  const gridDays: {
    date: string;
    dayOfMonth: number;
    inMonth: boolean;
    status?: AttendanceStatus;
  }[] = useMemo(() => {
    const attendance = data?.attendance ?? [];

    return buildMonthGrid(attendanceMonth).map((day) => {
      const a = attendance.find((item) => item.date === day.date);

      return {
        ...day,
        status: a?.status as AttendanceStatus | undefined,
      };
    });
  }, [attendanceMonth, data?.attendance]);

  const currentMonthAttendanceStats = useMemo(
    () => getAttendanceStats(data?.attendance ?? [], attendanceMonthKey),
    [data?.attendance, attendanceMonthKey],
  );

  const monthAttendanceRate = currentMonthAttendanceStats.rate;

  const attendanceMonthlyStats = useMemo(() => {
    const attendance = data?.attendance ?? [];
    const keys = new Set<string>();

    attendance.forEach((item) => {
      if (item.date) keys.add(getDateMonthKey(item.date));
    });

    keys.add(attendanceMonthKey);

    return Array.from(keys)
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a))
      .map((key) => {
        const [year, month] = key.split("-").map(Number);
        const monthDate = new Date(year, month - 1, 1);
        const stats = getAttendanceStats(attendance, key);

        return {
          key,
          date: monthDate,
          label: formatMonthTitle(monthDate, currentLang),
          ...stats,
        };
      });
  }, [data?.attendance, attendanceMonthKey, currentLang]);

  const bestAttendanceMonth = useMemo(
    () =>
      attendanceMonthlyStats
        .filter((item) => item.counted > 0)
        .slice()
        .sort((a, b) => b.rate - a.rate)[0],
    [attendanceMonthlyStats],
  );

  const weakestAttendanceMonth = useMemo(
    () =>
      attendanceMonthlyStats
        .filter((item) => item.counted > 0)
        .slice()
        .sort((a, b) => a.rate - b.rate)[0],
    [attendanceMonthlyStats],
  );

  const attendanceStreakStats = useMemo(
    () => calculateAttendanceStreaks(data?.attendance ?? []),
    [data?.attendance],
  );

  const attendanceTrendChartData = useMemo(
    () =>
      attendanceMonthlyStats
        .slice()
        .reverse()
        .map((item) => ({
          label: item.label.split(" ")[0],
          rate: item.rate / 100,
          value: item.rate,
        })),
    [attendanceMonthlyStats],
  );

  const supplementAdherenceData = useMemo(() => {
    const supps = data?.supps ?? [];

    return supps.map((supplement: any) => {
      const times = Array.isArray(supplement.specificTimes)
        ? supplement.specificTimes
        : [];
      const expected = Math.max(1, times.length);
      const taken = times.filter((time: string) => {
        const log = supplementLogsToday.find(
          (item) =>
            item.supplementItemId === supplement.id &&
            item.date === today &&
            item.time === time,
        );

        return log?.taken === true;
      }).length;

      return {
        label: String(supplement.name ?? "Supplement"),
        rate: taken / expected,
        value: taken / expected,
      };
    });
  }, [data?.supps, supplementLogsToday, today]);

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

  const weakestMuscleSummary = useMemo(() => {
    const active = muscleSummaries.filter((item) => item.totalVolume > 0);

    if (active.length === 0) return undefined;

    return active.slice().sort((a, b) => a.totalVolume - b.totalVolume)[0];
  }, [muscleSummaries]);

  const muscleBalanceScore = useMemo(() => {
    const active = muscleSummaries.filter((item) => item.totalVolume > 0);

    if (active.length <= 1) return active.length === 1 ? 50 : 0;

    const max = Math.max(...active.map((item) => item.totalVolume));
    const min = Math.min(...active.map((item) => item.totalVolume));

    return Math.round((min / Math.max(1, max)) * 100);
  }, [muscleSummaries]);

  const lastWorkoutVolume = useMemo(() => {
    const latest = exerciseHistory
      .slice()
      .sort(
        (a, b) =>
          getSafeDate(b.createdAt).getTime() -
          getSafeDate(a.createdAt).getTime(),
      )[0];

    if (!latest) return 0;

    const latestDay = ymd(getSafeDate(latest.createdAt));

    return exerciseHistory
      .filter((item) => ymd(getSafeDate(item.createdAt)) === latestDay)
      .flatMap((item) => item.sets)
      .reduce((sum, set) => sum + getSetVolume(set), 0);
  }, [exerciseHistory]);

  const latestExerciseHistory = useMemo(
    () =>
      exerciseHistory
        .slice()
        .sort(
          (a, b) =>
            getSafeDate(b.createdAt).getTime() -
            getSafeDate(a.createdAt).getTime(),
        )
        .slice(0, 12),
    [exerciseHistory],
  );

  const maxExerciseVolume = useMemo(
    () =>
      Math.max(
        1,
        ...exerciseProgress.map((item) => Math.round(item.totalVolume)),
      ),
    [exerciseProgress],
  );

  const muscleVolumeChartData = useMemo(
    () =>
      muscleSummaries.map((item) => ({
        label: getMuscleGroupLabel(item.muscleGroup, t),
        value: Math.round(item.totalVolume),
      })),
    [muscleSummaries, t],
  );

  const exerciseProgressChartData = useMemo(
    () =>
      exerciseProgress.map((item) => {
        const repsUnit = currentLang === "ru" ? "повт." : currentLang === "kk" ? "қайт." : "reps";
        const hasWeight = item.bestWeight > 0;
        const unit = hasWeight ? t("common.kg") : repsUnit;
        const progressValue = hasWeight ? item.progress : item.bestReps;
        const currentBest = hasWeight ? item.bestWeight : item.bestReps;
        const progressLabel =
          progressValue > 0
            ? `${currentLang === "ru" ? "прогресс" : currentLang === "kk" ? "прогресс" : "progress"}: +${Number(progressValue.toFixed(1))} ${unit}`
            : `${currentLang === "ru" ? "лучший результат" : currentLang === "kk" ? "үздік нәтиже" : "best"}: ${Number(currentBest.toFixed(1))} ${unit}`;

        return {
          label: getTranslatedExerciseName(item.exerciseName, currentLang),
          value: Number(progressValue.toFixed(1)),
          meta: `${item.setCount} ${uiText.sets} · ${progressLabel}`,
        };
      }),
    [exerciseProgress, currentLang, uiText.sets, t],
  );

  const repRangeOptions = useMemo(
    () =>
      (["all", "1-5", "6-8", "9-10", "11-15", "16+"] as RepRangeKey[]).map(
        (key) => ({
          key,
          label: getRepRangeLabel(key, currentLang),
        }),
      ),
    [currentLang],
  );

  const exerciseHistorySetCountByKey = useMemo(() => {
    const map = new Map<string, number>();

    exerciseHistory.forEach((item) => {
      const key = normalizeExerciseNameForMatch(item.exerciseName);
      map.set(key, (map.get(key) ?? 0) + item.sets.length);
    });

    return map;
  }, [exerciseHistory]);

  const muscleGroupSelectorOptions = useMemo(
    () => [
      {
        key: "all",
        label:
          currentLang === "ru"
            ? "Все группы"
            : currentLang === "kk"
              ? "Барлық топтар"
              : "All groups",
      },
      ...MUSCLE_GROUPS.map((group) => ({
        key: group,
        label: getMuscleGroupName(group, currentLang),
      })),
    ],
    [currentLang],
  );

  const exerciseSelectorOptions = useMemo(() => {
    const libraryMap = new Map<
      string,
      {
        key: string;
        label: string;
        muscleGroup: string;
        rawMuscleGroup: string;
        setCount: number;
        source: "library" | "history";
      }
    >();

    EXERCISE_LIBRARY.forEach((exercise) => {
      const rawMuscleGroup = normalizeMuscleGroup(exercise.muscleGroup);

      if (selectedMuscleGroupKey !== "all" && rawMuscleGroup !== selectedMuscleGroupKey) {
        return;
      }

      const key = normalizeExerciseNameForMatch(exercise.name);

      if (!libraryMap.has(key)) {
        libraryMap.set(key, {
          key,
          label: getExerciseName(exercise, currentLang),
          muscleGroup: getMuscleGroupName(exercise.muscleGroup, currentLang),
          rawMuscleGroup,
          setCount: exerciseHistorySetCountByKey.get(key) ?? 0,
          source: "library",
        });
      }
    });

    exerciseHistory.forEach((item) => {
      const key = normalizeExerciseNameForMatch(item.exerciseName);
      const rawMuscleGroup = normalizeMuscleGroup(item.muscleGroup);

      if (selectedMuscleGroupKey !== "all" && rawMuscleGroup !== selectedMuscleGroupKey) {
        return;
      }

      if (!libraryMap.has(key)) {
        libraryMap.set(key, {
          key,
          label: getTranslatedExerciseName(item.exerciseName, currentLang),
          muscleGroup: getMuscleGroupLabel(rawMuscleGroup, t),
          rawMuscleGroup,
          setCount: exerciseHistorySetCountByKey.get(key) ?? item.sets.length,
          source: "history",
        });
      }
    });

    return Array.from(libraryMap.values()).sort((a, b) => {
      if (b.setCount !== a.setCount) return b.setCount - a.setCount;
      if (a.rawMuscleGroup !== b.rawMuscleGroup) return a.rawMuscleGroup.localeCompare(b.rawMuscleGroup);
      return a.label.localeCompare(b.label);
    });
  }, [
    selectedMuscleGroupKey,
    currentLang,
    exerciseHistory,
    exerciseHistorySetCountByKey,
    t,
  ]);

  const groupedExerciseSelectorOptions = useMemo(() => {
    const grouped = new Map<
      string,
      {
        key: string;
        label: string;
        items: typeof exerciseSelectorOptions;
      }
    >();

    exerciseSelectorOptions.forEach((item) => {
      const group = grouped.get(item.rawMuscleGroup) ?? {
        key: item.rawMuscleGroup,
        label: item.muscleGroup,
        items: [],
      };

      group.items.push(item);
      grouped.set(item.rawMuscleGroup, group);
    });

    return Array.from(grouped.values()).sort((a, b) => {
      const aSets = a.items.reduce((sum, item) => sum + item.setCount, 0);
      const bSets = b.items.reduce((sum, item) => sum + item.setCount, 0);

      if (bSets !== aSets) return bSets - aSets;
      return a.label.localeCompare(b.label);
    });
  }, [exerciseSelectorOptions]);

  const resolvedSelectedExerciseKey = useMemo(() => {
    if (selectedExerciseKey === "all") return "all";

    if (exerciseSelectorOptions.some((item) => item.key === selectedExerciseKey)) {
      return selectedExerciseKey;
    }

    return "all";
  }, [exerciseSelectorOptions, selectedExerciseKey]);

  const selectedExerciseOption = useMemo(() => {
    if (resolvedSelectedExerciseKey === "all") return undefined;

    return exerciseSelectorOptions.find(
      (item) => item.key === resolvedSelectedExerciseKey,
    );
  }, [exerciseSelectorOptions, resolvedSelectedExerciseKey]);

  const selectedExerciseSets = useMemo(() => {
    const rows = exerciseHistory
      .flatMap((item) =>
        item.sets.map((set) => {
          const exerciseKey = normalizeExerciseNameForMatch(item.exerciseName);
          const reps = Number(set.actualReps ?? 0);
          const weight = Number(set.weight ?? 0);
          const date = set.createdAt ?? item.createdAt;

          return {
            id: set.id,
            exerciseKey,
            exerciseName: getTranslatedExerciseName(item.exerciseName, currentLang),
            muscleGroup: getMuscleGroupLabel(item.muscleGroup, t),
            date,
            time: getSafeDate(date).getTime(),
            reps,
            weight,
            volume: weight > 0 && reps > 0 ? weight * reps : reps,
          };
        }),
      )
      .filter((set) => set.reps > 0)
      .filter((set) =>
        resolvedSelectedExerciseKey === "all"
          ? true
          : set.exerciseKey === resolvedSelectedExerciseKey,
      )
      .filter((set) => matchesRepRange(set.reps, selectedRepRange))
      .sort((a, b) => a.time - b.time);

    return rows;
  }, [
    exerciseHistory,
    resolvedSelectedExerciseKey,
    selectedRepRange,
    currentLang,
    t,
  ]);

  const selectedExerciseHasWeight = useMemo(
    () => selectedExerciseSets.some((set) => set.weight > 0),
    [selectedExerciseSets],
  );

  const selectedExerciseMetricUnit = selectedExerciseHasWeight
    ? t("common.kg")
    : currentLang === "ru"
      ? "повт."
      : currentLang === "kk"
        ? "қайт."
        : "reps";

  const selectedExerciseMetricLabel = selectedExerciseHasWeight
    ? uiText.weightMetric
    : uiText.repsMetric;

  const selectedExercisePerformanceData = useMemo(
    () =>
      selectedExerciseSets.map((set) => ({
        label: formatShortChartDate(set.date, currentLang),
        date: set.date,
        value: selectedExerciseHasWeight ? set.weight : set.reps,
        reps: set.reps,
        weight: set.weight,
        volume: set.volume,
      })),
    [selectedExerciseSets, selectedExerciseHasWeight, currentLang],
  );

  const repRangePerformanceData = useMemo(() => {
    const allSets = exerciseHistory
      .flatMap((item) =>
        item.sets.map((set) => {
          const exerciseKey = normalizeExerciseNameForMatch(item.exerciseName);
          const reps = Number(set.actualReps ?? 0);
          const weight = Number(set.weight ?? 0);
          const date = set.createdAt ?? item.createdAt;

          return {
            exerciseKey,
            reps,
            weight,
            date,
            time: getSafeDate(date).getTime(),
          };
        }),
      )
      .filter((set) => set.reps > 0)
      .filter((set) =>
        resolvedSelectedExerciseKey === "all"
          ? true
          : set.exerciseKey === resolvedSelectedExerciseKey,
      )
      .sort((a, b) => a.time - b.time);

    return (["1-5", "6-8", "9-10", "11-15", "16+"] as RepRangeKey[]).map((range) => {
      const rangeSets = allSets.filter((set) => matchesRepRange(set.reps, range));
      const split = splitPreviousCurrent(rangeSets);
      const previous = getMetricValueFromSets(split.previous);
      const current = getMetricValueFromSets(split.current.length > 0 ? split.current : split.previous);
      const hasWeight = rangeSets.some((set) => set.weight > 0);

      return {
        label: getRepRangeLabel(range, currentLang),
        previous,
        current,
        unit: hasWeight ? t("common.kg") : selectedExerciseMetricUnit,
        meta: `${rangeSets.length} ${uiText.sets}`,
      };
    });
  }, [
    exerciseHistory,
    resolvedSelectedExerciseKey,
    currentLang,
    selectedExerciseMetricUnit,
    t,
    uiText.sets,
  ]);

  const muscleGroupProgressChartData = useMemo(() => {
    const sorted = exerciseHistory
      .slice()
      .sort(
        (a, b) =>
          getSafeDate(a.createdAt).getTime() -
          getSafeDate(b.createdAt).getTime(),
      );
    const split = splitPreviousCurrent(sorted);

    const collect = (items: ExerciseHistoryItem[]) => {
      const map = new Map<string, { label: string; volume: number }>();

      items.forEach((item) => {
        const key = normalizeMuscleGroup(item.muscleGroup);
        const current = map.get(key) ?? {
          label: getMuscleGroupLabel(key, t),
          volume: 0,
        };

        current.volume += item.sets.reduce((sum, set) => sum + getSetVolume(set), 0);
        map.set(key, current);
      });

      return map;
    };

    const previousMap = collect(split.previous);
    const currentMap = collect(split.current.length > 0 ? split.current : split.previous);
    const keys = new Set([...previousMap.keys(), ...currentMap.keys()]);

    return Array.from(keys).map((key) => ({
      label: currentMap.get(key)?.label ?? previousMap.get(key)?.label ?? key,
      previous: Math.round(previousMap.get(key)?.volume ?? 0),
      value: Math.round(currentMap.get(key)?.volume ?? 0),
    }));
  }, [exerciseHistory, t]);

  const muscleDistributionData = useMemo(
    () =>
      muscleSummaries.map((item) => ({
        label: getMuscleGroupLabel(item.muscleGroup, t),
        value: Math.round(item.totalVolume),
      })),
    [muscleSummaries, t],
  );


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

      update((d) => {
        const normalizedAttendance = backendAttendance.map((a: any) => ({
          id: String(a.id),
          clientId: String(a.clientId ?? a.client_id ?? id),
          coachId: String(a.coachId ?? a.coach_id ?? user.id),
          date: a.date,
          status: a.status,
          notes: a.notes ?? undefined,
        }));
        const nextAttendance = [
          ...d.attendance.filter((a) => a.clientId !== id),
          ...normalizedAttendance,
        ];
        const calculated = calculateAttendanceStreaks(normalizedAttendance);
        const hasStreak = d.streaks.some((streak) => streak.clientId === id);
        const nextStreaks = hasStreak
          ? d.streaks.map((streak) =>
              streak.clientId === id
                ? {
                    ...streak,
                    currentStreak: calculated.currentStreak,
                    bestStreak: Math.max(streak.bestStreak ?? 0, calculated.bestStreak),
                  }
                : streak,
            )
          : [
              ...d.streaks,
              {
                clientId: id,
                currentStreak: calculated.currentStreak,
                bestStreak: calculated.bestStreak,
              },
            ];

        return {
          ...d,
          attendance: nextAttendance,
          streaks: nextStreaks,
        };
      });
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

  const applyAttendanceLocal = useCallback(
    (
      date: string,
      status: AttendanceStatus,
      saved?: any,
    ) => {
      if (!id || !user?.id) return;

      update((d) => {
        const existing = d.attendance.find(
          (a) => a.clientId === id && a.date === date,
        );

        const nextAttendanceEntry = {
          id: String(saved?.id ?? existing?.id ?? `att_local_${id}_${date}`),
          clientId: String(saved?.clientId ?? saved?.client_id ?? id),
          coachId: String(saved?.coachId ?? saved?.coach_id ?? user.id),
          date: String(saved?.date ?? date),
          status: String(saved?.status ?? status) as AttendanceStatus,
          notes: saved?.notes ?? existing?.notes ?? undefined,
        };

        const nextAttendance = existing
          ? d.attendance.map((a) =>
              a.clientId === id && a.date === date ? nextAttendanceEntry : a,
            )
          : [...d.attendance, nextAttendanceEntry];

        const calculated = calculateAttendanceStreaks(
          nextAttendance.filter((a) => a.clientId === id),
        );
        const hasStreak = d.streaks.some((streak) => streak.clientId === id);
        const nextStreaks = hasStreak
          ? d.streaks.map((streak) =>
              streak.clientId === id
                ? {
                    ...streak,
                    currentStreak: calculated.currentStreak,
                    bestStreak: Math.max(streak.bestStreak ?? 0, calculated.bestStreak),
                  }
                : streak,
            )
          : [
              ...d.streaks,
              {
                clientId: id,
                currentStreak: calculated.currentStreak,
                bestStreak: calculated.bestStreak,
              },
            ];

        return {
          ...d,
          attendance: nextAttendance,
          streaks: nextStreaks,
        };
      });
    },
    [id, update, user?.id],
  );

  const rollbackAttendanceLocal = useCallback(
    (date: string, previous?: any) => {
      if (!id) return;

      update((d) => {
        if (!previous) {
          return {
            ...d,
            attendance: d.attendance.filter(
              (a) => !(a.clientId === id && a.date === date),
            ),
          };
        }

        return {
          ...d,
          attendance: d.attendance.map((a) =>
            a.clientId === id && a.date === date ? previous : a,
          ),
        };
      });
    },
    [id, update],
  );

  const clearAttendanceLocal = useCallback(
    (date: string) => {
      if (!id) return;

      update((d) => {
        const nextAttendance = d.attendance.filter(
          (a) => !(a.clientId === id && a.date === date),
        );
        const calculated = calculateAttendanceStreaks(
          nextAttendance.filter((a) => a.clientId === id),
        );

        return {
          ...d,
          attendance: nextAttendance,
          streaks: d.streaks.map((streak) =>
            streak.clientId === id
              ? {
                  ...streak,
                  currentStreak: calculated.currentStreak,
                  bestStreak: Math.max(streak.bestStreak ?? 0, calculated.bestStreak),
                }
              : streak,
          ),
        };
      });
    },
    [id, update],
  );

  const setAttendance = (date: string, action: AttendanceAction) => {
    if (!user || !id || !token) {
      Alert.alert(t("profile.authErrorTitle"), t("profile.loginAgainText"));
      return;
    }

    const previousAttendance = data.attendance.find(
      (a) => a.clientId === id && a.date === date,
    );

    const nextSeq = (attendanceSyncSeq.current[date] ?? 0) + 1;
    attendanceSyncSeq.current[date] = nextSeq;

    if (action === "clear") {
      clearAttendanceLocal(date);

      void (async () => {
        try {
          await apiDelete(`/attendance?client_id=${id}&date=${date}`, {
            token,
          });
        } catch (e) {
          console.log("[client-detail] clear attendance delete error", e);

          try {
            await apiPost(
              "/attendance",
              {
                client_id: id,
                date,
                status: "clear",
              },
              { token },
            );
          } catch (fallbackError) {
            console.log(
              "[client-detail] clear attendance fallback error",
              fallbackError,
            );

            if (attendanceSyncSeq.current[date] === nextSeq) {
              rollbackAttendanceLocal(date, previousAttendance);
            }
          }
        }
      })();

      return;
    }

    applyAttendanceLocal(date, action);

    void (async () => {
      try {
        const saved = await apiPost(
          "/attendance",
          {
            client_id: id,
            date,
            status: action,
          },
          { token },
        );

        if (attendanceSyncSeq.current[date] === nextSeq) {
          applyAttendanceLocal(date, action, saved);
        }
      } catch (e: any) {
        console.log("[client-detail] attendance save error", e);

        if (attendanceSyncSeq.current[date] === nextSeq) {
          rollbackAttendanceLocal(date, previousAttendance);

          Alert.alert(
            t("clientDetail.attendanceErrorTitle"),
            e?.message || t("clientDetail.attendanceErrorMessage"),
          );
        }
      }
    })();
  };

  const promptAttendance = (date: string, current?: AttendanceStatus) => {
    const statusText = getAttendanceStatusLabel(current, {
      attended: uiText.attendedLabel,
      missed: uiText.missedLabel,
      rest: uiText.restLabel,
      notMarked: uiText.notMarked,
    });

    const actions: {
      text: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }[] = [
      {
        text: uiText.attendedLabel,
        onPress: () => setAttendance(date, "attended"),
      },
      {
        text: uiText.missedLabel,
        onPress: () => setAttendance(date, "missed"),
      },
      {
        text: uiText.restLabel,
        onPress: () => setAttendance(date, "rest"),
      },
    ];

    if (current) {
      actions.push({
        text: uiText.clearSelection,
        style: "destructive",
        onPress: () => setAttendance(date, "clear"),
      });
    }

    actions.push({ text: t("common.cancel"), style: "cancel" });

    Alert.alert(
      formatAttendanceDialogDate(date, currentLang),
      `${t("clientDetail.currentStatus").replace("{status}", statusText)}\n${uiText.attendanceFormula}`,
      actions,
      { cancelable: true },
    );
  };

  const cycleAttendance = (date: string, current?: AttendanceStatus) => {
    const nextAction: AttendanceAction =
      current === undefined
        ? "attended"
        : current === "attended"
          ? "missed"
          : current === "missed"
            ? "rest"
            : "clear";

    setAttendance(date, nextAction);
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
              <StreakPill count={attendanceStreakStats.currentStreak} />

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
              { key: "results", label: t("clientDetail.results") },
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
                    {t("clients.height")}: {data.profile.height || "—"} {t("common.cm")} ·{" "}
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
                      <AppText variant="h3">{t("clients.weightTrend")}</AppText>

                      <AppText
                        variant="caption"
                        color={theme.colors.textMuted}
                        style={{ marginTop: 3 }}
                      >
                        {uiText.shownEntries}: {filteredProgress.length}
                      </AppText>
                    </View>

                    {progressLoading ? (
                      <AppText variant="caption" color={theme.colors.textMuted}>
                        {uiText.loading}
                      </AppText>
                    ) : null}
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      backgroundColor: theme.colors.surfaceAlt,
                      padding: 4,
                      borderRadius: theme.radius.pill,
                      gap: 4,
                    }}
                  >
                    {progressRangeOptions.map((option) => {
                      const isSelected = weightRange === option.key;

                      return (
                        <Pressable
                          key={String(option.key)}
                          onPress={() => setWeightRange(option.key)}
                          style={({ pressed }) => ({
                            flex: 1,
                            minHeight: 36,
                            borderRadius: theme.radius.pill,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: isSelected
                              ? theme.colors.surface
                              : "transparent",
                            opacity: pressed ? 0.82 : 1,
                          })}
                        >
                          <AppText
                            variant="caption"
                            color={
                              isSelected
                                ? theme.colors.text
                                : theme.colors.textMuted
                            }
                            style={{ fontWeight: "800" }}
                          >
                            {option.label}
                          </AppText>
                        </Pressable>
                      );
                    })}
                  </View>

                  {progressError ? (
                    <AppText
                      variant="small"
                      color={theme.colors.danger}
                    >
                      {progressError}
                    </AppText>
                  ) : null}

                  {data.progress.length === 0 ? (
                    <AppEmptyState
                      title={uiText.noWeightEntries}
                      message={uiText.noWeightEntriesText}
                    />
                  ) : (
                    <WeightChart
                      values={data.progress}
                      width={w - 80}
                      height={230}
                      rangeDays={getRangeDays(weightRange)}
                      maxPoints={weightRange === "all" ? 14 : 10}
                    />
                  )}
                </View>
              </AppCard>

              <AppButton
                title={t("clients.addWeightEntry")}
                icon={<Plus size={18} color={theme.colors.primaryContrast} />}
                onPress={addProgress}
                fullWidth
              />

              <View style={{ gap: 8 }}>
                {filteredProgress
                  .slice()
                  .reverse()
                  .map((item) => (
                    <AppCard key={item.id} variant="outline">
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <AppText variant="bodyStrong">
                          {item.weight} {t("common.kg")}
                        </AppText>

                        <AppText
                          variant="small"
                          color={theme.colors.textMuted}
                          numberOfLines={1}
                        >
                          {formatProgressDate(item.date, currentLang)}
                        </AppText>
                      </View>
                    </AppCard>
                  ))}
              </View>
            </>
          )}

          {tab === "attendance" && (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <StatCard
                  label={t("attendance.currentStreak")}
                  value={attendanceStreakStats.currentStreak}
                  hint={`${t("attendance.bestStreak")} ${attendanceStreakStats.bestStreak} · ${uiText.currentStreakLocal}`}
                  tone="fire"
                  icon={<Flame size={16} color="#fff" fill="#fff" />}
                />

                <StatCard
                  label={t("attendance.monthRate")}
                  value={`${monthAttendanceRate}%`}
                  hint={uiText.attendanceFormula}
                />
              </View>

              <AppCard variant="elevated">
                <View style={{ gap: 14 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <Pressable
                      onPress={() => setAttendanceMonth((value) => addMonths(value, -1))}
                      hitSlop={8}
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: theme.colors.surfaceAlt,
                      }}
                    >
                      <AppText variant="h3">‹</AppText>
                    </Pressable>

                    <View style={{ alignItems: "center", flex: 1 }}>
                      <AppText
                        variant="h3"
                        style={{ textTransform: "capitalize", textAlign: "center" }}
                      >
                        {attendanceMonthTitle}
                      </AppText>

                      <AppText
                        variant="caption"
                        color={theme.colors.textMuted}
                        style={{ marginTop: 2, textAlign: "center" }}
                      >
                        {uiText.attendanceTrendText}
                      </AppText>
                    </View>

                    <Pressable
                      onPress={() => setAttendanceMonth((value) => addMonths(value, 1))}
                      hitSlop={8}
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: theme.colors.surfaceAlt,
                      }}
                    >
                      <AppText variant="h3">›</AppText>
                    </Pressable>
                  </View>

                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <MiniMetric
                      label={uiText.attendedLabel}
                      value={String(currentMonthAttendanceStats.attended)}
                      positive
                    />

                    <MiniMetric
                      label={uiText.missedLabel}
                      value={String(currentMonthAttendanceStats.missed)}
                      positive={false}
                    />

                    <MiniMetric
                      label={uiText.restLabel}
                      value={String(currentMonthAttendanceStats.rest)}
                    />
                  </View>

                  <ProgressLine
                    value={monthAttendanceRate / 100}
                    tone={
                      monthAttendanceRate >= 80
                        ? "success"
                        : monthAttendanceRate >= 55
                          ? "primary"
                          : "danger"
                    }
                  />

                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <AppText variant="caption" color={theme.colors.textMuted}>
                      {uiText.countedDays}: {currentMonthAttendanceStats.counted}
                    </AppText>

                    <AppText variant="caption" color={theme.colors.textMuted}>
                      {uiText.markedDays}: {currentMonthAttendanceStats.marked}
                    </AppText>
                  </View>
                </View>
              </AppCard>

              <AppText variant="caption" color={theme.colors.textMuted}>
                {uiText.quickTapHint}
              </AppText>

              <View style={{ alignItems: "center" }}>
                <View
                  style={{
                    width: calendarGridWidth,
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  {ALL_DAYS.map((day) => (
                    <View
                      key={day}
                      style={{
                        width: calendarDaySize,
                        alignItems: "center",
                      }}
                    >
                      <AppText
                        variant="caption"
                        color={theme.colors.textMuted}
                        style={{ fontWeight: "800" }}
                      >
                        {getDayLabel(day, t)}
                      </AppText>
                    </View>
                  ))}
                </View>
              </View>

              <View style={{ alignItems: "center" }}>
                <View
                  style={{
                    width: calendarGridWidth,
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: calendarGap,
                  }}
                >
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

                    const fg =
                      day.status === "attended" || day.status === "missed"
                        ? "#fff"
                        : day.inMonth
                          ? theme.colors.text
                          : theme.colors.textFaint;

                    return (
                      <Pressable
                        key={day.date}
                        onPress={() => cycleAttendance(day.date, day.status)}
                        onLongPress={() => promptAttendance(day.date, day.status)}
                        disabled={!day.inMonth}
                        delayLongPress={260}
                        style={({ pressed }) => ({
                          width: calendarDaySize,
                          height: calendarDaySize,
                          borderRadius: 10,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: bg,
                          borderWidth: isToday ? 2 : 1,
                          borderColor: isToday ? theme.colors.fire : theme.colors.border,
                          opacity: !day.inMonth ? 0.28 : pressed ? 0.78 : 1,
                        })}
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
                          <AppText variant="caption" color={fg}>
                            {String(day.dayOfMonth).padStart(2, "0")}
                          </AppText>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <AppCard variant="outline">
                <View style={{ gap: 12 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <AppText variant="h3">{uiText.attendanceTrend}</AppText>

                      <AppText
                        variant="small"
                        color={theme.colors.textMuted}
                        style={{ marginTop: 3 }}
                      >
                        {uiText.monthComparison}
                      </AppText>
                    </View>

                    <AppText variant="h3">{monthAttendanceRate}%</AppText>
                  </View>

                  {attendanceMonthlyStats.length === 0 ? (
                    <AppText variant="small" color={theme.colors.textMuted}>
                      {uiText.noAttendanceHistory}
                    </AppText>
                  ) : (
                    <>
                      <AttendanceTrendChart
                        data={attendanceTrendChartData}
                        width={w - 80}
                        height={210}
                      />

                      <View style={{ gap: 10 }}>
                      {attendanceMonthlyStats.slice(0, 6).map((item) => (
                        <AttendanceMonthRow
                          key={item.key}
                          label={item.label}
                          rate={item.rate}
                          attended={item.attended}
                          missed={item.missed}
                          rest={item.rest}
                        />
                      ))}
                      </View>
                    </>
                  )}
                </View>
              </AppCard>

              <View style={{ flexDirection: "row", gap: 12 }}>
                <AppCard variant="outline" style={{ flex: 1 }}>
                  <AppText variant="caption" color={theme.colors.textMuted}>
                    {uiText.bestMonth}
                  </AppText>

                  <AppText variant="bodyStrong" style={{ marginTop: 4 }}>
                    {bestAttendanceMonth
                      ? `${bestAttendanceMonth.rate}%`
                      : "—"}
                  </AppText>

                  <AppText
                    variant="caption"
                    color={theme.colors.textMuted}
                    numberOfLines={1}
                  >
                    {bestAttendanceMonth?.label ?? uiText.noAttendanceHistory}
                  </AppText>
                </AppCard>

                <AppCard variant="outline" style={{ flex: 1 }}>
                  <AppText variant="caption" color={theme.colors.textMuted}>
                    {uiText.weakMonth}
                  </AppText>

                  <AppText variant="bodyStrong" style={{ marginTop: 4 }}>
                    {weakestAttendanceMonth
                      ? `${weakestAttendanceMonth.rate}%`
                      : "—"}
                  </AppText>

                  <AppText
                    variant="caption"
                    color={theme.colors.textMuted}
                    numberOfLines={1}
                  >
                    {weakestAttendanceMonth?.label ?? uiText.noAttendanceHistory}
                  </AppText>
                </AppCard>
              </View>
            </View>
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
                  <AppCard variant="elevated">
                    <View style={{ gap: 12 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <TrendingUp color={theme.colors.primary} size={20} />

                        <View style={{ flex: 1 }}>
                          <AppText variant="h3">
                            {t("clientDetail.muscleProgressAnalytics")}
                          </AppText>

                          <AppText
                            variant="small"
                            color={theme.colors.textMuted}
                            style={{ marginTop: 3 }}
                          >
                            {uiText.historyIntro}
                          </AppText>
                        </View>
                      </View>

                      <View style={{ flexDirection: "row", gap: 12 }}>
                        <StatCard
                          label={t("clientDetail.totalVolume")}
                          value={`${Math.round(totalHistoryVolume)}${t(
                            "common.kg",
                          )}`}
                          hint={t("clientDetail.weightTimesReps")}
                          tone="primary"
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
                            padding: 14,
                            borderRadius: theme.radius.lg,
                            backgroundColor:
                              strongestExercise.progress >= 0
                                ? "rgba(22,199,132,0.12)"
                                : "rgba(255,73,73,0.12)",
                            borderWidth: 1,
                            borderColor:
                              strongestExercise.progress >= 0
                                ? "rgba(22,199,132,0.24)"
                                : "rgba(255,73,73,0.24)",
                            gap: 8,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              gap: 12,
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <AppText variant="caption" color={theme.colors.textMuted}>
                                {uiText.topProgress}
                              </AppText>

                              <AppText variant="bodyStrong" style={{ marginTop: 2 }}>
                                {getTranslatedExerciseName(
                                  strongestExercise.exerciseName,
                                  currentLang,
                                )}
                              </AppText>

                              <AppText variant="caption" color={theme.colors.textMuted}>
                                {getMuscleGroupLabel(strongestExercise.muscleGroup, t)}
                              </AppText>
                            </View>

                            <AppText
                              variant="h3"
                              color={
                                strongestExercise.progress >= 0
                                  ? theme.colors.success
                                  : theme.colors.danger
                              }
                            >
                              {strongestExercise.progress >= 0 ? "+" : ""}
                              {strongestExercise.progress.toFixed(1)}
                              {t("common.kg")}
                            </AppText>
                          </View>

                          <ProgressLine
                            value={Math.min(
                              1,
                              Math.abs(strongestExercise.progress) /
                                Math.max(1, strongestExercise.bestWeight),
                            )}
                            tone={strongestExercise.progress >= 0 ? "success" : "danger"}
                          />

                          <AppText variant="caption" color={theme.colors.textMuted}>
                            {t("clientDetail.best")}:{" "}
                            {strongestExercise.bestWeight || "—"}
                            {t("common.kg")} ×{" "}
                            {strongestExercise.bestReps || "—"}
                          </AppText>
                        </View>
                      ) : null}
                    </View>
                  </AppCard>

                  <AppCard variant="outline">
                    <View style={{ gap: 12 }}>
                      <View>
                        <AppText variant="h3">{uiText.loadDistribution}</AppText>
                        <AppText
                          variant="small"
                          color={theme.colors.textMuted}
                          style={{ marginTop: 3 }}
                        >
                          {uiText.volumeDistribution}
                        </AppText>
                      </View>

                      <DistributionDonutChart
                        data={muscleDistributionData}
                        width={w - 80}
                        centerLabel={uiText.totalWork}
                        centerValue={`${Math.round(totalHistoryVolume)}${t("common.kg")}`}
                      />
                    </View>
                  </AppCard>

                  <AppCard variant="outline">
                    <View style={{ gap: 12 }}>
                      <View>
                        <AppText variant="h3">{uiText.muscleProgressByPeriod}</AppText>
                        <AppText
                          variant="small"
                          color={theme.colors.textMuted}
                          style={{ marginTop: 3 }}
                        >
                          {uiText.previousCurrent}
                        </AppText>
                      </View>

                      <MuscleGroupProgressChart
                        data={muscleGroupProgressChartData}
                        width={w - 80}
                      />
                    </View>
                  </AppCard>

                  <AppCard variant="outline">
                    <View style={{ gap: 12 }}>
                      <View>
                        <AppText variant="h3">{uiText.exerciseDeepAnalysis}</AppText>
                        <AppText
                          variant="small"
                          color={theme.colors.textMuted}
                          style={{ marginTop: 3 }}
                        >
                          {uiText.chooseExercise}
                        </AppText>
                      </View>

                      <AppText variant="caption" color={theme.colors.textMuted} style={{ fontWeight: "800" }}>
                        {uiText.chooseMuscleGroup}
                      </AppText>

                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8, paddingRight: 8 }}
                      >
                        {muscleGroupSelectorOptions.map((option) => {
                          const active = selectedMuscleGroupKey === option.key;

                          return (
                            <Pressable
                              key={`muscle_chip_${option.key}`}
                              onPress={() => {
                                setSelectedMuscleGroupKey(option.key);
                                setSelectedExerciseKey("all");
                              }}
                              style={{
                                paddingVertical: 9,
                                paddingHorizontal: 12,
                                borderRadius: theme.radius.pill,
                                backgroundColor: active
                                  ? theme.colors.primary
                                  : theme.colors.surfaceAlt,
                              }}
                            >
                              <AppText
                                variant="caption"
                                color={active ? theme.colors.primaryContrast : theme.colors.text}
                                style={{ fontWeight: "800" }}
                              >
                                {option.label}
                              </AppText>
                            </Pressable>
                          );
                        })}
                      </ScrollView>

                      <Pressable
                        onPress={() => setExercisePickerOpen(true)}
                        style={{
                          minHeight: 48,
                          borderRadius: theme.radius.lg,
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                          backgroundColor: theme.colors.surfaceAlt,
                          borderWidth: 1,
                          borderColor: theme.colors.borderSoft,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <AppText variant="caption" color={theme.colors.textMuted} style={{ fontWeight: "800" }}>
                            {uiText.exerciseDropdown}
                          </AppText>
                          <AppText variant="bodyStrong" numberOfLines={1}>
                            {selectedExerciseOption?.label ?? uiText.allExercises}
                          </AppText>
                        </View>
                        <AppText variant="bodyStrong" color={theme.colors.primary}>⌄</AppText>
                      </Pressable>

                      <Modal
                        visible={exercisePickerOpen}
                        transparent
                        animationType="fade"
                        onRequestClose={() => setExercisePickerOpen(false)}
                      >
                        <Pressable
                          onPress={() => setExercisePickerOpen(false)}
                          style={{
                            flex: 1,
                            backgroundColor: "rgba(0,0,0,0.5)",
                            justifyContent: "flex-end",
                          }}
                        >
                          <Pressable
                            onPress={(event) => event.stopPropagation()}
                            style={{
                              maxHeight: "78%",
                              backgroundColor: theme.colors.bg,
                              borderTopLeftRadius: 24,
                              borderTopRightRadius: 24,
                              padding: 18,
                              gap: 12,
                              borderWidth: 1,
                              borderColor: theme.colors.borderSoft,
                            }}
                          >
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                              <View style={{ flex: 1 }}>
                                <AppText variant="h3">
                                  {selectedMuscleGroupKey === "all" ? uiText.chooseGroupFirst : uiText.chooseExercise}
                                </AppText>
                                <AppText variant="small" color={theme.colors.textMuted} style={{ marginTop: 3 }}>
{selectedMuscleGroupKey === "all"
  ? uiText.chooseMuscleGroup
  : getMuscleGroupName(selectedMuscleGroupKey as MuscleGroup, currentLang)}                                </AppText>
                              </View>

                              {selectedMuscleGroupKey !== "all" ? (
                                <Pressable
                                  onPress={() => {
                                    setSelectedMuscleGroupKey("all");
                                    setSelectedExerciseKey("all");
                                  }}
                                  style={{
                                    paddingVertical: 8,
                                    paddingHorizontal: 12,
                                    borderRadius: theme.radius.pill,
                                    backgroundColor: theme.colors.surfaceAlt,
                                  }}
                                >
                                  <AppText variant="caption" style={{ fontWeight: "900" }}>
                                    {uiText.backToGroups}
                                  </AppText>
                                </Pressable>
                              ) : null}
                            </View>

                            {selectedMuscleGroupKey === "all" ? (
                              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 16 }}>
                                <Pressable
                                  onPress={() => {
                                    setSelectedExerciseKey("all");
                                    setExercisePickerOpen(false);
                                  }}
                                  style={{
                                    padding: 16,
                                    borderRadius: theme.radius.lg,
                                    backgroundColor: selectedExerciseKey === "all" ? theme.colors.primary : theme.colors.surface,
                                    borderWidth: 1,
                                    borderColor: selectedExerciseKey === "all" ? theme.colors.primary : theme.colors.borderSoft,
                                  }}
                                >
                                  <AppText
                                    variant="bodyStrong"
                                    color={selectedExerciseKey === "all" ? theme.colors.primaryContrast : theme.colors.text}
                                  >
                                    {uiText.allExercises}
                                  </AppText>
                                </Pressable>

                                {muscleGroupSelectorOptions
                                  .filter((group) => group.key !== "all")
                                  .map((group, groupIndex) => {
                                    const groupItems = groupedExerciseSelectorOptions.find((item) => item.key === group.key)?.items ?? [];
                                    const groupSetCount = groupItems.reduce((sum, item) => sum + item.setCount, 0);

                                    return (
                                      <Pressable
                                        key={`picker_group_${group.key}_${groupIndex}`}
                                        onPress={() => {
                                          setSelectedMuscleGroupKey(group.key);
                                          setSelectedExerciseKey("all");
                                        }}
                                        style={{
                                          padding: 16,
                                          borderRadius: theme.radius.lg,
                                          backgroundColor: theme.colors.surface,
                                          borderWidth: 1,
                                          borderColor: theme.colors.borderSoft,
                                        }}
                                      >
                                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                                          <View style={{ flex: 1 }}>
                                            <AppText variant="bodyStrong" numberOfLines={1}>
                                              {group.label}
                                            </AppText>
                                            <AppText variant="caption" color={theme.colors.textMuted} numberOfLines={1}>
                                              {groupItems.length} {uiText.exerciseDropdown.toLowerCase()}
                                            </AppText>
                                          </View>
                                          {groupSetCount > 0 ? (
                                            <AppText variant="caption" color={theme.colors.primary} style={{ fontWeight: "900" }}>
                                              {groupSetCount} {uiText.sets}
                                            </AppText>
                                          ) : null}
                                        </View>
                                      </Pressable>
                                    );
                                  })}
                              </ScrollView>
                            ) : (
                              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
                                {exerciseSelectorOptions.map((option, optionIndex) => {
                                  const active = resolvedSelectedExerciseKey === option.key && selectedExerciseKey !== "all";

                                  return (
                                    <Pressable
                                      key={`picker_exercise_${option.rawMuscleGroup}_${option.key}_${optionIndex}`}
                                      onPress={() => {
                                        setSelectedExerciseKey(option.key);
                                        setExercisePickerOpen(false);
                                      }}
                                      style={{
                                        padding: 14,
                                        borderRadius: theme.radius.lg,
                                        backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                                        borderWidth: 1,
                                        borderColor: active ? theme.colors.primary : theme.colors.borderSoft,
                                      }}
                                    >
                                      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                                        <View style={{ flex: 1 }}>
                                          <AppText
                                            variant="bodyStrong"
                                            color={active ? theme.colors.primaryContrast : theme.colors.text}
                                            numberOfLines={1}
                                          >
                                            {option.label}
                                          </AppText>
                                          <AppText
                                            variant="caption"
                                            color={active ? theme.colors.primaryContrast : theme.colors.textMuted}
                                            numberOfLines={1}
                                          >
                                            {option.muscleGroup}
                                          </AppText>
                                        </View>
                                        {option.setCount > 0 ? (
                                          <AppText
                                            variant="caption"
                                            color={active ? theme.colors.primaryContrast : theme.colors.primary}
                                            style={{ fontWeight: "900" }}
                                          >
                                            {option.setCount} {uiText.sets}
                                          </AppText>
                                        ) : null}
                                      </View>
                                    </Pressable>
                                  );
                                })}
                              </ScrollView>
                            )}
                          </Pressable>
                        </Pressable>
                      </Modal>

                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                        {repRangeOptions.map((option) => {
                          const active = selectedRepRange === option.key;

                          return (
                            <Pressable
                              key={option.key}
                              onPress={() => setSelectedRepRange(option.key)}
                              style={{
                                paddingVertical: 7,
                                paddingHorizontal: 10,
                                borderRadius: theme.radius.pill,
                                backgroundColor: active
                                  ? "rgba(22,199,132,0.16)"
                                  : theme.colors.surfaceAlt,
                                borderWidth: 1,
                                borderColor: active
                                  ? theme.colors.primary
                                  : theme.colors.borderSoft,
                              }}
                            >
                              <AppText
                                variant="caption"
                                color={active ? theme.colors.primary : theme.colors.textMuted}
                                style={{ fontWeight: "800" }}
                              >
                                {option.label}
                              </AppText>
                            </Pressable>
                          );
                        })}
                      </View>

                      <ExercisePerformanceLineChart
                        data={selectedExercisePerformanceData}
                        width={w - 80}
                        unit={selectedExerciseMetricUnit}
                        metricLabel={selectedExerciseMetricLabel}
                      />

                      <RepRangePerformanceChart
                        data={repRangePerformanceData}
                        width={w - 80}
                        unit={selectedExerciseMetricUnit}
                      />
                    </View>
                  </AppCard>

                  <AppCard variant="outline">
                    <View style={{ gap: 12 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <AppText variant="h3">{uiText.muscleFocus}</AppText>

                          <AppText
                            variant="small"
                            color={theme.colors.textMuted}
                            style={{ marginTop: 3 }}
                          >
                            {uiText.balancedScore}: {muscleBalanceScore}%
                          </AppText>
                        </View>

                        <View
                          style={{
                            width: 58,
                            height: 58,
                            borderRadius: 29,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: theme.colors.surfaceAlt,
                            borderWidth: 1,
                            borderColor: theme.colors.border,
                          }}
                        >
                          <AppText variant="bodyStrong">{muscleBalanceScore}%</AppText>
                        </View>
                      </View>

                      <ProgressLine
                        value={muscleBalanceScore / 100}
                        tone={
                          muscleBalanceScore >= 70
                            ? "success"
                            : muscleBalanceScore >= 40
                              ? "primary"
                              : "danger"
                        }
                      />

                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <MiniMetric
                          label={uiText.totalWork}
                          value={`${Math.round(totalHistoryVolume)}${t("common.kg")}`}
                        />

                        <MiniMetric
                          label={uiText.laggingMuscle}
                          value={
                            weakestMuscleSummary
                              ? getMuscleGroupLabel(weakestMuscleSummary.muscleGroup, t)
                              : "—"
                          }
                        />

                        <MiniMetric
                          label={uiText.latestResultsTitle}
                          value={`${Math.round(lastWorkoutVolume)}${t("common.kg")}`}
                        />
                      </View>
                    </View>
                  </AppCard>

                  <AppCard variant="outline">
                    <View style={{ gap: 12 }}>
                      <AppText variant="h3">{uiText.muscleLoadChart}</AppText>
                      <MuscleVolumeChart
                        data={muscleVolumeChartData}
                        width={w - 80}
                        height={230}
                        unit={t("common.kg")}
                      />
                    </View>
                  </AppCard>

                  <AppCard variant="outline">
                    <View style={{ gap: 12 }}>
                      <View>
                        <AppText variant="h3">{uiText.exerciseProgressChart}</AppText>
                        <AppText variant="small" color={theme.colors.textMuted} style={{ marginTop: 3 }}>
                          {uiText.exerciseProgressInfo}
                        </AppText>
                      </View>
                      <ExerciseProgressChart
                        data={exerciseProgressChartData}
                        width={w - 80}
                        height={220}
                        unit={t("common.kg")}
                      />
                    </View>
                  </AppCard>

                  <AppCard variant="outline">
                    <View style={{ gap: 12 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <AppText variant="h3">{uiText.volumeDistribution}</AppText>

                          <AppText variant="small" color={theme.colors.textMuted}>
                            {t("clientDetail.muscleGroups")}
                          </AppText>
                        </View>

                        <AppText variant="caption" color={theme.colors.textMuted}>
                          {muscleSummaries.length}
                        </AppText>
                      </View>

                      <View style={{ gap: 10 }}>
                        {muscleSummaries.map((item, index) => (
                          <VolumeRow
                            key={item.muscleGroup}
                            label={getMuscleGroupLabel(item.muscleGroup, t)}
                            value={Math.round(item.totalVolume)}
                            hint={`${item.exerciseCount} ${t(
                              "workouts.exercises",
                            ).toLowerCase()} · ${item.setCount} ${t(
                              "workouts.sets",
                            ).toLowerCase()}`}
                            percent={
                              item.totalVolume /
                              Math.max(1, muscleSummaries[0]?.totalVolume ?? 1)
                            }
                            rank={index + 1}
                          />
                        ))}
                      </View>
                    </View>
                  </AppCard>

                  <AppText variant="h3">{uiText.exerciseDynamics}</AppText>

                  <View style={{ gap: 10 }}>
                    {exerciseProgress.slice(0, 8).map((item, index) => (
                      <AppCard key={item.exerciseName} variant="outline">
                        <View style={{ gap: 10 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              gap: 12,
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                <View
                                  style={{
                                    width: 26,
                                    height: 26,
                                    borderRadius: 13,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor: theme.colors.surfaceAlt,
                                  }}
                                >
                                  <AppText variant="caption" style={{ fontWeight: "900" }}>
                                    {index + 1}
                                  </AppText>
                                </View>

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
                                    {getMuscleGroupLabel(item.muscleGroup, t)} ·{" "}
                                    {item.setCount} {uiText.sets}
                                  </AppText>
                                </View>
                              </View>
                            </View>

                            <View style={{ alignItems: "flex-end" }}>
                              <AppText variant="bodyStrong">
                                {item.bestWeight || "—"}
                                {t("common.kg")}
                              </AppText>

                              <AppText variant="caption" color={theme.colors.textMuted}>
                                {t("clientDetail.best")}
                              </AppText>
                            </View>
                          </View>

                          <ProgressLine
                            value={Math.min(
                              1,
                              Math.round(item.totalVolume) / maxExerciseVolume,
                            )}
                            tone={item.progress >= 0 ? "success" : "danger"}
                          />

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
                            {t("clientDetail.volume")}:{" "}
                            {Math.round(item.totalVolume)}
                            {t("common.kg")} · {t("clientDetail.last")}:{" "}
                            {formatHistoryDate(item.lastDate, currentLang)}
                          </AppText>
                        </View>
                      </AppCard>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}

          {tab === "results" && (
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
                  <AppCard variant="elevated">
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
                          <AppText variant="h3">{uiText.latestResultsTitle}</AppText>

                          <AppText
                            variant="small"
                            color={theme.colors.textMuted}
                            style={{ marginTop: 3 }}
                          >
                            {uiText.latestResultsSubtitle}
                          </AppText>
                        </View>

                        <View
                          style={{
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: theme.radius.pill,
                            backgroundColor: theme.colors.surfaceAlt,
                          }}
                        >
                          <AppText variant="caption" style={{ fontWeight: "900" }}>
                            {latestExerciseHistory.length}
                          </AppText>
                        </View>
                      </View>
                    </View>
                  </AppCard>

                  <AppCard variant="outline">
                    <View style={{ gap: 12 }}>
                      <View>
                        <AppText variant="h3">{uiText.supplementAnalytics}</AppText>
                        <AppText
                          variant="small"
                          color={theme.colors.textMuted}
                          style={{ marginTop: 3 }}
                        >
                          {uiText.supplementAnalyticsText}
                        </AppText>
                      </View>

                      <SupplementAdherenceChart
                        data={supplementAdherenceData}
                        width={w - 80}
                      />
                    </View>
                  </AppCard>

                  <AppCard variant="outline">
                    <View style={{ gap: 12 }}>
                      <AppText variant="h3">{uiText.performanceOverview}</AppText>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <MiniMetric
                          label={uiText.latestWorkoutLoad}
                          value={`${Math.round(lastWorkoutVolume)}${t("common.kg")}`}
                          positive
                        />
                        <MiniMetric
                          label={uiText.balancedScore}
                          value={`${muscleBalanceScore}%`}
                          positive={muscleBalanceScore >= 55}
                        />
                      </View>
                    </View>
                  </AppCard>

                  <AppCard variant="outline">
                    <View style={{ gap: 12 }}>
                      <View>
                        <AppText variant="h3">{uiText.muscleLoadChart}</AppText>
                        <AppText
                          variant="small"
                          color={theme.colors.textMuted}
                          style={{ marginTop: 3 }}
                        >
                          {uiText.volumeDistribution}
                        </AppText>
                      </View>

                      <MuscleVolumeChart
                        data={muscleVolumeChartData}
                        width={w - 80}
                      />
                    </View>
                  </AppCard>

                  <AppCard variant="outline">
                    <View style={{ gap: 12 }}>
                      <View>
                        <AppText variant="h3">{uiText.exerciseProgressChart}</AppText>
                        <AppText
                          variant="small"
                          color={theme.colors.textMuted}
                          style={{ marginTop: 3 }}
                        >
                          {uiText.topProgress}
                        </AppText>
                      </View>

                      <ExerciseProgressChart
                        data={exerciseProgressChartData}
                        width={w - 80}
                        unit={t("common.kg")}
                      />
                    </View>
                  </AppCard>

                  <AppCard variant="outline">
                    <View style={{ gap: 12 }}>
                      <View>
                        <AppText variant="h3">{uiText.repRangeAnalysis}</AppText>
                        <AppText
                          variant="small"
                          color={theme.colors.textMuted}
                          style={{ marginTop: 3 }}
                        >
                          {uiText.chooseRepRange}
                        </AppText>
                      </View>

                      <RepRangePerformanceChart
                        data={repRangePerformanceData}
                        width={w - 80}
                        unit={selectedExerciseMetricUnit}
                      />
                    </View>
                  </AppCard>

                  <View style={{ gap: 10 }}>
                    {latestExerciseHistory.map((item) => {
                      const sortedSets = item.sets
                        .slice()
                        .sort((a, b) => a.setNumber - b.setNumber);

                      const totalVolume = sortedSets.reduce(
                        (sum, set) => sum + getSetVolume(set),
                        0,
                      );

                      const bestSet = sortedSets
                        .slice()
                        .sort((a, b) => {
                          const volumeDiff = getSetVolume(b) - getSetVolume(a);

                          if (volumeDiff !== 0) return volumeDiff;

                          return Number(b.actualReps ?? 0) - Number(a.actualReps ?? 0);
                        })[0];

                      const totalTargetReps = sortedSets.reduce(
                        (sum, set) => sum + Number(set.targetReps ?? 0),
                        0,
                      );
                      const totalActualReps = sortedSets.reduce(
                        (sum, set) => sum + Number(set.actualReps ?? 0),
                        0,
                      );
                      const completionRate =
                        totalTargetReps > 0
                          ? Math.min(1, totalActualReps / totalTargetReps)
                          : 0;

                      return (
                        <AppCard
                          key={`${item.exerciseName}_${item.workoutId}_${item.createdAt}`}
                          variant="outline"
                        >
                          <View style={{ gap: 12 }}>
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
                                  style={{ marginTop: 2 }}
                                >
                                  {getMuscleGroupLabel(item.muscleGroup, t)} ·{" "}
                                  {formatHistoryDate(item.createdAt, currentLang)}
                                </AppText>
                              </View>

                              <View style={{ alignItems: "flex-end" }}>
                                <AppText variant="bodyStrong">
                                  {Math.round(totalVolume)}
                                  {t("common.kg")}
                                </AppText>

                                <AppText variant="caption" color={theme.colors.textMuted}>
                                  {uiText.totalWork}
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
                                label={uiText.bestSetShort}
                                value={
                                  bestSet
                                    ? `${bestSet.weight ?? "—"}${t(
                                        "common.kg",
                                      )} × ${bestSet.actualReps}`
                                    : "—"
                                }
                              />

                              <MiniMetric
                                label={uiText.completion}
                                value={`${Math.round(completionRate * 100)}%`}
                                positive={completionRate >= 1}
                              />

                              <MiniMetric
                                label={uiText.sets}
                                value={String(sortedSets.length)}
                              />
                            </View>

                            <View style={{ gap: 8 }}>
                              {sortedSets.map((set) => {
                                const repsPercent =
                                  Number(set.targetReps ?? 0) > 0
                                    ? Math.min(
                                        1,
                                        Number(set.actualReps ?? 0) /
                                          Number(set.targetReps ?? 1),
                                      )
                                    : 0;

                                return (
                                  <View key={set.id} style={{ gap: 5 }}>
                                    <View
                                      style={{
                                        flexDirection: "row",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        gap: 8,
                                      }}
                                    >
                                      <AppText
                                        variant="caption"
                                        color={theme.colors.textMuted}
                                      >
                                        {t("workouts.sets")} {set.setNumber}
                                      </AppText>

                                      <AppText variant="caption" style={{ fontWeight: "800" }}>
                                        {set.weight ?? "—"} {t("common.kg")} ·{" "}
                                        {set.actualReps}/{set.targetReps}{" "}
                                        {t("workouts.reps").toLowerCase()}
                                      </AppText>
                                    </View>

                                    <ProgressLine
                                      value={repsPercent}
                                      tone={repsPercent >= 1 ? "success" : "primary"}
                                    />
                                  </View>
                                );
                              })}
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

function AttendanceMonthRow({
  label,
  rate,
  attended,
  missed,
  rest,
}: {
  label: string;
  rate: number;
  attended: number;
  missed: number;
  rest: number;
}) {
  const { theme } = useTheme();

  const tone = rate >= 80 ? "success" : rate >= 55 ? "primary" : "danger";

  return (
    <View style={{ gap: 7 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
        }}
      >
        <View style={{ flex: 1 }}>
          <AppText
            variant="small"
            style={{ fontWeight: "800", textTransform: "capitalize" }}
            numberOfLines={1}
          >
            {label}
          </AppText>

          <AppText variant="caption" color={theme.colors.textMuted}>
            ✓ {attended} · ✕ {missed} · ○ {rest}
          </AppText>
        </View>

        <AppText
          variant="bodyStrong"
          color={
            tone === "success"
              ? theme.colors.success
              : tone === "danger"
                ? theme.colors.danger
                : theme.colors.text
          }
        >
          {rate}%
        </AppText>
      </View>

      <ProgressLine value={rate / 100} tone={tone} />
    </View>
  );
}

function ProgressLine({
  value,
  tone = "primary",
}: {
  value: number;
  tone?: "primary" | "success" | "danger";
}) {
  const { theme } = useTheme();

  const normalized = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const color =
    tone === "success"
      ? theme.colors.success
      : tone === "danger"
        ? theme.colors.danger
        : theme.colors.primary;

  return (
    <View
      style={{
        height: 9,
        borderRadius: 999,
        backgroundColor: theme.colors.surfaceAlt,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${Math.max(4, normalized * 100)}%`,
          height: 9,
          borderRadius: 999,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

function VolumeRow({
  label,
  value,
  hint,
  percent,
  rank,
}: {
  label: string;
  value: number;
  hint: string;
  percent: number;
  rank: number;
}) {
  const { theme } = useTheme();

  return (
    <View style={{ gap: 7 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.colors.surfaceAlt,
            }}
          >
            <AppText variant="caption" style={{ fontWeight: "900" }}>
              {rank}
            </AppText>
          </View>

          <View style={{ flex: 1 }}>
            <AppText variant="small" style={{ fontWeight: "800" }}>
              {label}
            </AppText>

            <AppText variant="caption" color={theme.colors.textMuted}>
              {hint}
            </AppText>
          </View>
        </View>

        <AppText variant="small" style={{ fontWeight: "900" }}>
          {value}
        </AppText>
      </View>

      <ProgressLine value={percent} />
    </View>
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