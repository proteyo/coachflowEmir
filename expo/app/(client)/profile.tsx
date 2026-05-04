import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { Bell, Camera, Globe, LogOut, Moon, Sun } from "lucide-react-native";
import React from "react";
import { Alert, Platform, Pressable, Switch, View } from "react-native";
import {
  AppAvatar,
  AppButton,
  AppCard,
  AppText,
  GradientHeader,
  ScreenContainer,
  SectionHeader,
  StreakPill,
} from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { useTheme } from "@/src/context/ThemeContext";
import { LanguageModal } from "@/src/components/LanguageModal";
import { useI18n } from "@/src/i18n/I18nContext";
import { LANGUAGES } from "@/src/i18n/translations";

export default function ClientProfile() {
  const { theme, mode, toggle } = useTheme();
  const { t, lang, setLanguage } = useI18n();
  const { user, logout, updateMe } = useAuth();
  const { db, update } = useData();
  const [langOpen, setLangOpen] = React.useState<boolean>(false);

  if (!user || !db) return null;
  const profile = db.clientProfiles.find((c) => c.userId === user.id);
  const streak = db.streaks.find((s) => s.clientId === user.id);
  const notif = db.notifications.find((n) => n.userId === user.id);

  const setNotif = (key: keyof NonNullable<typeof notif>, value: boolean) => {
    update((d) => ({
      ...d,
      notifications: d.notifications.map((n) =>
        n.userId === user.id ? { ...n, [key]: value } : n,
      ),
    }));
  };

  const pickAvatar = async () => {
    try {
      if (Platform.OS !== "web") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(t("profile.permissionTitle"), t("profile.permissionMsg"));
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        updateMe({ avatarUrl: result.assets[0].uri });
      }
    } catch (e) {
      console.log("[avatar] err", e);
    }
  };

  return (
    <ScreenContainer scroll padded={false}>
      <GradientHeader height={210}>
        <View style={{ alignItems: "center", marginTop: 12, gap: 8 }}>
          <Pressable onPress={pickAvatar}>
            <View>
              <AppAvatar uri={user.avatarUrl} name={user.name} size={84} ring />
              <View
                style={{
                  position: "absolute",
                  right: -2,
                  bottom: -2,
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: theme.colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 2,
                  borderColor: "#fff",
                }}
              >
                <Camera color={theme.colors.primaryContrast} size={14} />
              </View>
            </View>
          </Pressable>
          <AppText variant="h2" color="#fff">
            {user.name}
          </AppText>
          <AppText variant="small" color="rgba(255,255,255,0.8)">
            {user.email}
          </AppText>
          <StreakPill count={streak?.currentStreak ?? 0} />
        </View>
      </GradientHeader>

      <View style={{ paddingHorizontal: 20, marginTop: 16, gap: 12 }}>
        <SectionHeader title={t("profile.myProfile")} />
        <AppCard variant="outline">
          <Row label={t("profile.goal")} value={profile?.goal ?? "—"} />
          <Row label={t("clients.age")} value={profile?.age ? String(profile.age) : "—"} />
          <Row label={t("profile.startWeight")} value={`${profile?.startWeight ?? 0} kg`} />
          <Row label={t("profile.currentWeight")} value={`${profile?.currentWeight ?? 0} kg`} />
          <Row label={t("clients.height")} value={`${profile?.height ?? 0} cm`} />
          <Row label={t("clients.fitnessLevel")} value={profile?.fitnessLevel ?? "—"} />
        </AppCard>

        {user.clientCode ? (
          <AppCard variant="outline">
            <AppText variant="caption" color={theme.colors.textMuted} style={{ textTransform: "uppercase" }}>
              {t("profile.yourCode")}
            </AppText>
            <AppText variant="title" color={theme.colors.primary} style={{ marginTop: 4 }}>
              {user.clientCode}
            </AppText>
            <AppText variant="small" color={theme.colors.textMuted} style={{ marginTop: 4 }}>
              {t("profile.yourCodeHint")}
            </AppText>
          </AppCard>
        ) : null}

        <SectionHeader
          title={t("profile.notifications")}
          icon={<Bell color={theme.colors.primary} size={18} />}
        />
        <AppCard variant="outline">
          {notif ? (
            <>
              <SwitchRow
                label={t("profile.workoutReminders")}
                value={notif.workoutReminders}
                onValueChange={(v) => setNotif("workoutReminders", v)}
              />
              <SwitchRow
                label={t("profile.suppReminders")}
                value={notif.supplementReminders}
                onValueChange={(v) => setNotif("supplementReminders", v)}
              />
              <SwitchRow
                label={t("profile.messageNotifs")}
                value={notif.messageNotifications}
                onValueChange={(v) => setNotif("messageNotifications", v)}
              />
              <SwitchRow
                label={t("profile.weeklyGoalReminders")}
                value={notif.weeklyGoalReminders}
                onValueChange={(v) => setNotif("weeklyGoalReminders", v)}
              />
            </>
          ) : null}
        </AppCard>

        <SectionHeader title={t("profile.preferences")} />
        <AppCard variant="outline">
          <Pressable
            onPress={toggle}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingVertical: 8,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              {mode === "dark" ? (
                <Moon color={theme.colors.text} size={18} />
              ) : (
                <Sun color={theme.colors.text} size={18} />
              )}
              <AppText variant="body">{t("profile.darkMode")}</AppText>
            </View>
            <AppText variant="small" color={theme.colors.primary} style={{ fontWeight: "700" }}>
              {mode === "dark" ? t("common.on") : t("common.off")}
            </AppText>
          </Pressable>
          <Pressable
            onPress={() => setLangOpen(true)}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingVertical: 8,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Globe color={theme.colors.text} size={18} />
              <AppText variant="body">{t("profile.language")}</AppText>
            </View>
            <AppText variant="small" color={theme.colors.primary} style={{ fontWeight: "700" }}>
              {LANGUAGES.find((l) => l.code === lang)?.label}
            </AppText>
          </Pressable>
        </AppCard>

        <View style={{ marginTop: 8 }}>
          <AppButton
            title={t("profile.logout")}
            variant="secondary"
            icon={<LogOut size={18} color={theme.colors.text} />}
            onPress={async () => {
              await logout();
              router.replace("/(auth)/login");
            }}
            fullWidth
          />
        </View>
        <View style={{ height: 32 }} />
      </View>

      <LanguageModal
        visible={langOpen}
        onClose={() => setLangOpen(false)}
        current={lang}
        onSelect={(c) => {
          setLanguage(c);
          setLangOpen(false);
        }}
      />
    </ScreenContainer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.borderSoft,
      }}
    >
      <AppText variant="small" color={theme.colors.textMuted}>
        {label}
      </AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  );
}

function SwitchRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 8,
      }}
    >
      <AppText variant="body">{label}</AppText>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
        thumbColor="#fff"
      />
    </View>
  );
}


