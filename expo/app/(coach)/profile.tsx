import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import {
  Award,
  Camera,
  CreditCard,
  Globe,
  LogOut,
  Moon,
  RefreshCw,
  Star,
  Sun,
} from "lucide-react-native";
import React from "react";
import { Alert, Platform, Pressable, View } from "react-native";
import {
  AppAvatar,
  AppButton,
  AppCard,
  AppText,
  GradientHeader,
  ScreenContainer,
  SectionHeader,
} from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { useSubscription } from "@/src/context/SubscriptionContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";
import { LANGUAGES } from "@/src/i18n/translations";
import { LanguageModal } from "@/src/components/LanguageModal";

export default function CoachProfile() {
  const { theme, mode, toggle } = useTheme();
  const { user, logout, updateMe } = useAuth();
  const { db, reset } = useData();
  const { sub, isActive } = useSubscription();
  const { t, lang, setLanguage } = useI18n();
  const [langOpen, setLangOpen] = React.useState<boolean>(false);

  const profile = db?.coachProfiles.find((p) => p.userId === user?.id);

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
      <GradientHeader height={200}>
        <View style={{ alignItems: "center", marginTop: 12, gap: 10 }}>
          <Pressable onPress={pickAvatar}>
            <View>
              <AppAvatar
                uri={user?.avatarUrl ?? profile?.profileImageUrl}
                name={user?.name}
                size={84}
                ring
              />
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
            {user?.name}
          </AppText>
          <AppText variant="small" color="rgba(255,255,255,0.8)">
            {profile?.specialty ?? "Personal Trainer"}
          </AppText>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: "rgba(255,255,255,0.15)",
              paddingVertical: 4,
              paddingHorizontal: 10,
              borderRadius: 20,
            }}
          >
            <Star color="#FFB020" size={14} fill="#FFB020" />
            <AppText variant="small" color="#fff" style={{ fontWeight: "700" }}>
              {profile?.rating ?? 5.0} · {profile?.experienceYears ?? 0} yrs
            </AppText>
          </View>
        </View>
      </GradientHeader>

      <View style={{ paddingHorizontal: 20, marginTop: 16, gap: 12 }}>
        <SectionHeader title={t("profile.subscription")} icon={<CreditCard color={theme.colors.primary} size={18} />} />
        <Pressable onPress={() => router.push("/subscription")}>
          <AppCard variant="elevated">
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <View>
                <AppText variant="bodyStrong">{sub?.planName ?? "CoachFlow Monthly"}</AppText>
                <AppText variant="small" color={theme.colors.textMuted}>
                  {isActive
                    ? `${t("subscription.active")} · ${t("subscription.renews")} ${sub?.endDate ? new Date(sub.endDate).toDateString().slice(4, 10) : ""}`
                    : t("subscription.inactive")}
                </AppText>
              </View>
              <AppText
                variant="bodyStrong"
                color={isActive ? theme.colors.success : theme.colors.warn}
              >
                {isActive ? t("subscription.active") : t("subscription.inactive")}
              </AppText>
            </View>
          </AppCard>
        </Pressable>

        <SectionHeader title={t("profile.achievements")} icon={<Award color={theme.colors.fire} size={18} />} />
        <AppCard variant="outline">
          {(profile?.achievements ?? []).map((a, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: theme.colors.primary,
                }}
              />
              <AppText variant="small">{a}</AppText>
            </View>
          ))}
        </AppCard>

        <SectionHeader title={t("profile.certificates")} />
        <AppCard variant="outline">
          {(profile?.certificates ?? []).map((c, i) => (
            <AppText key={i} variant="small" style={{ paddingVertical: 4 }}>
              · {c}
            </AppText>
          ))}
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
          <Pressable
            onPress={reset}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingVertical: 8,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <RefreshCw color={theme.colors.text} size={18} />
              <AppText variant="body">{t("profile.resetDemo")}</AppText>
            </View>
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
