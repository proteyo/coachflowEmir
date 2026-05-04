import { router } from "expo-router";
import React, { useState } from "react";
import { View } from "react-native";
import { AppButton, AppInput, AppText, ScreenContainer } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";

export default function AddWeight() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const { update } = useData();
  const [weight, setWeight] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [error, setError] = useState<string>("");

  const submit = () => {
    setError("");
    const v = parseFloat(weight);
    if (!v || v <= 0) return setError(t("progress.invalidWeight"));
    if (!user) return;
    update((d) => ({
      ...d,
      progress: [
        ...d.progress,
        {
          id: `pr_${Date.now()}`,
          clientId: user.id,
          weight: v,
          date: new Date().toISOString().slice(0, 10),
          notes: notes || undefined,
          addedBy: user.id,
        },
      ],
      clientProfiles: d.clientProfiles.map((c) =>
        c.userId === user.id ? { ...c, currentWeight: v } : c,
      ),
    }));
    router.back();
  };

  return (
    <ScreenContainer scroll>
      <View style={{ gap: 12 }}>
        <AppText variant="title">{t("progress.logWeight")}</AppText>
        <AppText variant="small" color={theme.colors.textMuted}>
          {t("progress.trackRegularly")}
        </AppText>
        <AppInput
          label={t("progress.weightLabel")}
          value={weight}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
          placeholder="65.4"
        />
        <AppInput
          label={t("progress.notesOptional")}
          value={notes}
          onChangeText={setNotes}
          placeholder={t("progress.notesPlaceholder")}
          multiline
        />
        {error ? (
          <AppText variant="small" color={theme.colors.danger}>
            {error}
          </AppText>
        ) : null}
        <AppButton title={t("progress.saveEntry")} size="lg" onPress={submit} fullWidth />
      </View>
    </ScreenContainer>
  );
}
