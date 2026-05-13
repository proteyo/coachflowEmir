import { router } from "expo-router";
import { Crown, Lock, LogOut } from "lucide-react-native";
import React, { ReactNode } from "react";
import { View } from "react-native";

import { AppButton, AppCard, AppText, ScreenContainer } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useSubscription } from "@/src/context/SubscriptionContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";

type SubscriptionGateProps = {
  children: ReactNode;
};

export default function SubscriptionGate({ children }: SubscriptionGateProps) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const { isActive, canStartFreeTrial } = useSubscription();

  const tt = (key: string, fallback: string) => {
    const value = t(key as never);
    return value && value !== key ? value : fallback;
  };

  const isCoach = user?.role === "coach";

  if (!isCoach) {
    return <>{children}</>;
  }

  if (isActive) {
    return <>{children}</>;
  }

  const handleGoToSubscription = () => {
    router.push("/subscription");
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <ScreenContainer>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          gap: 18,
          paddingVertical: 24,
        }}
      >
        <View
          style={{
            alignItems: "center",
            gap: 12,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 24,
              backgroundColor: theme.colors.surfaceAlt,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Lock color={theme.colors.primary} size={34} />
          </View>

          <View style={{ alignItems: "center", gap: 6 }}>
            <AppText variant="title" style={{ textAlign: "center" }}>
              {tt("subscription.gateTitle", "Subscription required")}
            </AppText>

            <AppText
              variant="body"
              color={theme.colors.textMuted}
              style={{ textAlign: "center", lineHeight: 22 }}
            >
              {tt(
                "subscription.gateMessage",
                "Activate a plan to use CoachFlow as a coach. All plans include the same tools; only the client limit changes.",
              )}
            </AppText>
          </View>
        </View>

        <AppCard variant="outline">
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Crown color={theme.colors.primary} size={22} />

              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">
                  {tt("subscription.currentAccess", "Current access")}
                </AppText>

                <AppText variant="small" color={theme.colors.textMuted}>
                  {tt("subscription.noActiveSubscription", "No active subscription")}
                </AppText>
              </View>
            </View>

            <View
              style={{
                height: 1,
                backgroundColor: theme.colors.borderSoft,
              }}
            />

            <View style={{ gap: 6 }}>
              <AppText variant="small" color={theme.colors.textMuted}>
                {tt(
                  "subscription.gateAccessText",
                  "Without an active plan, coach access is locked. After activation you get all CoachFlow tools with your selected client limit:",
                )}
              </AppText>

              <AppText variant="small">
                • {tt("subscription.gateFeature1", "Dashboard and client management")}
              </AppText>

              <AppText variant="small">
                • {tt("subscription.gateFeature2", "Workout plans and progress tracking")}
              </AppText>

              <AppText variant="small">
                • {tt("subscription.gateFeature3", "Messages, attendance and supplements")}
              </AppText>

              <AppText variant="small">
                • {tt("subscription.gateFeature4", "The plan changes only the client limit")}
              </AppText>
            </View>
          </View>
        </AppCard>

        <View style={{ gap: 10 }}>
          <AppButton
            title={
              canStartFreeTrial
                ? tt("subscription.choosePlanStartTrial", "Choose a plan / Start free trial")
                : tt("subscription.renewSubscription", "Renew subscription")
            }
            size="lg"
            icon={<Crown size={18} color={theme.colors.primaryContrast} />}
            onPress={handleGoToSubscription}
            fullWidth
          />

          <AppButton
            title={tt("common.logout", "Log out")}
            variant="secondary"
            size="lg"
            icon={<LogOut size={18} color={theme.colors.text} />}
            onPress={handleLogout}
            fullWidth
          />
        </View>
      </View>
    </ScreenContainer>
  );
}