import { Stack, router } from "expo-router";
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

type Lang = "ru" | "en" | "kk" | string;

function getText(lang: Lang, ru: string, en: string, kk: string) {
  if (lang === "ru") return ru;
  if (lang === "kk") return kk;
  return en;
}

function normalizeText(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ");
}

function localizeGoal(
  goalType?: string | null,
  goal?: string | null,
  lang: Lang = "en",
) {
  const type = String(goalType ?? "").trim().toLowerCase();
  const rawGoal = String(goal ?? "").trim();
  const normalizedGoal = normalizeText(rawGoal);

  const map: Record<string, { ru: string; en: string; kk: string }> = {
    lose_weight: {
      ru: "Сбросить вес",
      en: "Lose weight",
      kk: "Салмақ тастау",
    },
    fat_loss: {
      ru: "Похудение",
      en: "Fat loss",
      kk: "Арықтау",
    },
    gain_muscle: {
      ru: "Набор мышц",
      en: "Gain muscle",
      kk: "Бұлшықет жинау",
    },
    muscle_gain: {
      ru: "Набор мышц",
      en: "Muscle gain",
      kk: "Бұлшықет жинау",
    },
    improve_mobility: {
      ru: "Улучшить мобильность",
      en: "Improve mobility",
      kk: "Қозғалысты жақсарту",
    },
    mobility: {
      ru: "Мобильность",
      en: "Mobility",
      kk: "Қозғалғыштық",
    },
    maintain_shape: {
      ru: "Поддерживать форму",
      en: "Maintain shape",
      kk: "Форманы сақтау",
    },
    general_fitness: {
      ru: "Общая форма",
      en: "General fitness",
      kk: "Жалпы форма",
    },
    strength: {
      ru: "Сила",
      en: "Strength",
      kk: "Күш",
    },
    endurance: {
      ru: "Выносливость",
      en: "Endurance",
      kk: "Төзімділік",
    },
    recomposition: {
      ru: "Рекомпозиция тела",
      en: "Body recomposition",
      kk: "Дене құрамын өзгерту",
    },
    posture_back: {
      ru: "Осанка и спина",
      en: "Posture & back",
      kk: "Қалып және арқа",
    },
    upper_body: {
      ru: "Верх тела",
      en: "Upper body",
      kk: "Жоғарғы дене",
    },
    glutes_legs: {
      ru: "Ягодицы и ноги",
      en: "Glutes & legs",
      kk: "Бөксе және аяқ",
    },
    home_training: {
      ru: "Домашние тренировки",
      en: "Home training",
      kk: "Үй жаттығулары",
    },
    beginner_gym: {
      ru: "Новичок в зале",
      en: "Beginner gym",
      kk: "Залда бастаушы",
    },
    dumbbell_home: {
      ru: "Дом с гантелями",
      en: "Dumbbell home",
      kk: "Гантельмен үй",
    },
  };

  if (map[type]) {
    const item = map[type];
    return getText(lang, item.ru, item.en, item.kk);
  }

  if (map[normalizedGoal]) {
    const item = map[normalizedGoal];
    return getText(lang, item.ru, item.en, item.kk);
  }

  if (!rawGoal) {
    return getText(
      lang,
      "Цель не указана",
      "Goal not set",
      "Мақсат көрсетілмеген",
    );
  }

  return rawGoal
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isLoseGoal(goalType?: string | null, goal?: string | null) {
  const type = normalizeText(goalType);
  const text = normalizeText(goal);

  return (
    type === "lose weight" ||
    type === "fat loss" ||
    /lose|cut|weight|fat|сброс|похуд|арық|салмақ таст/i.test(text)
  );
}

function isGainGoal(goalType?: string | null, goal?: string | null) {
  const type = normalizeText(goalType);
  const text = normalizeText(goal);

  return (
    type === "gain muscle" ||
    type === "muscle gain" ||
    /gain|muscle|bulk|mass|набор|масса|бұлшық|салмақ қос/i.test(text)
  );
}

function isMobilityGoal(goalType?: string | null, goal?: string | null) {
  const type = normalizeText(goalType);
  const text = normalizeText(goal);

  return (
    type === "improve mobility" ||
    type === "mobility" ||
    type === "posture back" ||
    /mobility|posture|stretch|flexibility|мобиль|осанк|растяж|қозғал|икем/i.test(
      text,
    )
  );
}

export default function ClientsScreen() {
  const { theme } = useTheme();
  const { t, lang } = useI18n();
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

        const goalType = clientProfile.goalType;
        const goal = clientProfile.goal;

        if (filter === "lose" && !isLoseGoal(goalType, goal)) {
          return false;
        }

        if (filter === "gain" && !isGainGoal(goalType, goal)) {
          return false;
        }

        if (filter === "mobility" && !isMobilityGoal(goalType, goal)) {
          return false;
        }

        const query = q.trim().toLowerCase();

        if (query) {
          const localizedGoal = localizeGoal(goalType, goal, lang).toLowerCase();

          const matchesName = clientUser.name.toLowerCase().includes(query);
          const matchesEmail = clientUser.email?.toLowerCase().includes(query);
          const matchesGoal = localizedGoal.includes(query);

          if (!matchesName && !matchesEmail && !matchesGoal) {
            return false;
          }
        }

        return true;
      });
  }, [db, user, q, filter, lang]);

  const getFilterLabel = (value: Filter) => {
    if (value === "all") return t("clients.filterAll" as never);
    if (value === "lose") return t("clients.filterLose" as never);
    if (value === "gain") return t("clients.filterGain" as never);

    return t("clients.filterMobility" as never);
  };

  if (!db || !user) {
    return null;
  }

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: false }} />

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 22,
          marginBottom: 18,
        }}
      >
        <AppText variant="title">{t("clients.title" as never)}</AppText>

        <Pressable
          onPress={() => router.push("/add-client")}
          hitSlop={8}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: theme.colors.primary,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: theme.colors.primary,
            shadowOpacity: 0.35,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          }}
        >
          <Plus color={theme.colors.primaryContrast} size={28} />
        </Pressable>
      </View>

      <AppInput
        placeholder={t("clients.searchPlaceholder" as never)}
        value={q}
        onChangeText={setQ}
        leftIcon={<Search size={18} color={theme.colors.textMuted} />}
      />

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          marginTop: 12,
          marginBottom: 8,
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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: 120,
          gap: 12,
          flexGrow: 1,
        }}
        ListEmptyComponent={
          <AppEmptyState
            title={t("clients.noFound" as never)}
            message={t("clients.noFoundMsg" as never)}
          />
        }
        renderItem={({ item }) => {
          if (!item.clientUser) return null;

          const change =
            item.clientProfile.currentWeight - item.clientProfile.startWeight;

          const losing = change < 0;
          const changed = Math.abs(change) > 0.05;

          const localizedGoal = localizeGoal(
            item.clientProfile.goalType,
            item.clientProfile.goal,
            lang,
          );

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
                    size={58}
                  />

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText variant="bodyStrong" numberOfLines={1}>
                      {item.clientUser.name}
                    </AppText>

                    <AppText
                      variant="small"
                      color={theme.colors.textMuted}
                      numberOfLines={1}
                      style={{ marginTop: 2 }}
                    >
                      {localizedGoal}
                    </AppText>

                    <View
                      style={{
                        marginTop: 5,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {changed ? (
                        losing ? (
                          <TrendingDown color={theme.colors.primary} size={16} />
                        ) : (
                          <TrendingUp color={theme.colors.warn} size={16} />
                        )
                      ) : (
                        <TrendingUp color={theme.colors.warn} size={16} />
                      )}

                      <AppText
                        variant="small"
                        color={losing ? theme.colors.primary : theme.colors.warn}
                        style={{ fontWeight: "800" }}
                        numberOfLines={1}
                      >
                        {change > 0 ? "+" : ""}
                        {change.toFixed(1)} кг ·{" "}
                        {item.clientProfile.currentWeight.toFixed(0)} кг
                      </AppText>
                    </View>
                  </View>

                  <View style={{ alignItems: "flex-end" }}>
                    <StreakPill count={item.streak?.currentStreak ?? 0} />
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