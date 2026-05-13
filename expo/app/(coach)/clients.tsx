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
import { toAbsoluteUrl } from "@/src/services/api";

type Filter = "all" | "lose" | "gain" | "mobility";

const FILTERS: Filter[] = ["all", "lose", "gain", "mobility"];

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
      .filter((clientProfile) => clientProfile.coachId === user.id)
      .map((clientProfile) => {
        const clientUser = db.users.find(
          (item) => item.id === clientProfile.userId,
        );

        const streak = db.streaks.find(
          (item) => item.clientId === clientProfile.userId,
        );

        return {
          clientProfile,
          clientUser,
          streak,
        };
      })
      .filter(({ clientUser, clientProfile }) => {
        if (!clientUser) return false;

        const goal = clientProfile.goal ?? "";
        const normalizedGoal = goal.toLowerCase();

        if (
          filter === "lose" &&
          !(
            clientProfile.goalType === "lose_weight" ||
            /lose|cut|weight|fat|сброс|похуд|арық|салмақ/i.test(normalizedGoal)
          )
        ) {
          return false;
        }

        if (
          filter === "gain" &&
          !(
            clientProfile.goalType === "gain_muscle" ||
            /gain|muscle|bulk|mass|набор|масса|бұлшық|салмақ қос/i.test(
              normalizedGoal,
            )
          )
        ) {
          return false;
        }

        if (
          filter === "mobility" &&
          !(
            clientProfile.goalType === "improve_mobility" ||
            /mobility|posture|stretch|flexibility|мобиль|осанк|растяж|қозғал|икем/i.test(
              normalizedGoal,
            )
          )
        ) {
          return false;
        }

        if (
          q.trim() &&
          !clientUser.name.toLowerCase().includes(q.trim().toLowerCase())
        ) {
          return false;
        }

        return true;
      });
  }, [db, user, q, filter]);

  const getFilterLabel = (value: Filter) => {
    if (value === "all") return t("clients.filterAll");
    if (value === "lose") return t("clients.filterLose");
    if (value === "gain") return t("clients.filterGain");

    return t("clients.filterMobility");
  };

  return (
    <ScreenContainer>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginVertical: 8,
        }}
      >
        <AppText variant="title">{t("clients.title")}</AppText>

        <Pressable
          onPress={() => router.push("/add-client")}
          hitSlop={8}
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: theme.colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Plus color={theme.colors.primaryContrast} size={24} />
        </Pressable>
      </View>

      <AppInput
        placeholder={t("clients.searchPlaceholder")}
        value={q}
        onChangeText={setQ}
        leftIcon={<Search size={18} color={theme.colors.textMuted} />}
      />

      <View
        style={{
          flexDirection: "row",
          gap: 8,
          marginTop: 12,
          marginBottom: 6,
        }}
      >
        {FILTERS.map((item) => (
          <AppChip
            key={item}
            label={getFilterLabel(item)}
            active={filter === item}
            onPress={() => setFilter(item)}
          />
        ))}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.clientProfile.userId}
        contentContainerStyle={{ paddingVertical: 12, gap: 12 }}
        ListEmptyComponent={
          <AppEmptyState
            title={t("clients.noFound")}
            message={t("clients.noFoundMsg")}
          />
        }
        renderItem={({ item }) => {
          if (!item.clientUser) return null;

          const change =
            item.clientProfile.currentWeight - item.clientProfile.startWeight;

          const losing = change < 0;

          return (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/client/[id]",
                  params: { id: item.clientProfile.userId },
                } as any)
              }
            >
              <AppCard variant="elevated">
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <AppAvatar
                    uri={toAbsoluteUrl(item.clientUser.avatarUrl)}
                    name={item.clientUser.name}
                    size={56}
                    ring
                  />

                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <AppText variant="bodyStrong" numberOfLines={1}>
                        {item.clientUser.name}
                      </AppText>

                      <StreakPill count={item.streak?.currentStreak ?? 0} />
                    </View>

                    <AppText
                      variant="small"
                      color={theme.colors.textMuted}
                      numberOfLines={1}
                      style={{ marginTop: 2 }}
                    >
                      {item.clientProfile.goal || t("clients.noGoal")}
                    </AppText>

                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 4,
                      }}
                    >
                      {losing ? (
                        <TrendingDown size={14} color={theme.colors.success} />
                      ) : (
                        <TrendingUp size={14} color={theme.colors.warn} />
                      )}

                      <AppText
                        variant="small"
                        color={
                          losing ? theme.colors.success : theme.colors.warn
                        }
                        style={{ fontWeight: "700" }}
                      >
                        {change >= 0 ? "+" : ""}
                        {change.toFixed(1)} {t("common.kg")} ·{" "}
                        {item.clientProfile.currentWeight} {t("common.kg")}
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