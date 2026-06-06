import { Stack, router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  Award,
  MessageCircle,
  Send,
  Star,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";

import {
  AppAvatar,
  AppButton,
  AppCard,
  AppInput,
  AppText,
  GradientHeader,
  ScreenContainer,
  SectionHeader,
} from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";
import { apiGet, apiPost, toAbsoluteUrl } from "@/src/services/api";

type CoachReview = {
  id: string;
  coachId: string;
  clientId: string;
  clientName?: string | null;
  rating: number;
  comment?: string | null;
  createdAt: string;
  updatedAt: string;
};

type CoachReviewsSummary = {
  coachId: string;
  averageRating: number;
  reviewsCount: number;
  reviews: CoachReview[];
};

type AppLanguage = "ru" | "kk" | "en" | string;

const SPECIALTY_LABELS: Record<
  string,
  {
    ru: string;
    kk: string;
    en: string;
  }
> = {
  personal_trainer: {
    ru: "Персональный тренер",
    kk: "Жеке жаттықтырушы",
    en: "Personal trainer",
  },
  fitness_coach: {
    ru: "Фитнес-тренер",
    kk: "Фитнес жаттықтырушысы",
    en: "Fitness coach",
  },
  strength_coach: {
    ru: "Тренер по силовой подготовке",
    kk: "Күш дайындығы жаттықтырушысы",
    en: "Strength coach",
  },
  bodybuilding_coach: {
    ru: "Тренер по бодибилдингу",
    kk: "Бодибилдинг жаттықтырушысы",
    en: "Bodybuilding coach",
  },
  nutritionist: {
    ru: "Нутрициолог",
    kk: "Нутрициолог",
    en: "Nutritionist",
  },
  rehab_trainer: {
    ru: "Тренер по восстановлению",
    kk: "Қалпына келтіру жаттықтырушысы",
    en: "Rehabilitation trainer",
  },
  yoga_trainer: {
    ru: "Тренер по йоге",
    kk: "Йога жаттықтырушысы",
    en: "Yoga trainer",
  },
  boxing_coach: {
    ru: "Тренер по боксу",
    kk: "Бокс жаттықтырушысы",
    en: "Boxing coach",
  },
  running_coach: {
    ru: "Тренер по бегу",
    kk: "Жүгіру жаттықтырушысы",
    en: "Running coach",
  },
};

function getLocale(lang?: AppLanguage) {
  if (lang === "ru") return "ru-RU";
  if (lang === "kk") return "kk-KZ";

  return "en-US";
}

function formatReviewDate(value?: string, lang?: AppLanguage) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value.slice(0, 10);

  return date.toLocaleDateString(getLocale(lang), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function prettifySnakeCase(value: string) {
  const cleaned = value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function getCoachSpecialtyLabel(
  value: string | null | undefined,
  lang: AppLanguage,
  fallback: string,
) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return fallback;
  }

  const translated = SPECIALTY_LABELS[normalized];

  if (translated) {
    if (lang === "ru") return translated.ru;
    if (lang === "kk") return translated.kk;

    return translated.en;
  }

  return prettifySnakeCase(normalized);
}

export default function CoachPublicProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const coachId = String(id ?? "");

  const { theme } = useTheme();
  const { t, lang } = useI18n();
  const { user, token } = useAuth();
  const { db, refreshFromBackend } = useData();

  const [summary, setSummary] = useState<CoachReviewsSummary | null>(null);
  const [reviewOpen, setReviewOpen] = useState<boolean>(false);
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>("");
  const [savingReview, setSavingReview] = useState<boolean>(false);

  const coach = useMemo(() => {
    return db?.users.find((u) => u.id === coachId);
  }, [db, coachId]);

  const coachProfile = useMemo(() => {
    return db?.coachProfiles.find((p) => p.userId === coachId);
  }, [db, coachId]);

  const myReview = useMemo(() => {
    if (!user || !summary) return null;

    return summary.reviews.find((r) => r.clientId === user.id) ?? null;
  }, [summary, user]);

  const specialtyLabel = useMemo(() => {
    return getCoachSpecialtyLabel(
      coachProfile?.specialty,
      lang,
      t("coachPublic.defaultSpecialty"),
    );
  }, [coachProfile?.specialty, lang, t]);

  const loadReviews = useCallback(async () => {
    if (!coachId) return;

    try {
      const res = await apiGet(`/reviews/coaches/${coachId}`);
      setSummary(res);
    } catch (e) {
      console.log("[coach-profile] load reviews error", e);
    }
  }, [coachId]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const openReviewModal = () => {
    setRating(myReview?.rating ?? 5);
    setComment(myReview?.comment ?? "");
    setReviewOpen(true);
  };

  const submitReview = async () => {
    if (!token || !user) {
      Alert.alert(t("profile.authErrorTitle"), t("profile.loginAgainText"));
      return;
    }

    if (user.role !== "client") {
      Alert.alert(
        t("coachPublic.permissionDeniedTitle"),
        t("coachPublic.onlyClientsCanReview"),
      );
      return;
    }

    try {
      setSavingReview(true);

      await apiPost(
        `/reviews/coaches/${coachId}`,
        {
          rating,
          comment: comment.trim() || undefined,
        },
        { token },
      );

      await loadReviews();
      await refreshFromBackend();

      setReviewOpen(false);

      Alert.alert(t("coachPublic.savedTitle"), t("coachPublic.reviewSaved"));
    } catch (e: any) {
      console.log("[coach-profile] submit review error", e);

      Alert.alert(
        t("coachPublic.reviewErrorTitle"),
        e?.message || t("coachPublic.reviewErrorText"),
      );
    } finally {
      setSavingReview(false);
    }
  };

  if (!db || !coach) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ title: t("coachPublic.coachProfile") }} />

        <AppText variant="body">{t("coachPublic.coachNotFound")}</AppText>
      </ScreenContainer>
    );
  }

  const averageRating = summary?.averageRating ?? coachProfile?.rating ?? 0;
  const reviewsCount = summary?.reviewsCount ?? 0;

  return (
    <ScreenContainer scroll padded={false}>
      <Stack.Screen
        options={{
          title: coach.name,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <ArrowLeft color={theme.colors.text} size={22} />
            </Pressable>
          ),
        }}
      />

      <GradientHeader height={230}>
        <View style={{ alignItems: "center", marginTop: 18, gap: 10 }}>
          <AppAvatar
            uri={toAbsoluteUrl(coach.avatarUrl ?? coachProfile?.profileImageUrl)}
            name={coach.name}
            size={88}
            ring
          />

          <AppText variant="h2" color="#fff" numberOfLines={1}>
            {coach.name}
          </AppText>

          <AppText
            variant="small"
            color="rgba(255,255,255,0.82)"
            numberOfLines={1}
            style={{ textAlign: "center" }}
          >
            {specialtyLabel}
          </AppText>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: "rgba(255,255,255,0.15)",
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 999,
            }}
          >
            <Star color="#FFB020" size={16} fill="#FFB020" />

            <AppText variant="bodyStrong" color="#fff">
              {averageRating ? averageRating.toFixed(1) : "0.0"}
            </AppText>

            <AppText variant="small" color="rgba(255,255,255,0.75)">
              ·{" "}
              {t("coachPublic.reviewsCount").replace(
                "{n}",
                String(reviewsCount),
              )}
            </AppText>
          </View>
        </View>
      </GradientHeader>

      <View style={{ paddingHorizontal: 20, marginTop: 16, gap: 12 }}>
        <AppCard variant="elevated">
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText variant="caption" color={theme.colors.textMuted}>
                  {t("coachPublic.experience").toUpperCase()}
                </AppText>

                <AppText variant="bodyStrong" numberOfLines={1}>
                  {t("coachPublic.yearsValue").replace(
                    "{n}",
                    String(coachProfile?.experienceYears ?? 0),
                  )}
                </AppText>
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText variant="caption" color={theme.colors.textMuted}>
                  {t("coachPublic.rating").toUpperCase()}
                </AppText>

                <AppText variant="bodyStrong" numberOfLines={1}>
                  {averageRating
                    ? averageRating.toFixed(1)
                    : t("coachPublic.noRatingYet")}
                </AppText>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
              <View style={{ flex: 1 }}>
                <AppButton
                  title={t("coachPublic.message")}
                  icon={
                    <MessageCircle
                      size={18}
                      color={theme.colors.primaryContrast}
                    />
                  }
                  onPress={() => router.push(`/chat/${coach.id}`)}
                  fullWidth
                />
              </View>

              <View style={{ flex: 1 }}>
                <AppButton
                  title={
                    myReview
                      ? t("coachPublic.editReview")
                      : t("coachPublic.leaveReview")
                  }
                  variant="secondary"
                  icon={<Star size={18} color={theme.colors.text} />}
                  onPress={openReviewModal}
                  fullWidth
                />
              </View>
            </View>
          </View>
        </AppCard>

        <SectionHeader title={t("coachPublic.aboutCoach")} />

        <AppCard variant="outline">
          <AppText variant="body">
            {coachProfile?.bio || t("coachPublic.noBio")}
          </AppText>
        </AppCard>

        <SectionHeader
          title={t("profile.achievements")}
          icon={<Award color={theme.colors.fire} size={18} />}
        />

        <AppCard variant="outline">
          {(coachProfile?.achievements ?? []).length > 0 ? (
            (coachProfile?.achievements ?? []).map((item, index) => (
              <View
                key={`${item}_${index}`}
                style={{ flexDirection: "row", gap: 10, paddingVertical: 5 }}
              >
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: theme.colors.primary,
                    marginTop: 7,
                  }}
                />

                <AppText variant="small" style={{ flex: 1 }}>
                  {item}
                </AppText>
              </View>
            ))
          ) : (
            <AppText variant="small" color={theme.colors.textMuted}>
              {t("profile.noAchievementsYet")}
            </AppText>
          )}
        </AppCard>

        <SectionHeader title={t("profile.certificates")} />

        <AppCard variant="outline">
          {(coachProfile?.certificates ?? []).length > 0 ? (
            (coachProfile?.certificates ?? []).map((item, index) => (
              <AppText
                key={`${item}_${index}`}
                variant="small"
                style={{ paddingVertical: 4 }}
              >
                · {item}
              </AppText>
            ))
          ) : (
            <AppText variant="small" color={theme.colors.textMuted}>
              {t("profile.noCertificatesYet")}
            </AppText>
          )}
        </AppCard>

        <SectionHeader title={t("coachPublic.reviews")} />

        {(summary?.reviews ?? []).length > 0 ? (
          <View style={{ gap: 10 }}>
            {(summary?.reviews ?? []).map((review) => (
              <AppCard key={review.id} variant="outline">
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText variant="bodyStrong" numberOfLines={1}>
                      {review.clientName ?? t("auth.client")}
                    </AppText>

                    <AppText variant="small" color={theme.colors.textMuted}>
                      {formatReviewDate(review.updatedAt, lang)}
                    </AppText>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    <Star color="#FFB020" size={15} fill="#FFB020" />

                    <AppText variant="bodyStrong">{review.rating}</AppText>
                  </View>
                </View>

                {review.comment ? (
                  <AppText variant="small" style={{ marginTop: 8 }}>
                    {review.comment}
                  </AppText>
                ) : null}
              </AppCard>
            ))}
          </View>
        ) : (
          <AppCard variant="outline">
            <AppText variant="small" color={theme.colors.textMuted}>
              {t("coachPublic.noReviews")}
            </AppText>
          </AppCard>
        )}

        <View style={{ height: 30 }} />
      </View>

      <ReviewModal
        visible={reviewOpen}
        rating={rating}
        setRating={setRating}
        comment={comment}
        setComment={setComment}
        saving={savingReview}
        onClose={() => setReviewOpen(false)}
        onSubmit={submitReview}
      />
    </ScreenContainer>
  );
}

function ReviewModal({
  visible,
  rating,
  setRating,
  comment,
  setComment,
  saving,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  rating: number;
  setRating: (v: number) => void;
  comment: string;
  setComment: (v: string) => void;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { theme } = useTheme();
  const { t } = useI18n();

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: theme.colors.bg }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
          <View
            style={{
              paddingTop: 56,
              paddingHorizontal: 20,
              paddingBottom: 14,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.borderSoft,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Pressable onPress={handleClose} hitSlop={8} disabled={saving}>
              <X color={theme.colors.text} size={22} />
            </Pressable>

            <AppText
              variant="h3"
              numberOfLines={1}
              style={{ flex: 1, textAlign: "center" }}
            >
              {t("coachPublic.coachReview")}
            </AppText>

            <Pressable onPress={onSubmit} disabled={saving} hitSlop={8}>
              <Send
                color={saving ? theme.colors.textMuted : theme.colors.primary}
                size={20}
              />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              padding: 20,
              gap: 16,
              paddingBottom: 96,
            }}
          >
            <AppText variant="bodyStrong">
              {t("coachPublic.yourRating")}
            </AppText>

            <View style={{ flexDirection: "row", gap: 10 }}>
              {[1, 2, 3, 4, 5].map((value) => {
                const active = value <= rating;

                return (
                  <Pressable key={value} onPress={() => setRating(value)}>
                    <Star
                      size={34}
                      color={active ? "#FFB020" : theme.colors.border}
                      fill={active ? "#FFB020" : "transparent"}
                    />
                  </Pressable>
                );
              })}
            </View>

            <AppInput
              label={t("coachPublic.comment")}
              value={comment}
              onChangeText={setComment}
              placeholder={t("coachPublic.commentPlaceholder")}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              style={{
                minHeight: 120,
              }}
            />

            <AppButton
              title={
                saving
                  ? t("common.saving")
                  : t("coachPublic.saveReview")
              }
              onPress={onSubmit}
              disabled={saving}
              fullWidth
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}