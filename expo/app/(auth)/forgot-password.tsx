import { LinearGradient } from "expo-linear-gradient";
import { Link, router } from "expo-router";
import {
  ArrowLeft,
  Languages,
  Mail,
  ShieldCheck,
} from "lucide-react-native";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
} from "react-native";
import { LanguageModal } from "@/src/components/LanguageModal";
import {
  AppButton,
  AppInput,
  AppText,
  ScreenContainer,
} from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";
import { LANGUAGES } from "@/src/i18n/translations";

export default function ForgotPasswordScreen() {
  const { theme } = useTheme();
  const { lang, setLanguage, t } = useI18n();
  const { forgotPassword } = useAuth();

  const [email, setEmail] = useState<string>("");
  const [languageVisible, setLanguageVisible] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [sent, setSent] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const currentLanguage = LANGUAGES.find((item) => item.code === lang);

  const onSubmit = async () => {
    setError("");
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError(t("auth.emailRequired"));
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError(t("auth.emailInvalid"));
      return;
    }

    try {
      setSubmitting(true);

      const res = await forgotPassword(cleanEmail);

      if (!res.ok) {
        setError(res.error ?? t("auth.passwordResetSendFailed"));
        return;
      }

      setSent(true);
      setMessage(t("auth.passwordResetSent"));
    } catch (e: any) {
      console.log("[forgot-password] submit error", e);
      setError(e?.message || t("auth.passwordResetSendFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer scroll padded={false} edges={["top"]}>
      <LanguageModal
        visible={languageVisible}
        current={lang}
        onClose={() => setLanguageVisible(false)}
        onSelect={(code) => {
          setLanguage(code);
          setLanguageVisible(false);
        }}
      />

      <LinearGradient
        colors={theme.gradients.hero as readonly [string, string]}
        style={{
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: 52,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 22,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.16)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowLeft color="#fff" size={20} />
          </Pressable>

          <Pressable
            onPress={() => setLanguageVisible(true)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.16)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.18)",
            }}
          >
            <Languages color="#fff" size={16} />

            <AppText variant="small" color="#fff" style={{ fontWeight: "800" }}>
              {currentLanguage?.flag ?? "🌐"} {lang.toUpperCase()}
            </AppText>
          </Pressable>
        </View>

        <View style={{ gap: 8 }}>
          <AppText variant="display" color="#fff">
            {t("auth.forgotPasswordTitle")}
          </AppText>

          <AppText variant="body" color="rgba(255,255,255,0.75)">
            {t("auth.forgotPasswordSubtitle")}
          </AppText>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ paddingHorizontal: 20, paddingTop: 24, gap: 14 }}
      >
        <AppInput
          label={t("auth.email")}
          placeholder={t("auth.emailPlaceholder")}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setError("");
            setMessage("");
          }}
          leftIcon={<Mail size={18} color={theme.colors.textMuted} />}
        />

        {error ? (
          <AppText variant="small" color={theme.colors.danger}>
            {error}
          </AppText>
        ) : null}

        {message ? (
          <AppText variant="small" color={theme.colors.success}>
            {message}
          </AppText>
        ) : null}

        <AppButton
          title={
            submitting
              ? t("auth.sendingResetLink")
              : sent
                ? t("auth.sendAgain")
                : t("auth.sendResetLink")
          }
          size="lg"
          loading={submitting}
          onPress={onSubmit}
          fullWidth
        />

        <Link href="/(auth)/reset-password" asChild>
          <Pressable
            style={{
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 8,
            }}
            hitSlop={10}
          >
            <AppText
              variant="small"
              color={theme.colors.primary}
              style={{ fontWeight: "700" }}
            >
              {t("auth.alreadyHaveResetToken")}
            </AppText>
          </Pressable>
        </Link>

        <View
          style={{
            marginTop: 12,
            padding: 14,
            borderRadius: 16,
            backgroundColor: theme.colors.surfaceAlt,
            borderWidth: 1,
            borderColor: theme.colors.borderSoft,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ShieldCheck color={theme.colors.primary} size={18} />

            <AppText variant="bodyStrong">
              {t("auth.passwordResetSecurityTitle")}
            </AppText>
          </View>

          <AppText
            variant="small"
            color={theme.colors.textMuted}
            style={{ marginTop: 6 }}
          >
            {t("auth.passwordResetSecurityText")}
          </AppText>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}