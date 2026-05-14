import { router } from "expo-router";
import React, { useState } from "react";
import { View } from "react-native";

import {
  AppButton,
  AppInput,
  AppText,
  ScreenContainer,
} from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";
import { apiPost } from "@/src/services/api";

export default function AddWeight() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const { user, token } = useAuth();
  const { refreshFromBackend } = useData();

  const [weight, setWeight] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);

  const clearError = () => {
    if (error) setError("");
  };

  const submit = async () => {
    if (saving) return;

    setError("");

    const v = parseFloat(weight.replace(",", "."));

    if (!v || v <= 0 || v > 300) {
      setError(t("progress.invalidWeight"));
      return;
    }

    if (!user || !token) {
      setError(t("profile.loginAgainText"));
      return;
    }

    if (user.role !== "client") {
      setError(t("progress.onlyClientsCanLogWeight"));
      return;
    }

    try {
      setSaving(true);

      await apiPost(
        "/progress",
        {
          weight: v,
          date: new Date().toISOString(),
          notes: notes.trim() || undefined,
        },
        { token },
      );

      await refreshFromBackend();

      router.back();
    } catch (e: any) {
      console.log("[add-weight] save error", e);

      setError(e?.message || t("progress.saveWeightError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer scroll>
      <View style={{ gap: 12, paddingBottom: 40 }}>
        <AppText variant="title">{t("progress.logWeight")}</AppText>

        <AppText variant="small" color={theme.colors.textMuted}>
          {t("progress.trackRegularly")}
        </AppText>

        <AppInput
          label={t("progress.weightLabel")}
          value={weight}
          onChangeText={(value) => {
            setWeight(value.replace(/[^0-9.,]/g, ""));
            clearError();
          }}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder="65.4"
          returnKeyType="next"
          submitBehavior="submit"
          maxLength={6}
        />

        <AppInput
          label={t("progress.notesOptional")}
          value={notes}
          onChangeText={(value) => {
            setNotes(value);
            clearError();
          }}
          placeholder={t("progress.notesPlaceholder")}
          multiline
          autoCapitalize="sentences"
          autoCorrect
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          onSubmitEditing={submit}
          style={{
            minHeight: 96,
            textAlignVertical: "top",
            paddingTop: 10,
          }}
        />

        {error ? (
          <AppText variant="small" color={theme.colors.danger}>
            {error}
          </AppText>
        ) : null}

        <AppButton
          title={saving ? t("progress.savingEntry") : t("progress.saveEntry")}
          size="lg"
          loading={saving}
          disabled={saving}
          onPress={submit}
          fullWidth
        />

        <View style={{ height: 24 }} />
      </View>
    </ScreenContainer>
  );
}