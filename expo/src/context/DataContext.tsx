import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/src/context/AuthContext";
import { buildSeed } from "@/src/data/seed";
import { apiGet } from "@/src/services/api";
import {
  buildClientReminders,
  cancelCoachFlowReminders,
  syncReminders,
} from "@/src/services/notifications";
import {
  DBShape,
  Exercise,
  Message,
  SupplementDay,
  User,
  WorkoutAssignment,
} from "@/src/types/models";

const DB_KEY = "coachflow:db:production:v1";
const TOKEN_KEY = "coachflow:token";

function arr(value: any) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.messages)) return value.messages;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.results)) return value.results;

  return [];
}

function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getLocalDayKey(date = new Date()): SupplementDay {
  const days: SupplementDay[] = [
    "Sun",
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
  ];

  return days[date.getDay()];
}


export type WeeklyPlanExerciseInput = {
  id?: string | null;
  exerciseId?: string | null;

  name: string;
  nameRu?: string | null;
  nameKk?: string | null;

  sets: number;
  reps: number;
  restSeconds?: number | null;
  weight?: number | null;

  notes?: string | null;
  notesRu?: string | null;
  notesKk?: string | null;

  imageUrl?: string | null;
  gifUrl?: string | null;
  animationFrames?: string[];

  muscleGroup?: string | null;
  tempo?: string | null;
  targetRpe?: number | null;
};

export type WeeklyPlanDayInput = {
  id?: string | null;
  dayOffset?: number;
  day?: number;

  name: string;
  nameRu?: string | null;
  nameKk?: string | null;

  description?: string | null;
  descriptionRu?: string | null;
  descriptionKk?: string | null;

  category?: string | null;
  categoryRu?: string | null;
  categoryKk?: string | null;

  durationMinutes?: number | null;
  time?: string | null;
  exercises: WeeklyPlanExerciseInput[];
};

export type WeeklyTrainingPlanInput = {
  id: string;

  title?: string;
  name?: string;
  titleRu?: string | null;
  titleKk?: string | null;

  subtitle?: string | null;
  subtitleRu?: string | null;
  subtitleKk?: string | null;

  goal?: string;
  goalLabel?: string;
  goalLabelRu?: string | null;
  goalLabelKk?: string | null;

  description?: string | null;
  descriptionRu?: string | null;
  descriptionKk?: string | null;

  level?: any;
  equipment?: string | null;
  sessionsPerWeek?: number;
  estimatedMinutesPerSession?: number;
  tags?: string[];

  coachAnalysis?: string | null;
  coachAnalysisRu?: string | null;
  coachAnalysisKk?: string | null;

  safetyNotes?: string[];
  safetyNotesRu?: string[];
  safetyNotesKk?: string[];

  progressionNotes?: string[];
  progressionNotesRu?: string[];
  progressionNotesKk?: string[];

  days: WeeklyPlanDayInput[];
};

export type AssignWeeklyPlanOptions = {
  clientId: string;
  plan: WeeklyTrainingPlanInput;
  startDate?: string;
  coachId?: string;
};

export type AssignWeeklyPlanResult = {
  workoutIds: string[];
  exerciseIds: string[];
};

function makeLocalId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseDateKey(dateKey?: string | null): Date {
  if (!dateKey) return new Date();

  const [year, month, day] = dateKey.split("-").map(Number);

  if (!year || !month || !day) return new Date();

  return new Date(year, month - 1, day);
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey);

  date.setDate(date.getDate() + days);

  return getLocalDateKey(date);
}

function toSafeNumber(value: unknown, fallback: number): number {
  const numberValue = Number(value);

  if (Number.isFinite(numberValue)) return numberValue;

  return fallback;
}

function joinLocalizedParts(parts: Array<string | null | undefined>): string | null {
  const cleaned = parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean);

  return cleaned.length > 0 ? cleaned.join("\n\n") : null;
}

function getPlanDisplayName(plan: WeeklyTrainingPlanInput): string {
  return plan.title ?? plan.name ?? "Weekly Plan";
}

function buildWorkoutFromPlanDay(input: {
  coachId: string;
  clientId: string;
  plan: WeeklyTrainingPlanInput;
  day: WeeklyPlanDayInput;
  index: number;
  startDate: string;
  now: string;
}): WorkoutAssignment {
  const dayOffset = toSafeNumber(
    input.day.dayOffset ?? input.day.day,
    input.index * 2,
  );

  const planName = getPlanDisplayName(input.plan);
  const planNameRu = input.plan.titleRu ?? null;
  const planNameKk = input.plan.titleKk ?? null;

  const fallbackName = `${planName} • Day ${input.index + 1}`;
  const fallbackNameRu =
    planNameRu || input.plan.name
      ? `${planNameRu ?? input.plan.name} • День ${input.index + 1}`
      : null;
  const fallbackNameKk =
    planNameKk || input.plan.name
      ? `${planNameKk ?? input.plan.name} • ${input.index + 1}-күн`
      : null;

  const description = joinLocalizedParts([
    input.day.description,
    input.plan.description,
    input.plan.coachAnalysis ? `Coach analysis: ${input.plan.coachAnalysis}` : null,
    input.plan.safetyNotes?.length
      ? `Safety notes:\n${input.plan.safetyNotes.map((note) => `• ${note}`).join("\n")}`
      : null,
    input.plan.progressionNotes?.length
      ? `Progression:\n${input.plan.progressionNotes.map((note) => `• ${note}`).join("\n")}`
      : null,
    input.plan.goalLabel ?? input.plan.goal
      ? `Goal: ${input.plan.goalLabel ?? input.plan.goal}`
      : null,
  ]);

  const descriptionRu = joinLocalizedParts([
    input.day.descriptionRu,
    input.plan.descriptionRu,
    input.plan.coachAnalysisRu
      ? `AI-анализ плана: ${input.plan.coachAnalysisRu}`
      : null,
    input.plan.safetyNotesRu?.length
      ? `Безопасность:\n${input.plan.safetyNotesRu
          .map((note) => `• ${note}`)
          .join("\n")}`
      : null,
    input.plan.progressionNotesRu?.length
      ? `Прогрессия:\n${input.plan.progressionNotesRu
          .map((note) => `• ${note}`)
          .join("\n")}`
      : null,
    input.plan.goalLabelRu ?? input.plan.goalLabel
      ? `Цель: ${input.plan.goalLabelRu ?? input.plan.goalLabel}`
      : null,
  ]);

  const descriptionKk = joinLocalizedParts([
    input.day.descriptionKk,
    input.plan.descriptionKk,
    input.plan.coachAnalysisKk
      ? `AI жоспар талдауы: ${input.plan.coachAnalysisKk}`
      : null,
    input.plan.safetyNotesKk?.length
      ? `Қауіпсіздік:\n${input.plan.safetyNotesKk
          .map((note) => `• ${note}`)
          .join("\n")}`
      : null,
    input.plan.progressionNotesKk?.length
      ? `Прогрессия:\n${input.plan.progressionNotesKk
          .map((note) => `• ${note}`)
          .join("\n")}`
      : null,
    input.plan.goalLabelKk ?? input.plan.goalLabel
      ? `Мақсат: ${input.plan.goalLabelKk ?? input.plan.goalLabel}`
      : null,
  ]);

  return {
    id: makeLocalId("local_weekly_workout"),
    coachId: input.coachId,
    clientId: input.clientId,
    date: addDaysToDateKey(input.startDate, dayOffset),
    time: input.day.time ?? "18:00",

    name: input.day.name || fallbackName,
    nameRu: input.day.nameRu ?? fallbackNameRu ?? input.day.name ?? fallbackName,
    nameKk: input.day.nameKk ?? fallbackNameKk ?? input.day.name ?? fallbackName,

    description: description ?? `Workout from ${planName}.`,
    descriptionRu:
      descriptionRu ??
      description ??
      `Тренировка из плана ${planNameRu ?? planName}.`,
    descriptionKk:
      descriptionKk ??
      description ??
      `${planNameKk ?? planName} жоспарынан жаттығу.`,

    category: input.day.category ?? input.plan.goalLabel ?? input.plan.goal ?? "Weekly plan",
    categoryRu:
      input.day.categoryRu ??
      input.plan.goalLabelRu ??
      input.plan.goalLabel ??
      input.day.category ??
      "Недельный план",
    categoryKk:
      input.day.categoryKk ??
      input.plan.goalLabelKk ??
      input.plan.goalLabel ??
      input.day.category ??
      "Апталық жоспар",

    completed: false,
    completedAt: null,
    durationMinutes:
      input.day.durationMinutes === undefined ||
      input.day.durationMinutes === null
        ? input.plan.estimatedMinutesPerSession ?? 60
        : Number(input.day.durationMinutes),

    source: "weekly_template",
    weeklyPlanId: input.plan.id,
    weeklyPlanTitle: planName,
    weeklyPlanTitleRu: planNameRu ?? planName,
    weeklyPlanTitleKk: planNameKk ?? planName,
    weeklyPlanDayIndex: input.index,
    difficulty: input.plan.level ?? null,
    focus: input.plan.goalLabel ?? input.plan.goal ?? "Weekly plan",
    focusRu: input.plan.goalLabelRu ?? input.plan.goalLabel ?? null,
    focusKk: input.plan.goalLabelKk ?? input.plan.goalLabel ?? null,
    coachNotes: input.plan.coachAnalysis ?? null,
    coachNotesRu: input.plan.coachAnalysisRu ?? input.plan.coachAnalysis ?? null,
    coachNotesKk: input.plan.coachAnalysisKk ?? input.plan.coachAnalysis ?? null,
  };
}

function buildExercisesFromPlanDay(input: {
  workoutId: string;
  day: WeeklyPlanDayInput;
}): Exercise[] {
  return input.day.exercises.map((exercise, index) => ({
    id: makeLocalId("local_weekly_exercise"),
    workoutId: input.workoutId,
    libraryExerciseId: exercise.exerciseId ?? null,

    name: exercise.name,
    nameRu: exercise.nameRu ?? exercise.name,
    nameKk: exercise.nameKk ?? exercise.name,

    sets: Math.max(1, Math.round(toSafeNumber(exercise.sets, 3))),
    reps: Math.max(1, Math.round(toSafeNumber(exercise.reps, 10))),
    restSeconds: Math.max(
      0,
      Math.round(toSafeNumber(exercise.restSeconds, 60)),
    ),
    weight:
      exercise.weight === undefined || exercise.weight === null
        ? undefined
        : Number(exercise.weight),

    notes:
      exercise.notes ??
      (exercise.exerciseId
        ? `Library exercise: ${exercise.exerciseId}`
        : undefined),
    notesRu: exercise.notesRu ?? exercise.notes ?? undefined,
    notesKk: exercise.notesKk ?? exercise.notes ?? undefined,

    imageUrl: exercise.imageUrl ?? undefined,
    gifUrl: exercise.gifUrl ?? undefined,
    animationFrames: exercise.animationFrames ?? undefined,

    muscleGroup: exercise.muscleGroup ?? undefined,
    tempo: exercise.tempo ?? undefined,
    targetRpe: exercise.targetRpe ?? undefined,
    order: index + 1,
  }));
}

function getWeekPlanTargetMinutes(workouts: WorkoutAssignment[]): number {
  return workouts.reduce(
    (sum, workout) => sum + Number(workout.durationMinutes ?? 0),
    0,
  );
}

function normalizeUser(user: any): User {
  return {
    id: String(user.id),
    email: user.email ?? "",
    password: undefined,
    name: user.name ?? "",
    role: user.role,
    phone: user.phone ?? null,
    avatarUrl: user.avatarUrl ?? user.avatar_url ?? null,
    clientCode: user.clientCode ?? user.client_code ?? null,
    createdAt: user.createdAt ?? user.created_at ?? new Date().toISOString(),
    lastSeenAt: user.lastSeenAt ?? user.last_seen_at ?? null,
    isOnline: Boolean(user.isOnline ?? user.is_online ?? false),
  };
}

function mergeUsers(localUsers: User[], backendUsers: User[]): User[] {
  const map = new Map<string, User>();

  for (const user of localUsers) {
    map.set(user.id, user);
  }

  for (const user of backendUsers) {
    const previous = map.get(user.id);

    map.set(user.id, {
      ...(previous ?? {}),
      ...user,
      lastSeenAt: user.lastSeenAt ?? previous?.lastSeenAt ?? null,
      isOnline: Boolean(user.isOnline ?? previous?.isOnline ?? false),
    });
  }

  return Array.from(map.values());
}

function normalizeCoachProfile(profile: any) {
  return {
    userId: String(profile.userId ?? profile.user_id),
    specialty: profile.specialty ?? "",
    bio: profile.bio ?? "",
    experienceYears: Number(
      profile.experienceYears ?? profile.experience_years ?? 0,
    ),
    achievements: profile.achievements ?? [],
    certificates: profile.certificates ?? [],
    rating: Number(profile.rating ?? 5),
    profileImageUrl:
      profile.profileImageUrl ?? profile.profile_image_url ?? undefined,
    coverImageUrl: profile.coverImageUrl ?? profile.cover_image_url ?? undefined,
  };
}

function normalizeClientProfile(profile: any) {
  return {
    userId: String(profile.userId ?? profile.user_id),
    coachId: String(profile.coachId ?? profile.coach_id ?? ""),
    goal: profile.goal ?? "",
    goalType: profile.goalType ?? profile.goal_type ?? "custom",
    startWeight: Number(profile.startWeight ?? profile.start_weight ?? 0),
    currentWeight: Number(profile.currentWeight ?? profile.current_weight ?? 0),
    height: Number(profile.height ?? 0),
    age: profile.age ?? undefined,
    fitnessLevel: profile.fitnessLevel ?? profile.fitness_level ?? "beginner",
    healthNotes: profile.healthNotes ?? profile.health_notes ?? undefined,
    createdAt:
      profile.createdAt ?? profile.created_at ?? new Date().toISOString(),
  };
}

function normalizeWorkout(workout: any) {
  return {
    id: String(workout.id),
    coachId: String(workout.coachId ?? workout.coach_id),
    clientId: String(workout.clientId ?? workout.client_id),
    date: workout.date,
    time: workout.time ?? undefined,

    name: workout.name,
    nameRu: workout.nameRu ?? workout.name_ru ?? undefined,
    nameKk: workout.nameKk ?? workout.name_kk ?? undefined,

    description: workout.description ?? undefined,
    descriptionRu: workout.descriptionRu ?? workout.description_ru ?? undefined,
    descriptionKk: workout.descriptionKk ?? workout.description_kk ?? undefined,

    category: workout.category ?? undefined,
    categoryRu: workout.categoryRu ?? workout.category_ru ?? undefined,
    categoryKk: workout.categoryKk ?? workout.category_kk ?? undefined,

    completed: Boolean(workout.completed),
    completedAt: workout.completedAt ?? workout.completed_at ?? undefined,
    durationMinutes:
      workout.durationMinutes ?? workout.duration_minutes ?? undefined,

    source: workout.source ?? undefined,
    weeklyPlanId: workout.weeklyPlanId ?? workout.weekly_plan_id ?? undefined,
    weeklyPlanTitle:
      workout.weeklyPlanTitle ?? workout.weekly_plan_title ?? undefined,
    weeklyPlanTitleRu:
      workout.weeklyPlanTitleRu ?? workout.weekly_plan_title_ru ?? undefined,
    weeklyPlanTitleKk:
      workout.weeklyPlanTitleKk ?? workout.weekly_plan_title_kk ?? undefined,
    weeklyPlanDayIndex:
      workout.weeklyPlanDayIndex ?? workout.weekly_plan_day_index ?? undefined,

    difficulty: workout.difficulty ?? undefined,
    focus: workout.focus ?? undefined,
    focusRu: workout.focusRu ?? workout.focus_ru ?? undefined,
    focusKk: workout.focusKk ?? workout.focus_kk ?? undefined,
    coachNotes: workout.coachNotes ?? workout.coach_notes ?? undefined,
    coachNotesRu: workout.coachNotesRu ?? workout.coach_notes_ru ?? undefined,
    coachNotesKk: workout.coachNotesKk ?? workout.coach_notes_kk ?? undefined,
  };
}

function normalizeExercise(exercise: any) {
  return {
    id: String(exercise.id),
    workoutId: String(exercise.workoutId ?? exercise.workout_id),
    libraryExerciseId:
      exercise.libraryExerciseId ?? exercise.library_exercise_id ?? undefined,

    name: exercise.name,
    nameRu: exercise.nameRu ?? exercise.name_ru ?? undefined,
    nameKk: exercise.nameKk ?? exercise.name_kk ?? undefined,

    sets: Number(exercise.sets ?? 0),
    reps: Number(exercise.reps ?? 0),
    restSeconds: Number(exercise.restSeconds ?? exercise.rest_seconds ?? 60),
    weight:
      exercise.weight === undefined || exercise.weight === null
        ? undefined
        : Number(exercise.weight),

    notes: exercise.notes ?? undefined,
    notesRu: exercise.notesRu ?? exercise.notes_ru ?? undefined,
    notesKk: exercise.notesKk ?? exercise.notes_kk ?? undefined,

    imageUrl: exercise.imageUrl ?? exercise.image_url ?? undefined,
    gifUrl: exercise.gifUrl ?? exercise.gif_url ?? undefined,
    animationFrames:
      exercise.animationFrames ?? exercise.animation_frames ?? undefined,

    muscleGroup: exercise.muscleGroup ?? exercise.muscle_group ?? undefined,
    tempo: exercise.tempo ?? undefined,
    targetRpe: exercise.targetRpe ?? exercise.target_rpe ?? undefined,
    order: exercise.order ?? undefined,
  };
}

function normalizeProgress(entry: any) {
  return {
    id: String(entry.id),
    clientId: String(entry.clientId ?? entry.client_id),
    weight: Number(entry.weight ?? 0),
    date: entry.date,
    notes: entry.notes ?? undefined,
    addedBy: String(entry.addedBy ?? entry.added_by ?? ""),
  };
}

function normalizeMessage(message: any): Message {
  const receiverValue = message.receiverId ?? message.receiver_id ?? null;

  return {
    id: String(message.id),
    senderId: String(message.senderId ?? message.sender_id),
    receiverId: receiverValue ? String(receiverValue) : null,
    content: message.content ?? "",
    messageType: message.messageType ?? message.message_type ?? "text",
    voiceUrl: message.voiceUrl ?? message.voice_url ?? undefined,
    voiceDurationMs:
      message.voiceDurationMs ?? message.voice_duration_ms ?? undefined,
    read: Boolean(message.read),
    createdAt:
      message.createdAt ?? message.created_at ?? new Date().toISOString(),
  };
}

function mergeMessages(localMessages: Message[], backendMessages: Message[]) {
  const map = new Map<string, Message>();

  for (const message of localMessages) {
    map.set(message.id, message);
  }

  for (const message of backendMessages) {
    const previous = map.get(message.id);

    map.set(message.id, {
      ...(previous ?? {}),
      ...message,

      // Очень важно:
      // если где-то сообщение уже стало read=true,
      // не разрешаем старому локальному состоянию вернуть read=false.
      read: Boolean(previous?.read || message.read),

      receiverId: message.receiverId ?? previous?.receiverId ?? null,
      voiceUrl: message.voiceUrl ?? previous?.voiceUrl,
      voiceDurationMs: message.voiceDurationMs ?? previous?.voiceDurationMs,
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    const at = new Date(a.createdAt).getTime();
    const bt = new Date(b.createdAt).getTime();

    return (Number.isNaN(at) ? 0 : at) - (Number.isNaN(bt) ? 0 : bt);
  });
}

function normalizeWeeklyGoal(goal: any) {
  return {
    id: String(goal.id),
    clientId: String(goal.clientId ?? goal.client_id),
    weekStart: goal.weekStart ?? goal.week_start,
    targetMinutes: Number(goal.targetMinutes ?? goal.target_minutes ?? 0),
    completedMinutes: Number(
      goal.completedMinutes ?? goal.completed_minutes ?? 0,
    ),
    targetWorkouts: Number(goal.targetWorkouts ?? goal.target_workouts ?? 0),
    completedWorkouts: Number(
      goal.completedWorkouts ?? goal.completed_workouts ?? 0,
    ),
  };
}

function normalizeAttendance(item: any) {
  return {
    id: String(item.id),
    clientId: String(item.clientId ?? item.client_id),
    coachId: String(item.coachId ?? item.coach_id),
    date: item.date,
    status: item.status,
    notes: item.notes ?? undefined,
  };
}

function normalizePlace(place: any) {
  return {
    id: String(place.id),
    type: place.type,
    name: place.name,
    address: place.address,
    latitude: Number(place.latitude ?? 0),
    longitude: Number(place.longitude ?? 0),
    description: place.description ?? undefined,
    imageUrl: place.imageUrl ?? place.image_url ?? undefined,
    rating: place.rating ?? undefined,
  };
}

function normalizeNotification(item: any) {
  return {
    userId: String(item.userId ?? item.user_id),
    workoutReminders: Boolean(item.workoutReminders ?? item.workout_reminders),
    supplementReminders: Boolean(
      item.supplementReminders ?? item.supplement_reminders,
    ),
    messageNotifications: Boolean(
      item.messageNotifications ?? item.message_notifications,
    ),
    weeklyGoalReminders: Boolean(
      item.weeklyGoalReminders ?? item.weekly_goal_reminders,
    ),
  };
}

function normalizeSubscription(item: any) {
  return {
    id: String(item.id),
    coachId: String(item.coachId ?? item.coach_id ?? ""),

    planCode: item.planCode ?? item.plan_code ?? "free",
    planName: item.planName ?? item.plan_name ?? "Free Trial",

    price: Number(item.price ?? 0),
    currency: item.currency ?? "KZT",

    clientLimit: Number(item.clientLimit ?? item.client_limit ?? 0),

    status: item.status ?? "inactive",

    startDate: item.startDate ?? item.start_date ?? undefined,
    endDate: item.endDate ?? item.end_date ?? undefined,

    createdAt: item.createdAt ?? item.created_at ?? new Date().toISOString(),
  };
}

function isSubscriptionActive(subscription: any) {
  if (!subscription) return false;
  if (subscription.status !== "active") return false;

  const endDate = subscription.endDate ?? subscription.end_date;

  if (!endDate) return false;

  const time = new Date(endDate).getTime();

  if (Number.isNaN(time)) return false;

  return time > Date.now();
}

function normalizeStreak(item: any) {
  return {
    clientId: String(item.clientId ?? item.client_id ?? ""),
    currentStreak: Number(item.currentStreak ?? item.current_streak ?? 0),
    bestStreak: Number(item.bestStreak ?? item.best_streak ?? 0),
    lastActivityDate:
      item.lastActivityDate ?? item.last_activity_date ?? undefined,
  };
}

function normalizeSupplementPlan(plan: any) {
  return {
    id: String(plan.id),
    coachId: String(plan.coachId ?? plan.coach_id),
    clientId: String(plan.clientId ?? plan.client_id),
    startDate: plan.startDate ?? plan.start_date,
  };
}

function normalizeSupplementItem(item: any) {
  const defaultDays: SupplementDay[] = [
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
    "Sun",
  ];

  const rawDays = item.daysOfWeek ?? item.days_of_week;

  let daysOfWeek: SupplementDay[] = defaultDays;

  if (Array.isArray(rawDays)) {
    daysOfWeek = rawDays.length > 0 ? rawDays : defaultDays;
  } else if (typeof rawDays === "string") {
    try {
      const parsed = JSON.parse(rawDays);

      if (Array.isArray(parsed) && parsed.length > 0) {
        daysOfWeek = parsed;
      }
    } catch {
      daysOfWeek = defaultDays;
    }
  }

  const rawTimes = item.specificTimes ?? item.specific_times ?? [];

  let specificTimes: string[] = [];

  if (Array.isArray(rawTimes)) {
    specificTimes = rawTimes.filter((value) => typeof value === "string");
  } else if (typeof rawTimes === "string") {
    try {
      const parsed = JSON.parse(rawTimes);

      if (Array.isArray(parsed)) {
        specificTimes = parsed.filter((value) => typeof value === "string");
      }
    } catch {
      specificTimes = [];
    }
  }

  return {
    id: String(item.id),
    planId: String(item.planId ?? item.plan_id),
    name: item.name,
    dosage: item.dosage,
    timesPerDay: Number(item.timesPerDay ?? item.times_per_day ?? 1),
    specificTimes,
    daysOfWeek,
    notes: item.notes ?? undefined,
  };
}

function normalizeSupplementLog(log: any) {
  return {
    id: String(log.id),
    clientId: String(log.clientId ?? log.client_id),
    supplementItemId: String(log.supplementItemId ?? log.supplement_item_id),
    date: log.date,
    time: log.time,
    taken: Boolean(log.taken),
  };
}

async function loadLocalDB(): Promise<DBShape> {
  try {
    const raw = await AsyncStorage.getItem(DB_KEY);

    if (raw) {
      const parsed = JSON.parse(raw) as DBShape;

      if (parsed?.meta?.seeded) {
        return parsed;
      }
    }
  } catch (e) {
    console.log("[db] load error", e);
  }

  const seed = buildSeed();

  try {
    await AsyncStorage.setItem(DB_KEY, JSON.stringify(seed));
  } catch (e) {
    console.log("[db] seed write error", e);
  }

  return seed;
}

async function loadBackendDB(localDB: DBShape, token: string): Promise<DBShape> {
  const safeGet = async (path: string) => {
    try {
      return await apiGet(path, { token });
    } catch (e) {
      console.log(`[db] backend load failed: ${path}`, e);
      return null;
    }
  };

  const me = await safeGet("/users/me");
  const currentUser = me ? normalizeUser(me) : null;

  if (!currentUser) {
    return localDB;
  }

  const isCoach = currentUser.role === "coach";
  const isClient = currentUser.role === "client";

  const [
    coachProfile,
    clientProfile,
    notifications,
    clients,
    workouts,
    progress,
    messages,
    weeklyGoals,
    attendance,
    places,
    subscription,
    streak,
    supplementPlans,
    supplementLogs,
  ] = await Promise.all([
    isCoach ? safeGet("/users/me/coach-profile") : Promise.resolve(null),
    isClient ? safeGet("/users/me/client-profile") : Promise.resolve(null),

    safeGet("/users/me/notifications"),

    isCoach ? safeGet("/clients") : Promise.resolve(null),

    safeGet("/workouts"),

    isClient ? safeGet("/progress") : Promise.resolve(null),

    safeGet("/messages"),

    isClient ? safeGet("/weekly-goals") : Promise.resolve(null),

    isClient ? safeGet("/attendance") : Promise.resolve(null),

    safeGet("/places"),

    isCoach ? safeGet("/subscriptions/me") : Promise.resolve(null),

    isClient ? safeGet("/streak") : Promise.resolve(null),

    safeGet("/supplements/plans"),

    isClient ? safeGet("/supplements/logs") : Promise.resolve(null),
  ]);

  const workoutsLoadedFromBackend = workouts !== null;
  const progressLoadedFromBackend = isClient && progress !== null;
  const messagesLoadedFromBackend = messages !== null;
  const weeklyGoalsLoadedFromBackend = isClient && weeklyGoals !== null;
  const attendanceLoadedFromBackend = isClient && attendance !== null;
  const placesLoadedFromBackend = places !== null;
  const supplementPlansLoadedFromBackend = supplementPlans !== null;
  const supplementLogsLoadedFromBackend = isClient && supplementLogs !== null;

  const normalizedSubscription = subscription
    ? normalizeSubscription(subscription)
    : null;

  const coachSubscriptionActive = isCoach
    ? isSubscriptionActive(normalizedSubscription)
    : true;

  if (isCoach && !coachSubscriptionActive) {
    const protectedWorkoutIds = new Set(
      localDB.workouts
        .filter((workout) => workout.coachId === currentUser.id)
        .map((workout) => workout.id),
    );

    const protectedSupplementPlanIds = new Set(
      localDB.supplementPlans
        .filter((plan) => plan.coachId === currentUser.id)
        .map((plan) => plan.id),
    );

    return {
      ...localDB,

      users: mergeUsers(
        localDB.users.filter(
          (user) => user.role !== "client" && user.id !== currentUser.id,
        ),
        [currentUser],
      ),

      coachProfiles: coachProfile
        ? [
            ...localDB.coachProfiles.filter(
              (profile) => profile.userId !== currentUser.id,
            ),
            normalizeCoachProfile(coachProfile),
          ]
        : localDB.coachProfiles,

      clientProfiles: localDB.clientProfiles.filter(
        (profile) => profile.coachId !== currentUser.id,
      ),

      notifications: notifications
        ? [normalizeNotification(notifications)]
        : localDB.notifications,

      subscriptions: normalizedSubscription
        ? [normalizedSubscription]
        : localDB.subscriptions,

      workouts: localDB.workouts.filter(
        (workout) => workout.coachId !== currentUser.id,
      ),

      exercises: localDB.exercises.filter(
        (exercise) => !protectedWorkoutIds.has(exercise.workoutId),
      ),

      progress: localDB.progress,

      messages: localDB.messages.filter(
        (message) =>
          message.senderId !== currentUser.id &&
          message.receiverId !== currentUser.id,
      ),

      weeklyGoals: localDB.weeklyGoals,

      attendance: localDB.attendance.filter(
        (item) => item.coachId !== currentUser.id,
      ),

      places: placesLoadedFromBackend
        ? arr(places).map(normalizePlace)
        : localDB.places,

      streaks: localDB.streaks,

      supplementPlans: localDB.supplementPlans.filter(
        (plan) => plan.coachId !== currentUser.id,
      ),

      supplementItems: localDB.supplementItems.filter(
        (item) => !protectedSupplementPlanIds.has(item.planId),
      ),

      supplementLogs: localDB.supplementLogs,

      meta: {
        seeded: true,
        version: 2,
      },
    };
  }

  const backendClients = arr(clients);
  const clientsLoadedFromBackend = isCoach && clients !== null;

  const backendClientUsers = backendClients
    .map((client: any) => {
      const clientUserRaw = client.user
        ? {
            ...client,
            ...client.user,
            lastSeenAt:
              client.user.lastSeenAt ??
              client.user.last_seen_at ??
              client.lastSeenAt ??
              client.last_seen_at ??
              null,
            isOnline:
              client.user.isOnline ??
              client.user.is_online ??
              client.isOnline ??
              client.is_online ??
              false,
          }
        : client;

      return clientUserRaw?.email ? normalizeUser(clientUserRaw) : null;
    })
    .filter(Boolean) as User[];

  let users =
    isCoach && clientsLoadedFromBackend
      ? localDB.users.filter((user) => user.role !== "client")
      : [...localDB.users];

  users = mergeUsers(users, [currentUser, ...backendClientUsers]);

  let clientProfiles =
    isCoach && clientsLoadedFromBackend
      ? localDB.clientProfiles.filter(
          (profile) => profile.coachId !== currentUser.id,
        )
      : [...localDB.clientProfiles];

  if (clientProfile) {
    const normalized = normalizeClientProfile(clientProfile);
    const index = clientProfiles.findIndex(
      (profile) => profile.userId === normalized.userId,
    );

    if (index >= 0) {
      clientProfiles[index] = normalized;
    } else {
      clientProfiles.push(normalized);
    }
  }

  for (const client of backendClients) {
    const rawProfile =
      client.profile ?? client.clientProfile ?? client.client_profile;

    if (rawProfile) {
      const normalized = normalizeClientProfile(rawProfile);
      const index = clientProfiles.findIndex(
        (profile) => profile.userId === normalized.userId,
      );

      if (index >= 0) {
        clientProfiles[index] = normalized;
      } else {
        clientProfiles.push(normalized);
      }
    }
  }

  const coachProfiles = [...localDB.coachProfiles];

  if (coachProfile) {
    const normalized = normalizeCoachProfile(coachProfile);
    const index = coachProfiles.findIndex(
      (profile) => profile.userId === normalized.userId,
    );

    if (index >= 0) {
      coachProfiles[index] = normalized;
    } else {
      coachProfiles.push(normalized);
    }
  }

  const backendWorkouts = arr(workouts).map(normalizeWorkout);

  const backendExercises = arr(workouts).flatMap((workout: any) =>
    arr(workout.exercises).map(normalizeExercise),
  );

  const backendMessages = messagesLoadedFromBackend
    ? arr(messages).map(normalizeMessage)
    : [];

  return {
    ...localDB,

    users,
    coachProfiles,
    clientProfiles,

    notifications: notifications
      ? [normalizeNotification(notifications)]
      : localDB.notifications,

    subscriptions: normalizedSubscription
      ? [normalizedSubscription]
      : localDB.subscriptions,

    workouts: workoutsLoadedFromBackend ? backendWorkouts : localDB.workouts,

    exercises: workoutsLoadedFromBackend ? backendExercises : localDB.exercises,

    progress: progressLoadedFromBackend
      ? arr(progress).map(normalizeProgress)
      : localDB.progress,

    messages: messagesLoadedFromBackend
      ? mergeMessages(localDB.messages, backendMessages)
      : localDB.messages,

    weeklyGoals: weeklyGoalsLoadedFromBackend
      ? arr(weeklyGoals).map(normalizeWeeklyGoal)
      : localDB.weeklyGoals,

    attendance: attendanceLoadedFromBackend
      ? arr(attendance).map(normalizeAttendance)
      : localDB.attendance,

    places: placesLoadedFromBackend
      ? arr(places).map(normalizePlace)
      : localDB.places,

    streaks: streak ? [normalizeStreak(streak)] : localDB.streaks,

    supplementPlans: supplementPlansLoadedFromBackend
      ? arr(supplementPlans).map(normalizeSupplementPlan)
      : localDB.supplementPlans,

    supplementItems: supplementPlansLoadedFromBackend
      ? arr(supplementPlans).flatMap((plan: any) =>
          arr(plan.items).map(normalizeSupplementItem),
        )
      : localDB.supplementItems,

    supplementLogs: supplementLogsLoadedFromBackend
      ? arr(supplementLogs).map(normalizeSupplementLog)
      : localDB.supplementLogs,

    meta: {
      seeded: true,
      version: 2,
    },
  };
}

export const [DataProvider, useData] = createContextHook(() => {
  const { user } = useAuth();

  const [db, setDB] = useState<DBShape | null>(null);
  const [ready, setReady] = useState(false);
  const lastTokenRef = useRef<string | null>(null);
  const lastReminderSignatureRef = useRef<string>("");

  const persist = useCallback(async (next: DBShape) => {
    setDB(next);

    try {
      await AsyncStorage.setItem(DB_KEY, JSON.stringify(next));
    } catch (e) {
      console.log("[db] persist err", e);
    }
  }, []);

  const refreshFromBackend = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);

      if (!token) return;

      const localDB = db ?? (await loadLocalDB());
      const backendDB = await loadBackendDB(localDB, token);

      lastTokenRef.current = token;

      await persist(backendDB);
    } catch (e) {
      console.log("[db] refresh backend err", e);
    }
  }, [db, persist]);

  useEffect(() => {
    (async () => {
      const localDB = await loadLocalDB();

      setDB(localDB);
      setReady(true);

      const token = await AsyncStorage.getItem(TOKEN_KEY);

      if (token) {
        const backendDB = await loadBackendDB(localDB, token);

        lastTokenRef.current = token;

        await persist(backendDB);
      }
    })();
  }, [persist]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const token = await AsyncStorage.getItem(TOKEN_KEY);

      if (token && token !== lastTokenRef.current) {
        await refreshFromBackend();
      }

      if (!token) {
        lastTokenRef.current = null;
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [refreshFromBackend]);

  useEffect(() => {
    if (!ready || !db) {
      return;
    }

    if (!user) {
      if (lastReminderSignatureRef.current !== "no-user") {
        lastReminderSignatureRef.current = "no-user";

        cancelCoachFlowReminders().catch((error) =>
          console.log("[notifications] cancel for no-user error", error),
        );
      }

      return;
    }

    if (user.role !== "client") {
      if (lastReminderSignatureRef.current !== "not-client") {
        lastReminderSignatureRef.current = "not-client";

        cancelCoachFlowReminders().catch((error) =>
          console.log("[notifications] cancel for non-client error", error),
        );
      }

      return;
    }

    const today = getLocalDateKey();
    const dayKey = getLocalDayKey();

    const settings = db.notifications.find((item) => item.userId === user.id);

    const workoutsToday = db.workouts.filter(
      (workout) =>
        workout.clientId === user.id &&
        workout.date === today &&
        !workout.completed,
    );

    const clientPlanIds = new Set(
      db.supplementPlans
        .filter((plan) => plan.clientId === user.id)
        .map((plan) => plan.id),
    );

    const supplements = db.supplementItems.filter((item) => {
      if (!clientPlanIds.has(item.planId)) {
        return false;
      }

      if (!Array.isArray(item.daysOfWeek) || item.daysOfWeek.length === 0) {
        return true;
      }

      return item.daysOfWeek.includes(dayKey);
    });

    const reminders = buildClientReminders({
      settings,
      workoutsToday,
      supplements,
    });

    const signature = JSON.stringify({
      userId: user.id,
      settings,
      workoutsToday: workoutsToday.map((workout) => ({
        id: workout.id,
        date: workout.date,
        time: workout.time,
        name: workout.name,
        completed: workout.completed,
      })),
      supplements: supplements.map((item) => ({
        id: item.id,
        name: item.name,
        dosage: item.dosage,
        specificTimes: item.specificTimes,
        daysOfWeek: item.daysOfWeek,
      })),
    });

    if (signature === lastReminderSignatureRef.current) {
      return;
    }

    lastReminderSignatureRef.current = signature;

    syncReminders(reminders).catch((error) =>
      console.log("[notifications] sync reminders error", error),
    );
  }, [db, ready, user]);

  const update = useCallback((mutator: (data: DBShape) => DBShape) => {
    setDB((current) => {
      if (!current) return current;

      const next = mutator(current);

      AsyncStorage.setItem(DB_KEY, JSON.stringify(next)).catch((e) =>
        console.log("[db] persist err", e),
      );

      return next;
    });
  }, []);

  const assignWeeklyPlanToClient = useCallback(
    async (
      options: AssignWeeklyPlanOptions,
    ): Promise<AssignWeeklyPlanResult> => {
      if (!db) {
        throw new Error("Database is not ready yet.");
      }

      const coachId = options.coachId ?? user?.id;

      if (!coachId) {
        throw new Error("Coach id is required to assign a weekly plan.");
      }

      if (!options.clientId) {
        throw new Error("Client id is required to assign a weekly plan.");
      }

      if (!options.plan?.days?.length) {
        throw new Error("Weekly plan must contain at least one workout day.");
      }

      const validDays = options.plan.days.filter(
        (day) => Array.isArray(day.exercises) && day.exercises.length > 0,
      );

      if (!validDays.length) {
        throw new Error("Weekly plan must contain exercises.");
      }

      const startDate = options.startDate ?? getLocalDateKey();
      const now = new Date().toISOString();

      const createdWorkouts: WorkoutAssignment[] = [];
      const createdExercises: Exercise[] = [];

      validDays.forEach((day, index) => {
        const workout = buildWorkoutFromPlanDay({
          coachId,
          clientId: options.clientId,
          plan: options.plan,
          day,
          index,
          startDate,
          now,
        });

        const exercises = buildExercisesFromPlanDay({
          workoutId: workout.id,
          day,
        });

        createdWorkouts.push(workout);
        createdExercises.push(...exercises);
      });

      const targetMinutes = getWeekPlanTargetMinutes(createdWorkouts);
      const existingGoalIndex = db.weeklyGoals.findIndex(
        (goal) =>
          goal.clientId === options.clientId && goal.weekStart === startDate,
      );

      const weeklyGoals = [...db.weeklyGoals];

      if (existingGoalIndex >= 0) {
        const existingGoal = weeklyGoals[existingGoalIndex];

        weeklyGoals[existingGoalIndex] = {
          ...existingGoal,
          targetWorkouts: Math.max(
            existingGoal.targetWorkouts,
            createdWorkouts.length,
          ),
          targetMinutes: Math.max(existingGoal.targetMinutes, targetMinutes),
        };
      } else {
        weeklyGoals.push({
          id: makeLocalId("local_weekly_goal"),
          clientId: options.clientId,
          weekStart: startDate,
          targetMinutes,
          completedMinutes: 0,
          targetWorkouts: createdWorkouts.length,
          completedWorkouts: 0,
        });
      }

      const next: DBShape = {
        ...db,
        workouts: [...db.workouts, ...createdWorkouts],
        exercises: [...db.exercises, ...createdExercises],
        weeklyGoals,
        progressInsights: db.progressInsights ?? [],
        meta: {
          seeded: true,
          version: Math.max(db.meta?.version ?? 1, 3),
        },
      };

      await persist(next);

      return {
        workoutIds: createdWorkouts.map((workout) => workout.id),
        exerciseIds: createdExercises.map((exercise) => exercise.id),
      };
    },
    [db, persist, user?.id],
  );

  const reset = useCallback(async () => {
    await AsyncStorage.removeItem(DB_KEY);

    const seed = buildSeed();

    await persist(seed);
    await refreshFromBackend();
  }, [persist, refreshFromBackend]);

  return useMemo(
    () => ({
      db,
      update,
      reset,
      ready: ready && !!db,
      refreshFromBackend,
      assignWeeklyPlanToClient,
    }),
    [
      db,
      update,
      reset,
      ready,
      refreshFromBackend,
      assignWeeklyPlanToClient,
    ],
  );
});