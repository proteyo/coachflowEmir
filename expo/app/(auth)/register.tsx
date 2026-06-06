import { router } from "expo-router";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Languages,
  Lock,
  Mail,
  RefreshCw,
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
import { FitnessLevel, Gender, GoalType, Role } from "@/src/types/models";

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

const GENDER_KEYS: { key: Gender; ru: string; en: string; kk: string }[] = [
  { key: "male", ru: "Мужской", en: "Male", kk: "Ер" },
  { key: "female", ru: "Женский", en: "Female", kk: "Әйел" },
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

function cleanVerificationCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

export default function Register() {
  const { theme } = useTheme();
  const { lang, setLanguage, t } = useI18n();
  const { register, verifyEmail, resendVerificationCode } = useAuth();

  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [passwordVisible, setPasswordVisible] = useState<boolean>(false);
  const [languageVisible, setLanguageVisible] = useState<boolean>(false);
  const [role, setRole] = useState<Role>("client");

  const [gender, setGender] = useState<Gender>("male");
  const [age, setAge] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [startWeight, setStartWeight] = useState<string>("");
  const [currentWeight, setCurrentWeight] = useState<string>("");
  const [fitnessLevel, setFitnessLevel] = useState<FitnessLevel>("beginner");

  const [goalType, setGoalType] = useState<GoalType | null>(null);
  const [goalText, setGoalText] = useState<string>("");

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [resending, setResending] = useState<boolean>(false);

  const [error, setError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  const [verificationStep, setVerificationStep] = useState<boolean>(false);
  const [verificationEmail, setVerificationEmail] = useState<string>("");
  const [verificationCode, setVerificationCode] = useState<string>("");

  const currentLanguage = LANGUAGES.find((item) => item.code === lang);

  const passwordRules = useMemo(() => getPasswordRules(password), [password]);
  const strongPassword = useMemo(() => isStrongPassword(password), [password]);

  const getText = (ru: string, en: string, kk: string) => {
    if (lang === "ru") return ru;
    if (lang === "kk") return kk;
    return en;
  };

  const parsePositiveNumber = (value: string) => {
    const parsed = parseFloat(value.replace(",", "."));

    return Number.isFinite(parsed) ? parsed : 0;
  };

  const clearError = () => {
    if (error) setError("");
    if (successMessage) setSuccessMessage("");
  };

  const onSubmit = async () => {
    setError("");
    setSuccessMessage("");

    if (!name.trim()) {
      setError(t("auth.nameRequired" as never));
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(t("auth.emailInvalid" as never));
      return;
    }

    if (!strongPassword) {
      setError(t("auth.passwordStrongRequired" as never));
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
        setError(t("auth.ageInvalid" as never));
        return;
      }

      parsedAge = a;

      const h = parsePositiveNumber(height);

      if (!h || h < 80 || h > 250) {
        setError(t("auth.heightInvalid" as never));
        return;
      }

      parsedHeight = h;

      const sw = parsePositiveNumber(startWeight);

      if (!sw || sw < 20 || sw > 300) {
        setError(t("auth.startWeightInvalid" as never));
        return;
      }

      parsedStartWeight = sw;

      const cw = parsePositiveNumber(currentWeight);

      if (!cw || cw < 20 || cw > 300) {
        setError(t("auth.currentWeightInvalid" as never));
        return;
      }

      parsedCurrentWeight = cw;

      if (!goalType) {
        setError(t("auth.goalRequired" as never));
        return;
      }

      goalLabel = goalType === "custom" ? goalText.trim() : "";

      if (goalType === "custom" && !goalLabel) {
        setError(t("auth.goalRequired" as never));
        return;
      }
    }

    try {
      setSubmitting(true);

      const normalizedEmail = email.trim().toLowerCase();

      const res = await register({
        name: name.trim(),
        email: normalizedEmail,
        password,
        role,
        gender: role === "client" ? gender : undefined,
        age: parsedAge,
        goalType: role === "client" ? (goalType ?? undefined) : undefined,
        goal: goalLabel || undefined,
        height: parsedHeight,
        startWeight: parsedStartWeight,
        currentWeight: parsedCurrentWeight,
        fitnessLevel: role === "client" ? fitnessLevel : undefined,
      } as any);

      if (!res.ok) {
        setError(res.error ?? t("auth.failedRegister" as never));
        return;
      }

      setVerificationEmail(res.email ?? normalizedEmail);
      setVerificationStep(true);
      setVerificationCode("");
      setSuccessMessage(
        getText(
          "Мы отправили 6-значный код на вашу почту.",
          "We sent a 6-digit code to your email.",
          "Поштаңызға 6 таңбалы код жіберілді.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onVerifyEmail = async () => {
    setError("");
    setSuccessMessage("");

    const code = cleanVerificationCode(verificationCode);

    if (code.length !== 6) {
      setError(
        getText(
          "Введите 6-значный код из письма.",
          "Enter the 6-digit code from the email.",
          "Хаттағы 6 таңбалы кодты енгізіңіз.",
        ),
      );
      return;
    }

    try {
      setVerifying(true);

      const res = await verifyEmail(verificationEmail, code);

      if (!res.ok) {
        setError(
          res.error ??
            getText(
              "Не удалось подтвердить почту.",
              "Could not verify email.",
              "Поштаны растау мүмкін болмады.",
            ),
        );
        return;
      }

      router.replace("/");
    } finally {
      setVerifying(false);
    }
  };

  const onResendCode = async () => {
    setError("");
    setSuccessMessage("");

    if (!verificationEmail) return;

    try {
      setResending(true);

      const res = await resendVerificationCode(verificationEmail);

      if (!res.ok) {
        setError(
          res.error ??
            getText(
              "Не удалось отправить код повторно.",
              "Could not resend the code.",
              "Кодты қайта жіберу мүмкін болмады.",
            ),
        );
        return;
      }

      setSuccessMessage(
        getText(
          "Новый код отправлен на вашу почту.",
          "A new code has been sent to your email.",
          "Жаңа код поштаңызға жіберілді.",
        ),
      );
    } finally {
      setResending(false);
    }
  };

  const renderPasswordRule = (
    ok: boolean,
    ru: string,
    en: string,
    kk: string,
  ) => {
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
          {getText(ru, en, kk)}
        </AppText>
      </View>
    );
  };

  if (verificationStep) {
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
          <Pressable
            onPress={() => {
              setVerificationStep(false);
              setVerificationCode("");
              setError("");
              setSuccessMessage("");
            }}
            hitSlop={10}
          >
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

        <View style={{ marginTop: 26, gap: 8 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 24,
              backgroundColor: "rgba(22,199,132,0.12)",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 10,
            }}
          >
            <Mail color={theme.colors.primary} size={30} />
          </View>

          <AppText variant="title">
            {getText(
              "Подтвердите почту",
              "Verify your email",
              "Поштаны растаңыз",
            )}
          </AppText>

          <AppText variant="small" color={theme.colors.textMuted}>
            {getText(
              `Мы отправили код на ${verificationEmail}. Введите его ниже, чтобы активировать аккаунт.`,
              `We sent a code to ${verificationEmail}. Enter it below to activate your account.`,
              `Код ${verificationEmail} поштасына жіберілді. Аккаунтты белсендіру үшін төменге енгізіңіз.`,
            )}
          </AppText>
        </View>

        <View
          style={{
            marginTop: 22,
            padding: 16,
            borderRadius: theme.radius.xl,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
            gap: 14,
          }}
        >
          <AppInput
            label={getText(
              "6-значный код",
              "6-digit code",
              "6 таңбалы код",
            )}
            value={verificationCode}
            onChangeText={(value) => {
              clearError();
              setVerificationCode(cleanVerificationCode(value));
            }}
            placeholder="000000"
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={6}
            leftIcon={<Lock color={theme.colors.textMuted} size={18} />}
          />

          {error ? (
            <View
              style={{
                padding: 12,
                borderRadius: theme.radius.md,
                backgroundColor: "rgba(255, 77, 79, 0.12)",
                borderWidth: 1,
                borderColor: "rgba(255, 77, 79, 0.22)",
              }}
            >
              <AppText variant="small" color={theme.colors.danger}>
                {error}
              </AppText>
            </View>
          ) : null}

          {successMessage ? (
            <View
              style={{
                padding: 12,
                borderRadius: theme.radius.md,
                backgroundColor: "rgba(22,199,132,0.12)",
                borderWidth: 1,
                borderColor: "rgba(22,199,132,0.22)",
              }}
            >
              <AppText variant="small" color={theme.colors.primary}>
                {successMessage}
              </AppText>
            </View>
          ) : null}

          <AppButton
            title={getText("Подтвердить", "Verify", "Растау")}
            onPress={onVerifyEmail}
            loading={verifying}
            size="lg"
            fullWidth
          />

          <Pressable
            onPress={onResendCode}
            disabled={resending}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 12,
              opacity: pressed || resending ? 0.65 : 1,
            })}
          >
            <RefreshCw color={theme.colors.primary} size={17} />

            <AppText
              variant="small"
              color={theme.colors.primary}
              style={{ fontWeight: "800" }}
            >
              {resending
                ? getText("Отправляем...", "Sending...", "Жіберілуде...")
                : getText(
                    "Отправить код ещё раз",
                    "Resend code",
                    "Кодты қайта жіберу",
                  )}
            </AppText>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

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
        <AppText variant="title">{t("auth.getStarted" as never)}</AppText>

        <AppText variant="small" color={theme.colors.textMuted}>
          {getText(
            "Создайте аккаунт. После регистрации мы отправим код подтверждения на вашу почту.",
            "Create your account. After registration, we will send a verification code to your email.",
            "Аккаунт жасаңыз. Тіркелгеннен кейін поштаңызға растау коды жіберіледі.",
          )}
        </AppText>
      </View>

      <View style={{ flexDirection: "row", gap: 12, marginTop: 18 }}>
        {(["coach", "client"] as Role[]).map((itemRole) => {
          const active = role === itemRole;

          return (
            <Pressable
              key={itemRole}
              onPress={() => {
                setRole(itemRole);
                setError("");
                setSuccessMessage("");
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
                {itemRole === "coach"
                  ? t("auth.coach" as never)
                  : t("auth.client" as never)}
              </AppText>

              <AppText variant="small" color={theme.colors.textMuted}>
                {itemRole === "coach"
                  ? t("auth.coachIntro" as never)
                  : t("auth.clientIntro" as never)}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: 20, gap: 14, paddingBottom: 40 }}>
        <AppInput
          label={t("auth.name" as never)}
          placeholder={t("auth.namePlaceholder" as never)}
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
          label={t("auth.email" as never)}
          placeholder={t("auth.emailPlaceholder" as never)}
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
          label={t("auth.password" as never)}
          placeholder={t("auth.passwordPlaceholder" as never)}
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
              onPress={() => setPasswordVisible((value) => !value)}
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
            {t("auth.passwordRequirements" as never)}
          </AppText>

          {renderPasswordRule(
            passwordRules.minLength,
            "Минимум 8 символов",
            "At least 8 characters",
            "Кемінде 8 таңба",
          )}

          {renderPasswordRule(
            passwordRules.uppercase,
            "Одна заглавная буква",
            "One uppercase letter",
            "Бір бас әріп",
          )}

          {renderPasswordRule(
            passwordRules.lowercase,
            "Одна строчная буква",
            "One lowercase letter",
            "Бір кіші әріп",
          )}

          {renderPasswordRule(
            passwordRules.number,
            "Одна цифра",
            "One number",
            "Бір сан",
          )}

          {renderPasswordRule(
            passwordRules.special,
            "Один специальный символ",
            "One special character",
            "Бір арнайы таңба",
          )}
        </View>

        {role === "client" ? (
          <>
            <AppText
              variant="caption"
              color={theme.colors.textMuted}
              style={{ textTransform: "uppercase" }}
            >
              {getText("Пол", "Gender", "Жынысы")}
            </AppText>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {GENDER_KEYS.map((item) => (
                <AppChip
                  key={item.key}
                  label={getText(item.ru, item.en, item.kk)}
                  active={gender === item.key}
                  onPress={() => {
                    clearError();
                    setGender(item.key);
                  }}
                />
              ))}
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <AppInput
                  label={t("auth.age" as never)}
                  placeholder={t("auth.agePlaceholder" as never)}
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
                  label={t("auth.height" as never)}
                  placeholder={t("auth.heightPlaceholder" as never)}
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
                  label={t("auth.startWeight" as never)}
                  placeholder={t("auth.startWeightPlaceholder" as never)}
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
                  label={t("auth.currentWeight" as never)}
                  placeholder={t("auth.currentWeightPlaceholder" as never)}
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
              {t("auth.fitnessLevel" as never)}
            </AppText>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {FITNESS_LEVEL_KEYS.map((level) => (
                <AppChip
                  key={level.key}
                  label={t(level.tKey as never)}
                  active={fitnessLevel === level.key}
                  onPress={() => {
                    clearError();
                    setFitnessLevel(level.key);
                  }}
                />
              ))}
            </View>

            <AppText
              variant="caption"
              color={theme.colors.textMuted}
              style={{ textTransform: "uppercase" }}
            >
              {getText("Цель", "Goal", "Мақсат")}
            </AppText>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {GOAL_KEYS.map((goal) => (
                <AppChip
                  key={goal.key}
                  label={t(goal.tKey as never)}
                  active={goalType === goal.key}
                  onPress={() => {
                    clearError();
                    setGoalType(goal.key);
                  }}
                />
              ))}
            </View>

            {goalType === "custom" ? (
              <AppInput
                placeholder={t("auth.goalCustomPlaceholder" as never)}
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
          <View
            style={{
              padding: 12,
              borderRadius: theme.radius.md,
              backgroundColor: "rgba(255, 77, 79, 0.12)",
              borderWidth: 1,
              borderColor: "rgba(255, 77, 79, 0.22)",
            }}
          >
            <AppText variant="small" color={theme.colors.danger}>
              {error}
            </AppText>
          </View>
        ) : null}

        <AppButton
          title={
            submitting
              ? t("auth.registering" as never)
              : t("auth.register" as never)
          }
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