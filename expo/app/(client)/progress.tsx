import { router } from "expo-router";
import { Plus, TrendingDown, TrendingUp } from "lucide-react-native";
import React, { useMemo } from "react";
import { Dimensions, Pressable, View } from "react-native";
import { WeightChart } from "@/src/components/charts";
import {
  AppButton,
  AppCard,
  AppText,
  ScreenContainer,
  SectionHeader,
  StatCard,
} from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";

export default function ClientProgress() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const { db } = useData();
  const w = Dimensions.get("window").width;

  const data = useMemo(() => {
    if (!db || !user) return null;
    const profile = db.clientProfiles.find((c) => c.userId === user.id);
    const entries = db.progress
      .filter((p) => p.clientId === user.id)
      .sort((a, b) => (a.date > b.date ? 1 : -1));
    return { profile, entries };
  }, [db, user]);

  if (!db || !user || !data) return null;

  const change = data.profile
    ? data.profile.currentWeight - data.profile.startWeight
    : 0;
  const losing = change < 0;

  return (
    <ScreenContainer scroll>
      <SectionHeader title={t("progress.title")} />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <StatCard
          label={t("progress.current")}
          value={`${data.profile?.currentWeight ?? 0} kg`}
          hint={t("progress.latestWeight")}
        />
        <StatCard
          label={losing ? t("progress.lost") : t("progress.gained")}
          value={`${Math.abs(change).toFixed(1)} kg`}
          hint={`${t("progress.since")} ${data.profile?.startWeight ?? 0} kg`}
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

      <View style={{ marginTop: 16 }}>
        <AppCard variant="elevated">
          <AppText variant="h3" style={{ marginBottom: 8 }}>
            {t("progress.weightTrend")}
          </AppText>
          <WeightChart values={data.entries} width={w - 80} />
        </AppCard>
      </View>

      <View style={{ marginTop: 16, marginBottom: 12 }}>
        <AppButton
          title={t("progress.logWeight")}
          icon={<Plus size={18} color={theme.colors.primaryContrast} />}
          onPress={() => router.push("/add-weight")}
          fullWidth
        />
      </View>

      <SectionHeader title={t("progress.history")} />
      <View style={{ gap: 8 }}>
        {data.entries
          .slice()
          .reverse()
          .map((e, i, arr) => {
            const prev = arr[i + 1];
            const diff = prev ? e.weight - prev.weight : 0;
            return (
              <AppCard key={e.id} variant="outline">
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <View>
                    <AppText variant="bodyStrong">{e.weight} kg</AppText>
                    <AppText variant="small" color={theme.colors.textMuted}>
                      {e.date}
                    </AppText>
                  </View>
                  {prev ? (
                    <AppText
                      variant="bodyStrong"
                      color={diff <= 0 ? theme.colors.success : theme.colors.warn}
                    >
                      {diff > 0 ? "+" : ""}
                      {diff.toFixed(1)} kg
                    </AppText>
                  ) : (
                    <AppText variant="small" color={theme.colors.textMuted}>
                      {t("progress.start")}
                    </AppText>
                  )}
                </View>
                {e.notes ? (
                  <AppText variant="small" color={theme.colors.textMuted} style={{ marginTop: 4 }}>
                    {e.notes}
                  </AppText>
                ) : null}
              </AppCard>
            );
          })}
      </View>
    </ScreenContainer>
  );
}
