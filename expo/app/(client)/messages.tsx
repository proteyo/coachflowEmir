import { router } from "expo-router";
import { MessageCircle } from "lucide-react-native";
import React, { useMemo } from "react";
import { Pressable, View } from "react-native";
import {
  AppAvatar,
  AppCard,
  AppEmptyState,
  AppText,
  ScreenContainer,
} from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";

export default function ClientMessages() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const { db } = useData();

  const data = useMemo(() => {
    if (!db || !user) return null;
    const profile = db.clientProfiles.find((c) => c.userId === user.id);
    const coach = profile ? db.users.find((u) => u.id === profile.coachId) : null;
    const coachProfile = profile
      ? db.coachProfiles.find((p) => p.userId === profile.coachId)
      : null;
    const lastMsg = coach
      ? db.messages
          .filter(
            (m) =>
              (m.senderId === user.id && m.receiverId === coach.id) ||
              (m.senderId === coach.id && m.receiverId === user.id),
          )
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
      : undefined;
    return { coach, coachProfile, lastMsg };
  }, [db, user]);

  if (!db || !user || !data?.coach) {
    return (
      <ScreenContainer>
        <AppEmptyState
          title={t("messages.noCoach")}
          message={t("messages.noCoachMsg")}
          icon={<MessageCircle color={theme.colors.textMuted} size={36} />}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <Pressable onPress={() => router.push(`/chat/${data.coach!.id}`)}>
        <AppCard variant="elevated">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <AppAvatar
              uri={data.coachProfile?.profileImageUrl ?? data.coach.avatarUrl}
              name={data.coach.name}
              size={56}
              ring
            />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{data.coach.name}</AppText>
              <AppText variant="small" color={theme.colors.textMuted} numberOfLines={1}>
                {data.lastMsg?.content ?? t("messages.sayHi")}
              </AppText>
            </View>
          </View>
        </AppCard>
      </Pressable>

      <View style={{ marginTop: 16 }}>
        <AppCard variant="outline">
          <AppText variant="h3">{data.coach.name}</AppText>
          <AppText variant="small" color={theme.colors.textMuted} style={{ marginTop: 4 }}>
            {data.coachProfile?.specialty}
          </AppText>
          <AppText variant="small" style={{ marginTop: 8 }}>
            {data.coachProfile?.bio}
          </AppText>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
            {(data.coachProfile?.achievements ?? []).map((a) => (
              <View
                key={a}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  backgroundColor: theme.colors.surfaceAlt,
                  borderRadius: 999,
                }}
              >
                <AppText variant="caption">{a}</AppText>
              </View>
            ))}
          </View>
        </AppCard>
      </View>
    </ScreenContainer>
  );
}
