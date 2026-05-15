import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { Stack, useLocalSearchParams } from "expo-router";
import { Mic, Pause, Play, Send, X } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppAvatar, AppText } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";
import { apiPost, apiUploadFile, toAbsoluteUrl } from "@/src/services/api";
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

function getDateSeparatorLabel(date: Date) {
  const today = new Date();

  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) {
    return "Today";
  }

  if (isSameDay(date, yesterday)) {
    return "Yesterday";
  }

  const sameYear = date.getFullYear() === today.getFullYear();

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function buildChatItems(messages: Message[]): ChatListItem[] {
  const result: ChatListItem[] = [];

  let lastDayKey = "";

  messages.forEach((message) => {
    const date = getMessageDate(message);
    const dayKey = getDayKey(date);

    if (dayKey !== lastDayKey) {
      result.push({
        kind: "date",
        id: `date_${dayKey}`,
        label: getDateSeparatorLabel(date),
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

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const { t } = useI18n();
  const { user, token } = useAuth();
  const { db, update, refreshFromBackend } = useData();
  const insets = useSafeAreaInsets();

  const [text, setText] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);
  const [voiceSending, setVoiceSending] = useState<boolean>(false);
  const [recordingMs, setRecordingMs] = useState<number>(0);

  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const listRef = useRef<FlatList<ChatListItem>>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder);

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
    };
  }, []);

  const partner = db?.users.find((u) => u.id === id);

  const thread: Message[] = useMemo(() => {
    if (!db || !user || !id) return [];

    return db.messages
      .filter(
        (m) =>
          (m.senderId === user.id && m.receiverId === id) ||
          (m.senderId === id && m.receiverId === user.id),
      )
      .slice()
      .sort((a, b) => getMessageTime(a) - getMessageTime(b));
  }, [db, user, id]);

  const chatItems = useMemo(() => buildChatItems(thread), [thread]);

  useEffect(() => {
    if (!user || !id) return;

    update((d) => ({
      ...d,
      messages: d.messages.map((m) =>
        m.senderId === id && m.receiverId === user.id
          ? { ...m, read: true }
          : m,
      ),
    }));
  }, [id, user, update]);

  const scrollToBottom = (animated = true) => {
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated });
    }, 90);
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [chatItems.length]);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, () => {
      scrollToBottom(true);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      scrollToBottom(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const send = async () => {
    const content = text.trim();

    if (!content || !user || !id || !token || sending) return;

    const optimisticMsg: Message = {
      id: `local_${Date.now()}`,
      senderId: user.id,
      receiverId: id,
      content,
      messageType: "text",
      read: false,
      createdAt: new Date().toISOString(),
    };

    setText("");
    setSending(true);

    update((d) => ({
      ...d,
      messages: [...d.messages, optimisticMsg],
    }));

    scrollToBottom(true);

    try {
      await apiPost(
        "/messages",
        {
          receiver_id: id,
          content,
          message_type: "text",
        },
        { token },
      );

      await refreshFromBackend();

      scrollToBottom(true);
    } catch (e) {
      console.log("[chat] send message err", e);

      update((d) => ({
        ...d,
        messages: d.messages.filter((m) => m.id !== optimisticMsg.id),
      }));

      Alert.alert("Message error", "Could not send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const startRecord = async () => {
    if (Platform.OS === "web") {
      Alert.alert(t("messages.voiceWebUnsupported"));
      return;
    }

    if (voiceSending) return;

    try {
      await recorder.prepareToRecordAsync();
      recorder.record();

      setRecordingMs(0);

      recordTimer.current = setInterval(() => {
        setRecordingMs((m) => m + 100);
      }, 100);
    } catch (e) {
      console.log("[chat] start record err", e);

      Alert.alert("Voice error", "Could not start recording.");
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
    if (!user || !id || !token || voiceSending) return;

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

      setVoiceSending(true);

      const optimisticMsg: Message = {
        id: `local_voice_${Date.now()}`,
        senderId: user.id,
        receiverId: id,
        content: t("messages.voiceMessage"),
        messageType: "voice",
        voiceUrl: uri,
        voiceDurationMs: duration,
        read: false,
        createdAt: new Date().toISOString(),
      };

      update((d) => ({
        ...d,
        messages: [...d.messages, optimisticMsg],
      }));

      scrollToBottom(true);

      const uploadRes = await apiUploadFile("/uploads/voice", uri, "file", {
        token,
      });

      const uploadedVoiceUrl = uploadRes.voiceUrl ?? uploadRes.voice_url;

      if (!uploadedVoiceUrl) {
        throw new Error("Backend did not return voice URL.");
      }

      await apiPost(
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

      await refreshFromBackend();

      scrollToBottom(true);
    } catch (e: any) {
      console.log("[chat] stop/send voice err", e);

      update((d) => ({
        ...d,
        messages: d.messages.filter(
          (m) => !String(m.id).startsWith("local_voice_"),
        ),
      }));

      Alert.alert("Voice error", e?.message || "Could not send voice message.");
    } finally {
      setVoiceSending(false);
    }
  };

  const isRecording = recState.isRecording;
  const canSendText = text.trim().length > 0 && !sending;

  const bottomPadding = Math.max(insets.bottom, 10);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <Stack.Screen
        options={{
          title: partner?.name ?? t("messages.title"),
          headerLeft: () => (
            <View style={{ marginRight: 8 }}>
              <AppAvatar
                uri={toAbsoluteUrl(partner?.avatarUrl)}
                name={partner?.name}
                size={32}
              />
            </View>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        <FlatList
          ref={listRef}
          data={chatItems}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 18,
            gap: 8,
            flexGrow: 1,
            justifyContent: chatItems.length === 0 ? "center" : "flex-end",
          }}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: false })
          }
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            if (item.kind === "date") {
              return <DateSeparator label={item.label} />;
            }

            const mine = item.message.senderId === user?.id;

            return <MessageBubble msg={item.message} mine={mine} />;
          }}
          ListEmptyComponent={
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 24,
                paddingVertical: 32,
                gap: 8,
              }}
            >
              <AppText variant="h3" style={{ textAlign: "center" }}>
                {partner?.name ?? t("messages.title")}
              </AppText>

              <AppText
                variant="body"
                color={theme.colors.textMuted}
                style={{ textAlign: "center" }}
              >
                {t("messages.placeholder")}
              </AppText>
            </View>
          }
        />

        {isRecording ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 14,
              paddingTop: 12,
              paddingBottom: bottomPadding,
              borderTopWidth: 1,
              borderTopColor: theme.colors.borderSoft,
              backgroundColor: theme.colors.surface,
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: theme.colors.danger,
              }}
            />

            <AppText variant="bodyStrong">{t("messages.recording")}</AppText>

            <AppText variant="small" color={theme.colors.textMuted}>
              {fmtDur(recordingMs)}
            </AppText>

            <View style={{ flex: 1 }} />

            <Pressable
              onPress={cancelRecord}
              disabled={voiceSending}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: theme.colors.surfaceAlt,
                alignItems: "center",
                justifyContent: "center",
                opacity: voiceSending ? 0.5 : 1,
              }}
            >
              <X color={theme.colors.text} size={18} />
            </Pressable>

            <Pressable
              onPress={stopAndSend}
              disabled={voiceSending}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: voiceSending
                  ? theme.colors.textMuted
                  : theme.colors.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Send color={theme.colors.primaryContrast} size={18} />
            </Pressable>
          </View>
        ) : (
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              gap: 8,
              paddingHorizontal: 12,
              paddingTop: 10,
              paddingBottom: bottomPadding,
              borderTopWidth: 1,
              borderTopColor: theme.colors.borderSoft,
              backgroundColor: theme.colors.bg,
            }}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: theme.colors.inputBg,
                borderRadius: 22,
                paddingHorizontal: 14,
                paddingVertical: Platform.OS === "android" ? 6 : 8,
                minHeight: 44,
                maxHeight: 116,
                justifyContent: "center",
              }}
            >
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={t("messages.placeholder")}
                placeholderTextColor={theme.colors.textFaint}
                style={{
                  color: theme.colors.text,
                  fontSize: 15,
                  maxHeight: 96,
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
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: !canSendText
                    ? theme.colors.textMuted
                    : theme.colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: !canSendText ? 0.65 : 1,
                }}
              >
                <Send color={theme.colors.primaryContrast} size={18} />
              </Pressable>
            ) : (
              <Pressable
                onPress={startRecord}
                disabled={voiceSending}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: voiceSending
                    ? theme.colors.textMuted
                    : theme.colors.fire,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: voiceSending ? 0.65 : 1,
                }}
              >
                <Mic color="#fff" size={18} />
              </Pressable>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

function DateSeparator({ label }: { label: string }) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        alignSelf: "center",
        marginVertical: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: theme.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: theme.colors.borderSoft,
      }}
    >
      <AppText
        variant="caption"
        color={theme.colors.textMuted}
        style={{ fontWeight: "800" }}
      >
        {label}
      </AppText>
    </View>
  );
}

function MessageBubble({ msg, mine }: { msg: Message; mine: boolean }) {
  const { theme } = useTheme();
  const isVoice = msg.messageType === "voice";

  return (
    <View
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "80%",
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 18,
        borderBottomRightRadius: mine ? 4 : 18,
        borderBottomLeftRadius: mine ? 18 : 4,
        backgroundColor: mine ? theme.colors.primary : theme.colors.surface,
        borderWidth: mine ? 0 : 1,
        borderColor: theme.colors.border,
      }}
    >
      {isVoice ? (
        <VoicePlayer msg={msg} mine={mine} />
      ) : (
        <AppText
          variant="body"
          color={mine ? theme.colors.primaryContrast : theme.colors.text}
        >
          {msg.content}
        </AppText>
      )}

      <AppText
        variant="caption"
        color={mine ? "rgba(255,255,255,0.7)" : theme.colors.textMuted}
        style={{ marginTop: 4, textAlign: "right" }}
      >
        {new Date(msg.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </AppText>
    </View>
  );
}

function VoicePlayer({ msg, mine }: { msg: Message; mine: boolean }) {
  const { theme } = useTheme();

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

  const fg = mine ? theme.colors.primaryContrast : theme.colors.text;

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
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: mine
            ? "rgba(255,255,255,0.25)"
            : theme.colors.surfaceAlt,
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
                      : theme.colors.borderSoft,
                }}
              />
            );
          })}
        </View>

        <AppText
          variant="caption"
          color={mine ? "rgba(255,255,255,0.85)" : theme.colors.textMuted}
        >
          {fmtDur(total)}
        </AppText>
      </View>
    </View>
  );
}