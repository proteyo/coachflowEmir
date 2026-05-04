import { router } from "expo-router";
import { Minus, Plus } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { CircularGoalSelector } from "@/src/components/charts";
import {
  AppButton,
  AppCard,
  AppText,
  ScreenContainer,
} from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";

export default function WeeklyGoalsScreen() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const { db, update } = useData();

  const existing = db?.weeklyGoals.find((g) => g.clientId === user?.id);
  const [minutes, setMinutes] = useState<number>(existing?.targetMinutes ?? 240);
  const [workouts, setWorkouts] = useState<number>(existing?.targetWorkouts ?? 4);

  const adjMin = (delta: number) => setMinutes((m) => Math.max(30, Math.min(720, m + delta)));
  const adjWk = (delta: number) => setWorkouts((w) => Math.max(1, Math.min(14, w + delta)));

  const save = () => {
    if (!user) return;
    update((d) => {
      const idx = d.weeklyGoals.findIndex((g) => g.clientId === user.id);
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
      const ymd = weekStart.toISOString().slice(0, 10);
      if (idx >= 0) {
        const next = [...d.weeklyGoals];
        next[idx] = { ...next[idx], targetMinutes: minutes, targetWorkouts: workouts };
        return { ...d, weeklyGoals: next };
      }
      return {
        ...d,
        weeklyGoals: [
          ...d.weeklyGoals,
          {
            id: `wg_${user.id}`,
            clientId: user.id,
            weekStart: ymd,
            targetMinutes: minutes,
            completedMinutes: 0,
            targetWorkouts: workouts,
            completedWorkouts: 0,
          },
        ],
      };
    });
    router.back();
  };

  return (
    <ScreenContainer scroll>
      <AppText variant="title" style={{ marginBottom: 6 }}>
        {t("weekly.title")}
      </AppText>
      <AppText variant="small" color={theme.colors.textMuted}>
        {t("weekly.subtitle")}
      </AppText>

      <View style={{ alignItems: "center", marginVertical: 24 }}>
        <CircularGoalSelector
          value={minutes}
          min={30}
          max={720}
          step={15}
          onChange={setMinutes}
          unit={t("weekly.perWeek")}
        />
        <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
          <Stepper onPress={() => adjMin(-15)} icon="minus" />
          <Stepper onPress={() => adjMin(15)} icon="plus" />
        </View>
      </View>

      <AppCard variant="outline">
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View>
            <AppText variant="bodyStrong">{t("weekly.workoutsPerWeek")}</AppText>
            <AppText variant="small" color={theme.colors.textMuted}>
              {t("weekly.sessions")}
            </AppText>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Stepper onPress={() => adjWk(-1)} icon="minus" />
            <AppText variant="title">{workouts}</AppText>
            <Stepper onPress={() => adjWk(1)} icon="plus" />
          </View>
        </View>
      </AppCard>

      <View style={{ marginTop: 24 }}>
        <AppButton title={t("weekly.save")} size="lg" onPress={save} fullWidth />
      </View>
    </ScreenContainer>
  );
}

function Stepper({ onPress, icon }: { onPress: () => void; icon: "plus" | "minus" }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: theme.colors.surfaceAlt,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {icon === "plus" ? (
        <Plus color={theme.colors.text} size={18} />
      ) : (
        <Minus color={theme.colors.text} size={18} />
      )}
    </Pressable>
  );
}
