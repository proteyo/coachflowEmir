import { router } from "expo-router";
import { Check, MessageCircle, UserPlus, X } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, View } from "react-native";

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
import { apiGet, apiPost, toAbsoluteUrl } from "@/src/services/api";
import { Message } from "@/src/types/models";

type AppLangCode = "en" | "ru" | "kk";

type ClientInvite = {
  id: string;
  coachId: string;
  clientId: string;
  email: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  respondedAt?: string | null;
  coachName?: string | null;
  clientName?: string | null;
};

type ClientMessagesLabels = {
  defaultCoachName: string;
  noCoachTitle: string;
  noCoachMessage: string;
  coachInvites: string;
  coachWantsToAdd: string;
  inviteDescription: string;
  accepting: string;
  rejecting: string;
  accept: string;
  reject: string;
  inviteAcceptedTitle: string;
  inviteAcceptedMessage: string;
  inviteRejectedTitle: string;
  inviteRejectedMessage: string;
  inviteErrorTitle: string;
  acceptInviteError: string;
  rejectInviteError: string;
  sayHi: string;
  voiceMessage: string;
  viewCoachProfile: string;
  openChat: string;
  defaultSpecialty: string;
  noBio: string;
  achievements: string;
  onlineNow: string;
  lastSeenPrefix: string;
  lastSeenUnavailable: string;
  lastSeenAfterActivity: string;
};

const CLIENT_MESSAGES_TEXT: Record<AppLangCode, ClientMessagesLabels> = {
  en: {
    defaultCoachName: "Coach",
    noCoachTitle: "No coach yet",
    noCoachMessage:
      "When a coach links your account, you will see messages and profile details here.",
    coachInvites: "Coach invites",
    coachWantsToAdd: "{name} wants to add you as a client",
    inviteDescription:
      "Accept the invite if you want this coach to manage your workouts, supplements and progress.",
    accepting: "Accepting...",
    rejecting: "Rejecting...",
    accept: "Accept",
    reject: "Reject",
    inviteAcceptedTitle: "Invite accepted",
    inviteAcceptedMessage: "You are now linked with this coach.",
    inviteRejectedTitle: "Invite rejected",
    inviteRejectedMessage: "The invite was rejected.",
    inviteErrorTitle: "Invite error",
    acceptInviteError: "Could not accept invite.",
    rejectInviteError: "Could not reject invite.",
    sayHi: "Say hi to your coach",
    voiceMessage: "Voice message",
    viewCoachProfile: "View coach profile",
    openChat: "Open chat",
    defaultSpecialty: "Personal Trainer",
    noBio: "This coach has not added a description yet.",
    achievements: "Achievements",
    onlineNow: "Online now",
    lastSeenPrefix: "Last seen",
    lastSeenUnavailable: "Last seen unavailable",
    lastSeenAfterActivity: "Last seen will appear after activity",
  },
  ru: {
    defaultCoachName: "Тренер",
    noCoachTitle: "Тренер ещё не подключён",
    noCoachMessage:
      "Когда тренер привяжет ваш аккаунт, здесь появятся сообщения и информация о нём.",
    coachInvites: "Приглашения от тренеров",
    coachWantsToAdd: "{name} хочет добавить вас как клиента",
    inviteDescription:
      "Примите приглашение, если хотите, чтобы этот тренер управлял вашими тренировками, добавками и прогрессом.",
    accepting: "Принятие...",
    rejecting: "Отклонение...",
    accept: "Принять",
    reject: "Отклонить",
    inviteAcceptedTitle: "Приглашение принято",
    inviteAcceptedMessage: "Теперь вы связаны с этим тренером.",
    inviteRejectedTitle: "Приглашение отклонено",
    inviteRejectedMessage: "Приглашение было отклонено.",
    inviteErrorTitle: "Ошибка приглашения",
    acceptInviteError: "Не удалось принять приглашение.",
    rejectInviteError: "Не удалось отклонить приглашение.",
    sayHi: "Напишите тренеру",
    voiceMessage: "Голосовое сообщение",
    viewCoachProfile: "Посмотреть профиль тренера",
    openChat: "Открыть чат",
    defaultSpecialty: "Персональный тренер",
    noBio: "Этот тренер ещё не добавил описание.",
    achievements: "Достижения",
    onlineNow: "В сети",
    lastSeenPrefix: "Был(а) в сети",
    lastSeenUnavailable: "Время активности недоступно",
    lastSeenAfterActivity: "Статус появится после активности",
  },
  kk: {
    defaultCoachName: "Жаттықтырушы",
    noCoachTitle: "Жаттықтырушы әлі қосылмаған",
    noCoachMessage:
      "Жаттықтырушы аккаунтыңызды байланыстырған кезде, мұнда хабарламалар мен профиль ақпараты шығады.",
    coachInvites: "Жаттықтырушылардан шақырулар",
    coachWantsToAdd: "{name} сізді клиент ретінде қосқысы келеді",
    inviteDescription:
      "Бұл жаттықтырушы жаттығуларыңызды, қоспаларыңызды және прогресіңізді басқарсын десеңіз, шақыруды қабылдаңыз.",
    accepting: "Қабылдануда...",
    rejecting: "Бас тартылуда...",
    accept: "Қабылдау",
    reject: "Бас тарту",
    inviteAcceptedTitle: "Шақыру қабылданды",
    inviteAcceptedMessage: "Енді сіз осы жаттықтырушымен байланыстырылдыңыз.",
    inviteRejectedTitle: "Шақыру қабылданбады",
    inviteRejectedMessage: "Шақырудан бас тартылды.",
    inviteErrorTitle: "Шақыру қатесі",
    acceptInviteError: "Шақыруды қабылдау мүмкін болмады.",
    rejectInviteError: "Шақырудан бас тарту мүмкін болмады.",
    sayHi: "Жаттықтырушыға жазыңыз",
    voiceMessage: "Дауыс хабарламасы",
    viewCoachProfile: "Жаттықтырушы профилін көру",
    openChat: "Чатты ашу",
    defaultSpecialty: "Жеке жаттықтырушы",
    noBio: "Бұл жаттықтырушы әлі сипаттама қоспаған.",
    achievements: "Жетістіктер",
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

function getLocale(lang: AppLangCode) {
  if (lang === "ru") return "ru-RU";
  if (lang === "kk") return "kk-KZ";

  return "en-US";
}

function normalizeText(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function isDefaultSpecialty(value?: string | null) {
  const normalized = normalizeText(value);

  return (
    !normalized ||
    normalized === "personal_trainer" ||
    normalized === "personal_training" ||
    normalized === "trainer" ||
    normalized === "coach" ||
    normalized === "персональный_тренер" ||
    normalized === "жеке_жаттықтырушы"
  );
}

function getSpecialtyLabel(value: string | undefined | null, lang: AppLangCode) {
  if (isDefaultSpecialty(value)) {
    return CLIENT_MESSAGES_TEXT[lang].defaultSpecialty;
  }

  return value ?? CLIENT_MESSAGES_TEXT[lang].defaultSpecialty;
}

function getMessagePreview(message: Message | undefined, lang: AppLangCode) {
  if (!message) {
    return CLIENT_MESSAGES_TEXT[lang].sayHi;
  }

  if (message.messageType === "voice") {
    return CLIENT_MESSAGES_TEXT[lang].voiceMessage;
  }

  const content = String(message.content ?? "").trim();
  const normalized = normalizeText(content);

  if (
    normalized === "voice_message" ||
    normalized === "voice" ||
    normalized === "audio_message" ||
    normalized === "дауыс_хабарламасы" ||
    normalized === "голосовое_сообщение"
  ) {
    return CLIENT_MESSAGES_TEXT[lang].voiceMessage;
  }

  return content || CLIENT_MESSAGES_TEXT[lang].sayHi;
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

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatLastSeen(
  value: string | null | undefined,
  labels: ClientMessagesLabels,
  lang: AppLangCode,
) {
  if (!value) {
    return labels.lastSeenAfterActivity;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return labels.lastSeenUnavailable;
  }

  const locale = getLocale(lang);

  const time = date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (isSameDay(date, new Date())) {
    return `${labels.lastSeenPrefix} ${time}`;
  }

  const dayMonth = date.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
  });

  return `${labels.lastSeenPrefix} ${dayMonth} ${time}`;
}

export default function ClientMessages() {
  const { theme } = useTheme();
  const { t, lang } = useI18n();
  const { user, token } = useAuth();
  const { db, refreshFromBackend } = useData();

  const refreshRef = useRef(refreshFromBackend);

  const currentLang = getLangSafe(lang);
  const L = CLIENT_MESSAGES_TEXT[currentLang];

  const [invites, setInvites] = useState<ClientInvite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState<boolean>(false);
  const [processingInviteId, setProcessingInviteId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    refreshRef.current = refreshFromBackend;
  }, [refreshFromBackend]);

  const loadInvites = useCallback(async () => {
    if (!token || user?.role !== "client") return;

    try {
      setLoadingInvites(true);

      const res = await apiGet("/clients/invites/me", { token });

      setInvites(Array.isArray(res) ? res : []);
    } catch (e) {
      console.log("[client-messages] load invites error", e);
    } finally {
      setLoadingInvites(false);
    }
  }, [token, user?.role]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  useEffect(() => {
    refreshRef.current();

    const interval = setInterval(() => {
      refreshRef.current();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const data = useMemo(() => {
    if (!db || !user) return null;

    const profile = db.clientProfiles.find((client) => client.userId === user.id);

    const coach = profile?.coachId
      ? db.users.find((userItem) => userItem.id === profile.coachId)
      : null;

    const coachProfile = profile?.coachId
      ? db.coachProfiles.find((profileItem) => profileItem.userId === profile.coachId)
      : null;

    const lastMsg = coach
      ? db.messages
          .filter(
            (message) =>
              (message.senderId === user.id && message.receiverId === coach.id) ||
              (message.senderId === coach.id && message.receiverId === user.id),
          )
          .slice()
          .sort((a, b) => getMessageTime(b) - getMessageTime(a))[0]
      : undefined;

    return {
      profile,
      coach,
      coachProfile,
      lastMsg,
    };
  }, [db, user]);

  const acceptInvite = async (inviteId: string) => {
    if (!token || processingInviteId) return;

    try {
      setProcessingInviteId(inviteId);

      await apiPost(`/clients/invites/${inviteId}/accept`, undefined, {
        token,
      });

      await refreshFromBackend();
      await loadInvites();

      Alert.alert(L.inviteAcceptedTitle, L.inviteAcceptedMessage);
    } catch (e: any) {
      console.log("[client-messages] accept invite error", e);

      Alert.alert(L.inviteErrorTitle, e?.message || L.acceptInviteError);
    } finally {
      setProcessingInviteId(null);
    }
  };

  const rejectInvite = async (inviteId: string) => {
    if (!token || processingInviteId) return;

    try {
      setProcessingInviteId(inviteId);

      await apiPost(`/clients/invites/${inviteId}/reject`, undefined, {
        token,
      });

      await refreshFromBackend();
      await loadInvites();

      Alert.alert(L.inviteRejectedTitle, L.inviteRejectedMessage);
    } catch (e: any) {
      console.log("[client-messages] reject invite error", e);

      Alert.alert(L.inviteErrorTitle, e?.message || L.rejectInviteError);
    } finally {
      setProcessingInviteId(null);
    }
  };

  const openCoachProfile = () => {
    if (!data?.coach) return;

    router.push({
      pathname: "/coach/[id]",
      params: { id: data.coach.id },
    } as any);
  };

  const openChat = () => {
    if (!data?.coach?.id) return;

    router.push(`/chat/${data.coach.id}`);
  };

  const pendingInvites = invites.filter((invite) => invite.status === "pending");

  if (!db || !user || !data) {
    return null;
  }

  if (!data.coach) {
    return (
      <ScreenContainer scroll>
        <View style={{ gap: 12 }}>
          {pendingInvites.length > 0 ? (
            <>
              <AppText variant="title">{L.coachInvites}</AppText>

              {pendingInvites.map((invite) => {
                const isProcessing = processingInviteId === invite.id;
                const coachName = invite.coachName ?? L.defaultCoachName;

                return (
                  <AppCard key={invite.id} variant="elevated">
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: 16,
                          backgroundColor: theme.colors.surfaceAlt,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <UserPlus color={theme.colors.primary} size={22} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <AppText variant="bodyStrong">
                          {L.coachWantsToAdd.replace("{name}", coachName)}
                        </AppText>

                        <AppText
                          variant="small"
                          color={theme.colors.textMuted}
                          style={{ marginTop: 4 }}
                        >
                          {L.inviteDescription}
                        </AppText>
                      </View>
                    </View>

                    <View
                      style={{
                        flexDirection: "row",
                        gap: 10,
                        marginTop: 14,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <AppButton
                          title={isProcessing ? L.accepting : L.accept}
                          icon={
                            <Check
                              size={16}
                              color={theme.colors.primaryContrast}
                            />
                          }
                          onPress={() => acceptInvite(invite.id)}
                          fullWidth
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <AppButton
                          title={isProcessing ? L.rejecting : L.reject}
                          variant="secondary"
                          icon={<X size={16} color={theme.colors.text} />}
                          onPress={() => rejectInvite(invite.id)}
                          fullWidth
                        />
                      </View>
                    </View>
                  </AppCard>
                );
              })}
            </>
          ) : (
            <AppEmptyState
              title={L.noCoachTitle}
              message={L.noCoachMessage}
              icon={<MessageCircle color={theme.colors.textMuted} size={36} />}
            />
          )}

          {loadingInvites ? (
            <AppText variant="small" color={theme.colors.textMuted}>
              {t("common.loading")}
            </AppText>
          ) : null}
        </View>
      </ScreenContainer>
    );
  }

  const coachSpecialty = getSpecialtyLabel(
    data.coachProfile?.specialty,
    currentLang,
  );

  const coachBio = data.coachProfile?.bio?.trim() || L.noBio;

  const lastMessagePreview = getMessagePreview(data.lastMsg, currentLang);

  const coachOnline = Boolean(data.coach.isOnline);
  const coachPresenceText = coachOnline
    ? L.onlineNow
    : formatLastSeen(data.coach.lastSeenAt, L, currentLang);

  return (
    <ScreenContainer scroll>
      <View style={{ gap: 12 }}>
        {pendingInvites.length > 0 ? (
          <View style={{ gap: 12 }}>
            <AppText variant="title">{L.coachInvites}</AppText>

            {pendingInvites.map((invite) => {
              const isProcessing = processingInviteId === invite.id;
              const coachName = invite.coachName ?? L.defaultCoachName;

              return (
                <AppCard key={invite.id} variant="elevated">
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 16,
                        backgroundColor: theme.colors.surfaceAlt,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <UserPlus color={theme.colors.primary} size={22} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyStrong">
                        {L.coachWantsToAdd.replace("{name}", coachName)}
                      </AppText>

                      <AppText
                        variant="small"
                        color={theme.colors.textMuted}
                        style={{ marginTop: 4 }}
                      >
                        {L.inviteDescription}
                      </AppText>
                    </View>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      gap: 10,
                      marginTop: 14,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <AppButton
                        title={isProcessing ? L.accepting : L.accept}
                        icon={
                          <Check
                            size={16}
                            color={theme.colors.primaryContrast}
                          />
                        }
                        onPress={() => acceptInvite(invite.id)}
                        fullWidth
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <AppButton
                        title={isProcessing ? L.rejecting : L.reject}
                        variant="secondary"
                        icon={<X size={16} color={theme.colors.text} />}
                        onPress={() => rejectInvite(invite.id)}
                        fullWidth
                      />
                    </View>
                  </View>
                </AppCard>
              );
            })}
          </View>
        ) : null}

        <Pressable onPress={openChat}>
          <AppCard variant="elevated">
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View>
                <AppAvatar
                  uri={toAbsoluteUrl(
                    data.coachProfile?.profileImageUrl ?? data.coach.avatarUrl,
                  )}
                  name={data.coach.name}
                  size={56}
                  ring
                />

                <View
                  style={{
                    position: "absolute",
                    right: 0,
                    bottom: 1,
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: coachOnline ? "#22C55E" : "#9CA3AF",
                    borderWidth: 2,
                    borderColor: "#FFFFFF",
                  }}
                />
              </View>

              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{data.coach.name}</AppText>

                <AppText
                  variant="caption"
                  color={coachOnline ? "#22C55E" : theme.colors.textMuted}
                  numberOfLines={1}
                  style={{ marginTop: 2 }}
                >
                  {coachPresenceText}
                </AppText>

                <AppText
                  variant="small"
                  color={theme.colors.textMuted}
                  numberOfLines={1}
                  style={{ marginTop: 4 }}
                >
                  {lastMessagePreview}
                </AppText>
              </View>
            </View>
          </AppCard>
        </Pressable>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <AppButton
              title={L.openChat}
              onPress={openChat}
              icon={
                <MessageCircle
                  size={16}
                  color={theme.colors.primaryContrast}
                />
              }
              fullWidth
            />
          </View>

          <View style={{ flex: 1 }}>
            <AppButton
              title={L.viewCoachProfile}
              variant="secondary"
              onPress={openCoachProfile}
              fullWidth
            />
          </View>
        </View>

        <AppCard variant="outline">
          <AppText variant="h3">{data.coach.name}</AppText>

          <AppText
            variant="small"
            color={theme.colors.textMuted}
            style={{ marginTop: 4 }}
          >
            {coachSpecialty}
          </AppText>

          <AppText
            variant="caption"
            color={coachOnline ? "#22C55E" : theme.colors.textMuted}
            style={{ marginTop: 6 }}
          >
            {coachPresenceText}
          </AppText>

          <AppText variant="small" style={{ marginTop: 8 }}>
            {coachBio}
          </AppText>

          {(data.coachProfile?.achievements ?? []).length > 0 ? (
            <View style={{ marginTop: 14, gap: 8 }}>
              <AppText variant="bodyStrong">{L.achievements}</AppText>

              <View
                style={{
                  flexDirection: "row",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {(data.coachProfile?.achievements ?? []).map((achievement) => (
                  <View
                    key={achievement}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      backgroundColor: theme.colors.surfaceAlt,
                      borderRadius: 999,
                    }}
                  >
                    <AppText variant="caption">{achievement}</AppText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </AppCard>

        <View style={{ height: 24 }} />
      </View>
    </ScreenContainer>
  );
}