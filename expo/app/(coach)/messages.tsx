import { router } from "expo-router";
import { MessageCircle, UserRound } from "lucide-react-native";
import React, { useMemo } from "react";
import { FlatList, Pressable, View } from "react-native";
import {
  AppAvatar,
  AppButton,
  AppCard,
  AppEmptyState,
  AppText,
  ScreenContainer,
} from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";
import { toAbsoluteUrl } from "@/src/services/api";

type AppLangCode = "en" | "ru" | "kk";

const TEXT = {
  en: {
    openChat: "Open chat",
    viewProfile: "View profile",
    voiceMessage: "Voice message",
    tapToStart: "Tap to start a conversation",
  },
  ru: {
    openChat: "Открыть чат",
    viewProfile: "Посмотреть профиль",
    voiceMessage: "Голосовое сообщение",
    tapToStart: "Нажмите, чтобы начать переписку",
  },
  kk: {
    openChat: "Чатты ашу",
    viewProfile: "Профильді көру",
    voiceMessage: "Дауыстық хабарлама",
    tapToStart: "Хат алмасуды бастау үшін басыңыз",
  },
};

function getLangSafe(lang: string): AppLangCode {
  if (lang === "ru" || lang === "kk" || lang === "en") return lang;
  return "en";
}

function getMessageTime(message: any) {
  const time = new Date(message?.createdAt).getTime();

  if (!Number.isNaN(time)) return time;

  const idNumber = Number(String(message?.id ?? "").replace(/\D/g, ""));

  return Number.isNaN(idNumber) ? 0 : idNumber;
}

function getLastMessagePreview(message: any, labels: typeof TEXT.en) {
  if (!message) return labels.tapToStart;

  if (message.messageType === "voice") return labels.voiceMessage;

  if (message.message_type === "voice") return labels.voiceMessage;

  const content = String(message.content ?? "").trim();

  if (!content) return labels.tapToStart;

  if (content.toLowerCase() === "voice message") return labels.voiceMessage;

  return content;
}

export default function CoachMessages() {
  const { theme } = useTheme();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { db } = useData();

  const currentLang = getLangSafe(lang);
  const L = TEXT[currentLang];

  const threads = useMemo(() => {
    if (!db || !user) return [];

    const map = new Map<
      string,
      {
        partnerId: string;
        lastMsg?: any;
        unread: number;
      }
    >();

    db.messages
      .filter((message) => message.senderId === user.id || message.receiverId === user.id)
      .forEach((message) => {
        const other =
          message.senderId === user.id ? message.receiverId : message.senderId;

        const prev = map.get(other);
        const unread = prev?.unread ?? 0;
        const isUnread = message.receiverId === user.id && !message.read;

        const prevTime = prev?.lastMsg ? getMessageTime(prev.lastMsg) : 0;
        const currentTime = getMessageTime(message);

        map.set(other, {
          partnerId: other,
          lastMsg: !prev?.lastMsg || currentTime > prevTime ? message : prev.lastMsg,
          unread: unread + (isUnread ? 1 : 0),
        });
      });

    db.clientProfiles
      .filter((client) => client.coachId === user.id)
      .forEach((client) => {
        if (!map.has(client.userId)) {
          map.set(client.userId, {
            partnerId: client.userId,
            unread: 0,
          });
        }
      });

    return Array.from(map.values()).sort((a, b) => {
      const at = a.lastMsg ? getMessageTime(a.lastMsg) : 0;
      const bt = b.lastMsg ? getMessageTime(b.lastMsg) : 0;

      return bt - at;
    });
  }, [db, user]);

  const openChat = (clientId: string) => {
    router.push(`/chat/${clientId}`);
  };

  const openClientProfile = (clientId: string) => {
    router.push({
      pathname: "/client/[id]",
      params: { id: clientId },
    } as any);
  };

  return (
    <ScreenContainer>
      <FlatList
        data={threads}
        keyExtractor={(item) => item.partnerId}
        contentContainerStyle={{ paddingVertical: 8, gap: 10 }}
        ListEmptyComponent={
          <AppEmptyState
            title={t("messages.noConversations")}
            message={t("messages.addClientFirst")}
            icon={<MessageCircle color={theme.colors.textMuted} size={36} />}
          />
        }
        renderItem={({ item }) => {
          const client = db?.users.find((userItem) => userItem.id === item.partnerId);

          if (!client) return null;

          return (
            <AppCard variant="outline">
              <View style={{ gap: 12 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Pressable onPress={() => openClientProfile(item.partnerId)}>
                    <AppAvatar
                      uri={toAbsoluteUrl(client.avatarUrl)}
                      name={client.name}
                      size={48}
                    />
                  </Pressable>

                  <Pressable
                    onPress={() => openClientProfile(item.partnerId)}
                    style={{ flex: 1 }}
                  >
                    <AppText variant="bodyStrong">{client.name}</AppText>

                    <AppText
                      variant="small"
                      color={theme.colors.textMuted}
                      numberOfLines={1}
                    >
                      {getLastMessagePreview(item.lastMsg, L)}
                    </AppText>
                  </Pressable>

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

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <AppButton
                      title={L.openChat}
                      icon={
                        <MessageCircle
                          size={16}
                          color={theme.colors.primaryContrast}
                        />
                      }
                      onPress={() => openChat(item.partnerId)}
                      fullWidth
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <AppButton
                      title={L.viewProfile}
                      variant="secondary"
                      icon={<UserRound size={16} color={theme.colors.text} />}
                      onPress={() => openClientProfile(item.partnerId)}
                      fullWidth
                    />
                  </View>
                </View>
              </View>
            </AppCard>
          );
        }}
      />
    </ScreenContainer>
  );
}