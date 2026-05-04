import { router } from "expo-router";
import { Plus, Search, TrendingDown, TrendingUp } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import {
  AppAvatar,
  AppCard,
  AppChip,
  AppEmptyState,
  AppInput,
  AppText,
  ScreenContainer,
  StreakPill,
} from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";

type Filter = "all" | "lose" | "gain" | "mobility";

export default function ClientsScreen() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const { db } = useData();
  const [q, setQ] = useState<string>("");
  const [filter, setFilter] = useState<Filter>("all");

  const items = useMemo(() => {
    if (!db || !user) return [];
    return db.clientProfiles
      .filter((c) => c.coachId === user.id)
      .map((c) => {
        const u = db.users.find((x) => x.id === c.userId);
        const streak = db.streaks.find((x) => x.clientId === c.userId);
        return { c, u, streak };
      })
      .filter(({ u, c }) => {
        if (filter === "lose" && !(c.goalType === "lose_weight" || /lose|cut/i.test(c.goal))) return false;
        if (filter === "gain" && !(c.goalType === "gain_muscle" || /gain|muscle/i.test(c.goal))) return false;
        if (filter === "mobility" && !(c.goalType === "improve_mobility" || /mobility|posture/i.test(c.goal))) return false;
        if (q && !u?.name.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      });
  }, [db, user, q, filter]);

  return (
    <ScreenContainer>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 8 }}>
        <AppText variant="title">{t("clients.title")}</AppText>
        <Pressable
          onPress={() => router.push("/add-client")}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: theme.colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Plus color={theme.colors.primaryContrast} size={20} />
        </Pressable>
      </View>

      <AppInput
        placeholder={t("clients.searchPlaceholder")}
        value={q}
        onChangeText={setQ}
        leftIcon={<Search size={18} color={theme.colors.textMuted} />}
      />
      <View style={{ flexDirection: "row", gap: 8, marginTop: 12, marginBottom: 6 }}>
        {(["all", "lose", "gain", "mobility"] as Filter[]).map((f) => {
          const labelKey =
            f === "all"
              ? "clients.filterAll"
              : f === "lose"
                ? "clients.filterLose"
                : f === "gain"
                  ? "clients.filterGain"
                  : "clients.filterMobility";
          return (
            <AppChip
              key={f}
              label={t(labelKey as never)}
              active={filter === f}
              onPress={() => setFilter(f)}
            />
          );
        })}
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.c.userId}
        contentContainerStyle={{ paddingVertical: 12, gap: 12 }}
        ListEmptyComponent={
          <AppEmptyState title={t("clients.noFound")} message={t("clients.noFoundMsg")} />
        }
        renderItem={({ item }) => {
          const change = item.c.currentWeight - item.c.startWeight;
          const losing = change < 0;
          return (
            <Pressable onPress={() => router.push(`/client/${item.c.userId}`)}>
              <AppCard variant="elevated">
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <AppAvatar uri={item.u?.avatarUrl} name={item.u?.name} size={56} ring />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <AppText variant="bodyStrong">{item.u?.name}</AppText>
                      <StreakPill count={item.streak?.currentStreak ?? 0} />
                    </View>
                    <AppText variant="small" color={theme.colors.textMuted} numberOfLines={1}>
                      {item.c.goal}
                    </AppText>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                      {losing ? (
                        <TrendingDown size={14} color={theme.colors.success} />
                      ) : (
                        <TrendingUp size={14} color={theme.colors.warn} />
                      )}
                      <AppText
                        variant="small"
                        color={losing ? theme.colors.success : theme.colors.warn}
                        style={{ fontWeight: "700" }}
                      >
                        {change >= 0 ? "+" : ""}
                        {change.toFixed(1)} kg · {item.c.currentWeight} kg
                      </AppText>
                    </View>
                  </View>
                </View>
              </AppCard>
            </Pressable>
          );
        }}
      />
    </ScreenContainer>
  );
}
