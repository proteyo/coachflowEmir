import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Check, CreditCard, Sparkles, Zap } from "lucide-react-native";
import React, { useState } from "react";
import { Alert, View } from "react-native";
import {
  AppButton,
  AppCard,
  AppText,
  ScreenContainer,
} from "@/src/components/ui";
import { useSubscription } from "@/src/context/SubscriptionContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";

export default function SubscriptionScreen() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const { sub, isActive, activate, cancel, renew } = useSubscription();
  const [busy, setBusy] = useState<boolean>(false);

  const FEATURES = [
    t("subscription.f1"),
    t("subscription.f2"),
    t("subscription.f3"),
    t("subscription.f4"),
    t("subscription.f5"),
    t("subscription.f6"),
  ];

  const purchase = async () => {
    setBusy(true);
    setTimeout(async () => {
      await activate();
      setBusy(false);
      Alert.alert(t("subscription.activatedTitle"), t("subscription.activatedMsg"));
    }, 900);
  };

  return (
    <ScreenContainer scroll padded={false}>
      <LinearGradient
        colors={theme.gradients.hero as readonly [string, string]}
        style={{
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: 36,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
        }}
      >
        <View
          style={{
            alignSelf: "flex-start",
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 999,
            backgroundColor: "rgba(22,199,132,0.2)",
            flexDirection: "row",
            gap: 6,
            alignItems: "center",
          }}
        >
          <Sparkles color="#16C784" size={14} />
          <AppText variant="caption" color="#16C784">
            {t("subscription.proName")}
          </AppText>
        </View>
        <AppText variant="display" color="#fff" style={{ marginTop: 14 }}>
          {t("subscription.title")}
        </AppText>
        <AppText variant="body" color="rgba(255,255,255,0.75)" style={{ marginTop: 4 }}>
          {t("subscription.subtitle")}
        </AppText>
      </LinearGradient>

      <View style={{ paddingHorizontal: 20, marginTop: 20, gap: 12 }}>
        <AppCard variant="elevated">
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <AppText variant="caption" color={theme.colors.textMuted}>
                {t("subscription.monthlyTag")}
              </AppText>
              <AppText variant="title">{t("subscription.plan")}</AppText>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <AppText variant="title" color={theme.colors.primary}>
                2 490 ₸
              </AppText>
              <AppText variant="small" color={theme.colors.textMuted}>
                {t("subscription.perMonth")}
              </AppText>
            </View>
          </View>
          <View style={{ marginTop: 12, gap: 8 }}>
            {FEATURES.map((f) => (
              <View key={f} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: "rgba(22,199,132,0.15)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Check size={14} color={theme.colors.primary} />
                </View>
                <AppText variant="small">{f}</AppText>
              </View>
            ))}
          </View>
          <View style={{ marginTop: 16 }}>
            {isActive ? (
              <>
                <AppButton title={t("subscription.renewNow")} onPress={renew} fullWidth />
                <View style={{ height: 8 }} />
                <AppButton title={t("subscription.cancel")} variant="secondary" onPress={cancel} fullWidth />
              </>
            ) : (
              <AppButton
                title={t("subscription.buy")}
                size="lg"
                loading={busy}
                onPress={purchase}
                icon={<CreditCard color={theme.colors.primaryContrast} size={18} />}
                fullWidth
              />
            )}
          </View>
        </AppCard>

        {sub ? (
          <AppCard variant="outline">
            <AppText variant="caption" color={theme.colors.textMuted}>
              {t("subscription.currentStatus")}
            </AppText>
            <View
              style={{
                marginTop: 6,
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <AppText variant="bodyStrong">{sub.status.toUpperCase()}</AppText>
              <AppText variant="small" color={theme.colors.textMuted}>
                {sub.endDate
                  ? `${t("subscription.until")} ${new Date(sub.endDate).toDateString().slice(4)}`
                  : t("subscription.notStarted")}
              </AppText>
            </View>
          </AppCard>
        ) : null}

        <AppText
          variant="small"
          color={theme.colors.textMuted}
          style={{ textAlign: "center", marginTop: 8 }}
        >
          {t("subscription.mockNote")}
        </AppText>
      </View>
    </ScreenContainer>
  );
}
