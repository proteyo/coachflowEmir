import { LinearGradient } from "expo-linear-gradient";
import { Link, router } from "expo-router";
import { Dumbbell, Lock, Mail } from "lucide-react-native";
import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, View } from "react-native";
import { AppButton, AppInput, AppText, ScreenContainer } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";

export default function Login() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const { login } = useAuth();
  const [email, setEmail] = useState<string>("coach@demo.com");
  const [password, setPassword] = useState<string>("demo123");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const onSubmit = async () => {
    setError("");
    if (!email || !password) {
      setError(t("auth.bothRequired"));
      return;
    }
    setSubmitting(true);
    const res = await login(email, password);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? t("auth.failedLogin"));
      return;
    }
    router.replace("/");
  };

  const useDemo = (e: string) => {
    setEmail(e);
    setPassword("demo123");
  };

  return (
    <ScreenContainer scroll padded={false} edges={["top"]}>
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
        <View style={{ marginTop: 28 }}>
          <AppText variant="display" color="#fff">
            {t("auth.welcomeBack")}
          </AppText>
          <AppText variant="body" color="rgba(255,255,255,0.75)" style={{ marginTop: 6 }}>
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
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          leftIcon={<Mail size={18} color={theme.colors.textMuted} />}
        />
        <AppInput
          label={t("auth.password")}
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          leftIcon={<Lock size={18} color={theme.colors.textMuted} />}
        />
        {error ? (
          <AppText variant="small" color={theme.colors.danger}>
            {error}
          </AppText>
        ) : null}
        <AppButton title={t("auth.signIn")} size="lg" loading={submitting} onPress={onSubmit} fullWidth />

        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 4 }}>
          <Link href="/(auth)/register" asChild>
            <Pressable>
              <AppText variant="small" color={theme.colors.primary} style={{ fontWeight: "700" }}>
                {t("auth.noAccount")}
              </AppText>
            </Pressable>
          </Link>
        </View>

        <View
          style={{
            marginTop: 18,
            borderRadius: 16,
            backgroundColor: theme.colors.surfaceAlt,
            padding: 14,
            gap: 8,
          }}
        >
          <AppText variant="caption" color={theme.colors.textMuted}>
            {t("auth.demoAccounts")}
          </AppText>
          {[
            { e: "coach@demo.com", l: "Coach — Alex Mitchell" },
            { e: "sarah@demo.com", l: "Client — Sarah Lee" },
            { e: "mike@demo.com", l: "Client — Mike Chen" },
            { e: "emma@demo.com", l: "Client — Emma Rivera" },
          ].map((d) => (
            <Pressable
              key={d.e}
              onPress={() => useDemo(d.e)}
              style={({ pressed }) => ({
                paddingVertical: 8,
                opacity: pressed ? 0.7 : 1,
                flexDirection: "row",
                justifyContent: "space-between",
              })}
            >
              <AppText variant="small">{d.l}</AppText>
              <AppText variant="small" color={theme.colors.primary}>
                {t("auth.use")}
              </AppText>
            </Pressable>
          ))}
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
