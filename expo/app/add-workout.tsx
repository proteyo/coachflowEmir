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
  Modal,
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
  "row",
  "machine",
  "cable",
  "press",
  "extension",
  "raise",
  "thrust",
  "shrug",
];

function toLocalYMD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function cleanExerciseName(name: string) {
  return name.trim().toLowerCase();
}

function shouldRequireWeight(name?: string, muscleGroup?: string) {
  const n = cleanExerciseName(name ?? "");
  const group = (muscleGroup ?? "").toLowerCase();

  if (group === "cardio" || group === "stretching") return false;

  if (BODYWEIGHT_KEYWORDS.some((key) => n.includes(key))) return false;

  if (WEIGHTED_KEYWORDS.some((key) => n.includes(key))) return true;

  return !["abs", "core"].includes(group);
}

function parsePositiveInt(value: string, fallback = 0) {
  const n = parseInt(value.replace(/[^0-9]/g, ""), 10);

  if (!Number.isFinite(n)) return fallback;

  return Math.max(0, n);
}

function parsePositiveFloat(value: string, fallback = 0) {
  const clean = value.replace(",", ".").replace(/[^0-9.]/g, "");
  const n = parseFloat(clean);

  if (!Number.isFinite(n)) return fallback;

  return Math.max(0, n);
}

function formatLatestDate(value?: string) {
  if (!value) return "";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatLatestSets(
  result: LatestExerciseResult | null | undefined,
  bodyweightLabel: string,
) {
  if (!result || result.sets.length === 0) return "";

  return result.sets
    .slice()
    .sort((a, b) => a.setNumber - b.setNumber)
    .map((set) => {
      const weight =
        set.weight !== undefined && set.weight !== null && Number(set.weight) > 0
          ? `${set.weight} kg`
          : bodyweightLabel;

      return `${weight} × ${set.actualReps}`;
    })
    .join(" / ");
}

function getLatestWeight(result?: LatestExerciseResult | null) {
  const firstWeight = result?.sets
    ?.slice()
    .sort((a, b) => a.setNumber - b.setNumber)
    .find(
      (set) =>
        set.weight !== undefined &&
        set.weight !== null &&
        Number(set.weight) > 0,
    )?.weight;

  if (firstWeight === undefined || firstWeight === null) return undefined;

  return Number(firstWeight);
}

function getFramesFromImageUrl(imageUrl?: string): string[] {
  if (!imageUrl) return [];

  if (imageUrl.includes("/0.jpg")) {
    return [imageUrl, imageUrl.replace("/0.jpg", "/1.jpg")];
  }

  return [imageUrl];
}

function findLibraryExerciseByDraft(exercise: DraftExercise) {
  if (exercise.libId) {
    const byId = EXERCISE_LIBRARY.find((item) => item.id === exercise.libId);

    if (byId) return byId;
  }

  return EXERCISE_LIBRARY.find(
    (item) => item.name.trim().toLowerCase() === exercise.name.trim().toLowerCase(),
  );
}

function getDraftDisplayName(exercise: DraftExercise, lang: AppLangCode) {
  const libraryExercise = findLibraryExerciseByDraft(exercise);

  if (libraryExercise) {
    return getExerciseName(libraryExercise, lang);
  }

  return exercise.name;
}

function getDraftFrames(exercise: DraftExercise) {
  const libraryExercise = findLibraryExerciseByDraft(exercise);

  if (libraryExercise) {
    return getExerciseAnimationFrames(libraryExercise);
  }

  return getFramesFromImageUrl(exercise.imageUrl);
}

function ExerciseAnimatedImage({
  frames,
  size = 56,
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
    }, 620);

    return () => clearInterval(timer);
  }, [safeFrames.join("|")]);

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
        <AppText variant="caption" color={theme.colors.textMuted}>
          GIF
        </AppText>
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

export default function AddWorkout() {
  const { clientId, workoutId } = useLocalSearchParams<{
    clientId?: string;
    workoutId?: string;
  }>();

  const { theme } = useTheme();
  const { t, lang } = useI18n();
  const { user, token } = useAuth();
  const { db, update, refreshFromBackend } = useData();

  const appLang = lang as AppLangCode;
  const editing = !!workoutId;

  const existing = useMemo(
    () => (workoutId ? db?.workouts.find((workout) => workout.id === workoutId) : null),
    [db, workoutId],
  );

  const existingExercises = useMemo(
    () =>
      workoutId
        ? db?.exercises.filter((exercise) => exercise.workoutId === workoutId) ?? []
        : [],
    [db, workoutId],
  );

  const [name, setName] = useState<string>("");
  const [date, setDate] = useState<string>(toLocalYMD(new Date()));
  const [time, setTime] = useState<string>("08:00");
  const [description, setDescription] = useState<string>("");
  const [duration, setDuration] = useState<string>("45");
  const [draft, setDraft] = useState<DraftExercise[]>([]);
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [latestResults, setLatestResults] = useState<
    Record<string, LatestExerciseResult | null>
  >({});

  const draftNamesKey = useMemo(
    () => draft.map((exercise) => exercise.name).join("|"),
    [draft],
  );

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setDate(existing.date);
      setTime(existing.time ?? "08:00");
      setDescription(existing.description ?? "");
      setDuration(String(existing.durationMinutes ?? 45));

      setDraft(
        existingExercises.map((exercise) => {
          const libraryExercise = EXERCISE_LIBRARY.find(
            (item) =>
              item.name.trim().toLowerCase() ===
              exercise.name.trim().toLowerCase(),
          );

          const inferredRequiresWeight =
            exercise.weight !== undefined &&
            exercise.weight !== null &&
            Number(exercise.weight) > 0
              ? true
              : shouldRequireWeight(exercise.name, exercise.muscleGroup);

          return {
            id: exercise.id,
            libId: libraryExercise?.id,
            name: libraryExercise?.name ?? exercise.name,
            sets: exercise.sets,
            reps: exercise.reps,
            restSeconds: exercise.restSeconds,
            weight:
              exercise.weight !== undefined &&
              exercise.weight !== null &&
              Number(exercise.weight) > 0
                ? Number(exercise.weight)
                : undefined,
            requiresWeight: inferredRequiresWeight,
            notes: exercise.notes,
            imageUrl: libraryExercise?.imageUrl ?? exercise.imageUrl,
            muscleGroup: exercise.muscleGroup,
          };
        }),
      );
    }
  }, [existing, existingExercises]);

  const targetClientId = clientId ?? existing?.clientId;

  useEffect(() => {
    if (
      !targetClientId ||
      !token ||
      user?.role !== "coach" ||
      draft.length === 0
    ) {
      setLatestResults({});
      return;
    }

    let cancelled = false;

    const loadLatestResults = async () => {
      const uniqueExerciseNames = Array.from(
        new Set(
          draft
            .map((exercise) => exercise.name.trim())
            .filter((exerciseName) => exerciseName.length > 0),
        ),
      );

      if (uniqueExerciseNames.length === 0) {
        setLatestResults({});
        return;
      }

      const entries = await Promise.all(
        uniqueExerciseNames.map(async (exerciseName) => {
          try {
            const res = await apiGet(
              `/exercise-results/latest?client_id=${encodeURIComponent(
                targetClientId,
              )}&exercise_name=${encodeURIComponent(exerciseName)}`,
              { token },
            );

            return [exerciseName, res as LatestExerciseResult | null] as const;
          } catch (e) {
            console.log(
              "[add-workout] latest result load skipped",
              exerciseName,
              e,
            );

            return [exerciseName, null] as const;
          }
        }),
      );

      if (!cancelled) {
        setLatestResults(Object.fromEntries(entries));
      }
    };

    loadLatestResults();

    return () => {
      cancelled = true;
    };
  }, [targetClientId, token, user?.role, draftNamesKey]);

  const getMuscleGroupLabel = (group?: string | null) => {
    if (!group) return t("workouts.exercise");

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
  };

  const validateDraft = () => {
    for (const exercise of draft) {
      const displayName = getDraftDisplayName(exercise, appLang);

      if (!exercise.name.trim()) {
        Alert.alert(
          t("workouts.exerciseErrorTitle"),
          t("workouts.exerciseNameRequired"),
        );
        return false;
      }

      if (!exercise.sets || exercise.sets <= 0) {
        Alert.alert(
          t("workouts.exerciseErrorTitle"),
          t("workouts.setsRequired").replace("{name}", displayName),
        );
        return false;
      }

      if (!exercise.reps || exercise.reps <= 0) {
        Alert.alert(
          t("workouts.exerciseErrorTitle"),
          t("workouts.repsRequired").replace("{name}", displayName),
        );
        return false;
      }

      if (exercise.restSeconds < 0) {
        Alert.alert(
          t("workouts.exerciseErrorTitle"),
          t("workouts.restInvalid").replace("{name}", displayName),
        );
        return false;
      }

      if (exercise.requiresWeight && (!exercise.weight || exercise.weight <= 0)) {
        Alert.alert(
          t("workouts.weightRequiredTitle"),
          t("workouts.weightRequiredMessage").replace("{name}", displayName),
        );
        return false;
      }
    }

    return true;
  };

  const save = async () => {
    if (saving) return;

    if (!user || !token) {
      Alert.alert(t("profile.authErrorTitle"), t("profile.loginAgainText"));
      return;
    }

    if (user.role !== "coach") {
      Alert.alert(
        t("workouts.permissionDeniedTitle"),
        t("workouts.onlyCoachesCanEdit"),
      );
      return;
    }

    if (!targetClientId) {
      Alert.alert(t("workouts.clientErrorTitle"), t("workouts.clientNotSelected"));
      return;
    }

    if (!name.trim()) {
      Alert.alert(t("workouts.workoutNameRequired"));
      return;
    }

    if (draft.length === 0) {
      Alert.alert(
        t("workouts.exercisesRequiredTitle"),
        t("workouts.exercisesRequiredMessage"),
      );
      return;
    }

    if (!validateDraft()) return;

    const dur = parseInt(duration, 10) || 45;

    const payload = {
      client_id: targetClientId,
      date,
      time: time.trim() || undefined,
      name: name.trim(),
      description: description.trim() || undefined,
      category: "Strength",
      duration_minutes: dur,
      exercises: draft.map((exercise) => ({
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        rest_seconds: exercise.restSeconds,
        weight: exercise.requiresWeight ? exercise.weight : undefined,
        notes: exercise.notes,
        image_url: exercise.imageUrl,
        muscle_group: exercise.muscleGroup,
      })),
    };

    try {
      setSaving(true);

      if (editing && existing) {
        await apiPatch(`/workouts/${existing.id}`, payload, { token });
      } else {
        await apiPost("/workouts", payload, { token });
      }

      await refreshFromBackend();

      router.back();
    } catch (e) {
      console.log("[add-workout] backend save error", e);

      update((data) => {
        if (editing && existing) {
          const updatedWorkouts = data.workouts.map((workout) =>
            workout.id === existing.id
              ? {
                  ...workout,
                  name: name.trim(),
                  date,
                  time: time.trim() || undefined,
                  description: description.trim() || undefined,
                  durationMinutes: dur,
                }
              : workout,
          );

          const otherExercises = data.exercises.filter(
            (exercise) => exercise.workoutId !== existing.id,
          );

          const newExercises: Exercise[] = draft.map((exercise, index) => ({
            id: exercise.id.startsWith("new_")
              ? `ex_${existing.id}_${Date.now()}_${index}`
              : exercise.id,
            workoutId: existing.id,
            name: exercise.name,
            sets: exercise.sets,
            reps: exercise.reps,
            restSeconds: exercise.restSeconds,
            weight: exercise.requiresWeight ? exercise.weight : undefined,
            notes: exercise.notes,
            imageUrl: exercise.imageUrl,
            muscleGroup: exercise.muscleGroup,
          }));

          return {
            ...data,
            workouts: updatedWorkouts,
            exercises: [...otherExercises, ...newExercises],
          };
        }

        const newId = `w_${Date.now()}`;

        const newExercises: Exercise[] = draft.map((exercise, index) => ({
          id: `ex_${newId}_${index}`,
          workoutId: newId,
          name: exercise.name,
          sets: exercise.sets,
          reps: exercise.reps,
          restSeconds: exercise.restSeconds,
          weight: exercise.requiresWeight ? exercise.weight : undefined,
          notes: exercise.notes,
          imageUrl: exercise.imageUrl,
          muscleGroup: exercise.muscleGroup,
        }));

        return {
          ...data,
          workouts: [
            ...data.workouts,
            {
              id: newId,
              coachId: user.id,
              clientId: targetClientId,
              date,
              time: time.trim() || undefined,
              name: name.trim(),
              description: description.trim() || undefined,
              category: "Strength",
              completed: false,
              durationMinutes: dur,
            },
          ],
          exercises: [...data.exercises, ...newExercises],
        };
      });

      Alert.alert(
        t("workouts.savedLocallyTitle"),
        t("workouts.savedLocallyMessage"),
      );

      router.back();
    } finally {
      setSaving(false);
    }
  };

  const addFromLibrary = (libIds: string[]) => {
    const items: DraftExercise[] = libIds
      .map((id) => EXERCISE_LIBRARY.find((item) => item.id === id))
      .filter((item): item is LibraryExercise => !!item)
      .map((item, index) => ({
        id: `new_${Date.now()}_${index}`,
        libId: item.id,
        name: item.name,
        sets: item.defaultSets,
        reps: item.defaultReps,
        restSeconds: item.defaultRestSeconds,
        muscleGroup: item.muscleGroup,
        imageUrl: item.imageUrl,
        requiresWeight: shouldRequireWeight(item.name, item.muscleGroup),
      }));

    setDraft((currentDraft) => [...currentDraft, ...items]);
  };

  const updateExercise = (id: string, patch: Partial<DraftExercise>) => {
    setDraft((currentDraft) =>
      currentDraft.map((exercise) =>
        exercise.id === id ? { ...exercise, ...patch } : exercise,
      ),
    );
  };

  const removeExercise = (id: string) => {
    setDraft((currentDraft) =>
      currentDraft.filter((exercise) => exercise.id !== id),
    );
  };

  const applyLatestWeight = (
    exerciseId: string,
    latest?: LatestExerciseResult | null,
  ) => {
    const latestWeight = getLatestWeight(latest);

    if (!latestWeight || latestWeight <= 0) return;

    updateExercise(exerciseId, {
      weight: latestWeight,
      requiresWeight: true,
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: editing ? t("clients.editWorkout") : t("clients.addWorkout"),
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              style={{ paddingHorizontal: 4 }}
            >
              <ChevronLeft color={theme.colors.text} size={22} />
            </Pressable>
          ),
        }}
      />

      <SubscriptionGate>
        <ScreenContainer scroll padded={false}>
          <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 12 }}>
            <AppInput
              label={t("workouts.name")}
              value={name}
              onChangeText={setName}
              placeholder={t("workouts.namePlaceholder")}
            />

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <AppInput
                  label={t("workouts.date")}
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                  autoCapitalize="none"
                />
              </View>

              <View style={{ width: 100 }}>
                <AppInput
                  label={t("workouts.time")}
                  value={time}
                  onChangeText={setTime}
                  placeholder={t("workouts.timePlaceholder")}
                  autoCapitalize="none"
                />
              </View>

              <View style={{ width: 90 }}>
                <AppInput
                  label={t("workouts.duration")}
                  value={duration}
                  onChangeText={setDuration}
                  keyboardType="numeric"
                  placeholder="45"
                />
              </View>
            </View>

            <AppInput
              label={t("workouts.description")}
              value={description}
              onChangeText={setDescription}
              placeholder={t("workouts.descriptionPlaceholder")}
              multiline
            />

            <View
              style={{
                padding: 12,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.surfaceAlt,
                borderWidth: 1,
                borderColor: theme.colors.borderSoft,
              }}
            >
              <AppText variant="bodyStrong">{t("workouts.weightRuleTitle")}</AppText>

              <AppText
                variant="small"
                color={theme.colors.textMuted}
                style={{ marginTop: 4 }}
              >
                {t("workouts.weightRuleText")}
              </AppText>
            </View>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 8,
              }}
            >
              <AppText variant="h3">
                {t("workouts.exercises")} · {draft.length}
              </AppText>

              <AppButton
                title={t("workouts.addExercises")}
                size="sm"
                icon={<Plus size={16} color={theme.colors.primaryContrast} />}
                onPress={() => setPickerOpen(true)}
              />
            </View>

            {draft.length === 0 ? (
              <AppCard variant="outline">
                <AppText variant="small" color={theme.colors.textMuted}>
                  {t("workouts.openLibraryHint")}
                </AppText>
              </AppCard>
            ) : null}

            <View style={{ gap: 10 }}>
              {draft.map((exercise) => {
                const latest = latestResults[exercise.name.trim()];
                const latestText = formatLatestSets(
                  latest,
                  t("workouts.bodyweight"),
                );
                const latestDate = formatLatestDate(latest?.createdAt);
                const latestWeight = getLatestWeight(latest);
                const frames = getDraftFrames(exercise);

                return (
                  <AppCard key={exercise.id} variant="outline">
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <ExerciseAnimatedImage frames={frames} size={58} radius={14} />

                      <View style={{ flex: 1 }}>
                        <AppText variant="bodyStrong">
                          {getDraftDisplayName(exercise, appLang)}
                        </AppText>

                        <AppText variant="caption" color={theme.colors.textMuted}>
                          {getMuscleGroupLabel(exercise.muscleGroup)}
                        </AppText>
                      </View>

                      <Pressable
                        onPress={() => removeExercise(exercise.id)}
                        hitSlop={8}
                      >
                        <Trash2 color={theme.colors.danger} size={18} />
                      </Pressable>
                    </View>

                    {latest ? (
                      <View
                        style={{
                          marginTop: 10,
                          padding: 10,
                          borderRadius: theme.radius.md,
                          backgroundColor: "rgba(22,199,132,0.12)",
                          borderWidth: 1,
                          borderColor: "rgba(22,199,132,0.35)",
                          gap: 6,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            gap: 8,
                          }}
                        >
                          <AppText variant="caption" color={theme.colors.primary}>
                            {t("workouts.lastResult")}
                            {latestDate ? ` · ${latestDate}` : ""}
                          </AppText>

                          {latestWeight ? (
                            <Pressable
                              onPress={() =>
                                applyLatestWeight(exercise.id, latest)
                              }
                            >
                              <AppText
                                variant="caption"
                                color={theme.colors.primary}
                                style={{ fontWeight: "800" }}
                              >
                                {t("workouts.useWeight")}
                              </AppText>
                            </Pressable>
                          ) : null}
                        </View>

                        <AppText variant="small" style={{ fontWeight: "700" }}>
                          {latestText || t("workouts.noSetDetails")}
                        </AppText>
                      </View>
                    ) : null}

                    <View
                      style={{
                        marginTop: 10,
                        padding: 10,
                        borderRadius: theme.radius.md,
                        backgroundColor: theme.colors.surfaceAlt,
                        gap: 8,
                      }}
                    >
                      <AppText variant="caption" color={theme.colors.textMuted}>
                        {t("workouts.exerciseType")}
                      </AppText>

                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <Pressable
                          onPress={() =>
                            updateExercise(exercise.id, {
                              requiresWeight: true,
                              weight:
                                exercise.weight && exercise.weight > 0
                                  ? exercise.weight
                                  : undefined,
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
                            {t("workouts.weighted")}
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
                            {t("workouts.bodyweight")}
                          </AppText>
                        </Pressable>
                      </View>

                      <AppText variant="caption" color={theme.colors.textMuted}>
                        {exercise.requiresWeight
                          ? t("workouts.weightRequiredHint")
                          : t("workouts.noWeightSavedHint")}
                      </AppText>
                    </View>

                    <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                      <NumField
                        label={t("workouts.sets")}
                        value={exercise.sets}
                        onChange={(value) =>
                          updateExercise(exercise.id, { sets: value })
                        }
                      />

                      <NumField
                        label={t("workouts.reps")}
                        value={exercise.reps}
                        onChange={(value) =>
                          updateExercise(exercise.id, { reps: value })
                        }
                      />

                      <NumField
                        label={t("workouts.rest")}
                        value={exercise.restSeconds}
                        onChange={(value) =>
                          updateExercise(exercise.id, { restSeconds: value })
                        }
                      />
                    </View>

                    {exercise.requiresWeight ? (
                      <View style={{ marginTop: 10 }}>
                        <DecimalField
                          label={t("workouts.weight")}
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
                            {t("workouts.requiredWeightError")}
                          </AppText>
                        ) : null}
                      </View>
                    ) : null}

                    <TextInput
                      placeholder={t("workouts.notes")}
                      placeholderTextColor={theme.colors.textFaint}
                      value={exercise.notes ?? ""}
                      onChangeText={(value) =>
                        updateExercise(exercise.id, { notes: value })
                      }
                      style={{
                        marginTop: 8,
                        backgroundColor: theme.colors.inputBg,
                        borderRadius: theme.radius.md,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        color: theme.colors.text,
                        fontSize: 13,
                      }}
                    />
                  </AppCard>
                );
              })}
            </View>

            <View style={{ marginTop: 16, marginBottom: 32 }}>
              <AppButton
                title={saving ? t("common.loading") : t("workouts.save")}
                size="lg"
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
        onChangeText={(value) => onChange(parsePositiveInt(value, 0))}
        keyboardType="numeric"
        style={{
          backgroundColor: theme.colors.inputBg,
          borderRadius: theme.radius.md,
          paddingHorizontal: 10,
          paddingVertical: 8,
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

  return (
    <View>
      <AppText variant="caption" color={theme.colors.textMuted}>
        {label}
      </AppText>

      <TextInput
        value={value !== undefined && value !== null ? String(value) : ""}
        onChangeText={(newValue) => onChange(parsePositiveFloat(newValue, 0))}
        keyboardType="decimal-pad"
        placeholder={t("workouts.weightExample")}
        placeholderTextColor={theme.colors.textFaint}
        style={{
          backgroundColor: theme.colors.inputBg,
          borderRadius: theme.radius.md,
          paddingHorizontal: 10,
          paddingVertical: 10,
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

  const appLang = lang as AppLangCode;

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
    if (group === "All") return t("exerciseLib.all");
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
          }}
        >
          <Pressable onPress={onClose} hitSlop={8}>
            <X color={theme.colors.text} size={22} />
          </Pressable>

          <AppText variant="h3">{t("workouts.library")}</AppText>

          <Pressable
            onPress={() => onAdd(selected)}
            disabled={selected.length === 0}
            hitSlop={8}
            style={{ opacity: selected.length === 0 ? 0.4 : 1 }}
          >
            <AppText variant="bodyStrong" color={theme.colors.primary}>
              {t("common.add")}
              {selected.length > 0 ? ` (${selected.length})` : ""}
            </AppText>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <AppInput
            placeholder={t("common.search")}
            value={q}
            onChangeText={setQ}
            leftIcon={<Search color={theme.colors.textMuted} size={18} />}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 12 }}
          >
            {MUSCLE_FILTERS.map((muscle) => (
              <AppChip
                key={muscle}
                label={getMuscleGroupLabel(muscle)}
                active={filter === muscle}
                onPress={() => setFilter(muscle)}
              />
            ))}
          </ScrollView>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          renderItem={({ item }) => {
            const selectedExercise = selected.includes(item.id);
            const autoWeighted = shouldRequireWeight(item.name, item.muscleGroup);
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
                    <ExerciseAnimatedImage frames={frames} size={60} radius={14} />

                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyStrong">
                        {getExerciseName(item, appLang)}
                      </AppText>

                      <AppText variant="caption" color={theme.colors.textMuted}>
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
                      >
                        {autoWeighted
                          ? t("workouts.weightedByDefault")
                          : t("workouts.bodyweightByDefault")}
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
                        <Check color={theme.colors.primaryContrast} size={16} />
                      ) : null}
                    </View>
                  </View>
                </AppCard>
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}