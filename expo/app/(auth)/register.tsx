import { router } from "expo-router";
import { ArrowLeft, Lock, Mail, User as UserIcon } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, View } from "react-native";
import {
  AppButton,
  AppChip,
  AppInput,
  AppText,
  ScreenContainer,
} from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";
import { GoalType, Role } from "@/src/types/models";

const GOAL_KEYS: { key: GoalType; tKey: string }[] = [
  { key: "lose_weight", tKey: "auth.goalLose" },
  { key: "gain_muscle", tKey: "auth.goalGain" },
  { key: "improve_mobility", tKey: "auth.goalMobility" },
  { key: "maintain_shape", tKey: "auth.goalMaintain" },
  { key: "custom", tKey: "auth.goalCustom" },
];

export default function Register() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const { register } = useAuth();
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [role, setRole] = useState<Role>("client");
  const [age, setAge] = useState<string>("");
  const [goalType, setGoalType] = useState<GoalType | null>(null);
  const [goalText, setGoalText] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const onSubmit = async () => {
    setError("");
    if (!name.trim()) return setError(t("auth.nameRequired"));
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError(t("auth.emailInvalid"));
    if (password.length < 6) return setError(t("auth.passwordTooShort"));

    let parsedAge: number | undefined;
    let goalLabel = "";
    if (role === "client") {
      const a = parseInt(age, 10);
      if (!a || a < 10 || a > 100) return setError(t("auth.ageInvalid"));
      parsedAge = a;
      if (!goalType) return setError(t("auth.goalRequired"));
      const labelKey = GOAL_KEYS.find((g) => g.key === goalType)?.tKey;
      goalLabel = goalType === "custom" ? goalText.trim() : (labelKey ? t(labelKey as never) : "");
      if (goalType === "custom" && !goalLabel) return setError(t("auth.goalRequired"));
    }

    setSubmitting(true);
    const res = await register({
      name,
      email,
      password,
      role,
      age: parsedAge,
      goalType: role === "client" ? (goalType ?? undefined) : undefined,
      goal: goalLabel || undefined,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? t("auth.failedRegister"));
      return;
    }
    router.replace("/");
  };

  return (
    <ScreenContainer scroll>
      <View style={{ flexDirection: "row", alignItems: "center", paddingTop: 4 }}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ArrowLeft color={theme.colors.text} size={22} />
        </Pressable>
      </View>
      <View style={{ marginTop: 16, gap: 4 }}>
        <AppText variant="title">{t("auth.getStarted")}</AppText>
        <AppText variant="small" color={theme.colors.textMuted}>
          {t("auth.pickRole")}
        </AppText>
      </View>

      <View style={{ flexDirection: "row", gap: 12, marginTop: 18 }}>
        {(["coach", "client"] as Role[]).map((r) => {
          const active = role === r;
          return (
            <Pressable
              key={r}
              onPress={() => setRole(r)}
              style={{
                flex: 1,
                padding: 16,
                borderRadius: theme.radius.lg,
                borderWidth: 2,
                borderColor: active ? theme.colors.primary : theme.colors.border,
                backgroundColor: active ? "rgba(22,199,132,0.1)" : theme.colors.surface,
                gap: 6,
              }}
            >
              <AppText variant="h3">
                {r === "coach" ? t("auth.coach") : t("auth.client")}
              </AppText>
              <AppText variant="small" color={theme.colors.textMuted}>
                {r === "coach" ? t("auth.coachIntro") : t("auth.clientIntro")}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: 20, gap: 14 }}>
        <AppInput
          label={t("auth.name")}
          placeholder={t("auth.namePlaceholder")}
          value={name}
          onChangeText={setName}
          leftIcon={<UserIcon size={18} color={theme.colors.textMuted} />}
        />
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
          placeholder={t("auth.passwordPlaceholder")}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          leftIcon={<Lock size={18} color={theme.colors.textMuted} />}
        />

        {role === "client" ? (
          <>
            <AppInput
              label={t("auth.age")}
              placeholder={t("auth.agePlaceholder")}
              value={age}
              onChangeText={setAge}
              keyboardType="numeric"
            />
            <AppText
              variant="caption"
              color={theme.colors.textMuted}
              style={{ textTransform: "uppercase" }}
            >
              {t("auth.goalType")}
            </AppText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {GOAL_KEYS.map((g) => (
                <AppChip
                  key={g.key}
                  label={t(g.tKey as never)}
                  active={goalType === g.key}
                  onPress={() => setGoalType(g.key)}
                />
              ))}
            </View>
            {goalType === "custom" ? (
              <AppInput
                placeholder={t("auth.goalCustomPlaceholder")}
                value={goalText}
                onChangeText={setGoalText}
              />
            ) : null}
          </>
        ) : null}

        {error ? (
          <AppText variant="small" color={theme.colors.danger}>
            {error}
          </AppText>
        ) : null}
        <AppButton
          title={t("auth.register")}
          size="lg"
          loading={submitting}
          onPress={onSubmit}
          fullWidth
        />
      </View>
    </ScreenContainer>
  );
}
