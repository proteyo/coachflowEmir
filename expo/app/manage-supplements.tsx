import { router, Stack, useLocalSearchParams } from "expo-router";
import { ChevronLeft, Pill, Plus, Trash2, X } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";
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
import { SUPPLEMENT_SUGGESTIONS } from "@/src/data/exerciseLibrary";
import { useI18n } from "@/src/i18n/I18nContext";
import { SupplementItem } from "@/src/types/models";

export default function ManageSupplements() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { theme } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const { db, update } = useData();
  const [editing, setEditing] = useState<SupplementItem | null>(null);
  const [adding, setAdding] = useState<boolean>(false);

  const planAndItems = useMemo(() => {
    if (!db || !clientId) return { plan: null, items: [] };
    const plan = db.supplementPlans.find((p) => p.clientId === clientId);
    const items = plan ? db.supplementItems.filter((s) => s.planId === plan.id) : [];
    return { plan, items };
  }, [db, clientId]);

  const ensurePlan = (): string => {
    if (planAndItems.plan) return planAndItems.plan.id;
    const id = `sp_${Date.now()}`;
    update((d) => ({
      ...d,
      supplementPlans: [
        ...d.supplementPlans,
        {
          id,
          coachId: user?.id ?? "",
          clientId: clientId ?? "",
          startDate: new Date().toISOString().slice(0, 10),
        },
      ],
    }));
    return id;
  };

  const saveItem = (item: SupplementItem) => {
    update((d) => {
      const exists = d.supplementItems.some((i) => i.id === item.id);
      return {
        ...d,
        supplementItems: exists
          ? d.supplementItems.map((i) => (i.id === item.id ? item : i))
          : [...d.supplementItems, item],
      };
    });
  };

  const removeItem = (id: string) => {
    Alert.alert(t("supps.confirmDelete"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => {
          update((d) => ({
            ...d,
            supplementItems: d.supplementItems.filter((i) => i.id !== id),
          }));
        },
      },
    ]);
  };

  return (
    <ScreenContainer scroll padded={false}>
      <Stack.Screen
        options={{
          title: t("supps.title"),
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={{ paddingHorizontal: 4 }}>
              <ChevronLeft color={theme.colors.text} size={22} />
            </Pressable>
          ),
        }}
      />
      <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 12 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <AppText variant="h3">{t("supps.title")}</AppText>
          <AppButton
            title={t("supps.save")}
            size="sm"
            icon={<Plus size={16} color={theme.colors.primaryContrast} />}
            onPress={() => setAdding(true)}
          />
        </View>

        {planAndItems.items.length === 0 ? (
          <AppEmptyState
            title={t("clients.noSupps")}
            icon={<Pill color={theme.colors.accent} size={32} />}
          />
        ) : (
          planAndItems.items.map((s) => (
            <AppCard key={s.id} variant="outline">
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">{s.name}</AppText>
                  <AppText variant="small" color={theme.colors.textMuted}>
                    {s.dosage} · {s.specificTimes.join(", ")}
                  </AppText>
                  {s.notes ? (
                    <AppText variant="caption" color={theme.colors.textFaint}>
                      {s.notes}
                    </AppText>
                  ) : null}
                </View>
                <View style={{ flexDirection: "row", gap: 12 }}>
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
        <View style={{ height: 32 }} />
      </View>

      <SupplementEditor
        visible={adding || !!editing}
        initial={editing}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        onSave={(item) => {
          const planId = ensurePlan();
          saveItem({ ...item, planId });
          setAdding(false);
          setEditing(null);
        }}
      />
    </ScreenContainer>
  );
}

function SupplementEditor({
  visible,
  initial,
  onClose,
  onSave,
}: {
  visible: boolean;
  initial: SupplementItem | null;
  onClose: () => void;
  onSave: (s: SupplementItem) => void;
}) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const [name, setName] = useState<string>("");
  const [dosage, setDosage] = useState<string>("");
  const [timesPerDay, setTimesPerDay] = useState<string>("1");
  const [times, setTimes] = useState<string>("09:00");
  const [notes, setNotes] = useState<string>("");

  React.useEffect(() => {
    if (visible) {
      setName(initial?.name ?? "");
      setDosage(initial?.dosage ?? "");
      setTimesPerDay(String(initial?.timesPerDay ?? 1));
      setTimes((initial?.specificTimes ?? ["09:00"]).join(", "));
      setNotes(initial?.notes ?? "");
    }
  }, [visible, initial]);

  const submit = () => {
    if (!name.trim() || !dosage.trim()) return;
    const id = initial?.id ?? `si_${Date.now()}`;
    const specific = times
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    onSave({
      id,
      planId: initial?.planId ?? "",
      name: name.trim(),
      dosage: dosage.trim(),
      timesPerDay: parseInt(timesPerDay, 10) || 1,
      specificTimes: specific.length ? specific : ["09:00"],
      notes: notes.trim() || undefined,
    });
  };

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
          <AppText variant="h3">
            {initial ? t("common.edit") : t("common.add")}
          </AppText>
          <Pressable onPress={submit} hitSlop={8}>
            <AppText variant="bodyStrong" color={theme.colors.primary}>
              {t("common.save")}
            </AppText>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <AppText variant="caption" color={theme.colors.textMuted}>
            {t("supps.suggestions")}
          </AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {SUPPLEMENT_SUGGESTIONS.map((s) => (
              <AppChip
                key={s.name}
                label={s.name}
                onPress={() => {
                  setName(s.name);
                  setDosage(s.dosage);
                  setTimesPerDay(String(s.timesPerDay));
                  setTimes(s.specificTimes.join(", "));
                }}
              />
            ))}
          </ScrollView>

          <AppInput label={t("supps.name")} value={name} onChangeText={setName} />
          <AppInput
            label={t("supps.dosage")}
            value={dosage}
            onChangeText={setDosage}
            placeholder="e.g. 30g"
          />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ width: 110 }}>
              <AppInput
                label={t("supps.timesPerDay")}
                value={timesPerDay}
                onChangeText={setTimesPerDay}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppInput
                label={t("supps.times")}
                value={times}
                onChangeText={setTimes}
                autoCapitalize="none"
              />
            </View>
          </View>
          <AppInput
            label={t("supps.notes")}
            value={notes}
            onChangeText={setNotes}
            placeholder={t("common.optional")}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}
