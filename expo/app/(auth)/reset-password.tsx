import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Languages,
  Lock,
  XCircle,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
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

function extractResetToken(value: string) {
  const raw = value.trim();

  if (!raw.includes("token=")) {
    return raw;
  }

  try {
    const tokenPart = raw.split("token=", 2)[1] ?? "";
    return decodeURIComponent(tokenPart.split("&", 1)[0]).trim();
  } catch {
    return raw.split("token=", 2)[1]?.split("&", 1)[0]?.trim() ?? raw;
  }
}

function getPasswordRules(password: string, confirmPassword: string) {
  return {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    match: password.length > 0 && password === confirmPassword,
  };
}

function isStrongPassword(password: string, confirmPassword: string) {
  const rules = getPasswordRules(password, confirmPassword);

  return (
    rules.minLength &&
    rules.uppercase &&
    rules.lowercase &&
    rules.number &&
    rules.special &&
    rules.match
  );
}

export default function ResetPasswordScreen() {
  const { theme } = useTheme();
  const { lang, setLanguage, t } = useI18n();
  const { resetPassword } = useAuth();
  const params = useLocalSearchParams<{ token?: string }>();

  const initialToken = useMemo(() => {
    if (!params.token) return "";

    const value = Array.isArray(params.token) ? params.token[0] : params.token;

    return extractResetToken(value);
  }, [params.token]);

  const [token, setToken] = useState<string>(initialToken);
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [passwordVisible, setPasswordVisible] = useState<boolean>(false);
  const [confirmVisible, setConfirmVisible] = useState<boolean>(false);
  const [languageVisible, setLanguageVisible] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const currentLanguage = LANGUAGES.find((item) => item.code === lang);

  const passwordRules = useMemo(
    () => getPasswordRules(newPassword, confirmPassword),
    [newPassword, confirmPassword],
  );

  const strongPassword = useMemo(
    () => isStrongPassword(newPassword, confirmPassword),
    [newPassword, confirmPassword],
  );

  const onSubmit = async () => {
    setError("");

    const cleanToken = extractResetToken(token);

    if (!cleanToken) {
      setError(t("auth.resetTokenRequired"));
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError(t("auth.passwordsRequired"));
      return;
    }

    if (!strongPassword) {
      setError(t("auth.passwordStrongRequired"));
      return;
    }

    try {
      setSubmitting(true);

      const res = await resetPassword(cleanToken, newPassword);

      if (!res.ok) {
        setError(res.error ?? t("auth.passwordResetFailed"));
        return;
      }

      setSuccess(true);
    } catch (e: any) {
      console.log("[reset-password] submit error", e);
      setError(e?.message || t("auth.passwordResetFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <ScreenContainer scroll padded edges={["top"]}>
        <LanguageModal
          visible={languageVisible}
          current={lang}
          onClose={() => setLanguageVisible(false)}
          onSelect={(code) => {
            setLanguage(code);
            setLanguageVisible(false);
          }}
        />

        <View
          style={{
            alignItems: "flex-end",
            paddingTop: 4,
          }}
        >
          <Pressable
            onPress={() => setLanguageVisible(true)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: theme.colors.surfaceAlt,
              borderWidth: 1,
              borderColor: theme.colors.borderSoft,
            }}
          >
            <Languages color={theme.colors.text} size={16} />

            <AppText
              variant="small"
              color={theme.colors.text}
              style={{ fontWeight: "800" }}
            >
              {currentLanguage?.flag ?? "🌐"} {lang.toUpperCase()}
            </AppText>
          </Pressable>
        </View>

        <View
          style={{
            flex: 1,
            minHeight: 560,
            justifyContent: "center",
            alignItems: "center",
            gap: 18,
          }}
        >
          <View
            style={{
              width: 74,
              height: 74,
              borderRadius: 37,
              backgroundColor: "rgba(22,199,132,0.14)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CheckCircle2 color={theme.colors.success} size={38} />
          </View>

          <View style={{ alignItems: "center", gap: 8 }}>
            <AppText variant="h2" style={{ textAlign: "center" }}>
              {t("auth.passwordResetSuccessTitle")}
            </AppText>

            <AppText
              variant="body"
              color={theme.colors.textMuted}
              style={{ textAlign: "center" }}
            >
              {t("auth.passwordResetSuccessText")}
            </AppText>
          </View>

          <AppButton
            title={t("auth.backToLogin")}
            size="lg"
            fullWidth
            onPress={() => router.replace("/(auth)/login")}
          />
        </View>
      </ScreenContainer>
    );
  }

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
            {t("auth.resetPasswordTitle")}
          </AppText>

          <AppText variant="body" color="rgba(255,255,255,0.75)">
            {t("auth.resetPasswordSubtitle")}
          </AppText>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ paddingHorizontal: 20, paddingTop: 24, gap: 14 }}
      >
        <AppInput
          label={t("auth.resetToken")}
          placeholder={t("auth.resetTokenPlaceholder")}
          autoCapitalize="none"
          autoCorrect={false}
          value={token}
          onChangeText={(value) => {
            setToken(value);
            setError("");
          }}
          leftIcon={<KeyRound size={18} color={theme.colors.textMuted} />}
        />

        <AppInput
          label={t("auth.newPassword")}
          placeholder="••••••••"
          secureTextEntry={!passwordVisible}
          value={newPassword}
          onChangeText={(value) => {
            setNewPassword(value);
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

        <AppInput
          label={t("auth.confirmNewPassword")}
          placeholder="••••••••"
          secureTextEntry={!confirmVisible}
          value={confirmPassword}
          onChangeText={(value) => {
            setConfirmPassword(value);
            setError("");
          }}
          leftIcon={<Lock size={18} color={theme.colors.textMuted} />}
          rightIcon={
            <Pressable
              onPress={() => setConfirmVisible((v) => !v)}
              hitSlop={10}
            >
              {confirmVisible ? (
                <EyeOff size={18} color={theme.colors.textMuted} />
              ) : (
                <Eye size={18} color={theme.colors.textMuted} />
              )}
            </Pressable>
          }
        />

        <View
          style={{
            padding: 12,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surfaceAlt,
            gap: 8,
          }}
        >
          <AppText variant="caption" color={theme.colors.textMuted}>
            {t("auth.passwordRequirements")}
          </AppText>

          <PasswordRuleRow
            ok={passwordRules.minLength}
            label={t("auth.passwordReqMin")}
          />

          <PasswordRuleRow
            ok={passwordRules.uppercase}
            label={t("auth.passwordReqUpper")}
          />

          <PasswordRuleRow
            ok={passwordRules.lowercase}
            label={t("auth.passwordReqLower")}
          />

          <PasswordRuleRow
            ok={passwordRules.number}
            label={t("auth.passwordReqNumber")}
          />

          <PasswordRuleRow
            ok={passwordRules.special}
            label={t("auth.passwordReqSpecial")}
          />

          <PasswordRuleRow
            ok={passwordRules.match}
            label={t("auth.passwordRuleMatch")}
          />
        </View>

        {error ? (
          <AppText variant="small" color={theme.colors.danger}>
            {error}
          </AppText>
        ) : null}

        <AppButton
          title={
            submitting ? t("auth.resettingPassword") : t("auth.resetPassword")
          }
          size="lg"
          loading={submitting}
          onPress={onSubmit}
          fullWidth
        />
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function PasswordRuleRow({ ok, label }: { ok: boolean; label: string }) {
  const { theme } = useTheme();

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      {ok ? (
        <CheckCircle2 size={16} color={theme.colors.success} />
      ) : (
        <XCircle size={16} color={theme.colors.textMuted} />
      )}

      <AppText
        variant="small"
        color={ok ? theme.colors.success : theme.colors.textMuted}
        style={{ fontWeight: ok ? "700" : "500" }}
      >
        {label}
      </AppText>
    </View>
  );
}