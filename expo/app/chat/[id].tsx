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
import { Mic, Pause, Play, Send, Square, X } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { AppAvatar, AppText } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";
import { Message } from "@/src/types/models";

function fmtDur(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const { db, update } = useData();
  const [text, setText] = useState<string>("");
  const [recordingMs, setRecordingMs] = useState<number>(0);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

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
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [db, user, id]);

  useEffect(() => {
    if (!user || !id) return;
    update((d) => ({
      ...d,
      messages: d.messages.map((m) =>
        m.senderId === id && m.receiverId === user.id ? { ...m, read: true } : m,
      ),
    }));
  }, [id, user, update]);

  const send = () => {
    if (!text.trim() || !user || !id) return;
    const newMsg: Message = {
      id: `m_${Date.now()}`,
      senderId: user.id,
      receiverId: id,
      content: text.trim(),
      messageType: "text",
      read: false,
      createdAt: new Date().toISOString(),
    };
    update((d) => ({ ...d, messages: [...d.messages, newMsg] }));
    setText("");
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const startRecord = async () => {
    if (Platform.OS === "web") {
      Alert.alert(t("messages.voiceWebUnsupported"));
      return;
    }
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecordingMs(0);
      recordTimer.current = setInterval(() => setRecordingMs((m) => m + 100), 100);
    } catch (e) {
      console.log("[chat] start record err", e);
    }
  };

  const cancelRecord = async () => {
    try {
      if (recordTimer.current) clearInterval(recordTimer.current);
      recordTimer.current = null;
      await recorder.stop();
      setRecordingMs(0);
    } catch (e) {
      console.log("[chat] cancel record err", e);
    }
  };

  const stopAndSend = async () => {
    if (!user || !id) return;
    try {
      if (recordTimer.current) clearInterval(recordTimer.current);
      recordTimer.current = null;
      await recorder.stop();
      const uri = recorder.uri;
      const duration = recordingMs;
      setRecordingMs(0);
      if (!uri) return;
      const newMsg: Message = {
        id: `m_${Date.now()}`,
        senderId: user.id,
        receiverId: id,
        content: t("messages.voiceMessage"),
        messageType: "voice",
        voiceUrl: uri,
        voiceDurationMs: duration,
        read: false,
        createdAt: new Date().toISOString(),
      };
      update((d) => ({ ...d, messages: [...d.messages, newMsg] }));
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (e) {
      console.log("[chat] stop record err", e);
    }
  };

  const isRecording = recState.isRecording;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <Stack.Screen
        options={{
          title: partner?.name ?? t("messages.title"),
          headerLeft: () => (
            <View style={{ marginRight: 8 }}>
              <AppAvatar uri={partner?.avatarUrl} name={partner?.name} size={32} />
            </View>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={thread}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mine = item.senderId === user?.id;
            return (
              <MessageBubble
                msg={item}
                mine={mine}
              />
            );
          }}
        />

        {isRecording ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
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
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: theme.colors.surfaceAlt,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X color={theme.colors.text} size={18} />
            </Pressable>
            <Pressable
              onPress={stopAndSend}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: theme.colors.primary,
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
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
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
                minHeight: 44,
                justifyContent: "center",
              }}
            >
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={t("messages.placeholder")}
                placeholderTextColor={theme.colors.textFaint}
                style={{ color: theme.colors.text, fontSize: 15 }}
                multiline
              />
            </View>
            {text.trim().length > 0 ? (
              <Pressable
                onPress={send}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: theme.colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Send color={theme.colors.primaryContrast} size={18} />
              </Pressable>
            ) : (
              <Pressable
                onPress={startRecord}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: theme.colors.fire,
                  alignItems: "center",
                  justifyContent: "center",
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
        <AppText variant="body" color={mine ? theme.colors.primaryContrast : theme.colors.text}>
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
  const source = msg.voiceUrl && msg.voiceUrl !== "mock://voice" ? { uri: msg.voiceUrl } : null;
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
      if ((status?.currentTime ?? 0) >= ((status?.duration ?? 0) - 0.1) && status?.duration) {
        player.seekTo(0);
      }
      player.play();
    }
  };

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minWidth: 180 }}>
      <Pressable
        onPress={toggle}
        disabled={!source}
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: mine ? "rgba(255,255,255,0.25)" : theme.colors.surfaceAlt,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {playing ? (
          <Pause size={14} color={fg} fill={fg} />
        ) : (
          <Play size={14} color={fg} fill={fg} />
        )}
      </Pressable>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 2, height: 18 }}>
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
        <AppText variant="caption" color={mine ? "rgba(255,255,255,0.85)" : theme.colors.textMuted}>
          {fmtDur(total)}
        </AppText>
      </View>
    </View>
  );
}
