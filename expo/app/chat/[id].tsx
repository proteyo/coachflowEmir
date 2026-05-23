import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  Check,
  CheckCheck,
  ChevronLeft,
  Mic,
  Palette,
  Pause,
  Play,
  Send,
  Sparkles,
  X,
} from "lucide-react-native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppAvatar, AppText } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { useI18n } from "@/src/i18n/I18nContext";
import {
  apiGet,
  apiPost,
  apiUploadFile,
  toAbsoluteUrl,
} from "@/src/services/api";
import { Message } from "@/src/types/models";

type ChatListItem =
  | {
      kind: "date";
      id: string;
      label: string;
    }
  | {
      kind: "message";
      id: string;
      message: Message;
    };

type ChatThemeKey = "premium" | "midnight" | "energy";

type ChatThemePreset = {
  key: ChatThemeKey;
  name: string;
  shortName: string;
  background: string;
  header: string;
  surface: string;
  surfaceSoft: string;
  mine: string;
  mineText: string;
  partner: string;
  partnerText: string;
  accent: string;
  accentText: string;
  accentSoft: string;
  border: string;
  shadow: string;
  input: string;
};

type ChatTexts = {
  today: string;
  yesterday: string;
  sending: string;
  sent: string;
  read: string;
  onlineNow: string;
  recentlyOnline: string;
  lastSeenPrefix: string;
  lastSeenUnavailable: string;
  lastSeenAfterActivity: string;
  startConversation: string;
  chooseTheme: string;
  recording: string;
  voiceErrorTitle: string;
  voiceStartError: string;
  voiceSendError: string;
  messageErrorTitle: string;
  messageSendError: string;
};

const CHAT_THEME_STORAGE_KEY = "coachflow:chat-theme-key";

const CHAT_THEMES: ChatThemePreset[] = [
  {
    key: "premium",
    name: "Premium Glass",
    shortName: "Glass",
    background: "#07111F",
    header: "rgba(7,17,31,0.97)",
    surface: "rgba(255,255,255,0.08)",
    surfaceSoft: "rgba(255,255,255,0.13)",
    mine: "#6D5DF6",
    mineText: "#FFFFFF",
    partner: "rgba(255,255,255,0.10)",
    partnerText: "#F7FAFC",
    accent: "#58E6C2",
    accentText: "#06131F",
    accentSoft: "rgba(88,230,194,0.16)",
    border: "rgba(255,255,255,0.14)",
    shadow: "rgba(109,93,246,0.35)",
    input: "rgba(255,255,255,0.08)",
  },
  {
    key: "midnight",
    name: "Midnight Coach",
    shortName: "Night",
    background: "#050816",
    header: "rgba(5,8,22,0.97)",
    surface: "rgba(18,24,45,0.95)",
    surfaceSoft: "rgba(33,43,75,0.9)",
    mine: "#2F80ED",
    mineText: "#FFFFFF",
    partner: "#111827",
    partnerText: "#FFFFFF",
    accent: "#F2C94C",
    accentText: "#090B12",
    accentSoft: "rgba(242,201,76,0.16)",
    border: "rgba(255,255,255,0.10)",
    shadow: "rgba(47,128,237,0.35)",
    input: "rgba(255,255,255,0.075)",
  },
  {
    key: "energy",
    name: "Energy Orange",
    shortName: "Energy",
    background: "#130B07",
    header: "rgba(19,11,7,0.97)",
    surface: "rgba(255,255,255,0.08)",
    surfaceSoft: "rgba(255,255,255,0.13)",
    mine: "#FF7A1A",
    mineText: "#FFFFFF",
    partner: "rgba(255,255,255,0.11)",
    partnerText: "#FFF8F2",
    accent: "#FFD166",
    accentText: "#211100",
    accentSoft: "rgba(255,209,102,0.18)",
    border: "rgba(255,255,255,0.15)",
    shadow: "rgba(255,122,26,0.35)",
    input: "rgba(255,255,255,0.08)",
  },
];

function isValidChatThemeKey(value: string | null): value is ChatThemeKey {
  return value === "premium" || value === "midnight" || value === "energy";
}

function getChatTexts(lang?: string): ChatTexts {
  if (lang === "ru") {
    return {
      today: "Сегодня",
      yesterday: "Вчера",
      sending: "отправка",
      sent: "отправлено",
      read: "прочитано",
      onlineNow: "В сети",
      recentlyOnline: "Недавно был(а) в сети",
      lastSeenPrefix: "Был(а) в сети",
      lastSeenUnavailable: "Время активности недоступно",
      lastSeenAfterActivity: "Статус появится после активности",
      startConversation:
        "Начните переписку. Здесь будут сообщения и голосовые записи.",
      chooseTheme: "Тема чата",
      recording: "Идёт запись",
      voiceErrorTitle: "Ошибка голосового сообщения",
      voiceStartError: "Не удалось начать запись.",
      voiceSendError: "Не удалось отправить голосовое сообщение.",
      messageErrorTitle: "Ошибка сообщения",
      messageSendError: "Не удалось отправить сообщение. Попробуйте ещё раз.",
    };
  }

  if (lang === "kk") {
    return {
      today: "Бүгін",
      yesterday: "Кеше",
      sending: "жіберілуде",
      sent: "жіберілді",
      read: "оқылды",
      onlineNow: "Желіде",
      recentlyOnline: "Жақында желіде болды",
      lastSeenPrefix: "Соңғы белсенділік",
      lastSeenUnavailable: "Белсенділік уақыты қолжетімсіз",
      lastSeenAfterActivity: "Белсенділіктен кейін статус шығады",
      startConversation:
        "Хатты бастаңыз. Мұнда хабарламалар мен дауыс жазбалары көрсетіледі.",
      chooseTheme: "Чат тақырыбы",
      recording: "Жазылып жатыр",
      voiceErrorTitle: "Дауыс хабарламасы қатесі",
      voiceStartError: "Жазуды бастау мүмкін болмады.",
      voiceSendError: "Дауыс хабарламасын жіберу мүмкін болмады.",
      messageErrorTitle: "Хабарлама қатесі",
      messageSendError: "Хабарламаны жіберу мүмкін болмады. Қайталап көріңіз.",
    };
  }

  return {
    today: "Today",
    yesterday: "Yesterday",
    sending: "sending",
    sent: "sent",
    read: "read",
    onlineNow: "Online now",
    recentlyOnline: "Online recently",
    lastSeenPrefix: "Last seen",
    lastSeenUnavailable: "Last seen unavailable",
    lastSeenAfterActivity: "Last seen will appear after activity",
    startConversation:
      "Start a clean coach-client conversation. Text and voice messages will appear here.",
    chooseTheme: "Chat theme",
    recording: "Recording",
    voiceErrorTitle: "Voice error",
    voiceStartError: "Could not start recording.",
    voiceSendError: "Could not send voice message.",
    messageErrorTitle: "Message error",
    messageSendError: "Could not send message. Please try again.",
  };
}

function arr(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.messages)) return value.messages;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.results)) return value.results;

  return [];
}

function normalizeMessage(message: any): Message {
  const receiverValue = message.receiverId ?? message.receiver_id ?? null;

  return {
    id: String(message.id),
    senderId: String(message.senderId ?? message.sender_id),
    receiverId: receiverValue ? String(receiverValue) : null,
    content: message.content ?? "",
    messageType: message.messageType ?? message.message_type ?? "text",
    voiceUrl: message.voiceUrl ?? message.voice_url ?? undefined,
    voiceDurationMs:
      message.voiceDurationMs ?? message.voice_duration_ms ?? undefined,
    read: Boolean(message.read),
    createdAt:
      message.createdAt ?? message.created_at ?? new Date().toISOString(),
  };
}

function fmtDur(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);

  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function getMessageTime(msg: Message) {
  const time = new Date(msg.createdAt).getTime();

  if (!Number.isNaN(time)) {
    return time;
  }

  const idNumber = Number(String(msg.id).replace(/\D/g, ""));

  return Number.isNaN(idNumber) ? 0 : idNumber;
}

function getDateTime(value?: string | null) {
  if (!value) return 0;

  const time = new Date(value).getTime();

  return Number.isNaN(time) ? 0 : time;
}

function getMessageDate(msg: Message) {
  const time = getMessageTime(msg);

  if (!time) {
    return new Date();
  }

  const date = new Date(time);

  if (Number.isNaN(date.getTime())) {
    return new Date();
  }

  return date;
}

function getDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isSameDay(a: Date, b: Date) {
  return getDayKey(a) === getDayKey(b);
}

function getDateSeparatorLabel(date: Date, texts: ChatTexts) {
  const today = new Date();

  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) {
    return texts.today;
  }

  if (isSameDay(date, yesterday)) {
    return texts.yesterday;
  }

  const sameYear = date.getFullYear() === today.getFullYear();

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function buildChatItems(messages: Message[], texts: ChatTexts): ChatListItem[] {
  const result: ChatListItem[] = [];
  let lastDayKey = "";

  messages.forEach((message) => {
    const date = getMessageDate(message);
    const dayKey = getDayKey(date);

    if (dayKey !== lastDayKey) {
      result.push({
        kind: "date",
        id: `date_${dayKey}`,
        label: getDateSeparatorLabel(date, texts),
      });

      lastDayKey = dayKey;
    }

    result.push({
      kind: "message",
      id: message.id,
      message,
    });
  });

  return result;
}

function formatLastSeen(value: string | null | undefined, texts: ChatTexts) {
  if (!value) {
    return texts.lastSeenAfterActivity;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return texts.lastSeenUnavailable;
  }

  const sameDay = isSameDay(date, new Date());
  const time = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (sameDay) {
    return `${texts.lastSeenPrefix} ${time}`;
  }

  return `${texts.lastSeenPrefix} ${date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  })} ${time}`;
}

function isConversationMessage(
  message: Message,
  userId: string,
  partnerId: string,
) {
  return (
    (message.senderId === userId && message.receiverId === partnerId) ||
    (message.senderId === partnerId && message.receiverId === userId)
  );
}

function applyReadReceiptsFromPartnerActivity(
  messages: Message[],
  userId: string,
  partnerId: string,
  partnerLastSeenAt?: string | null,
): Message[] {
  const conversationMessages = messages.filter((message) =>
    isConversationMessage(message, userId, partnerId),
  );

  const latestPartnerMessageTime = conversationMessages
    .filter((message) => message.senderId === partnerId)
    .reduce((latest, message) => {
      const time = getMessageTime(message);
      return time > latest ? time : latest;
    }, 0);

  const latestPartnerSeenTime = getDateTime(partnerLastSeenAt);

  const latestPartnerActivityTime = Math.max(
    latestPartnerMessageTime,
    latestPartnerSeenTime,
  );

  if (latestPartnerActivityTime <= 0) {
    return messages;
  }

  return messages.map((message) => {
    if (!isConversationMessage(message, userId, partnerId)) {
      return message;
    }

    if (message.senderId !== userId) {
      return message;
    }

    if (message.read) {
      return message;
    }

    const messageTime = getMessageTime(message);

    if (messageTime > 0 && messageTime <= latestPartnerActivityTime) {
      return {
        ...message,
        read: true,
      };
    }

    return message;
  });
}

export default function Chat() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const { t, lang } = useI18n();
  const { user, token } = useAuth();
  const { db, update, refreshFromBackend } = useData();
  const insets = useSafeAreaInsets();

  const texts = useMemo(() => getChatTexts(lang), [lang]);

  const [text, setText] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);
  const [voiceSending, setVoiceSending] = useState<boolean>(false);
  const [recordingMs, setRecordingMs] = useState<number>(0);
  const [chatThemeKey, setChatThemeKey] = useState<ChatThemeKey>("premium");
  const [themeModalOpen, setThemeModalOpen] = useState<boolean>(false);

  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const listRef = useRef<FlatList<ChatListItem>>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const presencePollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendingRef = useRef<boolean>(false);
  const voiceSendingRef = useRef<boolean>(false);
  const readMarkingRef = useRef<boolean>(false);
  const refreshFromBackendRef = useRef(refreshFromBackend);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder);

  const chatTheme = useMemo(
    () => CHAT_THEMES.find((item) => item.key === chatThemeKey) ?? CHAT_THEMES[0],
    [chatThemeKey],
  );

  const userId = user?.id;

  const screenOptions = useMemo(() => ({ headerShown: false }), []);

  const partner = db?.users.find((u) => u.id === id);

  useEffect(() => {
    AsyncStorage.getItem(CHAT_THEME_STORAGE_KEY)
      .then((savedTheme) => {
        if (isValidChatThemeKey(savedTheme)) {
          setChatThemeKey(savedTheme);
        }
      })
      .catch((error) => {
        console.log("[chat] load saved theme error", error);
      });
  }, []);

  useEffect(() => {
    sendingRef.current = sending;
  }, [sending]);

  useEffect(() => {
    voiceSendingRef.current = voiceSending;
  }, [voiceSending]);

  useEffect(() => {
    refreshFromBackendRef.current = refreshFromBackend;
  }, [refreshFromBackend]);

  const thread: Message[] = useMemo(() => {
    if (!db || !userId || !id) return [];

    return db.messages
      .filter((m) => isConversationMessage(m, userId, id))
      .slice()
      .sort((a, b) => getMessageTime(a) - getMessageTime(b));
  }, [db, userId, id]);

  const chatItems = useMemo(
    () => buildChatItems(thread, texts),
    [thread, texts],
  );

  const lastPartnerActivity = useMemo(() => {
    if (!id) return partner?.lastSeenAt ?? null;

    const lastPartnerMessage = thread
      .filter((message) => message.senderId === id)
      .slice()
      .sort((a, b) => getMessageTime(b) - getMessageTime(a))[0];

    return partner?.lastSeenAt ?? lastPartnerMessage?.createdAt ?? null;
  }, [id, partner?.lastSeenAt, thread]);

  const presence = useMemo(() => {
    const online = Boolean(partner?.isOnline);
    const label = online
      ? texts.onlineNow
      : formatLastSeen(lastPartnerActivity, texts);

    return {
      online,
      label,
    };
  }, [partner?.isOnline, lastPartnerActivity, texts]);

  const scrollToBottom = useCallback((animated = true) => {
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated });
    }, 90);
  }, []);

  const loadConversation = useCallback(
    async (markAsRead: boolean) => {
      if (!id || !userId || !token) return;

      try {
        const res = await apiGet(
          `/messages?partner_id=${id}&mark_as_read=${
            markAsRead ? "true" : "false"
          }&_=${Date.now()}`,
          { token },
        );

        const rawMessages: any[] = arr(res);
        const backendMessages: Message[] = rawMessages
          .map(normalizeMessage)
          .filter((message: Message) =>
            isConversationMessage(message, userId, id),
          );

        update((d) => {
          const mergedMessages = [
            ...d.messages.filter(
              (message: Message) =>
                !isConversationMessage(message, userId, id),
            ),
            ...backendMessages,
          ];

          return {
            ...d,
            messages: applyReadReceiptsFromPartnerActivity(
              mergedMessages,
              userId,
              id,
              partner?.lastSeenAt,
            ),
          };
        });
      } catch (e) {
        console.log("[chat] load conversation error", e);
      }
    },
    [id, userId, token, update, partner?.lastSeenAt],
  );

  const markConversationRead = useCallback(async () => {
    if (!id || !userId || !token || readMarkingRef.current) return;

    readMarkingRef.current = true;

    try {
      const res = await apiPost(
        `/messages/read-conversation?partner_id=${id}`,
        {},
        { token },
      );

      const backendMessages: Message[] = arr(res)
        .map(normalizeMessage)
        .filter((message: Message) =>
          isConversationMessage(message, userId, id),
        );

      if (backendMessages.length > 0) {
        update((d) => {
          const mergedMessages = [
            ...d.messages.filter(
              (message: Message) =>
                !isConversationMessage(message, userId, id),
            ),
            ...backendMessages,
          ];

          return {
            ...d,
            messages: applyReadReceiptsFromPartnerActivity(
              mergedMessages,
              userId,
              id,
              partner?.lastSeenAt,
            ),
          };
        });

        return;
      }

      update((d) => ({
        ...d,
        messages: d.messages.map((message: Message) =>
          message.senderId === id && message.receiverId === userId
            ? { ...message, read: true }
            : message,
        ),
      }));
    } catch (e) {
      console.log("[chat] mark conversation read error", e);
    } finally {
      readMarkingRef.current = false;
    }
  }, [id, userId, token, update, partner?.lastSeenAt]);

  useEffect(() => {
    if (!id || !userId || !partner?.lastSeenAt) return;

    update((d) => ({
      ...d,
      messages: applyReadReceiptsFromPartnerActivity(
        d.messages,
        userId,
        id,
        partner.lastSeenAt,
      ),
    }));
  }, [id, userId, partner?.lastSeenAt, update]);

  useEffect(() => {
    (async () => {
      if (Platform.OS === "web") return;

      try {
        const status = await AudioModule.requestRecordingPermissionsAsync();

        if (!status.granted) {
          console.log("[chat] mic permission denied");
        }

        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
        });
      } catch (e) {
        console.log("[chat] audio init err", e);
      }
    })();

    return () => {
      if (recordTimer.current) {
        clearInterval(recordTimer.current);
        recordTimer.current = null;
      }

      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }

      if (presencePollingRef.current) {
        clearInterval(presencePollingRef.current);
        presencePollingRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!id || !userId || !token) return;

    markConversationRead();
    loadConversation(true);
    scrollToBottom(false);

    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    pollingRef.current = setInterval(() => {
      loadConversation(true);
    }, 1500);

    if (presencePollingRef.current) {
      clearInterval(presencePollingRef.current);
    }

    presencePollingRef.current = setInterval(() => {
      refreshFromBackendRef.current();
    }, 5000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }

      if (presencePollingRef.current) {
        clearInterval(presencePollingRef.current);
        presencePollingRef.current = null;
      }
    };
  }, [
    id,
    userId,
    token,
    markConversationRead,
    loadConversation,
    scrollToBottom,
  ]);

  useEffect(() => {
    if (!id || !userId || !token) return;

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        markConversationRead();
        loadConversation(true);
        refreshFromBackendRef.current();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [id, userId, token, markConversationRead, loadConversation]);

  useEffect(() => {
    scrollToBottom(false);
  }, [chatItems.length, scrollToBottom]);

  const openPartnerProfile = () => {
  if (!id || !partner) return;

  if (partner.role === "client") {
    router.push({
      pathname: "/client/[id]",
      params: { id },
    } as any);
    return;
  }

  if (partner.role === "coach") {
    router.push({
      pathname: "/coach/[id]",
      params: { id },
    } as any);
  }
};

  const saveTheme = async (key: ChatThemeKey) => {
    setChatThemeKey(key);

    try {
      await AsyncStorage.setItem(CHAT_THEME_STORAGE_KEY, key);
    } catch (error) {
      console.log("[chat] save theme error", error);
    }
  };

  const send = async () => {
    const content = text.trim();

    if (!content || !userId || !id || !token || sendingRef.current) return;

    sendingRef.current = true;
    setText("");
    setSending(true);

    try {
      const created = await apiPost(
        "/messages",
        {
          receiver_id: id,
          content,
          message_type: "text",
        },
        { token },
      );

      const createdMessage = created?.id ? normalizeMessage(created) : null;

      if (createdMessage) {
        update((d) => ({
          ...d,
          messages: [
            ...d.messages.filter(
              (message: Message) => message.id !== createdMessage.id,
            ),
            createdMessage,
          ],
        }));
      }

      await loadConversation(false);
      scrollToBottom(true);
    } catch (e) {
      console.log("[chat] send message err", e);

      setText(content);
      Alert.alert(texts.messageErrorTitle, texts.messageSendError);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const startRecord = async () => {
    if (Platform.OS === "web") {
      Alert.alert(t("messages.voiceWebUnsupported"));
      return;
    }

    if (voiceSendingRef.current) return;

    try {
      await recorder.prepareToRecordAsync();
      recorder.record();

      setRecordingMs(0);

      recordTimer.current = setInterval(() => {
        setRecordingMs((m) => m + 100);
      }, 100);
    } catch (e) {
      console.log("[chat] start record err", e);

      Alert.alert(texts.voiceErrorTitle, texts.voiceStartError);
    }
  };

  const cancelRecord = async () => {
    try {
      if (recordTimer.current) {
        clearInterval(recordTimer.current);
      }

      recordTimer.current = null;

      await recorder.stop();

      setRecordingMs(0);
    } catch (e) {
      console.log("[chat] cancel record err", e);
    }
  };

  const stopAndSend = async () => {
    if (!userId || !id || !token || voiceSendingRef.current) return;

    try {
      if (recordTimer.current) {
        clearInterval(recordTimer.current);
      }

      recordTimer.current = null;

      await recorder.stop();

      const uri = recorder.uri;
      const duration = recordingMs;

      setRecordingMs(0);

      if (!uri) return;

      voiceSendingRef.current = true;
      setVoiceSending(true);

      const uploadRes = await apiUploadFile("/uploads/voice", uri, "file", {
        token,
      });

      const uploadedVoiceUrl = uploadRes.voiceUrl ?? uploadRes.voice_url;

      if (!uploadedVoiceUrl) {
        throw new Error("Backend did not return voice URL.");
      }

      const created = await apiPost(
        "/messages",
        {
          receiver_id: id,
          content: t("messages.voiceMessage"),
          message_type: "voice",
          voice_url: uploadedVoiceUrl,
          voice_duration_ms: duration,
        },
        { token },
      );

      const createdMessage = created?.id ? normalizeMessage(created) : null;

      if (createdMessage) {
        update((d) => ({
          ...d,
          messages: [
            ...d.messages.filter(
              (message: Message) => message.id !== createdMessage.id,
            ),
            createdMessage,
          ],
        }));
      }

      await loadConversation(false);
      scrollToBottom(true);
    } catch (e: any) {
      console.log("[chat] stop/send voice err", e);

      Alert.alert(texts.voiceErrorTitle, e?.message || texts.voiceSendError);
    } finally {
      voiceSendingRef.current = false;
      setVoiceSending(false);
    }
  };

  const isRecording = recState.isRecording;
  const canSendText = text.trim().length > 0 && !sending;
  const bottomPadding = Math.max(insets.bottom, 10);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: chatTheme.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <Stack.Screen options={screenOptions} />

      <View style={{ flex: 1, backgroundColor: chatTheme.background }}>
        <View
          style={{
            position: "absolute",
            top: 0,
            left: -95,
            width: 250,
            height: 250,
            borderRadius: 125,
            backgroundColor: chatTheme.shadow,
            opacity: 0.3,
          }}
        />

        <View
          style={{
            position: "absolute",
            top: 180,
            right: -120,
            width: 280,
            height: 280,
            borderRadius: 140,
            backgroundColor: chatTheme.accentSoft,
            opacity: 0.95,
          }}
        />

        <View
          style={{
            paddingTop: insets.top + 12,
            paddingHorizontal: 16,
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderBottomColor: chatTheme.border,
            backgroundColor: chatTheme.header,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Pressable
              onPress={() => router.back()}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: chatTheme.surface,
                borderWidth: 1,
                borderColor: chatTheme.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronLeft color="#fff" size={24} />
            </Pressable>

            <Pressable
              onPress={openPartnerProfile}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                flex: 1,
              }}
            >
              <View>
                <AppAvatar
                  uri={toAbsoluteUrl(partner?.avatarUrl)}
                  name={partner?.name}
                  size={52}
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
                    backgroundColor: presence.online ? "#24D18B" : "#8A94A6",
                    borderWidth: 2,
                    borderColor: chatTheme.background,
                  }}
                />
              </View>

              <View style={{ flex: 1 }}>
                <AppText variant="h3" color="#fff" numberOfLines={1}>
                  {partner?.name ?? t("messages.title")}
                </AppText>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 2,
                  }}
                >
                  <View
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 4,
                      backgroundColor: presence.online
                        ? chatTheme.accent
                        : "rgba(255,255,255,0.4)",
                    }}
                  />

                  <AppText
                    variant="caption"
                    color={
                      presence.online
                        ? chatTheme.accent
                        : "rgba(255,255,255,0.68)"
                    }
                    numberOfLines={1}
                  >
                    {presence.label}
                  </AppText>
                </View>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setThemeModalOpen(true)}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: chatTheme.accentSoft,
                borderWidth: 1.5,
                borderColor: chatTheme.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Palette color={chatTheme.accent} size={22} />
            </Pressable>
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={chatItems}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 16,
            gap: 8,
            flexGrow: 1,
            justifyContent: chatItems.length === 0 ? "center" : "flex-end",
          }}
          style={{ flex: 1 }}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: false })
          }
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            if (item.kind === "date") {
              return <DateSeparator label={item.label} chatTheme={chatTheme} />;
            }

            const mine = item.message.senderId === userId;

            return (
              <MessageBubble
                msg={item.message}
                mine={mine}
                chatTheme={chatTheme}
                texts={texts}
              />
            );
          }}
          ListEmptyComponent={
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 24,
                paddingVertical: 32,
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 38,
                  backgroundColor: chatTheme.surface,
                  borderWidth: 1,
                  borderColor: chatTheme.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Sparkles color={chatTheme.accent} size={30} />
              </View>

              <AppText variant="h3" color="#fff" style={{ textAlign: "center" }}>
                {partner?.name ?? t("messages.title")}
              </AppText>

              <AppText
                variant="body"
                color="rgba(255,255,255,0.68)"
                style={{ textAlign: "center" }}
              >
                {texts.startConversation}
              </AppText>
            </View>
          }
        />

        <View
          style={{
            paddingHorizontal: 12,
            paddingTop: 10,
            paddingBottom: bottomPadding,
            borderTopWidth: 1,
            borderTopColor: chatTheme.border,
            backgroundColor: "rgba(5,10,20,0.96)",
          }}
        >
          {isRecording ? (
            <RecordingComposer
              recordingMs={recordingMs}
              voiceSending={voiceSending}
              onCancel={cancelRecord}
              onSend={stopAndSend}
              chatTheme={chatTheme}
              texts={texts}
            />
          ) : (
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-end",
                gap: 8,
              }}
            >
              <View
                style={{
                  flex: 1,
                  backgroundColor: chatTheme.input,
                  borderRadius: 24,
                  paddingHorizontal: 14,
                  paddingVertical: Platform.OS === "android" ? 6 : 9,
                  minHeight: 46,
                  maxHeight: 122,
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: chatTheme.border,
                }}
              >
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder={t("messages.placeholder")}
                  placeholderTextColor="rgba(255,255,255,0.48)"
                  style={{
                    color: "#fff",
                    fontSize: 15,
                    maxHeight: 100,
                    paddingVertical: Platform.OS === "android" ? 4 : 0,
                    textAlignVertical: "center",
                  }}
                  multiline
                  autoCapitalize="sentences"
                  autoCorrect
                  returnKeyType="default"
                  submitBehavior="newline"
                  onFocus={() => scrollToBottom(true)}
                />
              </View>

              {text.trim().length > 0 ? (
                <Pressable
                  onPress={send}
                  disabled={!canSendText}
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    backgroundColor: !canSendText
                      ? "rgba(255,255,255,0.22)"
                      : chatTheme.mine,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: !canSendText ? 0.65 : 1,
                    shadowColor: chatTheme.mine,
                    shadowOpacity: 0.35,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: 6,
                  }}
                >
                  <Send color={chatTheme.mineText} size={18} />
                </Pressable>
              ) : (
                <Pressable
                  onPress={startRecord}
                  disabled={voiceSending}
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    backgroundColor: voiceSending
                      ? "rgba(255,255,255,0.22)"
                      : chatTheme.accent,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: voiceSending ? 0.65 : 1,
                    shadowColor: chatTheme.accent,
                    shadowOpacity: 0.35,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: 6,
                  }}
                >
                  <Mic color={chatTheme.accentText} size={18} />
                </Pressable>
              )}
            </View>
          )}
        </View>

        <ThemeModal
          visible={themeModalOpen}
          activeThemeKey={chatThemeKey}
          chatTheme={chatTheme}
          texts={texts}
          onClose={() => setThemeModalOpen(false)}
          onSelect={(key) => {
            saveTheme(key);
            setThemeModalOpen(false);
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function ThemeModal({
  visible,
  activeThemeKey,
  chatTheme,
  texts,
  onClose,
  onSelect,
}: {
  visible: boolean;
  activeThemeKey: ChatThemeKey;
  chatTheme: ChatThemePreset;
  texts: ChatTexts;
  onClose: () => void;
  onSelect: (key: ChatThemeKey) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "flex-start",
          alignItems: "flex-end",
          paddingTop: 94,
          paddingRight: 16,
        }}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            width: 230,
            borderRadius: 24,
            padding: 14,
            backgroundColor: chatTheme.header,
            borderWidth: 1,
            borderColor: chatTheme.border,
            gap: 10,
          }}
        >
          <AppText variant="bodyStrong" color="#fff">
            {texts.chooseTheme}
          </AppText>

          {CHAT_THEMES.map((item) => {
            const active = item.key === activeThemeKey;

            return (
              <Pressable
                key={item.key}
                onPress={() => onSelect(item.key)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  paddingVertical: 10,
                  paddingHorizontal: 10,
                  borderRadius: 16,
                  backgroundColor: active
                    ? item.accentSoft
                    : "rgba(255,255,255,0.06)",
                  borderWidth: 1,
                  borderColor: active ? item.accent : chatTheme.border,
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: item.mine,
                    borderWidth: 2,
                    borderColor: item.accent,
                  }}
                />

                <View style={{ flex: 1 }}>
                  <AppText variant="small" color="#fff" style={{ fontWeight: "800" }}>
                    {item.name}
                  </AppText>

                  <AppText variant="caption" color="rgba(255,255,255,0.62)">
                    {item.shortName}
                  </AppText>
                </View>

                {active ? <CheckCheck color={item.accent} size={18} /> : null}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function RecordingComposer({
  recordingMs,
  voiceSending,
  onCancel,
  onSend,
  chatTheme,
  texts,
}: {
  recordingMs: number;
  voiceSending: boolean;
  onCancel: () => void;
  onSend: () => void;
  chatTheme: ChatThemePreset;
  texts: ChatTexts;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: "#FF4D4D",
        }}
      />

      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong" color="#fff">
          {texts.recording}
        </AppText>

        <AppText variant="caption" color="rgba(255,255,255,0.65)">
          {fmtDur(recordingMs)}
        </AppText>
      </View>

      <Pressable
        onPress={onCancel}
        disabled={voiceSending}
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: chatTheme.surfaceSoft,
          alignItems: "center",
          justifyContent: "center",
          opacity: voiceSending ? 0.5 : 1,
        }}
      >
        <X color="#fff" size={18} />
      </Pressable>

      <Pressable
        onPress={onSend}
        disabled={voiceSending}
        style={{
          width: 46,
          height: 46,
          borderRadius: 23,
          backgroundColor: voiceSending
            ? "rgba(255,255,255,0.22)"
            : chatTheme.mine,
          alignItems: "center",
          justifyContent: "center",
          opacity: voiceSending ? 0.65 : 1,
        }}
      >
        <Send color={chatTheme.mineText} size={18} />
      </Pressable>
    </View>
  );
}

function DateSeparator({
  label,
  chatTheme,
}: {
  label: string;
  chatTheme: ChatThemePreset;
}) {
  return (
    <View
      style={{
        alignSelf: "center",
        marginVertical: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: chatTheme.surface,
        borderWidth: 1,
        borderColor: chatTheme.border,
      }}
    >
      <AppText
        variant="caption"
        color="rgba(255,255,255,0.7)"
        style={{ fontWeight: "800" }}
      >
        {label}
      </AppText>
    </View>
  );
}

function MessageStatus({
  msg,
  chatTheme,
  texts,
}: {
  msg: Message;
  chatTheme: ChatThemePreset;
  texts: ChatTexts;
}) {
  const read = Boolean(msg.read);

  if (read) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
        <CheckCheck color={chatTheme.accent} size={13} />

        <AppText variant="caption" color={chatTheme.accent}>
          {texts.read}
        </AppText>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      <Check color="rgba(255,255,255,0.72)" size={13} />

      <AppText variant="caption" color="rgba(255,255,255,0.72)">
        {texts.sent}
      </AppText>
    </View>
  );
}

function MessageBubble({
  msg,
  mine,
  chatTheme,
  texts,
}: {
  msg: Message;
  mine: boolean;
  chatTheme: ChatThemePreset;
  texts: ChatTexts;
}) {
  const isVoice = msg.messageType === "voice";

  return (
    <View
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "82%",
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 20,
        borderBottomRightRadius: mine ? 5 : 20,
        borderBottomLeftRadius: mine ? 20 : 5,
        backgroundColor: mine ? chatTheme.mine : chatTheme.partner,
        borderWidth: mine ? 0 : 1,
        borderColor: chatTheme.border,
        shadowColor: mine ? chatTheme.mine : "#000",
        shadowOpacity: mine ? 0.22 : 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 5 },
        elevation: mine ? 4 : 2,
      }}
    >
      {isVoice ? (
        <VoicePlayer msg={msg} mine={mine} chatTheme={chatTheme} />
      ) : (
        <AppText
          variant="body"
          color={mine ? chatTheme.mineText : chatTheme.partnerText}
          style={{ lineHeight: 21 }}
        >
          {msg.content}
        </AppText>
      )}

      <View
        style={{
          marginTop: 5,
          flexDirection: "row",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 6,
        }}
      >
        <AppText
          variant="caption"
          color={mine ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.55)"}
        >
          {new Date(msg.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </AppText>

        {mine ? (
          <MessageStatus msg={msg} chatTheme={chatTheme} texts={texts} />
        ) : null}
      </View>
    </View>
  );
}

function VoicePlayer({
  msg,
  mine,
  chatTheme,
}: {
  msg: Message;
  mine: boolean;
  chatTheme: ChatThemePreset;
}) {
  const source =
    msg.voiceUrl && msg.voiceUrl !== "mock://voice"
      ? { uri: toAbsoluteUrl(msg.voiceUrl) ?? msg.voiceUrl }
      : null;

  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);

  const total = msg.voiceDurationMs ?? 0;
  const playing = !!status?.playing;

  const progress =
    total > 0 && status?.currentTime
      ? Math.min(1, (status.currentTime * 1000) / total)
      : 0;

  const fg = mine ? chatTheme.mineText : chatTheme.partnerText;

  const toggle = () => {
    if (!source) return;

    if (playing) {
      player.pause();
    } else {
      if (
        (status?.currentTime ?? 0) >= (status?.duration ?? 0) - 0.1 &&
        status?.duration
      ) {
        player.seekTo(0);
      }

      player.play();
    }
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        minWidth: 180,
      }}
    >
      <Pressable
        onPress={toggle}
        disabled={!source}
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: mine
            ? "rgba(255,255,255,0.24)"
            : chatTheme.surfaceSoft,
          alignItems: "center",
          justifyContent: "center",
          opacity: source ? 1 : 0.45,
        }}
      >
        {playing ? (
          <Pause size={14} color={fg} fill={fg} />
        ) : (
          <Play size={14} color={fg} fill={fg} />
        )}
      </Pressable>

      <View style={{ flex: 1, gap: 2 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 2,
            height: 18,
          }}
        >
          {Array.from({ length: 22 }).map((_, i) => {
            const h = 4 + ((i * 7) % 14);
            const filled = i / 22 < progress;

            return (
              <View
                key={i}
                style={{
                  width: 2,
                  height: h,
                  borderRadius: 1,
                  backgroundColor: filled
                    ? fg
                    : mine
                      ? "rgba(255,255,255,0.45)"
                      : "rgba(255,255,255,0.22)",
                }}
              />
            );
          })}
        </View>

        <AppText
          variant="caption"
          color={mine ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.62)"}
        >
          {fmtDur(total)}
        </AppText>
      </View>
    </View>
  );
}