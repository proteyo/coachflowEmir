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
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { VideoView, useVideoPlayer } from "expo-video";
import * as VideoThumbnails from "expo-video-thumbnails";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  ArrowUp,
  Check,
  CheckCheck,
  ChevronLeft,
  Copy,
  Edit3,
  Forward,
  Lock,
  Mic,
  Palette,
  Paperclip,
  Pause,
  Pin,
  PinOff,
  Play,
  Reply,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react-native";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
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
  apiDeleteMessage,
  apiDeleteMessageFallback,
  apiEditMessage,
  apiForwardMessage,
  apiGetMessages,
  apiMarkConversationRead,
  apiPinMessage,
  apiReactToMessage,
  apiSendMessage,
  apiUploadChatImage,
  apiUploadChatVideo,
  apiUploadVideoThumbnail,
  apiUploadVoice,
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

type ChatThemeKey = "premium" | "midnight" | "energy" | "light";

type ChatThemePreset = {
  key: ChatThemeKey;
  name: string;
  shortName: string;
  isLight: boolean;
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
  text: string;
  muted: string;
  composer: string;
};

type MediaDraft = {
  uri: string;
  type: "image" | "video";
  mimeType?: string | null;
  fileName?: string | null;
  thumbnailUri?: string | null;
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
  holdToRecord: string;
  releaseToSend: string;
  swipeUpToLock: string;
  lockedRecording: string;
  cancelRecording: string;
  deleteForMe: string;
  deleteForEveryone: string;
  deleteMessageTitle: string;
  deleteMessageText: string;
  cancel: string;
  photoMessage: string;
  videoMessage: string;
  mediaErrorTitle: string;
  mediaSendError: string;
  mediaPermissionMessage: string;
  voiceTooShort: string;
  attachMedia: string;
  copy: string;
  copied: string;
  removeDraft: string;
  tapToPreview: string;
  reply: string;
  edit: string;
  save: string;
  editing: string;
  replyTo: string;
  pin: string;
  unpin: string;
  forward: string;
  forwardTo: string;
  chooseReceiver: string;
  pinnedMessage: string;
};

const CHAT_THEME_STORAGE_KEY = "coachflow:chat-theme-key";
const MIN_VOICE_DURATION_MS = 1000;

const CHAT_THEMES: ChatThemePreset[] = [
  {
    key: "premium",
    name: "CoachFlow Premium",
    shortName: "Premium",
    isLight: false,
    background: "#06111F",
    header: "rgba(6,17,31,0.98)",
    surface: "rgba(255,255,255,0.075)",
    surfaceSoft: "rgba(255,255,255,0.125)",
    mine: "#18C989",
    mineText: "#04140E",
    partner: "rgba(255,255,255,0.105)",
    partnerText: "#F7FAFC",
    accent: "#23E0A3",
    accentText: "#02130D",
    accentSoft: "rgba(35,224,163,0.16)",
    border: "rgba(255,255,255,0.13)",
    shadow: "rgba(24,201,137,0.35)",
    input: "rgba(255,255,255,0.09)",
    text: "#FFFFFF",
    muted: "rgba(255,255,255,0.68)",
    composer: "rgba(5,10,20,0.96)",
  },
  {
    key: "midnight",
    name: "Midnight Coach",
    shortName: "Night",
    isLight: false,
    background: "#050816",
    header: "rgba(5,8,22,0.98)",
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
    text: "#FFFFFF",
    muted: "rgba(255,255,255,0.68)",
    composer: "rgba(5,8,22,0.96)",
  },
  {
    key: "energy",
    name: "Energy Orange",
    shortName: "Energy",
    isLight: false,
    background: "#130B07",
    header: "rgba(19,11,7,0.98)",
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
    text: "#FFFFFF",
    muted: "rgba(255,255,255,0.68)",
    composer: "rgba(19,11,7,0.96)",
  },
  {
    key: "light",
    name: "Clean Light",
    shortName: "Light",
    isLight: true,
    background: "#F4F7FB",
    header: "rgba(255,255,255,0.98)",
    surface: "rgba(15,23,42,0.055)",
    surfaceSoft: "rgba(15,23,42,0.09)",
    mine: "#18C989",
    mineText: "#04140E",
    partner: "#FFFFFF",
    partnerText: "#111827",
    accent: "#12B981",
    accentText: "#FFFFFF",
    accentSoft: "rgba(18,185,129,0.14)",
    border: "rgba(15,23,42,0.12)",
    shadow: "rgba(15,23,42,0.12)",
    input: "#FFFFFF",
    text: "#111827",
    muted: "rgba(15,23,42,0.62)",
    composer: "rgba(255,255,255,0.98)",
  },
];

const REACTIONS = ["💙", "👍", "👀", "😂", "🔥", "❤️", "💪", "👏"];

function isValidChatThemeKey(value: string | null): value is ChatThemeKey {
  return (
    value === "premium" ||
    value === "midnight" ||
    value === "energy" ||
    value === "light"
  );
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
        "Начните переписку. Здесь будут сообщения, фото, видео и голосовые записи.",
      chooseTheme: "Тема чата",
      recording: "Идёт запись",
      voiceErrorTitle: "Ошибка голосового сообщения",
      voiceStartError:
        "Не удалось начать запись. Проверьте разрешение на микрофон.",
      voiceSendError: "Не удалось отправить голосовое сообщение.",
      messageErrorTitle: "Ошибка сообщения",
      messageSendError: "Не удалось отправить сообщение. Попробуйте ещё раз.",
      holdToRecord: "Удерживайте микрофон для записи",
      releaseToSend: "Отпустите, чтобы отправить",
      swipeUpToLock: "Проведите вверх — закрепить запись",
      lockedRecording: "Запись закреплена",
      cancelRecording: "Удалить запись",
      deleteForMe: "Удалить у себя",
      deleteForEveryone: "Удалить у всех",
      deleteMessageTitle: "Сообщение",
      deleteMessageText: "Выберите действие",
      cancel: "Отмена",
      photoMessage: "Фото",
      videoMessage: "Видео",
      mediaErrorTitle: "Ошибка медиа",
      mediaSendError: "Не удалось отправить фото или видео.",
      mediaPermissionMessage:
        "Разрешите доступ к галерее, чтобы отправлять фото и видео.",
      voiceTooShort: "Голосовое слишком короткое",
      attachMedia: "Фото/видео",
      copy: "Копировать",
      copied: "Скопировано",
      removeDraft: "Убрать файл",
      tapToPreview: "Нажмите для просмотра",
      reply: "Ответить",
      edit: "Изменить",
      save: "Сохранить",
      editing: "Редактирование",
      replyTo: "Ответ на сообщение",
      pin: "Закрепить",
      unpin: "Открепить",
      forward: "Переслать",
      forwardTo: "Переслать",
      chooseReceiver: "Выберите получателя",
      pinnedMessage: "Закреплённое сообщение",
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
        "Хатты бастаңыз. Мұнда хабарламалар, фото, видео және дауыс жазбалары көрсетіледі.",
      chooseTheme: "Чат тақырыбы",
      recording: "Жазылып жатыр",
      voiceErrorTitle: "Дауыс хабарламасы қатесі",
      voiceStartError:
        "Жазуды бастау мүмкін болмады. Микрофон рұқсатын тексеріңіз.",
      voiceSendError: "Дауыс хабарламасын жіберу мүмкін болмады.",
      messageErrorTitle: "Хабарлама қатесі",
      messageSendError: "Хабарламаны жіберу мүмкін болмады. Қайталап көріңіз.",
      holdToRecord: "Жазу үшін микрофонды ұстап тұрыңыз",
      releaseToSend: "Жіберу үшін босатыңыз",
      swipeUpToLock: "Жоғары сырғыту — жазуды бекіту",
      lockedRecording: "Жазу бекітілді",
      cancelRecording: "Жазбаны өшіру",
      deleteForMe: "Өзімнен өшіру",
      deleteForEveryone: "Барлығынан өшіру",
      deleteMessageTitle: "Хабарлама",
      deleteMessageText: "Әрекетті таңдаңыз",
      cancel: "Бас тарту",
      photoMessage: "Фото",
      videoMessage: "Видео",
      mediaErrorTitle: "Медиа қатесі",
      mediaSendError: "Фото немесе видеоны жіберу мүмкін болмады.",
      mediaPermissionMessage:
        "Фото және видео жіберу үшін галереяға рұқсат беріңіз.",
      voiceTooShort: "Дауыс жазбасы тым қысқа",
      attachMedia: "Фото/видео",
      copy: "Көшіру",
      copied: "Көшірілді",
      removeDraft: "Файлды алып тастау",
      tapToPreview: "Көру үшін басыңыз",
      reply: "Жауап беру",
      edit: "Өзгерту",
      save: "Сақтау",
      editing: "Өзгерту",
      replyTo: "Хабарламаға жауап",
      pin: "Бекіту",
      unpin: "Босату",
      forward: "Жіберу",
      forwardTo: "Жіберу",
      chooseReceiver: "Алушыны таңдаңыз",
      pinnedMessage: "Бекітілген хабарлама",
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
      "Start a clean coach-client conversation. Text, media and voice messages will appear here.",
    chooseTheme: "Chat theme",
    recording: "Recording",
    voiceErrorTitle: "Voice error",
    voiceStartError: "Could not start recording. Check microphone permission.",
    voiceSendError: "Could not send voice message.",
    messageErrorTitle: "Message error",
    messageSendError: "Could not send message. Please try again.",
    holdToRecord: "Hold mic to record",
    releaseToSend: "Release to send",
    swipeUpToLock: "Swipe up to lock",
    lockedRecording: "Recording locked",
    cancelRecording: "Delete recording",
    deleteForMe: "Delete for me",
    deleteForEveryone: "Delete for everyone",
    deleteMessageTitle: "Message",
    deleteMessageText: "Choose an action",
    cancel: "Cancel",
    photoMessage: "Photo",
    videoMessage: "Video",
    mediaErrorTitle: "Media error",
    mediaSendError: "Could not send photo or video.",
    mediaPermissionMessage: "Allow gallery access to send photos and videos.",
    voiceTooShort: "Voice message is too short",
    attachMedia: "Photo/video",
    copy: "Copy",
    copied: "Copied",
    removeDraft: "Remove file",
    tapToPreview: "Tap to preview",
    reply: "Reply",
    edit: "Edit",
    save: "Save",
    editing: "Editing",
    replyTo: "Replying to message",
    pin: "Pin",
    unpin: "Unpin",
    forward: "Forward",
    forwardTo: "Forward",
    chooseReceiver: "Choose receiver",
    pinnedMessage: "Pinned message",
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
    clientTempId: message.clientTempId ?? message.client_temp_id ?? undefined,
    senderId: String(message.senderId ?? message.sender_id),
    receiverId: receiverValue ? String(receiverValue) : null,
    replyToId: message.replyToId ?? message.reply_to_id ?? undefined,
    replyPreview: message.replyPreview ?? message.reply_preview ?? undefined,
    content: message.content ?? "",
    messageType: message.messageType ?? message.message_type ?? "text",
    voiceUrl: message.voiceUrl ?? message.voice_url ?? undefined,
    voiceDurationMs:
      message.voiceDurationMs ?? message.voice_duration_ms ?? undefined,
    mediaUrl: message.mediaUrl ?? message.media_url ?? undefined,
    mediaType: message.mediaType ?? message.media_type ?? undefined,
    mediaThumbnailUrl:
      message.mediaThumbnailUrl ?? message.media_thumbnail_url ?? undefined,
    reactions: message.reactions ?? {},
    read: Boolean(message.read),
    pinned: Boolean(message.pinned),
    deletedAt: message.deletedAt ?? message.deleted_at ?? undefined,
    deletedForSender: Boolean(
      message.deletedForSender ?? message.deleted_for_sender,
    ),
    deletedForReceiver: Boolean(
      message.deletedForReceiver ?? message.deleted_for_receiver,
    ),
    deletedForEveryone: Boolean(
      message.deletedForEveryone ?? message.deleted_for_everyone,
    ),
    editedAt: message.editedAt ?? message.edited_at ?? undefined,
    createdAt:
      message.createdAt ?? message.created_at ?? new Date().toISOString(),
  } as Message;
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

function getLocale(lang?: string) {
  if (lang === "ru") return "ru-RU";
  if (lang === "kk") return "kk-KZ";

  return "en-US";
}

function getDateSeparatorLabel(date: Date, texts: ChatTexts, lang?: string) {
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

  return date.toLocaleDateString(getLocale(lang), {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function buildChatItems(
  messages: Message[],
  texts: ChatTexts,
  lang?: string,
): ChatListItem[] {
  const result: ChatListItem[] = [];
  let lastDayKey = "";

  messages.forEach((message) => {
    const date = getMessageDate(message);
    const dayKey = getDayKey(date);

    if (dayKey !== lastDayKey) {
      result.push({
        kind: "date",
        id: `date_${dayKey}`,
        label: getDateSeparatorLabel(date, texts, lang),
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

function formatLastSeen(
  value: string | null | undefined,
  texts: ChatTexts,
  lang?: string,
) {
  if (!value) {
    return texts.lastSeenAfterActivity;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return texts.lastSeenUnavailable;
  }

  const sameDay = isSameDay(date, new Date());
  const time = date.toLocaleTimeString(getLocale(lang), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (sameDay) {
    return `${texts.lastSeenPrefix} ${time}`;
  }

  return `${texts.lastSeenPrefix} ${date.toLocaleDateString(getLocale(lang), {
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

function getApiBaseUrl() {
  const env = (globalThis as any)?.process?.env ?? {};

  const raw =
    env.EXPO_PUBLIC_API_URL ??
    env.EXPO_PUBLIC_API_BASE_URL ??
    env.EXPO_PUBLIC_BACKEND_URL ??
    "";

  return String(raw).replace(/\/$/, "");
}

function getWebSocketUrl(partnerId: string, token: string) {
  const apiBase = getApiBaseUrl();

  if (!apiBase) return "";

  const wsBase = apiBase
    .replace(/^https:\/\//, "wss://")
    .replace(/^http:\/\//, "ws://");

  const params = new URLSearchParams({
    partner_id: partnerId,
    token,
  });

  return `${wsBase}/messages/ws?${params.toString()}`;
}

function createClientTempId() {
  return `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function makeLocalMessage({
  senderId,
  receiverId,
  content,
  messageType,
  voiceUrl,
  voiceDurationMs,
  mediaUrl,
  mediaType,
  mediaThumbnailUrl,
  replyToId,
  replyPreview,
  clientTempId,
}: {
  senderId: string;
  receiverId: string;
  content: string;
  messageType: string;
  voiceUrl?: string;
  voiceDurationMs?: number;
  mediaUrl?: string;
  mediaType?: string;
  mediaThumbnailUrl?: string;
  replyToId?: string | null;
  replyPreview?: any;
  clientTempId: string;
}): Message {
  return {
    id: `local_${clientTempId}`,
    clientTempId,
    senderId,
    receiverId,
    replyToId: replyToId || undefined,
    replyPreview,
    content,
    messageType,
    voiceUrl,
    voiceDurationMs,
    mediaUrl,
    mediaType,
    mediaThumbnailUrl,
    reactions: {},
    read: false,
    pinned: false,
    createdAt: new Date().toISOString(),
  } as Message;
}

function sameByTempId(a: Message, b: Message) {
  const aTemp = (a as any).clientTempId ?? (a as any).client_temp_id;
  const bTemp = (b as any).clientTempId ?? (b as any).client_temp_id;

  return Boolean(aTemp && bTemp && aTemp === bTemp);
}

function messagesLookLikeSameLocal(
  localMessage: Message,
  backendMessage: Message,
) {
  if (sameByTempId(localMessage, backendMessage)) return true;
  if (!String(localMessage.id).startsWith("local_")) return false;
  if (String(backendMessage.id).startsWith("local_")) return false;
  if (localMessage.senderId !== backendMessage.senderId) return false;
  if (localMessage.receiverId !== backendMessage.receiverId) return false;
  if ((localMessage as any).messageType !== (backendMessage as any).messageType) {
    return false;
  }

  const localTime = getMessageTime(localMessage);
  const backendTime = getMessageTime(backendMessage);
  const closeTime = Math.abs(localTime - backendTime) < 20_000;

  if (!closeTime) return false;

  if ((localMessage as any).messageType === "text") {
    return localMessage.content.trim() === backendMessage.content.trim();
  }

  return true;
}

function mergeMessages(existing: Message[], incoming: Message[]) {
  let result = [...existing];

  incoming.forEach((incomingMessage) => {
    result = result.filter(
      (existingMessage) =>
        existingMessage.id !== incomingMessage.id &&
        !sameByTempId(existingMessage, incomingMessage) &&
        !messagesLookLikeSameLocal(existingMessage, incomingMessage),
    );

    result.push(incomingMessage);
  });

  const map = new Map<string, Message>();

  result.forEach((message) => {
    map.set(message.id, {
      ...(map.get(message.id) ?? {}),
      ...message,
    } as Message);
  });

  return Array.from(map.values())
    .filter((message) => !(message as any).deletedForEveryone)
    .sort((a, b) => getMessageTime(a) - getMessageTime(b));
}

function replaceLocalMessage(
  messages: Message[],
  localId: string,
  createdMessage: Message,
) {
  return mergeMessages(
    messages.filter((message) => message.id !== localId),
    [createdMessage],
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

function buildReplyPreview(message: Message) {
  return {
    id: message.id,
    senderId: message.senderId,
    content: message.content,
    messageType: (message as any).messageType,
    mediaType: (message as any).mediaType,
  };
}

function getReplyPreviewText(message: Message | any, fallback = "") {
  const type = String(message?.messageType ?? message?.message_type ?? "").toLowerCase();

  if (type === "voice") return "Голосовое сообщение";
  if (type === "image") return "Фото";
  if (type === "video") return "Видео";

  return String(message?.content ?? fallback ?? "").trim() || fallback;
}

function getReactionEntries(message: Message) {
  const reactions = ((message as any).reactions ?? {}) as Record<string, string[]>;
  return Object.entries(reactions).filter(([, users]) => Array.isArray(users) && users.length > 0);
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
  const [recordingLocked, setRecordingLocked] = useState<boolean>(false);
  const [mediaSending, setMediaSending] = useState<boolean>(false);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [hiddenMessageIds, setHiddenMessageIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [actionMenuVisible, setActionMenuVisible] = useState<boolean>(false);
  const [mediaDraft, setMediaDraft] = useState<MediaDraft | null>(null);
  const [imageViewerUrl, setImageViewerUrl] = useState<string | null>(null);
  const [videoViewerUrl, setVideoViewerUrl] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [editTarget, setEditTarget] = useState<Message | null>(null);
  const [forwardTarget, setForwardTarget] = useState<Message | null>(null);
  const [forwardModalVisible, setForwardModalVisible] = useState(false);

  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const listRef = useRef<FlatList<ChatListItem>>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const presencePollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const recordingRef = useRef<boolean>(false);
  const recordingLockedRef = useRef<boolean>(false);
  const recordingStartedAtRef = useRef<number>(0);
  const recordingTouchActiveRef = useRef<boolean>(false);
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

  const possibleForwardReceivers = useMemo(() => {
    if (!db?.users || !userId) return [];

    return db.users.filter(
      (item) => item.id !== userId && item.id !== forwardTarget?.senderId,
    );
  }, [db?.users, userId, forwardTarget?.senderId]);

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
    recordingLockedRef.current = recordingLocked;
  }, [recordingLocked]);

  useEffect(() => {
    refreshFromBackendRef.current = refreshFromBackend;
  }, [refreshFromBackend]);

  const thread: Message[] = useMemo(() => {
    if (!db || !userId || !id) return [];

    return db.messages
      .filter((m) => isConversationMessage(m, userId, id))
      .filter((m) => !hiddenMessageIds.has(m.id))
      .filter((m) => !(m as any).deletedForEveryone)
      .slice()
      .sort((a, b) => getMessageTime(a) - getMessageTime(b));
  }, [db, userId, id, hiddenMessageIds]);

  const pinnedMessage = useMemo(() => {
    return thread.find((message) => Boolean((message as any).pinned)) ?? null;
  }, [thread]);

  const chatItems = useMemo(
    () => buildChatItems(thread, texts, lang),
    [thread, texts, lang],
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
      : formatLastSeen(lastPartnerActivity, texts, lang);

    return {
      online,
      label,
    };
  }, [partner?.isOnline, lastPartnerActivity, texts, lang]);

  const scrollToBottom = useCallback((animated = true, delay = 40) => {
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated });
    }, delay);
  }, []);

  const applyIncomingMessages = useCallback(
    (incoming: Message[]) => {
      if (!id || !userId) return;

      update((d) => {
        const otherMessages = d.messages.filter(
          (message: Message) => !isConversationMessage(message, userId, id),
        );

        const currentConversation = d.messages.filter((message: Message) =>
          isConversationMessage(message, userId, id),
        );

        return {
          ...d,
          messages: [
            ...otherMessages,
            ...mergeMessages(currentConversation, incoming),
          ],
        };
      });
    },
    [id, userId, update],
  );

  const loadConversation = useCallback(
    async (markAsRead: boolean) => {
      if (!id || !userId || !token) return;

      try {
        const res = await apiGetMessages(id, {
          token,
          markAsRead,
        });

        const backendMessages: Message[] = arr(res)
          .map(normalizeMessage)
          .filter((message: Message) =>
            isConversationMessage(message, userId, id),
          );

        update((d) => {
          const otherMessages = d.messages.filter(
            (message: Message) => !isConversationMessage(message, userId, id),
          );

          const currentConversation = d.messages.filter((message: Message) =>
            isConversationMessage(message, userId, id),
          );

          const mergedMessages = [
            ...otherMessages,
            ...mergeMessages(currentConversation, backendMessages),
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
      const res = await apiMarkConversationRead(id, { token });

      const backendMessages: Message[] = arr(res)
        .map(normalizeMessage)
        .filter((message: Message) =>
          isConversationMessage(message, userId, id),
        );

      if (backendMessages.length > 0) {
        applyIncomingMessages(backendMessages);
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
  }, [id, userId, token, update, applyIncomingMessages]);

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
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
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

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (event) => {
      try {
        Keyboard.scheduleLayoutAnimation?.(event);
      } catch {}

      scrollToBottom(true, Platform.OS === "ios" ? 10 : 70);
    });

    const hideSub = Keyboard.addListener(hideEvent, (event) => {
      try {
        Keyboard.scheduleLayoutAnimation?.(event);
      } catch {}

      scrollToBottom(true, 30);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollToBottom]);

  useEffect(() => {
    if (!id || !userId || !token) return;

    markConversationRead();
    loadConversation(true);
    scrollToBottom(false);

    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    pollingRef.current = setInterval(() => {
      if (!sendingRef.current && !voiceSendingRef.current && !mediaSending) {
        loadConversation(true);
      }
    }, wsConnected ? 18_000 : 8_000);

    if (presencePollingRef.current) {
      clearInterval(presencePollingRef.current);
    }

    presencePollingRef.current = setInterval(() => {
      refreshFromBackendRef.current();
    }, 12_000);

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
    wsConnected,
    mediaSending,
  ]);

  useEffect(() => {
    if (!id || !userId || !token) return;

    const wsUrl = getWebSocketUrl(String(id), token);

    if (!wsUrl) {
      setWsConnected(false);
      return;
    }

    let closedByEffect = false;

    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        if (closedByEffect) return;
        setWsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data));

          if (payload?.type === "message_deleted") {
            const messageId = String(payload.messageId ?? payload.message_id ?? "");
            const mode = String(payload.mode ?? "everyone");

            if (messageId) {
              update((d) => ({
                ...d,
                messages:
                  mode === "me"
                    ? d.messages.filter((message: Message) => message.id !== messageId)
                    : d.messages.map((message: Message) =>
                        message.id === messageId
                          ? { ...message, deletedForEveryone: true }
                          : message,
                      ),
              }));
            }

            return;
          }

          const incomingMessages = Array.isArray(payload?.messages)
            ? payload.messages
            : payload?.message
              ? [payload.message]
              : payload?.id
                ? [payload]
                : arr(payload);

          const normalizedMessages: Message[] = incomingMessages
            .map(normalizeMessage)
            .filter((message: Message) =>
              isConversationMessage(message, userId, String(id)),
            );

          if (normalizedMessages.length === 0) return;

          applyIncomingMessages(normalizedMessages);

          const hasIncomingFromPartner = normalizedMessages.some(
            (message) => message.senderId === String(id),
          );

          if (hasIncomingFromPartner) {
            markConversationRead();
            scrollToBottom(true);
          }
        } catch (error) {
          console.log("[chat] websocket message parse error", error);
        }
      };

      socket.onerror = (error) => {
        console.log("[chat] websocket error", error);
      };

      socket.onclose = () => {
        if (closedByEffect) return;
        setWsConnected(false);
      };
    } catch (error) {
      console.log("[chat] websocket init error", error);
      setWsConnected(false);
    }

    return () => {
      closedByEffect = true;
      setWsConnected(false);

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [id, userId, token, update, markConversationRead, scrollToBottom, applyIncomingMessages]);

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
    if (!id || !user) return;

    const partnerId = String(id);

    if (user.role === "coach") {
      router.push({
        pathname: "/client/[id]",
        params: { id: partnerId },
      } as any);
      return;
    }

    if (user.role === "client") {
      router.push({
        pathname: "/coach/[id]",
        params: { id: partnerId },
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

  const clearComposer = () => {
    setText("");
    setMediaDraft(null);
    setReplyTarget(null);
    setEditTarget(null);
  };

  const removeLocalMessage = (localId: string) => {
    update((d) => ({
      ...d,
      messages: d.messages.filter((message: Message) => message.id !== localId),
    }));
  };

  const sendTextOrMedia = async () => {
    const content = text.trim();

    if (!userId || !id || !token || sendingRef.current) return;
    if (!content && !mediaDraft) return;

    if (editTarget) {
      if (!content) return;

      const previousText = editTarget.content;
      const targetId = editTarget.id;

      sendingRef.current = true;
      setSending(true);

      setText("");
      setEditTarget(null);

      update((d) => ({
        ...d,
        messages: d.messages.map((message: Message) =>
          message.id === targetId
            ? {
                ...message,
                content,
                editedAt: new Date().toISOString(),
              }
            : message,
        ),
      }));

      try {
        const updated = await apiEditMessage(targetId, { content }, { token });
        const normalized = normalizeMessage(updated);

        applyIncomingMessages([normalized]);
      } catch (e: any) {
        update((d) => ({
          ...d,
          messages: d.messages.map((message: Message) =>
            message.id === targetId
              ? {
                  ...message,
                  content: previousText,
                  editedAt: (editTarget as any).editedAt,
                }
              : message,
          ),
        }));

        setText(content);
        setEditTarget(editTarget);
        Alert.alert(texts.messageErrorTitle, e?.message || texts.messageSendError);
      } finally {
        sendingRef.current = false;
        setSending(false);
      }

      return;
    }

    sendingRef.current = true;
    setSending(true);

    const draft = mediaDraft;
    const reply = replyTarget;
    const clientTempId = createClientTempId();

    clearComposer();

    let localMessage: Message | null = null;

    try {
      let uploadedUrl: string | undefined;
      let thumbnailUrl: string | undefined;
      let messageType: "text" | "image" | "video" = "text";
      let mediaType: "image" | "video" | undefined;
      let messageContent = content;

      if (draft) {
        setMediaSending(true);

        messageType = draft.type;
        mediaType = draft.type;
        messageContent =
          content || (draft.type === "video" ? texts.videoMessage : texts.photoMessage);

        localMessage = makeLocalMessage({
          senderId: userId,
          receiverId: String(id),
          content: messageContent,
          messageType,
          mediaUrl: draft.uri,
          mediaType,
          mediaThumbnailUrl: draft.thumbnailUri || undefined,
          replyToId: reply?.id,
          replyPreview: reply ? buildReplyPreview(reply) : undefined,
          clientTempId,
        });

        update((d) => ({
          ...d,
          messages: [...d.messages, localMessage as Message],
        }));

        scrollToBottom(true, 20);

        if (draft.type === "video" && draft.thumbnailUri) {
          const thumbnailUpload = await apiUploadVideoThumbnail(draft.thumbnailUri, {
            token,
            mimeType: "image/jpeg",
            fileName: `video_thumb_${Date.now()}.jpg`,
          });

          thumbnailUrl =
            thumbnailUpload.mediaThumbnailUrl ??
            thumbnailUpload.media_thumbnail_url ??
            thumbnailUpload.thumbnailUrl ??
            thumbnailUpload.thumbnail_url ??
            thumbnailUpload.url;
        }

        const uploadRes =
          draft.type === "video"
            ? await apiUploadChatVideo(draft.uri, {
                token,
                mimeType: draft.mimeType ?? "video/mp4",
                fileName: draft.fileName ?? `chat_${Date.now()}.mp4`,
              })
            : await apiUploadChatImage(draft.uri, {
                token,
                mimeType: draft.mimeType ?? "image/jpeg",
                fileName: draft.fileName ?? `chat_${Date.now()}.jpg`,
              });

        uploadedUrl =
          uploadRes.mediaUrl ??
          uploadRes.media_url ??
          uploadRes.imageUrl ??
          uploadRes.image_url ??
          uploadRes.videoUrl ??
          uploadRes.video_url ??
          uploadRes.url;

        if (!uploadedUrl) {
          throw new Error("Backend did not return media URL.");
        }
      } else {
        localMessage = makeLocalMessage({
          senderId: userId,
          receiverId: String(id),
          content: messageContent,
          messageType,
          replyToId: reply?.id,
          replyPreview: reply ? buildReplyPreview(reply) : undefined,
          clientTempId,
        });

        update((d) => ({
          ...d,
          messages: [...d.messages, localMessage as Message],
        }));

        scrollToBottom(true, 20);
      }

      const created = await apiSendMessage(
        {
          receiver_id: id,
          client_temp_id: clientTempId,
          content: messageContent,
          message_type: messageType,
          reply_to_id: reply?.id ?? null,
          ...(uploadedUrl
            ? {
                media_url: uploadedUrl,
                media_type: mediaType,
                media_thumbnail_url: thumbnailUrl ?? null,
              }
            : {}),
        },
        { token },
      );

      const createdMessage = created?.id ? normalizeMessage(created) : null;

      if (createdMessage && localMessage) {
        update((d) => ({
          ...d,
          messages: replaceLocalMessage(
            d.messages,
            localMessage?.id ?? "",
            createdMessage,
          ),
        }));
      }

      scrollToBottom(true, 20);
    } catch (e: any) {
      console.log("[chat] send text/media err", e);

      if (localMessage) {
        removeLocalMessage(localMessage.id);
      }

      setText(content);
      setMediaDraft(draft);
      setReplyTarget(reply);

      Alert.alert(texts.messageErrorTitle, e?.message || texts.messageSendError);
    } finally {
      sendingRef.current = false;
      setSending(false);
      setMediaSending(false);
    }
  };

  const closeActionMenu = () => {
    setActionMenuVisible(false);
    setTimeout(() => {
      setSelectedMessage(null);
    }, 160);
  };

  const copyMessage = async (message: Message) => {
    const textToCopy = message.content || "";

    if (textToCopy) {
      await Clipboard.setStringAsync(textToCopy);
    }

    closeActionMenu();
  };

  const replyToMessage = (message: Message) => {
    setReplyTarget(message);
    setEditTarget(null);
    closeActionMenu();
  };

  const editMessage = (message: Message) => {
    setEditTarget(message);
    setReplyTarget(null);
    setMediaDraft(null);
    setText(message.content || "");
    closeActionMenu();
  };

  const forwardMessage = (message: Message) => {
    setForwardTarget(message);
    setForwardModalVisible(true);
    closeActionMenu();
  };

  const pinMessage = async (message: Message) => {
    if (!token) return;

    const nextPinned = !Boolean((message as any).pinned);

    closeActionMenu();

    update((d) => ({
      ...d,
      messages: d.messages.map((item: Message) =>
        item.id === message.id ? { ...item, pinned: nextPinned } : item,
      ),
    }));

    try {
      const updated = await apiPinMessage(
        message.id,
        { pinned: nextPinned },
        { token },
      );

      applyIncomingMessages([normalizeMessage(updated)]);
    } catch (e) {
      console.log("[chat] pin error", e);
    }
  };

  const reactToMessage = async (message: Message, emoji: string) => {
    if (!token || !userId) return;

    closeActionMenu();

    const previous = (message as any).reactions ?? {};

    update((d) => ({
      ...d,
      messages: d.messages.map((item: Message) => {
        if (item.id !== message.id) return item;

        const reactions = { ...(((item as any).reactions ?? {}) as any) };
        const users = Array.isArray(reactions[emoji]) ? [...reactions[emoji]] : [];

        if (users.includes(userId)) {
          reactions[emoji] = users.filter((id: string) => id !== userId);
        } else {
          reactions[emoji] = [...users, userId];
        }

        if (Array.isArray(reactions[emoji]) && reactions[emoji].length === 0) {
          delete reactions[emoji];
        }

        return {
          ...item,
          reactions,
        };
      }),
    }));

    try {
      const updated = await apiReactToMessage(message.id, { emoji }, { token });
      applyIncomingMessages([normalizeMessage(updated)]);
    } catch (e) {
      console.log("[chat] reaction error", e);

      update((d) => ({
        ...d,
        messages: d.messages.map((item: Message) =>
          item.id === message.id ? { ...item, reactions: previous } : item,
        ),
      }));
    }
  };

  const deleteForMe = async (message: Message) => {
    if (!token) return;

    closeActionMenu();

    setHiddenMessageIds((prev) => {
      const next = new Set(prev);
      next.add(message.id);
      return next;
    });

    update((d) => ({
      ...d,
      messages: d.messages.filter((item: Message) => item.id !== message.id),
    }));

    try {
      await apiDeleteMessage(message.id, "me", { token });
    } catch (e) {
      console.log("[chat] delete for me error", e);

      try {
        await apiDeleteMessageFallback(message.id, "me", { token });
      } catch (fallbackError) {
        console.log("[chat] delete for me fallback error", fallbackError);
      }
    }
  };

  const deleteForEveryone = async (message: Message) => {
    if (!userId || !id || !token) return;

    closeActionMenu();

    update((d) => ({
      ...d,
      messages: d.messages.map((item: Message) =>
        item.id === message.id ? { ...item, deletedForEveryone: true } : item,
      ),
    }));

    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "delete_message",
            mode: "everyone",
            messageId: message.id,
            message_id: message.id,
          }),
        );
      } else {
        await apiDeleteMessage(message.id, "everyone", { token });
      }
    } catch (e) {
      console.log("[chat] delete message error", e);

      try {
        await apiDeleteMessageFallback(message.id, "everyone", { token });
      } catch (fallbackError) {
        console.log("[chat] delete message fallback error", fallbackError);
      }
    }
  };

  const openActionMenu = (message: Message) => {
    setSelectedMessage(message);
    setActionMenuVisible(true);
  };

  const pickMedia = async () => {
    if (mediaSending || voiceSending || sending) return;

    try {
      const currentPermission =
        await ImagePicker.getMediaLibraryPermissionsAsync();

      const permission = currentPermission.granted
        ? currentPermission
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(texts.mediaErrorTitle, texts.mediaPermissionMessage);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"] as any,
        allowsEditing: false,
        quality: 0.9,
        videoMaxDuration: 120,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      const asset = result.assets[0];
      const mimeType = String(asset.mimeType ?? "").toLowerCase();
      const isVideo = asset.type === "video" || mimeType.startsWith("video");

      let thumbnailUri: string | null = null;

      if (isVideo) {
        try {
          const thumbnail = await VideoThumbnails.getThumbnailAsync(asset.uri, {
            time: 700,
            quality: 0.75,
          });

          thumbnailUri = thumbnail.uri;
        } catch (thumbnailError) {
          console.log("[chat] video thumbnail error", thumbnailError);
        }
      }

      setMediaDraft({
        uri: asset.uri,
        type: isVideo ? "video" : "image",
        mimeType: asset.mimeType ?? (isVideo ? "video/mp4" : "image/jpeg"),
        fileName:
          asset.fileName ?? `chat_${Date.now()}.${isVideo ? "mp4" : "jpg"}`,
        thumbnailUri,
      });
    } catch (e: any) {
      console.log("[chat] pick media err", e);
      Alert.alert(texts.mediaErrorTitle, e?.message || texts.mediaSendError);
    }
  };

  const ensureMicPermission = async () => {
    if (Platform.OS === "web") {
      Alert.alert(t("messages.voiceWebUnsupported"));
      return false;
    }

    const status = await AudioModule.requestRecordingPermissionsAsync();

    if (!status.granted) {
      Alert.alert(texts.voiceErrorTitle, texts.voiceStartError);
      return false;
    }

    return true;
  };

  const startRecord = async () => {
    if (voiceSendingRef.current || recordingRef.current || text.trim() || mediaDraft || editTarget) {
      return;
    }

    try {
      const granted = await ensureMicPermission();

      if (!granted) return;

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();

      recordingRef.current = true;
      recordingLockedRef.current = false;
      recordingStartedAtRef.current = Date.now();

      setRecordingLocked(false);
      setRecordingMs(0);

      if (recordTimer.current) {
        clearInterval(recordTimer.current);
      }

      recordTimer.current = setInterval(() => {
        setRecordingMs(Math.max(0, Date.now() - recordingStartedAtRef.current));
      }, 100);
    } catch (e) {
      console.log("[chat] start record err", e);

      recordingRef.current = false;
      recordingLockedRef.current = false;
      setRecordingLocked(false);
      setRecordingMs(0);

      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
        });
      } catch {}

      Alert.alert(texts.voiceErrorTitle, texts.voiceStartError);
    }
  };

  const cancelRecord = async () => {
    try {
      if (recordTimer.current) {
        clearInterval(recordTimer.current);
      }

      recordTimer.current = null;

      if (recordingRef.current || recState.isRecording) {
        await recorder.stop();
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      });

      recordingRef.current = false;
      recordingLockedRef.current = false;
      recordingTouchActiveRef.current = false;
      recordingStartedAtRef.current = 0;

      setRecordingLocked(false);
      setRecordingMs(0);
    } catch (e) {
      console.log("[chat] cancel record err", e);

      recordingRef.current = false;
      recordingLockedRef.current = false;
      recordingTouchActiveRef.current = false;
      setRecordingLocked(false);
      setRecordingMs(0);
    }
  };

  const stopAndSend = async () => {
    if (!userId || !id || !token || voiceSendingRef.current) return;
    if (!recordingRef.current && !recState.isRecording) return;

    const finalDuration =
      recordingMs > 0
        ? recordingMs
        : recordingStartedAtRef.current > 0
          ? Date.now() - recordingStartedAtRef.current
          : 0;

    if (finalDuration < MIN_VOICE_DURATION_MS) {
      await cancelRecord();
      return;
    }

    const clientTempId = createClientTempId();

    try {
      if (recordTimer.current) {
        clearInterval(recordTimer.current);
      }

      recordTimer.current = null;

      await recorder.stop();

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      });

      recordingRef.current = false;
      recordingLockedRef.current = false;
      recordingTouchActiveRef.current = false;
      recordingStartedAtRef.current = 0;

      setRecordingLocked(false);

      const uri = recorder.uri;
      const duration = finalDuration;

      setRecordingMs(0);

      if (!uri) return;

      voiceSendingRef.current = true;
      setVoiceSending(true);

      const localMessage = makeLocalMessage({
        senderId: userId,
        receiverId: String(id),
        content: t("messages.voiceMessage"),
        messageType: "voice",
        voiceUrl: uri,
        voiceDurationMs: duration,
        replyToId: replyTarget?.id,
        replyPreview: replyTarget ? buildReplyPreview(replyTarget) : undefined,
        clientTempId,
      });

      setReplyTarget(null);

      update((d) => ({
        ...d,
        messages: [...d.messages, localMessage],
      }));

      scrollToBottom(true, 20);

      const uploadRes = await apiUploadVoice(uri, {
        token,
        mimeType: "audio/mp4",
        fileName: `voice_${Date.now()}.m4a`,
      });

      const uploadedVoiceUrl =
        uploadRes.voiceUrl ?? uploadRes.voice_url ?? uploadRes.url;

      if (!uploadedVoiceUrl) {
        throw new Error("Backend did not return voice URL.");
      }

      const created = await apiSendMessage(
        {
          receiver_id: id,
          client_temp_id: clientTempId,
          content: t("messages.voiceMessage"),
          message_type: "voice",
          reply_to_id: replyTarget?.id ?? null,
          voice_url: uploadedVoiceUrl,
          voice_duration_ms: duration,
        },
        { token },
      );

      const createdMessage = created?.id ? normalizeMessage(created) : null;

      if (createdMessage) {
        update((d) => ({
          ...d,
          messages: replaceLocalMessage(
            d.messages,
            localMessage.id,
            createdMessage,
          ),
        }));
      }

      scrollToBottom(true, 20);
    } catch (e: any) {
      console.log("[chat] stop/send voice err", e);

      recordingRef.current = false;
      recordingLockedRef.current = false;
      recordingTouchActiveRef.current = false;
      setRecordingLocked(false);
      setRecordingMs(0);

      Alert.alert(texts.voiceErrorTitle, e?.message || texts.voiceSendError);
    } finally {
      voiceSendingRef.current = false;
      setVoiceSending(false);

      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
        });
      } catch {}
    }
  };

  const micPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () =>
          !voiceSendingRef.current && !text.trim() && !mediaDraft && !editTarget,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          recordingTouchActiveRef.current = true;
          startRecord();
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy < -52 && recordingRef.current) {
            recordingLockedRef.current = true;
            setRecordingLocked(true);
          }
        },
        onPanResponderRelease: () => {
          recordingTouchActiveRef.current = false;

          if (!recordingRef.current) return;

          if (recordingLockedRef.current) {
            return;
          }

          stopAndSend();
        },
        onPanResponderTerminate: () => {
          recordingTouchActiveRef.current = false;

          if (!recordingRef.current) return;

          if (recordingLockedRef.current) {
            return;
          }

          cancelRecord();
        },
      }),
    [startRecord, stopAndSend, cancelRecord, text, mediaDraft, editTarget],
  );

  const forwardToUser = async (receiverId: string) => {
    if (!token || !forwardTarget) return;

    const target = forwardTarget;

    setForwardModalVisible(false);
    setForwardTarget(null);

    try {
      const created = await apiForwardMessage(
        target.id,
        {
          receiver_id: receiverId,
        },
        { token },
      );

      const normalized = normalizeMessage(created);

      if (isConversationMessage(normalized, userId ?? "", id ?? "")) {
        applyIncomingMessages([normalized]);
      }
    } catch (e: any) {
      Alert.alert(texts.messageErrorTitle, e?.message || texts.messageSendError);
    }
  };

  const isRecording = recState.isRecording || recordingRef.current;
  const canSend = (text.trim().length > 0 || !!mediaDraft) && !sending;
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
            top: -70,
            left: -110,
            width: 260,
            height: 260,
            borderRadius: 130,
            backgroundColor: chatTheme.shadow,
            opacity: chatTheme.isLight ? 0.55 : 0.35,
          }}
        />

        <View
          style={{
            position: "absolute",
            top: 170,
            right: -130,
            width: 310,
            height: 310,
            borderRadius: 155,
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
              <ChevronLeft color={chatTheme.text} size={24} />
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
                <AppText variant="h3" color={chatTheme.text} numberOfLines={1}>
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
                        : chatTheme.muted,
                    }}
                  />

                  <AppText
                    variant="caption"
                    color={presence.online ? chatTheme.accent : chatTheme.muted}
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

        {pinnedMessage ? (
          <Pressable
            onPress={() => {
              const index = chatItems.findIndex(
                (item) => item.kind === "message" && item.message.id === pinnedMessage.id,
              );

              if (index >= 0) {
                listRef.current?.scrollToIndex({
                  index,
                  animated: true,
                  viewPosition: 0.5,
                });
              }
            }}
            style={{
              marginHorizontal: 14,
              marginTop: 10,
              padding: 12,
              borderRadius: 18,
              backgroundColor: chatTheme.input,
              borderWidth: 1,
              borderColor: chatTheme.border,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Pin color={chatTheme.accent} size={18} />

            <View style={{ flex: 1 }}>
              <AppText variant="caption" color={chatTheme.accent}>
                {texts.pinnedMessage}
              </AppText>

              <AppText variant="small" color={chatTheme.text} numberOfLines={1}>
                {getReplyPreviewText(pinnedMessage, texts.pinnedMessage)}
              </AppText>
            </View>
          </Pressable>
        ) : null}

        <FlatList
          ref={listRef}
          data={chatItems}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          initialNumToRender={18}
          maxToRenderPerBatch={12}
          updateCellsBatchingPeriod={50}
          windowSize={8}
          removeClippedSubviews={Platform.OS === "android"}
          contentContainerStyle={{
            paddingHorizontal: 14,
            paddingTop: 18,
            paddingBottom: 18,
            gap: 9,
            flexGrow: 1,
            justifyContent: chatItems.length === 0 ? "center" : "flex-end",
          }}
          style={{ flex: 1 }}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: false })
          }
          onScrollToIndexFailed={() => scrollToBottom(true)}
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
                lang={lang}
                currentUserId={userId ?? ""}
                onOpenActions={openActionMenu}
                onOpenImage={(url) => setImageViewerUrl(url)}
                onOpenVideo={(url) => setVideoViewerUrl(url)}
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

              <AppText
                variant="h3"
                color={chatTheme.text}
                style={{ textAlign: "center" }}
              >
                {partner?.name ?? t("messages.title")}
              </AppText>

              <AppText
                variant="body"
                color={chatTheme.muted}
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
            backgroundColor: chatTheme.composer,
          }}
        >
          {replyTarget && !isRecording ? (
            <ComposerInfoBar
              title={texts.replyTo}
              text={getReplyPreviewText(replyTarget, texts.replyTo)}
              icon={<Reply color={chatTheme.accent} size={18} />}
              chatTheme={chatTheme}
              onClose={() => setReplyTarget(null)}
            />
          ) : null}

          {editTarget && !isRecording ? (
            <ComposerInfoBar
              title={texts.editing}
              text={editTarget.content}
              icon={<Edit3 color={chatTheme.accent} size={18} />}
              chatTheme={chatTheme}
              onClose={() => {
                setEditTarget(null);
                setText("");
              }}
            />
          ) : null}

          {mediaDraft && !isRecording ? (
            <MediaDraftPreview
              draft={mediaDraft}
              chatTheme={chatTheme}
              texts={texts}
              onRemove={() => setMediaDraft(null)}
              onOpen={() => {
                if (mediaDraft.type === "image") {
                  setImageViewerUrl(mediaDraft.uri);
                } else {
                  setVideoViewerUrl(mediaDraft.uri);
                }
              }}
            />
          ) : null}

          {isRecording ? (
            <RecordingComposer
              recordingMs={recordingMs}
              voiceSending={voiceSending}
              locked={recordingLocked}
              onLock={() => {
                recordingLockedRef.current = true;
                setRecordingLocked(true);
              }}
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
              <Pressable
                onPress={pickMedia}
                disabled={mediaSending || voiceSending || sending || !!editTarget}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  backgroundColor: chatTheme.surfaceSoft,
                  borderWidth: 1,
                  borderColor: chatTheme.border,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: mediaSending || editTarget ? 0.55 : 1,
                }}
              >
                <Paperclip color={chatTheme.text} size={18} />
              </Pressable>

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
                  placeholderTextColor={chatTheme.muted}
                  style={{
                    color: chatTheme.text,
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
                  onFocus={() => scrollToBottom(true, 30)}
                />
              </View>

              {canSend ? (
                <Pressable
                  onPress={sendTextOrMedia}
                  disabled={!canSend || sending || mediaSending}
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    backgroundColor:
                      sending || mediaSending ? chatTheme.surfaceSoft : chatTheme.mine,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: sending || mediaSending ? 0.7 : 1,
                    shadowColor: chatTheme.mine,
                    shadowOpacity: 0.35,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: 6,
                  }}
                >
                  {sending || mediaSending ? (
                    <ActivityIndicator color={chatTheme.mineText} size="small" />
                  ) : (
                    <Send color={chatTheme.mineText} size={18} />
                  )}
                </Pressable>
              ) : (
                <Pressable
                  {...micPanResponder.panHandlers}
                  disabled={voiceSending}
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    backgroundColor: voiceSending
                      ? chatTheme.surfaceSoft
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

        <MessageActionMenu
          visible={actionMenuVisible}
          message={selectedMessage}
          chatTheme={chatTheme}
          texts={texts}
          mine={selectedMessage?.senderId === userId}
          onClose={closeActionMenu}
          onCopy={(message) => copyMessage(message)}
          onReply={(message) => replyToMessage(message)}
          onEdit={(message) => editMessage(message)}
          onPin={(message) => pinMessage(message)}
          onForward={(message) => forwardMessage(message)}
          onReact={(message, emoji) => reactToMessage(message, emoji)}
          onDeleteForMe={(message) => deleteForMe(message)}
          onDeleteForEveryone={(message) => deleteForEveryone(message)}
        />

        <ForwardModal
          visible={forwardModalVisible}
          users={possibleForwardReceivers}
          chatTheme={chatTheme}
          texts={texts}
          onClose={() => {
            setForwardModalVisible(false);
            setForwardTarget(null);
          }}
          onSelect={forwardToUser}
        />

        <ImageViewerModal
          url={imageViewerUrl}
          chatTheme={chatTheme}
          onClose={() => setImageViewerUrl(null)}
        />

        <VideoViewerModal
          url={videoViewerUrl}
          chatTheme={chatTheme}
          onClose={() => setVideoViewerUrl(null)}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function ComposerInfoBar({
  title,
  text,
  icon,
  chatTheme,
  onClose,
}: {
  title: string;
  text: string;
  icon: React.ReactNode;
  chatTheme: ChatThemePreset;
  onClose: () => void;
}) {
  return (
    <View
      style={{
        marginBottom: 10,
        padding: 10,
        borderRadius: 18,
        backgroundColor: chatTheme.input,
        borderWidth: 1,
        borderColor: chatTheme.border,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      {icon}

      <View style={{ flex: 1 }}>
        <AppText variant="caption" color={chatTheme.accent}>
          {title}
        </AppText>

        <AppText variant="small" color={chatTheme.text} numberOfLines={1}>
          {text}
        </AppText>
      </View>

      <Pressable
        onPress={onClose}
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: chatTheme.surfaceSoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <X color={chatTheme.text} size={16} />
      </Pressable>
    </View>
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
            width: 240,
            borderRadius: 24,
            padding: 14,
            backgroundColor: chatTheme.header,
            borderWidth: 1,
            borderColor: chatTheme.border,
            gap: 10,
          }}
        >
          <AppText variant="bodyStrong" color={chatTheme.text}>
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
                  backgroundColor: active ? item.accentSoft : item.surface,
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
                  <AppText
                    variant="small"
                    color={chatTheme.text}
                    style={{ fontWeight: "800" }}
                  >
                    {item.name}
                  </AppText>

                  <AppText variant="caption" color={chatTheme.muted}>
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

function MediaDraftPreview({
  draft,
  chatTheme,
  texts,
  onRemove,
  onOpen,
}: {
  draft: MediaDraft;
  chatTheme: ChatThemePreset;
  texts: ChatTexts;
  onRemove: () => void;
  onOpen: () => void;
}) {
  const previewUri = draft.type === "video" ? draft.thumbnailUri || draft.uri : draft.uri;

  return (
    <View
      style={{
        marginBottom: 10,
        padding: 10,
        borderRadius: 22,
        backgroundColor: chatTheme.input,
        borderWidth: 1,
        borderColor: chatTheme.border,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <Pressable onPress={onOpen}>
        <View>
          <Image
            source={{ uri: previewUri }}
            style={{
              width: 58,
              height: 58,
              borderRadius: 16,
              backgroundColor: chatTheme.surfaceSoft,
            }}
            contentFit="cover"
          />

          {draft.type === "video" ? (
            <View
              style={{
                position: "absolute",
                left: 17,
                top: 17,
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: "rgba(0,0,0,0.55)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Play color="#fff" size={11} fill="#fff" />
            </View>
          ) : null}
        </View>
      </Pressable>

      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong" color={chatTheme.text} numberOfLines={1}>
          {draft.type === "video" ? texts.videoMessage : texts.photoMessage}
        </AppText>

        <AppText variant="caption" color={chatTheme.muted} numberOfLines={1}>
          {texts.tapToPreview}
        </AppText>
      </View>

      <Pressable
        onPress={onRemove}
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: chatTheme.surfaceSoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <X color={chatTheme.text} size={18} />
      </Pressable>
    </View>
  );
}

function MessageActionMenu({
  visible,
  message,
  chatTheme,
  texts,
  mine,
  onClose,
  onCopy,
  onReply,
  onEdit,
  onPin,
  onForward,
  onReact,
  onDeleteForMe,
  onDeleteForEveryone,
}: {
  visible: boolean;
  message: Message | null;
  chatTheme: ChatThemePreset;
  texts: ChatTexts;
  mine: boolean;
  onClose: () => void;
  onCopy: (message: Message) => void;
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  onPin: (message: Message) => void;
  onForward: (message: Message) => void;
  onReact: (message: Message, emoji: string) => void;
  onDeleteForMe: (message: Message) => void;
  onDeleteForEveryone: (message: Message) => void;
}) {
  if (!message) {
    return null;
  }

  const menuBg = chatTheme.isLight ? "#FFFFFF" : "rgba(17,24,39,0.98)";
  const reactionBg = chatTheme.isLight ? "#FFFFFF" : "rgba(17,24,39,0.96)";
  const menuBorder = chatTheme.isLight
    ? "rgba(15,23,42,0.10)"
    : "rgba(255,255,255,0.12)";

  const itemStyle = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
  };

  const canEdit = mine && String((message as any).messageType).toLowerCase() === "text";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.34)",
          justifyContent: "center",
          alignItems: mine ? "flex-end" : "flex-start",
          paddingHorizontal: 22,
        }}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            width: 306,
            gap: 10,
          }}
        >
          <View
            style={{
              alignSelf: mine ? "flex-end" : "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: 999,
              backgroundColor: reactionBg,
              borderWidth: 1,
              borderColor: menuBorder,
            }}
          >
            {REACTIONS.map((reaction) => (
              <Pressable
                key={reaction}
                onPress={() => onReact(message, reaction)}
                style={{
                  width: 27,
                  height: 28,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AppText variant="h3">{reaction}</AppText>
              </Pressable>
            ))}
          </View>

          <View
            style={{
              borderRadius: 28,
              backgroundColor: menuBg,
              borderWidth: 1,
              borderColor: menuBorder,
              overflow: "hidden",
              shadowColor: "#000",
              shadowOpacity: 0.3,
              shadowRadius: 22,
              shadowOffset: { width: 0, height: 12 },
              elevation: 14,
            }}
          >
            <MenuRow
              icon={<Reply color={chatTheme.text} size={22} />}
              label={texts.reply}
              color={chatTheme.text}
              onPress={() => onReply(message)}
              style={itemStyle}
            />

            <MenuRow
              icon={<Copy color={chatTheme.text} size={22} />}
              label={texts.copy}
              color={chatTheme.text}
              onPress={() => onCopy(message)}
              style={itemStyle}
            />

            {canEdit ? (
              <MenuRow
                icon={<Edit3 color={chatTheme.text} size={22} />}
                label={texts.edit}
                color={chatTheme.text}
                onPress={() => onEdit(message)}
                style={itemStyle}
              />
            ) : null}

            <MenuRow
              icon={
                (message as any).pinned ? (
                  <PinOff color={chatTheme.text} size={22} />
                ) : (
                  <Pin color={chatTheme.text} size={22} />
                )
              }
              label={(message as any).pinned ? texts.unpin : texts.pin}
              color={chatTheme.text}
              onPress={() => onPin(message)}
              style={itemStyle}
            />

            <MenuRow
              icon={<Forward color={chatTheme.text} size={22} />}
              label={texts.forward}
              color={chatTheme.text}
              onPress={() => onForward(message)}
              style={itemStyle}
            />

            <View
              style={{
                height: 1,
                backgroundColor: chatTheme.border,
                marginHorizontal: 16,
              }}
            />

            <MenuRow
              icon={<Trash2 color="#FF5E57" size={22} />}
              label={texts.deleteForMe}
              color="#FF5E57"
              onPress={() => onDeleteForMe(message)}
              style={itemStyle}
            />

            {mine ? (
              <MenuRow
                icon={<Trash2 color="#FF3B30" size={22} />}
                label={texts.deleteForEveryone}
                color="#FF3B30"
                onPress={() => onDeleteForEveryone(message)}
                style={itemStyle}
              />
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MenuRow({
  icon,
  label,
  color,
  onPress,
  style,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  onPress: () => void;
  style: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        style,
        {
          backgroundColor: pressed ? "rgba(128,128,128,0.10)" : "transparent",
        },
      ]}
    >
      <View style={{ width: 30, alignItems: "center" }}>{icon}</View>

      <AppText
        variant="body"
        color={color}
        style={{
          fontSize: 17,
          fontWeight: "700",
        }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

function ForwardModal({
  visible,
  users,
  chatTheme,
  texts,
  onClose,
  onSelect,
}: {
  visible: boolean;
  users: any[];
  chatTheme: ChatThemePreset;
  texts: ChatTexts;
  onClose: () => void;
  onSelect: (userId: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 22,
        }}
      >
        <View
          style={{
            width: "100%",
            maxHeight: "70%",
            borderRadius: 28,
            padding: 16,
            backgroundColor: chatTheme.header,
            borderWidth: 1,
            borderColor: chatTheme.border,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <AppText variant="h3" color={chatTheme.text} style={{ flex: 1 }}>
              {texts.chooseReceiver}
            </AppText>

            <Pressable
              onPress={onClose}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: chatTheme.surfaceSoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X color={chatTheme.text} size={18} />
            </Pressable>
          </View>

          <FlatList
            data={users}
            keyExtractor={(item) => String(item.id)}
            ItemSeparatorComponent={() => (
              <View style={{ height: 1, backgroundColor: chatTheme.border }} />
            )}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onSelect(String(item.id))}
                style={{
                  paddingVertical: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <AppAvatar
                  uri={toAbsoluteUrl(item.avatarUrl)}
                  name={item.name}
                  size={42}
                  ring
                />

                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong" color={chatTheme.text}>
                    {item.name}
                  </AppText>

                  <AppText variant="caption" color={chatTheme.muted}>
                    {item.role}
                  </AppText>
                </View>

                <Forward color={chatTheme.accent} size={19} />
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

function RecordingComposer({
  recordingMs,
  voiceSending,
  locked,
  onLock,
  onCancel,
  onSend,
  chatTheme,
  texts,
}: {
  recordingMs: number;
  voiceSending: boolean;
  locked: boolean;
  onLock: () => void;
  onCancel: () => void;
  onSend: () => void;
  chatTheme: ChatThemePreset;
  texts: ChatTexts;
}) {
  return (
    <View style={{ gap: 10 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 4,
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
          <AppText variant="bodyStrong" color={chatTheme.text}>
            {locked ? texts.lockedRecording : texts.recording}
          </AppText>

          <AppText variant="caption" color={chatTheme.muted}>
            {fmtDur(recordingMs)} · {locked ? texts.cancelRecording : texts.releaseToSend}
          </AppText>
        </View>

        {!locked ? (
          <Pressable
            onPress={onLock}
            disabled={voiceSending}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: chatTheme.accentSoft,
              alignItems: "center",
              justifyContent: "center",
              opacity: voiceSending ? 0.5 : 1,
            }}
          >
            <ArrowUp color={chatTheme.accent} size={18} />
          </Pressable>
        ) : (
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: chatTheme.accentSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Lock color={chatTheme.accent} size={18} />
          </View>
        )}

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
          <X color={chatTheme.text} size={18} />
        </Pressable>

        <Pressable
          onPress={onSend}
          disabled={voiceSending}
          style={{
            width: 46,
            height: 46,
            borderRadius: 23,
            backgroundColor: voiceSending
              ? chatTheme.surfaceSoft
              : chatTheme.mine,
            alignItems: "center",
            justifyContent: "center",
            opacity: voiceSending ? 0.65 : 1,
          }}
        >
          <Send color={chatTheme.mineText} size={18} />
        </Pressable>
      </View>

      <AppText
        variant="caption"
        color={chatTheme.muted}
        style={{ textAlign: "center" }}
      >
        {texts.swipeUpToLock}
      </AppText>
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
        color={chatTheme.muted}
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
      <Check color={chatTheme.muted} size={13} />

      <AppText variant="caption" color={chatTheme.muted}>
        {texts.sent}
      </AppText>
    </View>
  );
}

const MessageBubble = memo(function MessageBubble({
  msg,
  mine,
  chatTheme,
  texts,
  lang,
  currentUserId,
  onOpenActions,
  onOpenImage,
  onOpenVideo,
}: {
  msg: Message;
  mine: boolean;
  chatTheme: ChatThemePreset;
  texts: ChatTexts;
  lang?: string;
  currentUserId: string;
  onOpenActions: (message: Message) => void;
  onOpenImage: (url: string) => void;
  onOpenVideo: (url: string) => void;
}) {
  const messageType = String((msg as any).messageType ?? "").toLowerCase();
  const isVoice = messageType === "voice";
  const isImage = messageType === "image";
  const isVideo = messageType === "video";
  const mediaUrl = (msg as any).mediaUrl ?? (msg as any).media_url;
  const thumbnailUrl =
    (msg as any).mediaThumbnailUrl ?? (msg as any).media_thumbnail_url;
  const absoluteMediaUrl = mediaUrl ? toAbsoluteUrl(mediaUrl) ?? mediaUrl : "";
  const absoluteThumbnailUrl = thumbnailUrl
    ? toAbsoluteUrl(thumbnailUrl) ?? thumbnailUrl
    : "";
  const reactionEntries = getReactionEntries(msg);
  const replyPreview = (msg as any).replyPreview;

  return (
    <View
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "84%",
      }}
    >
      <Pressable
        onLongPress={() => onOpenActions(msg)}
        delayLongPress={330}
        style={{
          paddingVertical: isImage || isVideo ? 7 : 10,
          paddingHorizontal: isImage || isVideo ? 7 : 14,
          borderRadius: 22,
          borderBottomRightRadius: mine ? 7 : 22,
          borderBottomLeftRadius: mine ? 22 : 7,
          backgroundColor: mine ? chatTheme.mine : chatTheme.partner,
          borderWidth: mine ? 0 : 1,
          borderColor: chatTheme.border,
          shadowColor: mine ? chatTheme.mine : "#000",
          shadowOpacity: mine ? 0.16 : 0.1,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: mine ? 3 : 1,
        }}
      >
        {replyPreview ? (
          <View
            style={{
              marginBottom: 8,
              padding: 8,
              borderRadius: 14,
              backgroundColor: mine
                ? "rgba(255,255,255,0.22)"
                : chatTheme.surfaceSoft,
              borderLeftWidth: 3,
              borderLeftColor: chatTheme.accent,
            }}
          >
            <AppText
              variant="caption"
              color={mine ? chatTheme.mineText : chatTheme.accent}
              numberOfLines={1}
            >
              {texts.replyTo}
            </AppText>

            <AppText
              variant="small"
              color={mine ? chatTheme.mineText : chatTheme.partnerText}
              numberOfLines={1}
            >
              {getReplyPreviewText(replyPreview, texts.replyTo)}
            </AppText>
          </View>
        ) : null}

        {isVoice ? (
          <VoicePlayer msg={msg} mine={mine} chatTheme={chatTheme} />
        ) : isImage && absoluteMediaUrl ? (
          <Pressable onPress={() => onOpenImage(absoluteMediaUrl)} style={{ gap: 8 }}>
            <Image
              source={{ uri: absoluteMediaUrl }}
              style={{
                width: 232,
                height: 270,
                borderRadius: 18,
                backgroundColor: chatTheme.surfaceSoft,
              }}
              contentFit="cover"
              transition={180}
            />

            {msg.content ? (
              <AppText
                variant="body"
                color={mine ? chatTheme.mineText : chatTheme.partnerText}
                style={{ lineHeight: 21, paddingHorizontal: 4 }}
              >
                {msg.content}
              </AppText>
            ) : null}
          </Pressable>
        ) : isVideo && absoluteMediaUrl ? (
          <Pressable
            onPress={() => onOpenVideo(absoluteMediaUrl)}
            style={{
              width: 232,
              minHeight: 154,
              borderRadius: 18,
              overflow: "hidden",
              backgroundColor: mine ? "rgba(0,0,0,0.10)" : chatTheme.surfaceSoft,
              borderWidth: 1,
              borderColor: chatTheme.border,
            }}
          >
            {absoluteThumbnailUrl ? (
              <Image
                source={{ uri: absoluteThumbnailUrl }}
                style={{
                  width: "100%",
                  height: 136,
                  backgroundColor: "#000",
                }}
                contentFit="cover"
              />
            ) : (
              <View
                style={{
                  width: "100%",
                  height: 136,
                  backgroundColor: "#111827",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Sparkles color={chatTheme.accent} size={26} />
              </View>
            )}

            <View
              style={{
                position: "absolute",
                top: 48,
                left: 89,
                width: 54,
                height: 54,
                borderRadius: 27,
                backgroundColor: "rgba(0,0,0,0.55)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Play size={20} color="#fff" fill="#fff" />
            </View>

            <View style={{ padding: 10, gap: 2 }}>
              <AppText
                variant="bodyStrong"
                color={mine ? chatTheme.mineText : chatTheme.partnerText}
              >
                {texts.videoMessage}
              </AppText>

              <AppText
                variant="caption"
                color={mine ? "rgba(0,0,0,0.55)" : chatTheme.muted}
                numberOfLines={1}
              >
                {texts.tapToPreview}
              </AppText>
            </View>
          </Pressable>
        ) : (
          <AppText
            variant="body"
            color={mine ? chatTheme.mineText : chatTheme.partnerText}
            style={{ lineHeight: 21 }}
          >
            {msg.content}
          </AppText>
        )}

        {Boolean((msg as any).editedAt) ? (
          <AppText
            variant="caption"
            color={mine ? "rgba(0,0,0,0.48)" : chatTheme.muted}
            style={{ marginTop: 4 }}
          >
            edited
          </AppText>
        ) : null}

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
            color={
              mine
                ? chatTheme.mineText === "#FFFFFF"
                  ? "rgba(255,255,255,0.72)"
                  : "rgba(0,0,0,0.48)"
                : chatTheme.muted
            }
          >
            {new Date(msg.createdAt).toLocaleTimeString(getLocale(lang), {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
          </AppText>

          {mine ? (
            <MessageStatus msg={msg} chatTheme={chatTheme} texts={texts} />
          ) : null}
        </View>
      </Pressable>

      {reactionEntries.length > 0 ? (
        <View
          style={{
            alignSelf: mine ? "flex-end" : "flex-start",
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 5,
            marginTop: -5,
            marginHorizontal: 8,
          }}
        >
          {reactionEntries.map(([emoji, users]) => {
            const mineReacted = users.includes(currentUserId);

            return (
              <View
                key={emoji}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: mineReacted
                    ? chatTheme.accentSoft
                    : chatTheme.input,
                  borderWidth: 1,
                  borderColor: mineReacted ? chatTheme.accent : chatTheme.border,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <AppText variant="caption">{emoji}</AppText>

                <AppText
                  variant="caption"
                  color={mineReacted ? chatTheme.accent : chatTheme.muted}
                >
                  {users.length}
                </AppText>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
});

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

  const toggle = async () => {
    if (!source) return;

    if (playing) {
      player.pause();
      return;
    }

    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      });
    } catch (error) {
      console.log("[chat] playback audio mode error", error);
    }

    if (
      (status?.currentTime ?? 0) >= (status?.duration ?? 0) - 0.1 &&
      status?.duration
    ) {
      player.seekTo(0);
    }

    player.play();
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        minWidth: 184,
      }}
    >
      <Pressable
        onPress={toggle}
        disabled={!source}
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: mine ? "rgba(255,255,255,0.24)" : chatTheme.surfaceSoft,
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
          {Array.from({ length: 24 }).map((_, i) => {
            const h = 4 + ((i * 7) % 14);
            const filled = i / 24 < progress;

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
                      ? "rgba(0,0,0,0.25)"
                      : chatTheme.border,
                }}
              />
            );
          })}
        </View>

        <AppText
          variant="caption"
          color={mine ? "rgba(0,0,0,0.58)" : chatTheme.muted}
        >
          {fmtDur(total)}
        </AppText>
      </View>
    </View>
  );
}

function ImageViewerModal({
  url,
  chatTheme,
  onClose,
}: {
  url: string | null;
  chatTheme: ChatThemePreset;
  onClose: () => void;
}) {
  return (
    <Modal visible={!!url} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.96)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Pressable
          onPress={onClose}
          style={{
            position: "absolute",
            top: 54,
            right: 18,
            zIndex: 2,
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: "rgba(255,255,255,0.14)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X color="#fff" size={22} />
        </Pressable>

        {url ? (
          <Image
            source={{ uri: url }}
            style={{
              width: "94%",
              height: "78%",
              borderRadius: 22,
              backgroundColor: chatTheme.surfaceSoft,
            }}
            contentFit="contain"
            transition={180}
          />
        ) : null}
      </View>
    </Modal>
  );
}

function VideoViewerModal({
  url,
  onClose,
}: {
  url: string | null;
  chatTheme: ChatThemePreset;
  onClose: () => void;
}) {
  const player = useVideoPlayer(url || "", (createdPlayer) => {
    createdPlayer.loop = false;
  });

  useEffect(() => {
    if (!url) return;

    let mounted = true;

    const load = async () => {
      try {
        const anyPlayer = player as any;

        if (typeof anyPlayer.replaceAsync === "function") {
          await anyPlayer.replaceAsync(url);
        } else {
          player.replace(url);
        }

        if (mounted) {
          player.play();
        }
      } catch (error) {
        console.log("[chat] video player error", error);
      }
    };

    load();

    return () => {
      mounted = false;

      try {
        player.pause();
      } catch {}
    };
  }, [url, player]);

  return (
    <Modal visible={!!url} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.97)",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 12,
        }}
      >
        <Pressable
          onPress={onClose}
          style={{
            position: "absolute",
            top: 54,
            right: 18,
            zIndex: 2,
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: "rgba(255,255,255,0.14)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X color="#fff" size={22} />
        </Pressable>

        {url ? (
          <VideoView
            player={player}
            nativeControls
            allowsPictureInPicture
            contentFit="contain"
            surfaceType="textureView"
            style={{
              width: "100%",
              height: "72%",
              borderRadius: 22,
              backgroundColor: "#000",
            }}
          />
        ) : null}
      </View>
    </Modal>
  );
}