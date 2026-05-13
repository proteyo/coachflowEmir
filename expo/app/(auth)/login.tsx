import { LinearGradient } from "expo-linear-gradient";
import { Link, router } from "expo-router";
import {
  Dumbbell,
  Eye,
  EyeOff,
  Languages,
  Lock,
  Mail,
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

export default function Login() {
  const { theme } = useTheme();
  const { lang, setLanguage, t } = useI18n();
  const { login } = useAuth();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [passwordVisible, setPasswordVisible] = useState<boolean>(false);
  const [languageVisible, setLanguageVisible] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const currentLanguage = LANGUAGES.find((item) => item.code === lang);

  const onSubmit = async () => {
    setError("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setError(t("auth.bothRequired"));
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError(t("auth.emailInvalid"));
      return;
    }

    try {
      setSubmitting(true);

      const res = await login(cleanEmail, password);

      if (!res.ok) {
        setError(res.error ?? t("auth.failedLogin"));
        return;
      }

      router.replace("/");
    } catch (e: any) {
      console.log("[login] submit error", e);
      setError(e?.message || t("auth.failedLogin"));
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
          paddingBottom: 60,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: "rgba(22,199,132,0.18)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Dumbbell color="#16C784" size={22} />
            </View>

            <AppText variant="h2" color="#fff">
              CoachFlow
            </AppText>
          </View>

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

        <View style={{ marginTop: 28 }}>
          <AppText variant="display" color="#fff">
            {t("auth.welcomeBack")}
          </AppText>

          <AppText
            variant="body"
            color="rgba(255,255,255,0.75)"
            style={{ marginTop: 6 }}
          >
            {t("auth.welcomeSub")}
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
          }}
          leftIcon={<Mail size={18} color={theme.colors.textMuted} />}
        />

        <AppInput
          label={t("auth.password")}
          placeholder="••••••••"
          secureTextEntry={!passwordVisible}
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setError("");
          }}
          leftIcon={<Lock size={18} color={theme.colors.textMuted} />}
          rightIcon={
            <Pressable
              onPress={() => setPasswordVisible((v) => !v)}
              hitSlop={10}
            >
              {passwordVisible ? (
                <EyeOff size={18} color={theme.colors.textMuted} />
              ) : (
                <Eye size={18} color={theme.colors.textMuted} />
              )}
            </Pressable>
          }
        />

        <View style={{ alignItems: "flex-end", marginTop: -6 }}>
          <Link href="/(auth)/forgot-password" asChild>
            <Pressable hitSlop={10}>
              <AppText
                variant="small"
                color={theme.colors.primary}
                style={{ fontWeight: "700" }}
              >
                {t("auth.forgotPassword")}
              </AppText>
            </Pressable>
          </Link>
        </View>

        {error ? (
          <AppText variant="small" color={theme.colors.danger}>
            {error}
          </AppText>
        ) : null}

        <AppButton
          title={submitting ? t("auth.signingIn") : t("auth.signIn")}
          size="lg"
          loading={submitting}
          onPress={onSubmit}
          fullWidth
        />

        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            gap: 6,
            marginTop: 4,
          }}
        >
          <Link href="/(auth)/register" asChild>
            <Pressable hitSlop={10}>
              <AppText
                variant="small"
                color={theme.colors.primary}
                style={{ fontWeight: "700" }}
              >
                {t("auth.noAccount")}
              </AppText>
            </Pressable>
          </Link>
        </View>

        <View
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 16,
            backgroundColor: theme.colors.surfaceAlt,
            borderWidth: 1,
            borderColor: theme.colors.borderSoft,
          }}
        >
          <AppText variant="bodyStrong">{t("auth.secureAccess")}</AppText>

          <AppText
            variant="small"
            color={theme.colors.textMuted}
            style={{ marginTop: 4 }}
          >
            {t("auth.secureAccessText")}
          </AppText>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}