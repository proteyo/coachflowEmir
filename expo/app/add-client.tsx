import { router } from "expo-router";
import { Hash, Mail, Search, Send, UserPlus } from "lucide-react-native";
import React, { useState } from "react";
import { Alert, View } from "react-native";
import {
  AppAvatar,
  AppButton,
  AppCard,
  AppInput,
  AppText,
  ScreenContainer,
  TabBarPill,
} from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { useSubscription } from "@/src/context/SubscriptionContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";

type Method = "email" | "code";

export default function AddClient() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const { db, update } = useData();
  const { isActive } = useSubscription();
  const [method, setMethod] = useState<Method>("email");
  const [query, setQuery] = useState<string>("");
  const [error, setError] = useState<string>("");

  const findAndLink = () => {
    setError("");
    if (!user || !db) return;
    if (!isActive) {
      Alert.alert(t("subscription.required"), t("subscription.requiredMsg"));
      return;
    }
    const q = query.trim();
    if (!q) return setError(t("addClient.notFound"));

    const target = db.users.find((u) => {
      if (method === "email") {
        return u.email.toLowerCase() === q.toLowerCase();
      }
      return (u.clientCode ?? "").toLowerCase() === q.toLowerCase();
    });

    if (!target) return setError(t("addClient.notFound"));
    if (target.role !== "client") return setError(t("addClient.notClient"));

    const profile = db.clientProfiles.find((c) => c.userId === target.id);
    if (profile?.coachId === user.id) return setError(t("addClient.alreadyLinkedToYou"));
    if (profile?.coachId && profile.coachId !== user.id)
      return setError(t("addClient.alreadyHasCoach"));

    update((d) => {
      const hasProfile = d.clientProfiles.some((c) => c.userId === target.id);
      const clientProfiles = hasProfile
        ? d.clientProfiles.map((c) =>
            c.userId === target.id ? { ...c, coachId: user.id } : c,
          )
        : [
            ...d.clientProfiles,
            {
              userId: target.id,
              coachId: user.id,
              goal: "",
              startWeight: 0,
              currentWeight: 0,
              height: 0,
              fitnessLevel: "beginner" as const,
              createdAt: new Date().toISOString(),
            },
          ];
      const hasStreak = d.streaks.some((s) => s.clientId === target.id);
      const streaks = hasStreak
        ? d.streaks
        : [...d.streaks, { clientId: target.id, currentStreak: 0, bestStreak: 0 }];
      return { ...d, clientProfiles, streaks };
    });

    Alert.alert(t("addClient.linked"), t("addClient.linkedMsg", { name: target.name }), [
      { text: t("common.done"), onPress: () => router.back() },
    ]);
  };

  const sendInvite = () => {
    if (!query.trim() || !/^\S+@\S+\.\S+$/.test(query.trim())) {
      setError(t("auth.emailInvalid"));
      return;
    }
    Alert.alert(t("addClient.inviteSent"), t("addClient.inviteSentMsg"));
  };

  const previewMatch = (() => {
    if (!db || !query.trim()) return null;
    return db.users.find((u) => {
      if (method === "email") return u.email.toLowerCase() === query.trim().toLowerCase();
      return (u.clientCode ?? "").toLowerCase() === query.trim().toLowerCase();
    });
  })();

  return (
    <ScreenContainer scroll>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: theme.colors.surfaceAlt,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <UserPlus color={theme.colors.primary} size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="title">{t("addClient.title")}</AppText>
            <AppText variant="small" color={theme.colors.textMuted}>
              {t("addClient.subtitle")}
            </AppText>
          </View>
        </View>

        <View style={{ marginTop: 8 }}>
          <TabBarPill
            options={[
              { key: "email", label: t("addClient.methodEmail") },
              { key: "code", label: t("addClient.methodCode") },
            ]}
            active={method}
            onChange={(k) => {
              setMethod(k as Method);
              setQuery("");
              setError("");
            }}
          />
        </View>

        <AppInput
          label={method === "email" ? t("addClient.emailLabel") : t("addClient.codeLabel")}
          value={query}
          onChangeText={(v) => {
            setQuery(v);
            setError("");
          }}
          placeholder={
            method === "email" ? t("auth.emailPlaceholder") : t("addClient.codePlaceholder")
          }
          autoCapitalize={method === "code" ? "characters" : "none"}
          keyboardType={method === "email" ? "email-address" : "default"}
          leftIcon={
            method === "email" ? (
              <Mail size={18} color={theme.colors.textMuted} />
            ) : (
              <Hash size={18} color={theme.colors.textMuted} />
            )
          }
        />

        {previewMatch ? (
          <AppCard variant="outline">
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <AppAvatar uri={previewMatch.avatarUrl} name={previewMatch.name} size={44} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{previewMatch.name}</AppText>
                <AppText variant="small" color={theme.colors.textMuted}>
                  {previewMatch.email}
                  {previewMatch.clientCode ? ` · ${previewMatch.clientCode}` : ""}
                </AppText>
              </View>
            </View>
          </AppCard>
        ) : null}

        {error ? (
          <AppText variant="small" color={theme.colors.danger}>
            {error}
          </AppText>
        ) : null}

        <AppButton
          title={t("addClient.findAndLink")}
          size="lg"
          icon={<Search size={18} color={theme.colors.primaryContrast} />}
          onPress={findAndLink}
          fullWidth
        />

        {method === "email" ? (
          <AppButton
            title={t("addClient.invite")}
            variant="secondary"
            icon={<Send size={18} color={theme.colors.text} />}
            onPress={sendInvite}
            fullWidth
          />
        ) : null}
      </View>
    </ScreenContainer>
  );
}
