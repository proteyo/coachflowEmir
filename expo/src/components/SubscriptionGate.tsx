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
  const { isActive, canStartFreeTrial, currentPlan, trialEndsAt } = useSubscription();

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
              Subscription required
            </AppText>

            <AppText
              variant="body"
              color={theme.colors.textMuted}
              style={{ textAlign: "center", lineHeight: 22 }}
            >
              Your coach features are locked until you activate or renew your subscription.
            </AppText>
          </View>
        </View>

        <AppCard variant="outline">
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Crown color={theme.colors.primary} size={22} />

              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">Current access</AppText>

                <AppText variant="small" color={theme.colors.textMuted}>
                  No active subscription
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
                Without an active plan, you cannot access:
              </AppText>

              <AppText variant="small">• Dashboard</AppText>
              <AppText variant="small">• Clients and client details</AppText>
              <AppText variant="small">• Workouts and supplement plans</AppText>
              <AppText variant="small">• Messages and coaching tools</AppText>
            </View>
          </View>
        </AppCard>

        <View style={{ gap: 10 }}>
          <AppButton
            title={canStartFreeTrial ? "Choose a plan / Start free trial" : "Renew subscription"}
            size="lg"
            icon={<Crown size={18} color={theme.colors.primaryContrast} />}
            onPress={handleGoToSubscription}
            fullWidth
          />

          <AppButton
            title="Log out"
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