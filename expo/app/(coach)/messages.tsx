import { router } from "expo-router";
import { MessageCircle } from "lucide-react-native";
import React, { useMemo } from "react";
import { FlatList, Pressable, View } from "react-native";
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

export default function CoachMessages() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const { db } = useData();

  const threads = useMemo(() => {
    if (!db || !user) return [];
    const map = new Map<string, { partnerId: string; lastMsg?: any; unread: number }>();
    db.messages
      .filter((m) => m.senderId === user.id || m.receiverId === user.id)
      .forEach((m) => {
        const other = m.senderId === user.id ? m.receiverId : m.senderId;
        const prev = map.get(other);
        const unread = prev?.unread ?? 0;
        const isUnread = m.receiverId === user.id && !m.read;
        map.set(other, {
          partnerId: other,
          lastMsg:
            !prev?.lastMsg || prev.lastMsg.createdAt < m.createdAt ? m : prev.lastMsg,
          unread: unread + (isUnread ? 1 : 0),
        });
      });
    // Include all clients even without msgs
    db.clientProfiles
      .filter((c) => c.coachId === user.id)
      .forEach((c) => {
        if (!map.has(c.userId)) map.set(c.userId, { partnerId: c.userId, unread: 0 });
      });
    return Array.from(map.values()).sort((a, b) => {
      const at = a.lastMsg?.createdAt ?? "";
      const bt = b.lastMsg?.createdAt ?? "";
      return bt.localeCompare(at);
    });
  }, [db, user]);

  return (
    <ScreenContainer>
      <FlatList
        data={threads}
        keyExtractor={(t) => t.partnerId}
        contentContainerStyle={{ paddingVertical: 8, gap: 8 }}
        ListEmptyComponent={
          <AppEmptyState
            title={t("messages.noConversations")}
            message={t("messages.addClientFirst")}
            icon={<MessageCircle color={theme.colors.textMuted} size={36} />}
          />
        }
        renderItem={({ item }) => {
          const u = db?.users.find((x) => x.id === item.partnerId);
          return (
            <Pressable onPress={() => router.push(`/chat/${item.partnerId}`)}>
              <AppCard variant="outline">
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <AppAvatar uri={u?.avatarUrl} name={u?.name} size={48} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyStrong">{u?.name}</AppText>
                    <AppText
                      variant="small"
                      color={theme.colors.textMuted}
                      numberOfLines={1}
                    >
                      {item.lastMsg?.content ?? t("messages.tapToStart")}
                    </AppText>
                  </View>
                  {item.unread > 0 ? (
                    <View
                      style={{
                        backgroundColor: theme.colors.primary,
                        minWidth: 22,
                        height: 22,
                        paddingHorizontal: 6,
                        borderRadius: 11,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <AppText
                        variant="caption"
                        color={theme.colors.primaryContrast}
                        style={{ fontWeight: "800" }}
                      >
                        {item.unread}
                      </AppText>
                    </View>
                  ) : null}
                </View>
              </AppCard>
            </Pressable>
          );
        }}
      />
    </ScreenContainer>
  );
}
