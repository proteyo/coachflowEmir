import { router, Stack, useLocalSearchParams } from "expo-router";
import { ChevronLeft, Pill, Plus, Trash2, X } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";

import SubscriptionGate from "@/src/components/SubscriptionGate";
import {
  AppButton,
  AppCard,
  AppChip,
  AppEmptyState,
  AppInput,
  AppText,
  ScreenContainer,
} from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { useTheme } from "@/src/context/ThemeContext";
import {
  SUPPLEMENT_SUGGESTIONS,
  getSupplementName,
  translateSupplementName,
} from "@/src/data/exerciseLibrary";
import { useI18n } from "@/src/i18n/I18nContext";
import { apiPatch, apiPost } from "@/src/services/api";
import { SupplementItem } from "@/src/types/models";

type DayKey = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

type SupplementItemWithDays = SupplementItem & {
  daysOfWeek?: DayKey[];
};

type BackendSupplementPlan = {
  id: string;
  coachId?: string;
  coach_id?: string;
  clientId?: string;
  client_id?: string;
  startDate?: string;
  start_date?: string;
  items?: any[];
};

const DAYS: { key: DayKey; labelKey: string }[] = [
  { key: "Mon", labelKey: "supps.dayMon" },
  { key: "Tue", labelKey: "supps.dayTue" },
  { key: "Wed", labelKey: "supps.dayWed" },
  { key: "Thu", labelKey: "supps.dayThu" },
  { key: "Fri", labelKey: "supps.dayFri" },
  { key: "Sat", labelKey: "supps.daySat" },
  { key: "Sun", labelKey: "supps.daySun" },
];

const ALL_DAYS: DayKey[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS: DayKey[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const WEEKENDS: DayKey[] = ["Sat", "Sun"];

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDays(value: any): DayKey[] {
  if (!value) return ALL_DAYS;

  if (Array.isArray(value)) {
    const valid = value.filter((d) => ALL_DAYS.includes(d));
    return valid.length > 0 ? valid : ALL_DAYS;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        const valid = parsed.filter((d) => ALL_DAYS.includes(d));
        return valid.length > 0 ? valid : ALL_DAYS;
      }
    } catch {
      return ALL_DAYS;
    }
  }

  return ALL_DAYS;
}

function areSameDays(a: DayKey[], b: DayKey[]) {
  return a.length === b.length && b.every((day) => a.includes(day));
}

function getDayShortLabel(day: DayKey, t: (key: any, params?: any) => string) {
  if (day === "Mon") return t("supps.dayMon");
  if (day === "Tue") return t("supps.dayTue");
  if (day === "Wed") return t("supps.dayWed");
  if (day === "Thu") return t("supps.dayThu");
  if (day === "Fri") return t("supps.dayFri");
  if (day === "Sat") return t("supps.daySat");

  return t("supps.daySun");
}

function formatDays(
  days: DayKey[] | undefined,
  t: (key: any, params?: any) => string,
) {
  const normalized = normalizeDays(days);

  if (normalized.length === 7) return t("supps.everyDay");

  if (areSameDays(normalized, WEEKDAYS)) {
    return t("supps.weekdays");
  }

  if (areSameDays(normalized, WEEKENDS)) {
    return t("supps.weekends");
  }

  return normalized.map((day) => getDayShortLabel(day, t)).join(", ");
}

function normalizeBackendPlan(plan: BackendSupplementPlan) {
  return {
    id: String(plan.id),
    coachId: String(plan.coachId ?? plan.coach_id ?? ""),
    clientId: String(plan.clientId ?? plan.client_id ?? ""),
    startDate: String(plan.startDate ?? plan.start_date ?? todayYmd()),
  };
}

function normalizeBackendItems(
  plan: BackendSupplementPlan,
): SupplementItemWithDays[] {
  return (plan.items ?? []).map((item: any) => ({
    id: String(item.id),
    planId: String(item.planId ?? item.plan_id ?? plan.id),
    name: item.name,
    dosage: item.dosage,
    timesPerDay: Number(item.timesPerDay ?? item.times_per_day ?? 1),
    specificTimes: item.specificTimes ?? item.specific_times ?? [],
    daysOfWeek: normalizeDays(item.daysOfWeek ?? item.days_of_week),
    notes: item.notes ?? undefined,
  }));
}

function sanitizeTimesPerDay(value: string) {
  return value.replace(/[^\d]/g, "");
}

function sanitizeTimes(value: string) {
  return value.replace(/[^0-9:,\s]/g, "");
}

function normalizeSpecificTimes(value: string) {
  const times = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return times.length ? times : ["09:00"];
}

export default function ManageSupplements() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { theme } = useTheme();
  const { t, lang } = useI18n();
  const { user, token } = useAuth();
  const { db, update, refreshFromBackend } = useData();

  const [editing, setEditing] = useState<SupplementItemWithDays | null>(null);
  const [adding, setAdding] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const planAndItems = useMemo(() => {
    if (!db || !clientId) {
      return {
        plan: null,
        items: [] as SupplementItemWithDays[],
      };
    }

    const plan = db.supplementPlans.find((p) => p.clientId === clientId);

    const items = plan
      ? db.supplementItems
          .filter((s) => s.planId === plan.id)
          .map((item) => ({
            ...item,
            daysOfWeek: normalizeDays((item as any).daysOfWeek),
          }))
      : [];

    return { plan, items };
  }, [db, clientId]);

  const syncPlanLocally = (backendPlan: BackendSupplementPlan) => {
    const normalizedPlan = normalizeBackendPlan(backendPlan);
    const normalizedItems = normalizeBackendItems(backendPlan);

    update((d) => {
      const otherPlans = d.supplementPlans.filter(
        (p) =>
          p.id !== normalizedPlan.id &&
          p.clientId !== normalizedPlan.clientId,
      );

      const otherItems = d.supplementItems.filter(
        (item) => item.planId !== normalizedPlan.id,
      );

      return {
        ...d,
        supplementPlans: [...otherPlans, normalizedPlan],
        supplementItems: [...otherItems, ...normalizedItems],
      };
    });
  };

  const savePlanToBackend = async (nextItems: SupplementItemWithDays[]) => {
    if (!user || !token || !clientId) {
      Alert.alert(t("profile.authErrorTitle"), t("profile.loginAgainText"));
      return false;
    }

    if (user.role !== "coach") {
      Alert.alert(
        t("workouts.permissionDeniedTitle"),
        t("supps.onlyCoachesCanManage"),
      );
      return false;
    }

    const startDate = planAndItems.plan?.startDate ?? todayYmd();

    const payload = {
      client_id: clientId,
      start_date: startDate,
      items: nextItems.map((item) => ({
        id: item.id.startsWith("local_") ? undefined : item.id,
        name: item.name,
        dosage: item.dosage,
        times_per_day: item.timesPerDay,
        specific_times: item.specificTimes,
        days_of_week: normalizeDays(item.daysOfWeek),
        notes: item.notes,
      })),
    };

    try {
      setSaving(true);

      const saved = planAndItems.plan
        ? await apiPatch(`/supplements/plans/${planAndItems.plan.id}`, payload, {
            token,
          })
        : await apiPost("/supplements/plans", payload, { token });

      syncPlanLocally(saved);

      await refreshFromBackend();

      return true;
    } catch (e: any) {
      console.log("[manage-supplements] save plan error", e);

      Alert.alert(t("supps.errorTitle"), e?.message || t("supps.saveError"));

      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveItem = async (item: SupplementItemWithDays) => {
    const preparedItem: SupplementItemWithDays = {
      ...item,
      daysOfWeek: normalizeDays(item.daysOfWeek),
    };

    const existing = planAndItems.items.some((i) => i.id === preparedItem.id);

    const nextItems = existing
      ? planAndItems.items.map((i) =>
          i.id === preparedItem.id ? preparedItem : i,
        )
      : [...planAndItems.items, preparedItem];

    const ok = await savePlanToBackend(nextItems);

    if (ok) {
      setAdding(false);
      setEditing(null);
    }
  };

  const removeItem = (id: string) => {
    Alert.alert(t("supps.confirmDelete"), undefined, [
      {
        text: t("common.cancel"),
        style: "cancel",
      },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          const nextItems = planAndItems.items.filter((i) => i.id !== id);
          await savePlanToBackend(nextItems);
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: t("supps.title"),
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              style={{ paddingHorizontal: 4 }}
              hitSlop={10}
            >
              <ChevronLeft color={theme.colors.text} size={22} />
            </Pressable>
          ),
        }}
      />

      <SubscriptionGate>
        <ScreenContainer scroll padded={false}>
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 8,
              paddingBottom: 40,
              gap: 12,
            }}
          >
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
                  {t("supps.title")}
                </AppText>

                <AppText
                  variant="small"
                  color={theme.colors.textMuted}
                  numberOfLines={2}
                >
                  {t("supps.manageSubtitle")}
                </AppText>
              </View>

              <AppButton
                title={saving ? t("common.loading") : t("common.add")}
                size="sm"
                disabled={saving}
                icon={<Plus size={16} color={theme.colors.primaryContrast} />}
                onPress={() => setAdding(true)}
              />
            </View>

            {planAndItems.items.length === 0 ? (
              <AppEmptyState
                title={t("clients.noSupps")}
                message={t("supps.noItemsMessage")}
                icon={<Pill color={theme.colors.accent} size={32} />}
              />
            ) : (
              planAndItems.items.map((s) => (
                <AppCard key={s.id} variant="outline">
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <AppText variant="bodyStrong" numberOfLines={1}>
                        {translateSupplementName(s.name, lang)}
                      </AppText>

                      <AppText
                        variant="small"
                        color={theme.colors.textMuted}
                        numberOfLines={1}
                      >
                        {s.dosage} · {s.specificTimes.join(", ")}
                      </AppText>

                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: 6,
                          marginTop: 8,
                        }}
                      >
                        {normalizeDays(s.daysOfWeek).map((day) => (
                          <View
                            key={day}
                            style={{
                              paddingVertical: 4,
                              paddingHorizontal: 8,
                              borderRadius: 999,
                              backgroundColor: theme.colors.surfaceAlt,
                            }}
                          >
                            <AppText variant="caption">
                              {getDayShortLabel(day, t)}
                            </AppText>
                          </View>
                        ))}
                      </View>

                      <AppText
                        variant="caption"
                        color={theme.colors.primary}
                        style={{ marginTop: 6, fontWeight: "700" }}
                        numberOfLines={2}
                      >
                        {formatDays(s.daysOfWeek, t)}
                      </AppText>

                      {s.notes ? (
                        <AppText
                          variant="caption"
                          color={theme.colors.textFaint}
                          style={{ marginTop: 4 }}
                          numberOfLines={2}
                        >
                          {s.notes}
                        </AppText>
                      ) : null}
                    </View>

                    <View
                      style={{
                        flexDirection: "row",
                        gap: 12,
                        flexShrink: 0,
                      }}
                    >
                      <Pressable onPress={() => setEditing(s)} hitSlop={8}>
                        <AppText variant="small" color={theme.colors.primary}>
                          {t("common.edit")}
                        </AppText>
                      </Pressable>

                      <Pressable onPress={() => removeItem(s.id)} hitSlop={8}>
                        <Trash2 color={theme.colors.danger} size={18} />
                      </Pressable>
                    </View>
                  </View>
                </AppCard>
              ))
            )}

            <View style={{ height: 24 }} />
          </View>

          <SupplementEditor
            visible={adding || !!editing}
            initial={editing}
            saving={saving}
            onClose={() => {
              if (saving) return;
              setAdding(false);
              setEditing(null);
            }}
            onSave={saveItem}
          />
        </ScreenContainer>
      </SubscriptionGate>
    </>
  );
}

function SupplementEditor({
  visible,
  initial,
  saving,
  onClose,
  onSave,
}: {
  visible: boolean;
  initial: SupplementItemWithDays | null;
  saving: boolean;
  onClose: () => void;
  onSave: (s: SupplementItemWithDays) => void;
}) {
  const { theme } = useTheme();
  const { t, lang } = useI18n();

  const [name, setName] = useState<string>("");
  const [dosage, setDosage] = useState<string>("");
  const [timesPerDay, setTimesPerDay] = useState<string>("1");
  const [times, setTimes] = useState<string>("09:00");
  const [daysOfWeek, setDaysOfWeek] = useState<DayKey[]>(ALL_DAYS);
  const [notes, setNotes] = useState<string>("");

  React.useEffect(() => {
    if (visible) {
      setName(initial?.name ?? "");
      setDosage(initial?.dosage ?? "");
      setTimesPerDay(String(initial?.timesPerDay ?? 1));
      setTimes((initial?.specificTimes ?? ["09:00"]).join(", "));
      setDaysOfWeek(normalizeDays(initial?.daysOfWeek));
      setNotes(initial?.notes ?? "");
    }
  }, [visible, initial]);

  const toggleDay = (day: DayKey) => {
    setDaysOfWeek((current) => {
      if (current.includes(day)) {
        const next = current.filter((d) => d !== day);
        return next.length > 0 ? next : current;
      }

      return [...current, day];
    });
  };

  const selectEveryDay = () => {
    setDaysOfWeek(ALL_DAYS);
  };

  const selectWeekdays = () => {
    setDaysOfWeek(WEEKDAYS);
  };

  const selectWeekends = () => {
    setDaysOfWeek(WEEKENDS);
  };

  const submit = () => {
    if (saving) return;

    const cleanName = name.trim();
    const cleanDosage = dosage.trim();
    const cleanTimes = normalizeSpecificTimes(times);
    const cleanTimesPerDay = parseInt(timesPerDay, 10) || cleanTimes.length || 1;

    if (!cleanName || !cleanDosage) {
      return;
    }

    onSave({
      id: initial?.id ?? `local_si_${Date.now()}`,
      planId: initial?.planId ?? "",
      name: cleanName,
      dosage: cleanDosage,
      timesPerDay: cleanTimesPerDay,
      specificTimes: cleanTimes,
      daysOfWeek: normalizeDays(daysOfWeek),
      notes: notes.trim() || undefined,
    });
  };

  const everyDayActive = daysOfWeek.length === 7;
  const weekdaysActive = areSameDays(daysOfWeek, WEEKDAYS);
  const weekendsActive = areSameDays(daysOfWeek, WEEKENDS);
  const canSave = !!name.trim() && !!dosage.trim() && !saving;

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
            <Pressable onPress={onClose} hitSlop={8} disabled={saving}>
              <X color={theme.colors.text} size={22} />
            </Pressable>

            <AppText variant="h3" numberOfLines={1} style={{ flex: 1, textAlign: "center" }}>
              {initial ? t("supps.editSupplement") : t("supps.addSupplement")}
            </AppText>

            <Pressable onPress={submit} hitSlop={8} disabled={!canSave}>
              <AppText
                variant="bodyStrong"
                color={canSave ? theme.colors.primary : theme.colors.textFaint}
              >
                {saving ? t("common.loading") : t("common.save")}
              </AppText>
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              padding: 16,
              gap: 14,
              paddingBottom: 96,
            }}
          >
            <AppText variant="caption" color={theme.colors.textMuted}>
              {t("supps.suggestions")}
            </AppText>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 8 }}
            >
              {SUPPLEMENT_SUGGESTIONS.map((s) => (
                <AppChip
                  key={s.name}
                  label={getSupplementName(s, lang)}
                  onPress={() => {
                    setName(getSupplementName(s, lang));
                    setDosage(s.dosage);
                    setTimesPerDay(String(s.timesPerDay));
                    setTimes(s.specificTimes.join(", "));
                    setDaysOfWeek(ALL_DAYS);
                  }}
                />
              ))}
            </ScrollView>

            <AppInput
              label={t("supps.name")}
              value={name}
              onChangeText={setName}
              placeholder={t("supps.name")}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              submitBehavior="submit"
            />

            <AppInput
              label={t("supps.dosage")}
              value={dosage}
              onChangeText={setDosage}
              placeholder={t("supps.dosagePlaceholder")}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              submitBehavior="submit"
            />

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ width: 110 }}>
                <AppInput
                  label={t("supps.timesPerDay")}
                  value={timesPerDay}
                  onChangeText={(value) => {
                    setTimesPerDay(sanitizeTimesPerDay(value));
                  }}
                  keyboardType="numeric"
                  inputMode="numeric"
                  returnKeyType="next"
                  submitBehavior="submit"
                  maxLength={2}
                />
              </View>

              <View style={{ flex: 1 }}>
                <AppInput
                  label={t("supps.times")}
                  value={times}
                  onChangeText={(value) => {
                    setTimes(sanitizeTimes(value));
                  }}
                  placeholder="09:00, 18:00"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="numbers-and-punctuation"
                  inputMode="text"
                  returnKeyType="next"
                  submitBehavior="submit"
                />
              </View>
            </View>

            <AppCard variant="outline">
              <View style={{ gap: 10 }}>
                <View>
                  <AppText variant="bodyStrong">{t("supps.activeDays")}</AppText>

                  <AppText variant="small" color={theme.colors.textMuted}>
                    {t("supps.activeDaysHint")}
                  </AppText>
                </View>

                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  <AppChip
                    label={t("supps.everyDay")}
                    active={everyDayActive}
                    onPress={selectEveryDay}
                  />

                  <AppChip
                    label={t("supps.weekdays")}
                    active={weekdaysActive}
                    onPress={selectWeekdays}
                  />

                  <AppChip
                    label={t("supps.weekends")}
                    active={weekendsActive}
                    onPress={selectWeekends}
                  />
                </View>

                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {DAYS.map((day) => (
                    <AppChip
                      key={day.key}
                      label={t(day.labelKey as never)}
                      active={daysOfWeek.includes(day.key)}
                      onPress={() => toggleDay(day.key)}
                    />
                  ))}
                </View>

                <AppText variant="caption" color={theme.colors.primary}>
                  {t("supps.selectedDays")}: {formatDays(daysOfWeek, t)}
                </AppText>
              </View>
            </AppCard>

            <AppInput
              label={t("supps.notes")}
              value={notes}
              onChangeText={setNotes}
              placeholder={t("common.optional")}
              multiline
              autoCapitalize="sentences"
              autoCorrect
              returnKeyType="done"
              submitBehavior="blurAndSubmit"
              onSubmitEditing={submit}
              style={{
                minHeight: 92,
                textAlignVertical: "top",
                paddingTop: 10,
              }}
            />

            <AppButton
              title={saving ? t("common.loading") : t("common.save")}
              size="lg"
              loading={saving}
              disabled={!canSave}
              onPress={submit}
              fullWidth
            />

            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}