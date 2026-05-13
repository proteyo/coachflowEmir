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

export default function CoachDashboard() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const { db } = useData();
  const { isActive, sub } = useSubscription();

  const today = new Date().toISOString().slice(0, 10);

  const stats = useMemo(() => {
    if (!db || !user) return null;

    const clients = db.clientProfiles.filter((c) => c.coachId === user.id);
    const linkedClientIds = new Set(clients.map((c) => c.userId));

    const todayWorkouts = db.workouts.filter(
      (w) =>
        w.coachId === user.id &&
        w.date === today &&
        linkedClientIds.has(w.clientId),
    );

    const unread = db.messages.filter(
      (m) => m.receiverId === user.id && !m.read,
    ).length;

    const bestStreak = Math.max(
      0,
      ...db.streaks
        .filter((s) => linkedClientIds.has(s.clientId))
        .map((s) => s.currentStreak),
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
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

              <View>
                <AppText variant="bodyStrong" color="#fff">
                  {isActive ? t("dashboard.activeRenews") : t("dashboard.subRequired")}
                </AppText>

                <AppText variant="small" color="rgba(255,255,255,0.7)">
                  {isActive && sub?.endDate
                    ? `${t("dashboard.renewsOn")} ${new Date(sub.endDate)
                        .toDateString()
                        .slice(4, 10)}`
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
            {stats.todayWorkouts.map((w) => {
              const c = db.users.find((u) => u.id === w.clientId);

              if (!c) return null;

              return (
                <Pressable
                  key={w.id}
                  onPress={() =>
                    router.push({
                      pathname: "/client/[id]",
                      params: { id: w.clientId },
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
                        uri={toAbsoluteUrl(c.avatarUrl)}
                        name={c.name}
                        size={48}
                      />

                      <View style={{ flex: 1 }}>
                        <AppText variant="bodyStrong">{c.name}</AppText>

                        <AppText variant="small" color={theme.colors.textMuted}>
                          {w.time ? `${w.time} · ` : ""}
                          {w.name} · {w.durationMinutes}m
                        </AppText>
                      </View>

                      {w.completed ? (
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
            {stats.clients.map((c) => {
              const u = db.users.find((x) => x.id === c.userId);
              const s = db.streaks.find((x) => x.clientId === c.userId);

              if (!u) return null;

              return (
                <Pressable
                  key={c.userId}
                  onPress={() =>
                    router.push({
                      pathname: "/client/[id]",
                      params: { id: c.userId },
                    } as any)
                  }
                  style={{ width: 140 }}
                >
                  <AppCard variant="outline" padded>
                    <AppAvatar
                      uri={toAbsoluteUrl(u.avatarUrl)}
                      name={u.name}
                      size={48}
                    />

                    <AppText
                      variant="bodyStrong"
                      style={{ marginTop: 8 }}
                      numberOfLines={1}
                    >
                      {u.name.split(" ")[0]}
                    </AppText>

                    <AppText
                      variant="small"
                      color={theme.colors.textMuted}
                      numberOfLines={1}
                    >
                      {c.goal}
                    </AppText>

                    <View style={{ marginTop: 8 }}>
                      <StreakPill count={s?.currentStreak ?? 0} />
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
        }}
      >
        {icon}

        <AppText variant="small" color="#fff" style={{ fontWeight: "700" }}>
          {label}
        </AppText>
      </LinearGradient>
    </Pressable>
  );
}