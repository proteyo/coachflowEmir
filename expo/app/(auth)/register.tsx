import { router } from "expo-router";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Languages,
  Lock,
  Mail,
  User as UserIcon,
  XCircle,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { LanguageModal } from "@/src/components/LanguageModal";
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
import { LANGUAGES } from "@/src/i18n/translations";
import { FitnessLevel, GoalType, Role } from "@/src/types/models";

const GOAL_KEYS: { key: GoalType; tKey: string }[] = [
  { key: "lose_weight", tKey: "auth.goalLose" },
  { key: "gain_muscle", tKey: "auth.goalGain" },
  { key: "improve_mobility", tKey: "auth.goalMobility" },
  { key: "maintain_shape", tKey: "auth.goalMaintain" },
  { key: "custom", tKey: "auth.goalCustom" },
];

const FITNESS_LEVEL_KEYS: { key: FitnessLevel; tKey: string }[] = [
  { key: "beginner", tKey: "auth.fitnessBeginner" },
  { key: "intermediate", tKey: "auth.fitnessIntermediate" },
  { key: "advanced", tKey: "auth.fitnessAdvanced" },
];

function getPasswordRules(password: string) {
  return {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

function isStrongPassword(password: string) {
  const rules = getPasswordRules(password);

  return (
    rules.minLength &&
    rules.uppercase &&
    rules.lowercase &&
    rules.number &&
    rules.special
  );
}

export default function Register() {
  const { theme } = useTheme();
  const { lang, setLanguage, t } = useI18n();
  const { register } = useAuth();

  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [passwordVisible, setPasswordVisible] = useState<boolean>(false);
  const [languageVisible, setLanguageVisible] = useState<boolean>(false);
  const [role, setRole] = useState<Role>("client");

  const [age, setAge] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [startWeight, setStartWeight] = useState<string>("");
  const [currentWeight, setCurrentWeight] = useState<string>("");
  const [fitnessLevel, setFitnessLevel] = useState<FitnessLevel>("beginner");

  const [goalType, setGoalType] = useState<GoalType | null>(null);
  const [goalText, setGoalText] = useState<string>("");

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const currentLanguage = LANGUAGES.find((item) => item.code === lang);

  const passwordRules = useMemo(() => getPasswordRules(password), [password]);
  const strongPassword = useMemo(() => isStrongPassword(password), [password]);

  const parsePositiveNumber = (value: string) => {
    const parsed = parseFloat(value.replace(",", "."));

    return Number.isFinite(parsed) ? parsed : 0;
  };

  const clearError = () => {
    if (error) setError("");
  };

  const onSubmit = async () => {
    setError("");

    if (!name.trim()) {
      setError(t("auth.nameRequired"));
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(t("auth.emailInvalid"));
      return;
    }

    if (!strongPassword) {
      setError(t("auth.passwordStrongRequired"));
      return;
    }

    let parsedAge: number | undefined;
    let parsedHeight: number | undefined;
    let parsedStartWeight: number | undefined;
    let parsedCurrentWeight: number | undefined;
    let goalLabel = "";

    if (role === "client") {
      const a = parseInt(age, 10);

      if (!a || a < 10 || a > 100) {
        setError(t("auth.ageInvalid"));
        return;
      }

      parsedAge = a;

      const h = parsePositiveNumber(height);

      if (!h || h < 80 || h > 250) {
        setError(t("auth.heightInvalid"));
        return;
      }

      parsedHeight = h;

      const sw = parsePositiveNumber(startWeight);

      if (!sw || sw < 20 || sw > 300) {
        setError(t("auth.startWeightInvalid"));
        return;
      }

      parsedStartWeight = sw;

      const cw = parsePositiveNumber(currentWeight);

      if (!cw || cw < 20 || cw > 300) {
        setError(t("auth.currentWeightInvalid"));
        return;
      }

      parsedCurrentWeight = cw;

      if (!goalType) {
        setError(t("auth.goalRequired"));
        return;
      }

      /*
        ВАЖНО:
        Для стандартных целей НЕ сохраняем переведённый текст.
        Сохраняем только goalType: lose_weight / gain_muscle / improve_mobility / maintain_shape.
        Это нужно, чтобы цель потом могла переводиться при смене языка.

        goal сохраняем только если цель custom.
      */
      goalLabel = goalType === "custom" ? goalText.trim() : "";

      if (goalType === "custom" && !goalLabel) {
        setError(t("auth.goalRequired"));
        return;
      }
    }

    try {
      setSubmitting(true);

      const res = await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        age: parsedAge,
        goalType: role === "client" ? (goalType ?? undefined) : undefined,
        goal: goalLabel || undefined,
        height: parsedHeight,
        startWeight: parsedStartWeight,
        currentWeight: parsedCurrentWeight,
        fitnessLevel: role === "client" ? fitnessLevel : undefined,
      } as any);

      if (!res.ok) {
        setError(res.error ?? t("auth.failedRegister"));
        return;
      }

      router.replace("/");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer scroll>
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
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 4,
          gap: 12,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ArrowLeft color={theme.colors.text} size={22} />
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
              onPress={() => {
                setRole(r);
                setError("");
              }}
              style={{
                flex: 1,
                padding: 16,
                borderRadius: theme.radius.lg,
                borderWidth: 2,
                borderColor: active ? theme.colors.primary : theme.colors.border,
                backgroundColor: active
                  ? "rgba(22,199,132,0.1)"
                  : theme.colors.surface,
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

      <View style={{ marginTop: 20, gap: 14, paddingBottom: 40 }}>
        <AppInput
          label={t("auth.name")}
          placeholder={t("auth.namePlaceholder")}
          value={name}
          onChangeText={(value) => {
            setName(value);
            clearError();
          }}
          autoCapitalize="words"
          autoCorrect={false}
          textContentType="name"
          autoComplete="name"
          returnKeyType="next"
          submitBehavior="submit"
          leftIcon={<UserIcon size={18} color={theme.colors.textMuted} />}
        />

        <AppInput
          label={t("auth.email")}
          placeholder={t("auth.emailPlaceholder")}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          inputMode="email"
          textContentType="emailAddress"
          autoComplete="email"
          returnKeyType="next"
          submitBehavior="submit"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            clearError();
          }}
          leftIcon={<Mail size={18} color={theme.colors.textMuted} />}
        />

        <AppInput
          label={t("auth.password")}
          placeholder={t("auth.passwordPlaceholder")}
          secureTextEntry={!passwordVisible}
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            clearError();
          }}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          autoComplete="new-password"
          returnKeyType={role === "coach" ? "done" : "next"}
          submitBehavior={role === "coach" ? "blurAndSubmit" : "submit"}
          onSubmitEditing={() => {
            if (role === "coach") {
              onSubmit();
            }
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
        </View>

        {role === "client" ? (
          <>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <AppInput
                  label={t("auth.age")}
                  placeholder={t("auth.agePlaceholder")}
                  value={age}
                  onChangeText={(value) => {
                    setAge(value.replace(/[^\d]/g, ""));
                    clearError();
                  }}
                  keyboardType="numeric"
                  inputMode="numeric"
                  returnKeyType="next"
                  submitBehavior="submit"
                  maxLength={3}
                />
              </View>

              <View style={{ flex: 1 }}>
                <AppInput
                  label={t("auth.height")}
                  placeholder={t("auth.heightPlaceholder")}
                  value={height}
                  onChangeText={(value) => {
                    setHeight(value.replace(/[^0-9.,]/g, ""));
                    clearError();
                  }}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  returnKeyType="next"
                  submitBehavior="submit"
                  maxLength={6}
                />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <AppInput
                  label={t("auth.startWeight")}
                  placeholder={t("auth.startWeightPlaceholder")}
                  value={startWeight}
                  onChangeText={(value) => {
                    setStartWeight(value.replace(/[^0-9.,]/g, ""));
                    clearError();
                  }}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  returnKeyType="next"
                  submitBehavior="submit"
                  maxLength={6}
                />
              </View>

              <View style={{ flex: 1 }}>
                <AppInput
                  label={t("auth.currentWeight")}
                  placeholder={t("auth.currentWeightPlaceholder")}
                  value={currentWeight}
                  onChangeText={(value) => {
                    setCurrentWeight(value.replace(/[^0-9.,]/g, ""));
                    clearError();
                  }}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  returnKeyType="done"
                  submitBehavior="blurAndSubmit"
                />
              </View>
            </View>

            <AppText
              variant="caption"
              color={theme.colors.textMuted}
              style={{ textTransform: "uppercase" }}
            >
              {t("auth.fitnessLevel")}
            </AppText>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {FITNESS_LEVEL_KEYS.map((level) => (
                <AppChip
                  key={level.key}
                  label={t(level.tKey as never)}
                  active={fitnessLevel === level.key}
                  onPress={() => setFitnessLevel(level.key)}
                />
              ))}
            </View>

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
                  onPress={() => {
                    setGoalType(g.key);
                    setError("");
                  }}
                />
              ))}
            </View>

            {goalType === "custom" ? (
              <AppInput
                placeholder={t("auth.goalCustomPlaceholder")}
                value={goalText}
                onChangeText={(value) => {
                  setGoalText(value);
                  clearError();
                }}
                autoCapitalize="sentences"
                returnKeyType="done"
                submitBehavior="blurAndSubmit"
                multiline
                style={{
                  minHeight: 72,
                  textAlignVertical: "top",
                  paddingTop: 10,
                }}
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
          title={submitting ? t("auth.registering") : t("auth.register")}
          size="lg"
          loading={submitting}
          onPress={onSubmit}
          fullWidth
        />

        <View style={{ height: 40 }} />
      </View>
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