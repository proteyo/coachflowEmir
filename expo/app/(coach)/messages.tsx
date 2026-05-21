import { router } from "expo-router";
import { MessageCircle, UserRound } from "lucide-react-native";
import React, { useEffect, useMemo, useRef } from "react";
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
import { Message } from "@/src/types/models";

type AppLangCode = "en" | "ru" | "kk";

type TextLabels = {
  openChat: string;
  viewProfile: string;
  voiceMessage: string;
  tapToStart: string;
  onlineNow: string;
  lastSeenPrefix: string;
  lastSeenUnavailable: string;
  lastSeenAfterActivity: string;
};

const TEXT: Record<AppLangCode, TextLabels> = {
  en: {
    openChat: "Open chat",
    viewProfile: "View profile",
    voiceMessage: "Voice message",
    tapToStart: "Tap to start a conversation",
    onlineNow: "Online now",
    lastSeenPrefix: "Last seen",
    lastSeenUnavailable: "Last seen unavailable",
    lastSeenAfterActivity: "Last seen will appear after activity",
  },
  ru: {
    openChat: "Открыть чат",
    viewProfile: "Посмотреть профиль",
    voiceMessage: "Голосовое сообщение",
    tapToStart: "Нажмите, чтобы начать переписку",
    onlineNow: "В сети",
    lastSeenPrefix: "Был(а) в сети",
    lastSeenUnavailable: "Время активности недоступно",
    lastSeenAfterActivity: "Статус появится после активности",
  },
  kk: {
    openChat: "Чатты ашу",
    viewProfile: "Профильді көру",
    voiceMessage: "Дауыстық хабарлама",
    tapToStart: "Хат алмасуды бастау үшін басыңыз",
    onlineNow: "Желіде",
    lastSeenPrefix: "Соңғы белсенділік",
    lastSeenUnavailable: "Белсенділік уақыты қолжетімсіз",
    lastSeenAfterActivity: "Белсенділіктен кейін статус шығады",
  },
};

function getLangSafe(lang: string): AppLangCode {
  if (lang === "ru" || lang === "kk" || lang === "en") {
    return lang;
  }

  return "en";
}

function getMessageTime(message: Message | undefined) {
  if (!message) return 0;

  const time = new Date(message.createdAt).getTime();

  if (!Number.isNaN(time)) {
    return time;
  }

  const idNumber = Number(String(message.id ?? "").replace(/\D/g, ""));

  return Number.isNaN(idNumber) ? 0 : idNumber;
}

function getLastMessagePreview(message: Message | undefined, labels: TextLabels) {
  if (!message) {
    return labels.tapToStart;
  }

  if (message.messageType === "voice") {
    return labels.voiceMessage;
  }

  const content = String(message.content ?? "").trim();

  if (!content) {
    return labels.tapToStart;
  }

  if (content.toLowerCase() === "voice message") {
    return labels.voiceMessage;
  }

  return content;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatLastSeen(value: string | null | undefined, labels: TextLabels) {
  if (!value) {
    return labels.lastSeenAfterActivity;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return labels.lastSeenUnavailable;
  }

  const time = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isSameDay(date, new Date())) {
    return `${labels.lastSeenPrefix} ${time}`;
  }

  return `${labels.lastSeenPrefix} ${date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  })} ${time}`;
}

function isCurrentUserMessage(message: Message, userId: string) {
  return message.senderId === userId || message.receiverId === userId;
}

function getOtherUserId(message: Message, userId: string) {
  if (message.senderId === userId) {
    return message.receiverId;
  }

  return message.senderId;
}

export default function CoachMessages() {
  const { theme } = useTheme();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { db, refreshFromBackend } = useData();

  const refreshRef = useRef(refreshFromBackend);

  const currentLang = getLangSafe(lang);
  const L = TEXT[currentLang];

  useEffect(() => {
    refreshRef.current = refreshFromBackend;
  }, [refreshFromBackend]);

  useEffect(() => {
    refreshRef.current();

    const interval = setInterval(() => {
      refreshRef.current();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const threads = useMemo(() => {
    if (!db || !user) return [];

    const map = new Map<
      string,
      {
        partnerId: string;
        lastMsg?: Message;
        unread: number;
      }
    >();

    db.messages
      .filter((message) => isCurrentUserMessage(message, user.id))
      .forEach((message) => {
        const other = getOtherUserId(message, user.id);

        if (!other) return;

        const prev = map.get(other);
        const unread = prev?.unread ?? 0;
        const isUnread = message.receiverId === user.id && !message.read;

        const prevTime = getMessageTime(prev?.lastMsg);
        const currentTime = getMessageTime(message);

        map.set(other, {
          partnerId: other,
          lastMsg:
            !prev?.lastMsg || currentTime > prevTime
              ? message
              : prev.lastMsg,
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
      const at = getMessageTime(a.lastMsg);
      const bt = getMessageTime(b.lastMsg);

      return bt - at;
    });
  }, [db, user]);

  const openChat = (clientId: string) => {
    if (!clientId) return;

    router.push(`/chat/${clientId}`);
  };

  const openClientProfile = (clientId: string) => {
    if (!clientId) return;

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
          const client = db?.users.find(
            (userItem) => userItem.id === item.partnerId,
          );

          if (!client) return null;

          const online = Boolean(client.isOnline);
          const presenceText = online
            ? L.onlineNow
            : formatLastSeen(client.lastSeenAt, L);

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
                    <View>
                      <AppAvatar
                        uri={toAbsoluteUrl(client.avatarUrl)}
                        name={client.name}
                        size={48}
                      />

                      <View
                        style={{
                          position: "absolute",
                          right: 0,
                          bottom: 1,
                          width: 13,
                          height: 13,
                          borderRadius: 7,
                          backgroundColor: online ? "#22C55E" : "#9CA3AF",
                          borderWidth: 2,
                          borderColor: "#FFFFFF",
                        }}
                      />
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={() => openClientProfile(item.partnerId)}
                    style={{ flex: 1 }}
                  >
                    <AppText variant="bodyStrong">{client.name}</AppText>

                    <AppText
                      variant="caption"
                      color={online ? "#22C55E" : theme.colors.textMuted}
                      numberOfLines={1}
                      style={{ marginTop: 2 }}
                    >
                      {presenceText}
                    </AppText>

                    <AppText
                      variant="small"
                      color={theme.colors.textMuted}
                      numberOfLines={1}
                      style={{ marginTop: 4 }}
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