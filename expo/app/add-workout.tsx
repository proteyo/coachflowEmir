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
import { EXERCISE_LIBRARY, MuscleGroup } from "@/src/data/exerciseLibrary";
import { useI18n } from "@/src/i18n/I18nContext";
import { Exercise } from "@/src/types/models";

interface DraftExercise {
  id: string;
  libId?: string;
  name: string;
  sets: number;
  reps: number;
  restSeconds: number;
  weight?: number;
  notes?: string;
  imageUrl?: string;
  muscleGroup?: string;
}

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

export default function AddWorkout() {
  const { clientId, workoutId } = useLocalSearchParams<{
    clientId?: string;
    workoutId?: string;
  }>();
  const { theme } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const { db, update } = useData();

  const editing = !!workoutId;
  const existing = useMemo(
    () => (workoutId ? db?.workouts.find((w) => w.id === workoutId) : null),
    [db, workoutId],
  );
  const existingExercises = useMemo(
    () => (workoutId ? db?.exercises.filter((e) => e.workoutId === workoutId) ?? [] : []),
    [db, workoutId],
  );

  const [name, setName] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState<string>("08:00");
  const [description, setDescription] = useState<string>("");
  const [duration, setDuration] = useState<string>("45");
  const [draft, setDraft] = useState<DraftExercise[]>([]);
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setDate(existing.date);
      setTime(existing.time ?? "08:00");
      setDescription(existing.description ?? "");
      setDuration(String(existing.durationMinutes ?? 45));
      setDraft(
        existingExercises.map((e) => ({
          id: e.id,
          name: e.name,
          sets: e.sets,
          reps: e.reps,
          restSeconds: e.restSeconds,
          weight: e.weight,
          notes: e.notes,
          imageUrl: e.imageUrl,
          muscleGroup: e.muscleGroup,
        })),
      );
    }
  }, [existing, existingExercises]);

  const targetClientId = clientId ?? existing?.clientId;

  const save = () => {
    if (!user || !targetClientId) return;
    if (!name.trim()) {
      Alert.alert("Workout name is required");
      return;
    }
    const dur = parseInt(duration, 10) || 45;
    update((d) => {
      if (editing && existing) {
        const updatedWorkouts = d.workouts.map((w) =>
          w.id === existing.id
            ? {
                ...w,
                name: name.trim(),
                date,
                time: time.trim() || undefined,
                description: description.trim() || undefined,
                durationMinutes: dur,
              }
            : w,
        );
        const otherEx = d.exercises.filter((e) => e.workoutId !== existing.id);
        const newEx: Exercise[] = draft.map((e, i) => ({
          id: e.id.startsWith("new_") ? `ex_${existing.id}_${Date.now()}_${i}` : e.id,
          workoutId: existing.id,
          name: e.name,
          sets: e.sets,
          reps: e.reps,
          restSeconds: e.restSeconds,
          weight: e.weight,
          notes: e.notes,
          imageUrl: e.imageUrl,
          muscleGroup: e.muscleGroup,
        }));
        return { ...d, workouts: updatedWorkouts, exercises: [...otherEx, ...newEx] };
      }
      const newId = `w_${Date.now()}`;
      const newEx: Exercise[] = draft.map((e, i) => ({
        id: `ex_${newId}_${i}`,
        workoutId: newId,
        name: e.name,
        sets: e.sets,
        reps: e.reps,
        restSeconds: e.restSeconds,
        weight: e.weight,
        notes: e.notes,
        imageUrl: e.imageUrl,
        muscleGroup: e.muscleGroup,
      }));
      return {
        ...d,
        workouts: [
          ...d.workouts,
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
        exercises: [...d.exercises, ...newEx],
      };
    });
    router.back();
  };

  const addFromLibrary = (libIds: string[]) => {
    const items: DraftExercise[] = libIds
      .map((id) => EXERCISE_LIBRARY.find((x) => x.id === id))
      .filter((x): x is NonNullable<typeof x> => !!x)
      .map((x, i) => ({
        id: `new_${Date.now()}_${i}`,
        libId: x.id,
        name: x.name,
        sets: x.defaultSets,
        reps: x.defaultReps,
        restSeconds: x.defaultRestSeconds,
        muscleGroup: x.muscleGroup,
        imageUrl: x.imageUrl,
      }));
    setDraft((d) => [...d, ...items]);
  };

  const updateExercise = (id: string, patch: Partial<DraftExercise>) => {
    setDraft((d) => d.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const removeExercise = (id: string) => {
    setDraft((d) => d.filter((e) => e.id !== id));
  };

  return (
    <ScreenContainer scroll padded={false}>
      <Stack.Screen
        options={{
          title: editing ? t("clients.editWorkout") : t("clients.addWorkout"),
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={{ paddingHorizontal: 4 }}>
              <ChevronLeft color={theme.colors.text} size={22} />
            </Pressable>
          ),
        }}
      />
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
              {t("workouts.library")} →
            </AppText>
          </AppCard>
        ) : null}

        <View style={{ gap: 10 }}>
          {draft.map((e) => (
            <AppCard key={e.id} variant="outline">
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">{e.name}</AppText>
                  <AppText variant="caption" color={theme.colors.textMuted}>
                    {e.muscleGroup ?? ""}
                  </AppText>
                </View>
                <Pressable onPress={() => removeExercise(e.id)} hitSlop={8}>
                  <Trash2 color={theme.colors.danger} size={18} />
                </Pressable>
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <NumField
                  label={t("workouts.sets")}
                  value={e.sets}
                  onChange={(v) => updateExercise(e.id, { sets: v })}
                />
                <NumField
                  label={t("workouts.reps")}
                  value={e.reps}
                  onChange={(v) => updateExercise(e.id, { reps: v })}
                />
                <NumField
                  label={t("workouts.rest")}
                  value={e.restSeconds}
                  onChange={(v) => updateExercise(e.id, { restSeconds: v })}
                />
                <NumField
                  label={t("workouts.weight")}
                  value={e.weight ?? 0}
                  onChange={(v) => updateExercise(e.id, { weight: v || undefined })}
                />
              </View>
              <TextInput
                placeholder={t("workouts.notes")}
                placeholderTextColor={theme.colors.textFaint}
                value={e.notes ?? ""}
                onChangeText={(v) => updateExercise(e.id, { notes: v })}
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
          ))}
        </View>

        <View style={{ marginTop: 16, marginBottom: 32 }}>
          <AppButton title={t("workouts.save")} size="lg" onPress={save} fullWidth />
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
  );
}

function NumField({
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
    <View style={{ flex: 1 }}>
      <AppText variant="caption" color={theme.colors.textMuted}>
        {label}
      </AppText>
      <TextInput
        value={String(value)}
        onChangeText={(v) => onChange(parseInt(v.replace(/[^0-9]/g, ""), 10) || 0)}
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
  const { t } = useI18n();
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

  const filtered = useMemo(() => {
    return EXERCISE_LIBRARY.filter((e) => {
      if (filter !== "All" && e.muscleGroup !== filter) return false;
      if (q && !e.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [q, filter]);

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
            {MUSCLE_FILTERS.map((m) => (
              <AppChip
                key={m}
                label={m}
                active={filter === m}
                onPress={() => setFilter(m)}
              />
            ))}
          </ScrollView>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          renderItem={({ item }) => {
            const sel = selected.includes(item.id);
            return (
              <Pressable
                onPress={() =>
                  setSelected((s) =>
                    sel ? s.filter((x) => x !== item.id) : [...s, item.id],
                  )
                }
              >
                <AppCard
                  variant="outline"
                  style={{
                    borderColor: sel ? theme.colors.primary : theme.colors.border,
                    borderWidth: sel ? 2 : 1,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 12,
                        backgroundColor: theme.colors.surfaceAlt,
                      }}
                      contentFit="cover"
                    />
                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyStrong">{item.name}</AppText>
                      <AppText variant="caption" color={theme.colors.textMuted}>
                        {item.muscleGroup} · {item.defaultSets}×{item.defaultReps}
                      </AppText>
                      <AppText variant="caption" color={theme.colors.textFaint} numberOfLines={1}>
                        {item.description}
                      </AppText>
                    </View>
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: sel ? theme.colors.primary : theme.colors.surfaceAlt,
                      }}
                    >
                      {sel ? <Check color={theme.colors.primaryContrast} size={16} /> : null}
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
