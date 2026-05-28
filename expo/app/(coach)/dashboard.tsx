import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  Activity,
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Flame,
  MessageCircle,
  Plus,
  TrendingUp,
  Users,
} from "lucide-react-native";
import React, { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";

import {
  AppAvatar,
  AppCard,
  AppText,
  GradientHeader,
  ScreenContainer,
  SectionHeader,
  StatCard,
  StreakPill,
} from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { useSubscription } from "@/src/context/SubscriptionContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";
import { toAbsoluteUrl } from "@/src/services/api";

type Lang = "ru" | "en" | "kk" | string;

function getText(lang: Lang, ru: string, en: string, kk: string) {
  if (lang === "ru") return ru;
  if (lang === "kk") return kk;
  return en;
}

function formatShortDate(value?: string | null, lang: Lang = "en") {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const locale = lang === "ru" ? "ru-RU" : lang === "kk" ? "kk-KZ" : "en-US";

  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
}

function localizeGoal(value?: string | null, lang: Lang = "en") {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return getText(lang, "Цель не указана", "Goal not set", "Мақсат көрсетілмеген");
  }

  const key = raw.toLowerCase();

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

  const item = map[key];

  if (item) {
    return getText(lang, item.ru, item.en, item.kk);
  }

  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function localizeLevel(value?: string | null, lang: Lang = "en") {
  const key = String(value ?? "").trim().toLowerCase();

  if (key === "beginner") return getText(lang, "Новичок", "Beginner", "Бастаушы");
  if (key === "intermediate") return getText(lang, "Средний", "Intermediate", "Орташа");
  if (key === "advanced") return getText(lang, "Продвинутый", "Advanced", "Жоғары");

  return value ?? "";
}

function localizeWorkoutName(workout: any, lang: Lang = "en") {
  if (lang === "ru" && workout.nameRu) return workout.nameRu;
  if (lang === "kk" && workout.nameKk) return workout.nameKk;

  const original = String(workout.name ?? "").trim();

  if (!original) {
    return getText(lang, "Тренировка", "Workout", "Жаттығу");
  }

  if (lang === "en") return original;

  let result = original;

  const replacementsRu: Record<string, string> = {
    "Day 1": "День 1",
    "Day 2": "День 2",
    "Day 3": "День 3",
    "Day 4": "День 4",
    "Day 5": "День 5",
    "Strength Density": "Плотная силовая",
    "Upper + Intervals": "Верх + интервалы",
    "Legs + Metabolic Finish": "Ноги + метаболический финиш",
    "Full Body Strength": "Силовая на всё тело",
    "Upper Body + Cardio": "Верх тела + кардио",
    "Lower Body + Conditioning": "Ноги + выносливость",
    "Push Hypertrophy": "Жимовая гипертрофия",
    "Pull Hypertrophy": "Тяговая гипертрофия",
    "Legs & Glutes": "Ноги и ягодицы",
    "Squat Strength": "Сила приседа",
    "Bench & Upper Strength": "Жим и верх тела",
    "Deadlift Strength": "Сила становой",
    "Bodyweight Full Body": "Всё тело дома",
    "Conditioning & Core": "Выносливость и пресс",
    "Legs, Glutes & Mobility": "Ноги, ягодицы и мобильность",
    "Glute Strength": "Сила ягодиц",
    "Quads & Shape": "Квадрицепс и форма",
    "Glute Pump & Mobility": "Памп ягодиц и мобильность",
    "Spine & Hips": "Спина и таз",
    "Shoulders & Posture": "Плечи и осанка",
    "Ankles, Hips & Core": "Голеностоп, таз и корпус",
    "Efficient Full Body A": "Быстрое всё тело A",
    "Efficient Full Body B": "Быстрое всё тело B",
    "Efficient Full Body C": "Быстрое всё тело C",
  };

  const replacementsKk: Record<string, string> = {
    "Day 1": "1-күн",
    "Day 2": "2-күн",
    "Day 3": "3-күн",
    "Day 4": "4-күн",
    "Day 5": "5-күн",
    "Strength Density": "Тығыз күш жұмысы",
    "Upper + Intervals": "Жоғарғы дене + интервал",
    "Legs + Metabolic Finish": "Аяқ + метаболикалық аяқтау",
    "Full Body Strength": "Толық денеге күш",
    "Upper Body + Cardio": "Жоғарғы дене + кардио",
    "Lower Body + Conditioning": "Аяқ + төзімділік",
    "Push Hypertrophy": "Итеру гипертрофиясы",
    "Pull Hypertrophy": "Тарту гипертрофиясы",
    "Legs & Glutes": "Аяқ және бөксе",
    "Squat Strength": "Отырып-тұру күші",
    "Bench & Upper Strength": "Жим және жоғарғы дене",
    "Deadlift Strength": "Өлі тарту күші",
    "Bodyweight Full Body": "Үйде толық дене",
    "Conditioning & Core": "Төзімділік және пресс",
    "Legs, Glutes & Mobility": "Аяқ, бөксе және қозғалыс",
    "Glute Strength": "Бөксе күші",
    "Quads & Shape": "Квадрицепс және пішін",
    "Glute Pump & Mobility": "Бөксе пампы және қозғалыс",
    "Spine & Hips": "Омыртқа және жамбас",
    "Shoulders & Posture": "Иық және қалып",
    "Ankles, Hips & Core": "Тобық, жамбас және корпус",
    "Efficient Full Body A": "Тиімді толық дене A",
    "Efficient Full Body B": "Тиімді толық дене B",
    "Efficient Full Body C": "Тиімді толық дене C",
  };

  const replacements = lang === "ru" ? replacementsRu : replacementsKk;

  Object.entries(replacements).forEach(([en, localized]) => {
    result = result.replace(en, localized);
  });

  return result;
}

function localizeDuration(minutes?: number | null, lang: Lang = "en") {
  const value = Number(minutes ?? 0);

  if (!value) return "";

  if (lang === "ru") return `${value} мин`;
  if (lang === "kk") return `${value} мин`;

  return `${value}m`;
}

function localizeSubscriptionName(value?: string | null, lang: Lang = "en") {
  const name = String(value ?? "").trim();

  if (!name) return "";

  const lower = name.toLowerCase();

  if (lower.includes("free trial") || lower.includes("trial")) {
    return getText(lang, "Пробный период", "Free trial", "Сынақ кезеңі");
  }

  if (lower.includes("monthly")) {
    return getText(lang, "Месячная подписка", "Monthly", "Айлық жазылым");
  }

  if (lower.includes("yearly") || lower.includes("annual")) {
    return getText(lang, "Годовая подписка", "Yearly", "Жылдық жазылым");
  }

  return name;
}

export default function CoachDashboard() {
  const { theme } = useTheme();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { db } = useData();
  const { isActive, sub } = useSubscription();

  const today = new Date().toISOString().slice(0, 10);

  const stats = useMemo(() => {
    if (!db || !user) return null;

    const clients = db.clientProfiles.filter((client) => client.coachId === user.id);
    const linkedClientIds = new Set(clients.map((client) => client.userId));

    const todayWorkouts = db.workouts.filter(
      (workout) =>
        workout.coachId === user.id &&
        workout.date === today &&
        linkedClientIds.has(workout.clientId),
    );

    const unread = db.messages.filter(
      (message) => message.receiverId === user.id && !message.read,
    ).length;

    const bestStreak = Math.max(
      0,
      ...db.streaks
        .filter((streak) => linkedClientIds.has(streak.clientId))
        .map((streak) => streak.currentStreak),
    );

    return {
      clients,
      linkedClientIds,
      todayWorkouts,
      unread,
      bestStreak,
    };
  }, [db, user, today]);

  if (!db || !user || !stats) return null;

const subscriptionName = localizeSubscriptionName(sub?.planName ?? sub?.planCode, lang);
  return (
    <ScreenContainer scroll padded={false}>
      <GradientHeader height={210}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 6,
          }}
        >
          <View>
            <AppText variant="small" color="rgba(255,255,255,0.7)">
              {t("dashboard.welcomeBack")}
            </AppText>

            <AppText variant="title" color="#fff">
              {user.name.split(" ")[0]} 👋
            </AppText>
          </View>

          <Pressable
            onPress={() => router.push("/(coach)/messages")}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: "rgba(255,255,255,0.12)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Bell color="#fff" size={20} />

            {stats.unread > 0 ? (
              <View
                style={{
                  position: "absolute",
                  top: 6,
                  right: 8,
                  width: 9,
                  height: 9,
                  borderRadius: 5,
                  backgroundColor: theme.colors.fire,
                }}
              />
            ) : null}
          </Pressable>
        </View>

        <View style={{ marginTop: 18 }}>
          <Pressable
            onPress={() => router.push("/subscription")}
            style={{
              backgroundColor: "rgba(255,255,255,0.12)",
              padding: 14,
              borderRadius: 18,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  backgroundColor: isActive
                    ? "rgba(22,199,132,0.4)"
                    : "rgba(255,176,32,0.4)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CreditCard color="#fff" size={18} />
              </View>

              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong" color="#fff" numberOfLines={1}>
                  {isActive
                    ? `${subscriptionName || "CoachFlow"} · ${getText(
                        lang,
                        "Активна",
                        "Active",
                        "Белсенді",
                      )}`
                    : t("dashboard.subRequired")}
                </AppText>

                <AppText variant="small" color="rgba(255,255,255,0.7)" numberOfLines={1}>
                  {isActive && sub?.endDate
                    ? `${getText(lang, "Продлится", "Renews", "Жалғасады")} ${formatShortDate(
                        sub.endDate,
                        lang,
                      )}`
                    : t("dashboard.activate")}
                </AppText>
              </View>
            </View>

            <ArrowRight color="#fff" size={18} />
          </Pressable>
        </View>
      </GradientHeader>

      <View style={{ paddingHorizontal: 20, marginTop: -28 }}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <StatCard
            label={t("dashboard.totalClients")}
            value={stats.clients.length}
            hint={t("dashboard.activeRoster")}
            icon={<Users color={theme.colors.primary} size={16} />}
          />

          <StatCard
            label={t("dashboard.todaySessions")}
            value={stats.todayWorkouts.length}
            hint={t("dashboard.sessions")}
            icon={<CalendarClock color={theme.colors.accent} size={16} />}
          />
        </View>

        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
          <StatCard
            label={t("dashboard.unread")}
            value={stats.unread}
            hint={t("dashboard.messagesLabel")}
            icon={<MessageCircle color={theme.colors.warn} size={16} />}
          />

          <StatCard
            label={t("dashboard.bestStreak")}
            value={stats.bestStreak}
            hint={t("dashboard.days")}
            tone="fire"
            icon={<Flame color="#fff" size={16} />}
          />
        </View>

        <SectionHeader
          title={t("dashboard.quickActions")}
          icon={<TrendingUp color={theme.colors.primary} size={18} />}
        />

        <View style={{ flexDirection: "row", gap: 12 }}>
          <QuickAction
            label={t("dashboard.addClient")}
            icon={<Plus color="#fff" size={18} />}
            onPress={() => router.push("/add-client")}
          />

          <QuickAction
            label={t("dashboard.schedule")}
            icon={<CalendarClock color="#fff" size={18} />}
            onPress={() => router.push("/(coach)/calendar")}
          />

          <QuickAction
            label={t("dashboard.messages")}
            icon={<MessageCircle color="#fff" size={18} />}
            onPress={() => router.push("/(coach)/messages")}
          />
        </View>

        <SectionHeader
          title={t("dashboard.todaysSessions")}
          icon={<Activity color={theme.colors.primary} size={18} />}
        />

        {stats.todayWorkouts.length === 0 ? (
          <AppCard variant="outline">
            <AppText variant="small" color={theme.colors.textMuted}>
              {t("dashboard.noSessionsToday")}
            </AppText>
          </AppCard>
        ) : (
          <View style={{ gap: 10 }}>
            {stats.todayWorkouts.map((workout) => {
              const clientUser = db.users.find((item) => item.id === workout.clientId);

              if (!clientUser) return null;

              const workoutName = localizeWorkoutName(workout, lang);
              const duration = localizeDuration(workout.durationMinutes, lang);

              return (
                <Pressable
                  key={workout.id}
                  onPress={() =>
                    router.push({
                      pathname: "/client/[id]",
                      params: { id: workout.clientId },
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
                        uri={toAbsoluteUrl(clientUser.avatarUrl)}
                        name={clientUser.name}
                        size={48}
                      />

                      <View style={{ flex: 1 }}>
                        <AppText variant="bodyStrong">{clientUser.name}</AppText>

                        <AppText variant="small" color={theme.colors.textMuted} numberOfLines={1}>
                          {workout.time ? `${workout.time} · ` : ""}
                          {workoutName}
                          {duration ? ` · ${duration}` : ""}
                        </AppText>
                      </View>

                      {workout.completed ? (
                        <CheckCircle2 color={theme.colors.success} size={22} />
                      ) : (
                        <ArrowRight color={theme.colors.textMuted} size={20} />
                      )}
                    </View>
                  </AppCard>
                </Pressable>
              );
            })}
          </View>
        )}

        <SectionHeader
          title={t("dashboard.streaks")}
          icon={<Flame color={theme.colors.fire} size={18} />}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {stats.clients.map((clientProfile) => {
              const clientUser = db.users.find((item) => item.id === clientProfile.userId);
              const streak = db.streaks.find((item) => item.clientId === clientProfile.userId);

              if (!clientUser) return null;

              const goal =
                localizeGoal((clientProfile as any).goalType, lang) ||
                localizeGoal(clientProfile.goal, lang);

              return (
                <Pressable
                  key={clientProfile.userId}
                  onPress={() =>
                    router.push({
                      pathname: "/client/[id]",
                      params: { id: clientProfile.userId },
                    } as any)
                  }
                  style={{ width: 150 }}
                >
                  <AppCard variant="outline" padded>
                    <AppAvatar
                      uri={toAbsoluteUrl(clientUser.avatarUrl)}
                      name={clientUser.name}
                      size={48}
                    />

                    <AppText
                      variant="bodyStrong"
                      style={{ marginTop: 8 }}
                      numberOfLines={1}
                    >
                      {clientUser.name.split(" ")[0]}
                    </AppText>

                    <AppText
                      variant="small"
                      color={theme.colors.textMuted}
                      numberOfLines={2}
                    >
                      {goal}
                    </AppText>

                    <View style={{ marginTop: 8 }}>
                      <StreakPill count={streak?.currentStreak ?? 0} />
                    </View>
                  </AppCard>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={{ height: 24 }} />
      </View>
    </ScreenContainer>
  );
}

function QuickAction({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <LinearGradient
        colors={["#16C784", "#0EA968"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          padding: 14,
          borderRadius: 16,
          alignItems: "center",
          gap: 6,
          minHeight: 92,
          justifyContent: "center",
        }}
      >
        {icon}

        <AppText
          variant="small"
          color="#fff"
          style={{ fontWeight: "700", textAlign: "center" }}
          numberOfLines={2}
        >
          {label}
        </AppText>
      </LinearGradient>
    </Pressable>
  );
}