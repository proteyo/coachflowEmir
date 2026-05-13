import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  ArrowLeft,
  Check,
  CreditCard,
  Crown,
  ExternalLink,
  Info,
  Languages,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { LanguageModal } from "@/src/components/LanguageModal";
import {
  AppButton,
  AppCard,
  AppText,
  ScreenContainer,
} from "@/src/components/ui";
import {
  SubscriptionPlanCode,
  useSubscription,
} from "@/src/context/SubscriptionContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";
import { LANGUAGES } from "@/src/i18n/translations";

type AppLangCode = "en" | "ru" | "kk";

function getLangSafe(lang: string): AppLangCode {
  if (lang === "ru" || lang === "kk" || lang === "en") return lang;
  return "en";
}

function formatPrice(price: number, currency: string) {
  if (price <= 0) return "0 ₸";

  return `${price.toLocaleString("ru-RU")} ${
    currency === "KZT" ? "₸" : currency
  }`;
}

function formatDate(date: string | undefined, lang: AppLangCode) {
  if (!date) return "—";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date.slice(0, 10);
  }

  const locale =
    lang === "ru" ? "ru-RU" : lang === "kk" ? "kk-KZ" : "en-GB";

  return parsed.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function SubscriptionScreen() {
  const { theme } = useTheme();
  const { lang, setLanguage, t } = useI18n();

  const {
    sub,
    plans,
    currentPlan,
    planCode,
    isActive,
    isTrialActive,
    trialEndsAt,
    trialDays,
    freeClientLimit,
    paidSubscriptionActive,
    currentClientCount,
    remainingSlots,
    activate,
  } = useSubscription();

  const currentLang = getLangSafe(lang);

  const [busy, setBusy] = useState<boolean>(false);
  const [languageVisible, setLanguageVisible] = useState<boolean>(false);
  const [selectedPlanCode, setSelectedPlanCode] =
    useState<SubscriptionPlanCode>(planCode);

  const currentLanguage = LANGUAGES.find((item) => item.code === lang);

  const tt = (key: string, fallback: string) => {
    const value = t(key as never);
    return value && value !== key ? value : fallback;
  };

  const selectedPlan = useMemo(() => {
    return plans.find((plan) => plan.code === selectedPlanCode) ?? plans[0];
  }, [plans, selectedPlanCode]);

  const selectedIsCurrentPlan = isActive && selectedPlanCode === planCode;

  const activeUntil = formatDate(
    paidSubscriptionActive
      ? sub?.endDate
      : isTrialActive
        ? trialEndsAt
        : undefined,
    currentLang,
  );

  const getPlanName = (code: string, fallback: string) => {
    if (code === "free") {
      return tt("subscription.freeName", "Free Trial");
    }

    if (code === "starter") {
      return tt("subscription.starterName", "Starter");
    }

    if (code === "pro") {
      return tt("subscription.proPlanName", "Pro");
    }

    if (code === "unlimited") {
      return tt("subscription.unlimitedName", "Unlimited");
    }

    return fallback;
  };

  const getPlanDescription = (code: string, fallback: string) => {
    if (code === "free") {
      return tt(
        "subscription.freeDescription",
        `Try all CoachFlow tools for ${trialDays} days with up to ${freeClientLimit} clients.`,
      );
    }

    if (code === "starter") {
      return tt(
        "subscription.starterDescription",
        "Full CoachFlow access for coaches with up to 10 clients.",
      );
    }

    if (code === "pro") {
      return tt(
        "subscription.proDescription",
        "Full CoachFlow access for active coaches with up to 30 clients.",
      );
    }

    if (code === "unlimited") {
      return tt(
        "subscription.unlimitedDescription",
        "Full CoachFlow access with no client limit.",
      );
    }

    return fallback;
  };

  const getPlanBadge = (code: string, fallback?: string) => {
    if (code === "free") {
      return tt("subscription.freeBadge", `${trialDays} days free`);
    }

    if (code === "starter") {
      return tt("subscription.starterBadge", "Up to 10 clients");
    }

    if (code === "pro") {
      return tt("subscription.proBadge", "Up to 30 clients");
    }

    if (code === "unlimited") {
      return tt("subscription.unlimitedBadge", "No client limit");
    }

    return fallback ?? "";
  };

  const getPlanFeatures = (code: string, fallback: string[]) => {
    if (code === "free") {
      return [
        tt("subscription.freeFeature1", `Full access for ${trialDays} days`),
        tt("subscription.freeFeature2", `Up to ${freeClientLimit} clients`),
        tt("subscription.freeFeature3", "All CoachFlow tools included"),
        tt("subscription.freeFeature4", "Workouts, progress, attendance and chat"),
        tt("subscription.freeFeature5", "Clients use the app for free"),
        tt("subscription.freeFeature6", "Good for testing the platform"),
      ];
    }

    if (code === "starter") {
      return [
        tt("subscription.starterFeature1", "Full CoachFlow access"),
        tt("subscription.starterFeature2", "Up to 10 clients"),
        tt("subscription.starterFeature3", "Same tools as every paid plan"),
        tt(
          "subscription.starterFeature4",
          "Workouts, progress, attendance and chat",
        ),
        tt("subscription.starterFeature5", "Clients use the app for free"),
        tt("subscription.starterFeature6", "Only the client limit changes"),
      ];
    }

    if (code === "pro") {
      return [
        tt("subscription.proFeature1", "Full CoachFlow access"),
        tt("subscription.proFeature2", "Up to 30 clients"),
        tt("subscription.proFeature3", "Same tools as every paid plan"),
        tt("subscription.proFeature4", "Workouts, progress, attendance and chat"),
        tt("subscription.proFeature5", "Clients use the app for free"),
        tt("subscription.proFeature6", "Only the client limit changes"),
      ];
    }

    if (code === "unlimited") {
      return [
        tt("subscription.unlimitedFeature1", "Full CoachFlow access"),
        tt("subscription.unlimitedFeature2", "Unlimited clients"),
        tt("subscription.unlimitedFeature3", "Same tools as every paid plan"),
        tt(
          "subscription.unlimitedFeature4",
          "Workouts, progress, attendance and chat",
        ),
        tt("subscription.unlimitedFeature5", "Clients use the app for free"),
        tt("subscription.unlimitedFeature6", "Best for large client bases"),
      ];
    }

    return fallback;
  };

  const formatLimit = (limit: number) => {
    if (limit >= 999999) {
      return tt("subscription.unlimitedClients", "Unlimited clients");
    }

    return tt("subscription.upToClients", "Up to {n} clients").replace(
      "{n}",
      String(limit),
    );
  };

  const planActionText = useMemo(() => {
    if (selectedIsCurrentPlan) {
      return tt("subscription.currentPlanSelected", "Current plan");
    }

    if (selectedPlanCode === "free") {
      return isTrialActive
        ? tt("subscription.currentPlanSelected", "Current plan")
        : tt("subscription.activateFreeTrial", "Activate free trial");
    }

    return tt("subscription.selectPlanButton", "Select plan");
  }, [selectedIsCurrentPlan, selectedPlanCode, isTrialActive]);

  const showPaidPaymentAlert = () => {
    Alert.alert(
      tt("subscription.paymentNotConnectedTitle", "Payment is not connected yet"),
      tt(
        "subscription.paymentNotConnectedText",
        "Paid plans will be activated only after Google Play payment and backend verification.",
      ),
      [{ text: tt("common.done", "Done") }],
    );
  };

  const handleSelectPlan = async () => {
    if (busy) return;

    if (selectedIsCurrentPlan) {
      Alert.alert(
        tt("subscription.currentPlanTitle", "Current plan"),
        tt("subscription.currentPlanMessage", "This plan is already active."),
      );
      return;
    }

    if (selectedPlanCode !== "free") {
      showPaidPaymentAlert();
      return;
    }

    try {
      setBusy(true);

      await activate("free");

      Alert.alert(
        tt("subscription.activatedTitle", "Activated"),
        tt(
          "subscription.freeActivatedMessage",
          `Free trial is active. You can manage up to ${freeClientLimit} clients.`,
        ),
        [{ text: tt("common.done", "Done"), onPress: () => router.back() }],
      );
    } catch (e: any) {
      console.log("[subscription] free activation error", e);

      Alert.alert(
        tt("subscription.errorTitle", "Subscription error"),
        e?.message ||
          tt(
            "subscription.freeActivationError",
            "Could not activate free trial.",
          ),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleManageSubscription = () => {
    Alert.alert(
      tt("subscription.manageTitle", "Manage subscription"),
      tt(
        "subscription.manageText",
        "Subscription management will open Google Play subscription settings after real payments are connected.",
      ),
      [{ text: tt("common.done", "Done") }],
    );
  };

  const currentStatusText = useMemo(() => {
    if (paidSubscriptionActive) {
      return tt("subscription.activePlanStatus", "{plan} active").replace(
        "{plan}",
        getPlanName(currentPlan.code, currentPlan.name),
      );
    }

    if (isTrialActive) {
      return tt("subscription.freeTrialActiveStatus", "Free Trial active");
    }

    return tt("subscription.inactive", "No active subscription");
  }, [paidSubscriptionActive, isTrialActive, currentPlan]);

  const currentStatusHint = useMemo(() => {
    if (paidSubscriptionActive) {
      return tt("subscription.activeUntil", "Active until {date}").replace(
        "{date}",
        activeUntil,
      );
    }

    if (isTrialActive) {
      return tt("subscription.trialActiveUntil", "Free trial until {date}").replace(
        "{date}",
        activeUntil,
      );
    }

    return tt(
      "subscription.selectPlanThenPayment",
      "Choose Free Trial to start, or select a paid plan when Google Play payment is connected.",
    );
  }, [paidSubscriptionActive, isTrialActive, activeUntil]);

  return (
    <ScreenContainer scroll padded={false}>
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
          paddingTop: 58,
          paddingHorizontal: 20,
          paddingBottom: 28,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
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

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              backgroundColor: "rgba(255,255,255,0.18)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Crown color="#fff" size={24} />
          </View>

          <View style={{ flex: 1 }}>
            <AppText variant="title" color="#fff">
              {tt("subscription.plansTitle", "Subscription")}
            </AppText>

            <AppText variant="small" color="rgba(255,255,255,0.78)">
              {tt(
                "subscription.plansSubtitle",
                "All plans include the same CoachFlow tools. Choose only by client limit.",
              )}
            </AppText>
          </View>
        </View>

        <View
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 18,
            backgroundColor: "rgba(255,255,255,0.14)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.18)",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <AppText variant="small" color="rgba(255,255,255,0.72)">
                {tt("subscription.currentStatus", "Current status")}
              </AppText>

              <AppText variant="h3" color="#fff">
                {currentStatusText}
              </AppText>

              <AppText variant="caption" color="rgba(255,255,255,0.72)">
                {currentStatusHint}
              </AppText>
            </View>

            <View style={{ alignItems: "flex-end" }}>
              <AppText variant="small" color="rgba(255,255,255,0.72)">
                {tt("subscription.clients", "Clients")}
              </AppText>

              <AppText variant="h3" color="#fff">
                {currentClientCount}
                {isActive && currentPlan.clientLimit < 999999
                  ? `/${currentPlan.clientLimit}`
                  : ""}
              </AppText>

              <AppText variant="caption" color="rgba(255,255,255,0.72)">
                {!isActive
                  ? tt("subscription.locked", "Locked")
                  : currentPlan.clientLimit >= 999999
                    ? tt("subscription.unlimited", "Unlimited")
                    : tt("subscription.slotsLeft", "{n} slots left").replace(
                        "{n}",
                        String(remainingSlots),
                      )}
              </AppText>
            </View>
          </View>
        </View>
      </LinearGradient>

      <View style={{ padding: 20, gap: 14 }}>
        <View>
          <AppText variant="h2">
            {tt("subscription.selectYourPlan", "Select your plan")}
          </AppText>

          <AppText
            variant="small"
            color={theme.colors.textMuted}
            style={{ marginTop: 4 }}
          >
            {tt(
              "subscription.coachPaysClientsFree",
              "Coaches pay for access. Clients use the app for free.",
            )}
          </AppText>
        </View>

        {plans.map((plan) => {
          const selected = selectedPlanCode === plan.code;
          const current = isActive && planCode === plan.code;

          const translatedName = getPlanName(plan.code, plan.name);
          const translatedBadge = getPlanBadge(plan.code, plan.badge);
          const translatedDescription = getPlanDescription(
            plan.code,
            plan.description,
          );
          const translatedFeatures = getPlanFeatures(plan.code, plan.features);
          const paidNotConnected = plan.code !== "free";

          return (
            <Pressable
              key={plan.code}
              onPress={() => setSelectedPlanCode(plan.code)}
            >
              <AppCard
                variant={selected ? "elevated" : "outline"}
                style={{
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected
                    ? theme.colors.primary
                    : theme.colors.border,
                  overflow: "hidden",
                  opacity: paidNotConnected ? 0.92 : 1,
                }}
              >
                <View style={{ gap: 12 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <AppText variant="h2">{translatedName}</AppText>

                        {translatedBadge ? (
                          <View
                            style={{
                              paddingVertical: 4,
                              paddingHorizontal: 8,
                              borderRadius: 999,
                              backgroundColor:
                                plan.code === "pro"
                                  ? "rgba(255,176,32,0.16)"
                                  : plan.code === "free"
                                    ? "rgba(22,199,132,0.14)"
                                    : "rgba(82,118,255,0.12)",
                            }}
                          >
                            <AppText
                              variant="caption"
                              color={
                                plan.code === "pro"
                                  ? theme.colors.fire
                                  : plan.code === "free"
                                    ? theme.colors.success
                                    : theme.colors.primary
                              }
                              style={{ fontWeight: "800" }}
                            >
                              {translatedBadge}
                            </AppText>
                          </View>
                        ) : null}

                        {paidNotConnected ? (
                          <View
                            style={{
                              paddingVertical: 4,
                              paddingHorizontal: 8,
                              borderRadius: 999,
                              backgroundColor: "rgba(255,176,32,0.14)",
                            }}
                          >
                            <AppText
                              variant="caption"
                              color={theme.colors.fire}
                              style={{ fontWeight: "800" }}
                            >
                              {tt(
                                "subscription.paymentLater",
                                "Google Play payment",
                              )}
                            </AppText>
                          </View>
                        ) : null}

                        {current ? (
                          <View
                            style={{
                              paddingVertical: 4,
                              paddingHorizontal: 8,
                              borderRadius: 999,
                              backgroundColor: "rgba(22,199,132,0.14)",
                            }}
                          >
                            <AppText
                              variant="caption"
                              color={theme.colors.success}
                              style={{ fontWeight: "800" }}
                            >
                              {tt("subscription.current", "Current")}
                            </AppText>
                          </View>
                        ) : null}

                        {selected ? (
                          <View
                            style={{
                              paddingVertical: 4,
                              paddingHorizontal: 8,
                              borderRadius: 999,
                              backgroundColor: "rgba(82,118,255,0.12)",
                            }}
                          >
                            <AppText
                              variant="caption"
                              color={theme.colors.primary}
                              style={{ fontWeight: "800" }}
                            >
                              {tt("subscription.selected", "Selected")}
                            </AppText>
                          </View>
                        ) : null}
                      </View>

                      <AppText
                        variant="small"
                        color={theme.colors.textMuted}
                        style={{ marginTop: 4 }}
                      >
                        {translatedDescription}
                      </AppText>
                    </View>

                    <View style={{ alignItems: "flex-end" }}>
                      <AppText variant="h2">
                        {formatPrice(plan.price, plan.currency)}
                      </AppText>

                      <AppText variant="caption" color={theme.colors.textMuted}>
                        {plan.price <= 0
                          ? tt("subscription.free", "Free")
                          : tt("subscription.perMonth", "per month")}
                      </AppText>
                    </View>
                  </View>

                  <View
                    style={{
                      padding: 12,
                      borderRadius: theme.radius.md,
                      backgroundColor: theme.colors.surfaceAlt,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Users color={theme.colors.primary} size={18} />

                    <AppText variant="bodyStrong">
                      {formatLimit(plan.clientLimit)}
                    </AppText>
                  </View>

                  <View style={{ gap: 8 }}>
                    {translatedFeatures.map((feature) => (
                      <View
                        key={feature}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <View
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            backgroundColor: "rgba(22,199,132,0.14)",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Check color={theme.colors.success} size={13} />
                        </View>

                        <AppText variant="small" style={{ flex: 1 }}>
                          {feature}
                        </AppText>
                      </View>
                    ))}
                  </View>
                </View>
              </AppCard>
            </Pressable>
          );
        })}

        <AppCard variant="outline">
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <ShieldCheck color={theme.colors.primary} size={20} />

              <AppText variant="h3">
                {tt("subscription.businessAccess", "Business access")}
              </AppText>
            </View>

            <AppText variant="small" color={theme.colors.textMuted}>
              {tt(
                "subscription.businessAccessText",
                "All plans include the same CoachFlow tools. The only difference between plans is how many clients a coach can manage.",
              )}
            </AppText>

            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <MiniFeature
                icon={<Zap color={theme.colors.fire} size={15} />}
                label={tt("subscription.days30", `${trialDays} days free`)}
              />

              <MiniFeature
                icon={<CreditCard color={theme.colors.primary} size={15} />}
                label={tt("subscription.billingReady", "Google Play billing")}
              />

              <MiniFeature
                icon={<Sparkles color={theme.colors.success} size={15} />}
                label={tt("subscription.clientLimits", "Client limits only")}
              />
            </View>
          </View>
        </AppCard>

        <AppCard variant="outline">
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Info color={theme.colors.primary} size={20} />

              <AppText variant="h3">
                {tt("subscription.paymentStatus", "Payment status")}
              </AppText>
            </View>

            <AppText variant="small" color={theme.colors.textMuted}>
              {tt(
                "subscription.paymentStatusText",
                "Paid plans will be activated only after Google Play payment and backend verification.",
              )}
            </AppText>
          </View>
        </AppCard>

        <AppButton
          title={
            busy ? tt("subscription.processing", "Processing...") : planActionText
          }
          size="lg"
          fullWidth
          onPress={handleSelectPlan}
          icon={<CreditCard color={theme.colors.primaryContrast} size={18} />}
        />

        {paidSubscriptionActive ? (
          <AppButton
            title={tt("subscription.manageSubscription", "Manage subscription")}
            variant="secondary"
            fullWidth
            onPress={handleManageSubscription}
            icon={<ExternalLink color={theme.colors.text} size={18} />}
          />
        ) : null}

        <AppText
          variant="caption"
          color={theme.colors.textMuted}
          style={{ textAlign: "center", marginTop: 2 }}
        >
          {tt(
            "subscription.releaseNote",
            "All paid plans include the same functions. The selected plan only changes the coach client limit.",
          )}
        </AppText>

        <View style={{ height: 20 }} />
      </View>
    </ScreenContainer>
  );
}

function MiniFeature({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: theme.colors.surfaceAlt,
      }}
    >
      {icon}

      <AppText variant="caption" style={{ fontWeight: "700" }}>
        {label}
      </AppText>
    </View>
  );
}