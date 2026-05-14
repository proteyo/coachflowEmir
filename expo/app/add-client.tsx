import { router } from "expo-router";
import {
  Crown,
  Hash,
  Mail,
  Search,
  Send,
  UserPlus,
  Users,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";

import {
  AppAvatar,
  AppButton,
  AppCard,
  AppInput,
  AppText,
  ScreenContainer,
  TabBarPill,
} from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { useSubscription } from "@/src/context/SubscriptionContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";
import { apiPost, toAbsoluteUrl } from "@/src/services/api";

type Method = "email" | "code";

function formatClientLimit(
  limit: number,
  t: (key: any, params?: Record<string, string | number>) => string,
) {
  if (limit >= 999999) return t("addClient.unlimitedClients");

  return t("addClient.upToClients", {
    n: limit,
  });
}

export default function AddClient() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const { user, token } = useAuth();
  const { db, update, refreshFromBackend } = useData();

  const {
    isActive,
    currentPlan,
    clientLimit,
    currentClientCount,
    remainingSlots,
    canAddClient,
  } = useSubscription();

  const [method, setMethod] = useState<Method>("email");
  const [query, setQuery] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);

  const limitReached = isActive && !canAddClient();

  const previewMatch = useMemo(() => {
    if (!db || !query.trim()) return null;

    const q = query.trim().toLowerCase();

    return db.users.find((u) => {
      if (method === "email") {
        return u.email.toLowerCase() === q;
      }

      return (u.clientCode ?? "").toLowerCase() === q;
    });
  }, [db, method, query]);

  const previewProfile = useMemo(() => {
    if (!db || !previewMatch) return null;

    return db.clientProfiles.find((c) => c.userId === previewMatch.id) ?? null;
  }, [db, previewMatch]);

  const clearError = () => {
    if (error) setError("");
  };

  const localFallbackLink = (target: NonNullable<typeof previewMatch>) => {
    if (!user) return;

    update((d) => {
      const hasProfile = d.clientProfiles.some((c) => c.userId === target.id);

      const clientProfiles = hasProfile
        ? d.clientProfiles.map((c) =>
            c.userId === target.id ? { ...c, coachId: user.id } : c,
          )
        : [
            ...d.clientProfiles,
            {
              userId: target.id,
              coachId: user.id,
              goal: "",
              startWeight: 0,
              currentWeight: 0,
              height: 0,
              fitnessLevel: "beginner" as const,
              createdAt: new Date().toISOString(),
            },
          ];

      const hasStreak = d.streaks.some((s) => s.clientId === target.id);

      const streaks = hasStreak
        ? d.streaks
        : [
            ...d.streaks,
            {
              clientId: target.id,
              currentStreak: 0,
              bestStreak: 0,
            },
          ];

      return {
        ...d,
        clientProfiles,
        streaks,
      };
    });
  };

  const showUpgradeAlert = () => {
    Alert.alert(
      t("addClient.limitReachedTitle"),
      t("addClient.limitReachedMessage", {
        plan: currentPlan.name,
        limit: formatClientLimit(clientLimit, t).toLowerCase(),
      }),
      [
        {
          text: t("addClient.notNow"),
          style: "cancel",
        },
        {
          text: t("addClient.upgrade"),
          onPress: () => router.push("/subscription"),
        },
      ],
    );
  };

  const validateCommon = () => {
    setError("");

    if (!user || !db || !token) {
      setError(t("profile.loginAgainText"));
      return false;
    }

    if (user.role !== "coach") {
      setError(t("addClient.onlyCoachesCanAdd"));
      return false;
    }

    if (!isActive) {
      Alert.alert(t("subscription.required"), t("subscription.requiredMsg"), [
        {
          text: t("common.cancel"),
          style: "cancel",
        },
        {
          text: t("addClient.choosePlan"),
          onPress: () => router.push("/subscription"),
        },
      ]);

      return false;
    }

    if (!canAddClient()) {
      showUpgradeAlert();
      return false;
    }

    if (!query.trim()) {
      setError(
        method === "email"
          ? t("addClient.enterClientEmail")
          : t("addClient.enterClientCode"),
      );

      return false;
    }

    return true;
  };

  const linkByCode = async () => {
    if (!validateCommon()) return;

    const code = query.trim().toUpperCase();
    const target = previewMatch;

    if (target && target.role !== "client") {
      setError(t("addClient.notClient"));
      return;
    }

    if (previewProfile?.coachId === user?.id) {
      Alert.alert(
        t("addClient.alreadyLinkedTitle"),
        t("addClient.alreadyLinkedToYou"),
      );

      return;
    }

    if (previewProfile?.coachId && previewProfile.coachId !== user?.id) {
      setError(t("addClient.alreadyHasCoach"));
      return;
    }

    try {
      setSaving(true);

      await apiPost(
        "/clients/link",
        {
          client_code: code,
        },
        { token },
      );

      await refreshFromBackend();

      Alert.alert(
        t("addClient.linked"),
        t("addClient.linkedMsg", {
          name: target?.name ?? t("auth.client"),
        }),
        [
          {
            text: t("common.done"),
            onPress: () => router.back(),
          },
        ],
      );
    } catch (e: any) {
      console.log("[add-client] link by code error", e);

      if (target) {
        if (!canAddClient()) {
          showUpgradeAlert();
          return;
        }

        localFallbackLink(target);

        Alert.alert(
          t("addClient.savedLocallyTitle"),
          t("addClient.savedLocallyMessage"),
          [
            {
              text: t("common.done"),
              onPress: () => router.back(),
            },
          ],
        );

        return;
      }

      setError(e?.message || t("addClient.linkClientError"));
    } finally {
      setSaving(false);
    }
  };

  const inviteByEmail = async () => {
    if (!validateCommon()) return;

    const email = query.trim().toLowerCase();

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError(t("auth.emailInvalid"));
      return;
    }

    if (previewProfile?.coachId === user?.id) {
      Alert.alert(
        t("addClient.alreadyLinkedTitle"),
        t("addClient.alreadyLinkedToYou"),
      );

      return;
    }

    if (previewProfile?.coachId && previewProfile.coachId !== user?.id) {
      setError(t("addClient.alreadyHasCoach"));
      return;
    }

    try {
      setSaving(true);

      await apiPost(
        "/clients/invite",
        {
          email,
        },
        { token },
      );

      await refreshFromBackend();

      Alert.alert(t("addClient.inviteSent"), t("addClient.inviteSentFullMsg"), [
        {
          text: t("common.done"),
          onPress: () => router.back(),
        },
      ]);
    } catch (e: any) {
      console.log("[add-client] invite by email error", e);

      setError(e?.message || t("addClient.inviteClientError"));
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (saving) return;

    if (method === "code") {
      await linkByCode();
      return;
    }

    await inviteByEmail();
  };

  return (
    <ScreenContainer scroll>
      <View style={{ gap: 12, paddingBottom: 40 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: theme.colors.surfaceAlt,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <UserPlus color={theme.colors.primary} size={22} />
          </View>

          <View style={{ flex: 1 }}>
            <AppText variant="title">{t("addClient.title")}</AppText>

            <AppText variant="small" color={theme.colors.textMuted}>
              {t("addClient.subtitle")}
            </AppText>
          </View>
        </View>

        <AppCard variant={limitReached ? "elevated" : "outline"}>
          <View style={{ gap: 10 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Crown
                    color={limitReached ? theme.colors.fire : theme.colors.primary}
                    size={18}
                  />

                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {isActive
                      ? t("addClient.currentPlanLabel", {
                          plan: currentPlan.name,
                        })
                      : t("addClient.noActivePlan")}
                  </AppText>
                </View>

                <AppText
                  variant="small"
                  color={theme.colors.textMuted}
                  style={{ marginTop: 4 }}
                  numberOfLines={2}
                >
                  {isActive
                    ? formatClientLimit(clientLimit, t)
                    : t("addClient.activatePlanToAddClients")}
                </AppText>
              </View>

              <View style={{ alignItems: "flex-end", flexShrink: 0 }}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Users
                    color={limitReached ? theme.colors.danger : theme.colors.text}
                    size={16}
                  />

                  <AppText
                    variant="bodyStrong"
                    color={limitReached ? theme.colors.danger : theme.colors.text}
                  >
                    {currentClientCount}
                    {clientLimit >= 999999 ? "" : `/${clientLimit}`}
                  </AppText>
                </View>

                <AppText
                  variant="caption"
                  color={
                    limitReached ? theme.colors.danger : theme.colors.textMuted
                  }
                  style={{ marginTop: 4 }}
                  numberOfLines={1}
                >
                  {clientLimit >= 999999
                    ? t("addClient.unlimitedSlots")
                    : t("addClient.slotsLeft", {
                        n: remainingSlots,
                      })}
                </AppText>
              </View>
            </View>

            {limitReached ? (
              <View
                style={{
                  padding: 10,
                  borderRadius: theme.radius.md,
                  backgroundColor: "rgba(255,73,73,0.10)",
                  gap: 6,
                }}
              >
                <AppText
                  variant="small"
                  color={theme.colors.danger}
                  style={{ fontWeight: "800" }}
                >
                  {t("addClient.limitReachedShort")}
                </AppText>

                <AppText variant="caption" color={theme.colors.textMuted}>
                  {t("addClient.upgradeToAddMore")}
                </AppText>

                <Pressable onPress={() => router.push("/subscription")}>
                  <AppText
                    variant="small"
                    color={theme.colors.primary}
                    style={{ fontWeight: "800" }}
                  >
                    {t("addClient.upgradePlan")}
                  </AppText>
                </Pressable>
              </View>
            ) : null}
          </View>
        </AppCard>

        <View style={{ marginTop: 8 }}>
          <TabBarPill
            options={[
              {
                key: "email",
                label: t("addClient.methodEmail"),
              },
              {
                key: "code",
                label: t("addClient.methodCode"),
              },
            ]}
            active={method}
            onChange={(k) => {
              setMethod(k as Method);
              setQuery("");
              setError("");
            }}
          />
        </View>

        <AppInput
          label={
            method === "email"
              ? t("addClient.emailLabel")
              : t("addClient.codeLabel")
          }
          value={query}
          onChangeText={(v) => {
            const next = method === "code" ? v.toUpperCase() : v;
            setQuery(next);
            clearError();
          }}
          placeholder={
            method === "email"
              ? t("auth.emailPlaceholder")
              : t("addClient.codePlaceholder")
          }
          autoCapitalize={method === "code" ? "characters" : "none"}
          autoCorrect={false}
          keyboardType={method === "email" ? "email-address" : "default"}
          inputMode={method === "email" ? "email" : "text"}
          textContentType={method === "email" ? "emailAddress" : "none"}
          autoComplete={method === "email" ? "email" : "off"}
          returnKeyType={method === "email" ? "send" : "search"}
          submitBehavior="blurAndSubmit"
          onSubmitEditing={submit}
          leftIcon={
            method === "email" ? (
              <Mail size={18} color={theme.colors.textMuted} />
            ) : (
              <Hash size={18} color={theme.colors.textMuted} />
            )
          }
        />

        {previewMatch ? (
          <AppCard variant="outline">
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <AppAvatar
                uri={toAbsoluteUrl(previewMatch.avatarUrl)}
                name={previewMatch.name}
                size={44}
              />

              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {previewMatch.name}
                </AppText>

                <AppText
                  variant="small"
                  color={theme.colors.textMuted}
                  numberOfLines={1}
                >
                  {previewMatch.email}
                  {previewMatch.clientCode ? ` · ${previewMatch.clientCode}` : ""}
                </AppText>

                {previewProfile?.coachId === user?.id ? (
                  <AppText
                    variant="caption"
                    color={theme.colors.success}
                    style={{ marginTop: 4 }}
                    numberOfLines={2}
                  >
                    {t("addClient.alreadyInYourList")}
                  </AppText>
                ) : previewProfile?.coachId ? (
                  <AppText
                    variant="caption"
                    color={theme.colors.warn}
                    style={{ marginTop: 4 }}
                    numberOfLines={2}
                  >
                    {t("addClient.clientAlreadyHasAnotherCoach")}
                  </AppText>
                ) : method === "email" ? (
                  <AppText
                    variant="caption"
                    color={theme.colors.textMuted}
                    style={{ marginTop: 4 }}
                    numberOfLines={2}
                  >
                    {t("addClient.inviteBackendHint")}
                  </AppText>
                ) : null}
              </View>
            </View>
          </AppCard>
        ) : method === "email" && query.trim() ? (
          <AppCard variant="outline">
            <AppText variant="bodyStrong" numberOfLines={1}>
              {query.trim().toLowerCase()}
            </AppText>

            <AppText
              variant="small"
              color={theme.colors.textMuted}
              style={{ marginTop: 4 }}
            >
              {t("addClient.emailInvitePreviewHint")}
            </AppText>
          </AppCard>
        ) : null}

        {error ? (
          <AppText variant="small" color={theme.colors.danger}>
            {error}
          </AppText>
        ) : null}

        <AppButton
          title={
            saving
              ? method === "email"
                ? t("addClient.sending")
                : t("addClient.linking")
              : method === "email"
                ? t("addClient.sendInvite")
                : t("addClient.findAndLink")
          }
          size="lg"
          disabled={saving}
          loading={saving}
          icon={
            method === "email" ? (
              <Send size={18} color={theme.colors.primaryContrast} />
            ) : (
              <Search size={18} color={theme.colors.primaryContrast} />
            )
          }
          onPress={submit}
          fullWidth
        />

        {method === "email" ? (
          <AppText variant="small" color={theme.colors.textMuted}>
            {t("addClient.emailInviteHint")}
          </AppText>
        ) : (
          <AppText variant="small" color={theme.colors.textMuted}>
            {t("addClient.codeLinkHint")}
          </AppText>
        )}

        <View style={{ height: 24 }} />
      </View>
    </ScreenContainer>
  );
}