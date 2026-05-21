import { router } from "expo-router";
import { ChevronLeft, ChevronRight, Clock3, Dumbbell } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import {
  AppAvatar,
  AppCard,
  AppEmptyState,
  AppText,
  ScreenContainer,
} from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";
import { toAbsoluteUrl } from "@/src/services/api";

const COLORS = ["#16C784", "#3B82F6", "#FF7A1A", "#A855F7", "#EF4444", "#FFB020"];

type AppLangCode = "en" | "ru" | "kk";

type LocalizedWorkoutLike = {
  name?: string | null;
  nameRu?: string | null;
  nameKk?: string | null;
  name_ru?: string | null;
  name_kk?: string | null;

  category?: string | null;
  categoryRu?: string | null;
  categoryKk?: string | null;
  category_ru?: string | null;
  category_kk?: string | null;

  weeklyPlanTitle?: string | null;
  weeklyPlanTitleRu?: string | null;
  weeklyPlanTitleKk?: string | null;
  weekly_plan_title?: string | null;
  weekly_plan_title_ru?: string | null;
  weekly_plan_title_kk?: string | null;

  source?: string | null;
};

const TEXT = {
  en: {
    minuteShort: "m",
    sessionSingle: "session scheduled",
    sessionPlural: "sessions scheduled",
    completed: "Completed",
    categoryStrength: "Strength",
    categoryCardio: "Cardio",
    categoryMobility: "Mobility",
    categoryStretching: "Stretching",
    categoryRecovery: "Recovery",
    categoryOther: "Workout",
    weeklyPlan: "Weekly plan",
  },
  ru: {
    minuteShort: "мин",
    sessionSingle: "тренировка запланирована",
    sessionPlural: "тренировок запланировано",
    completed: "Завершено",
    categoryStrength: "Силовая",
    categoryCardio: "Кардио",
    categoryMobility: "Мобильность",
    categoryStretching: "Растяжка",
    categoryRecovery: "Восстановление",
    categoryOther: "Тренировка",
    weeklyPlan: "Недельный план",
  },
  kk: {
    minuteShort: "мин",
    sessionSingle: "жаттығу жоспарланған",
    sessionPlural: "жаттығу жоспарланған",
    completed: "Аяқталды",
    categoryStrength: "Күш жаттығуы",
    categoryCardio: "Кардио",
    categoryMobility: "Қозғалыс",
    categoryStretching: "Созылу",
    categoryRecovery: "Қалпына келу",
    categoryOther: "Жаттығу",
    weeklyPlan: "Апталық жоспар",
  },
};

function getLangSafe(lang: string): AppLangCode {
  if (lang === "ru" || lang === "kk" || lang === "en") return lang;

  return "en";
}

function pickText(...values: Array<string | null | undefined>) {
  return (
    values
      .find((value) => typeof value === "string" && value.trim().length > 0)
      ?.trim() ?? ""
  );
}

function getLocalizedWorkoutName(
  workout: LocalizedWorkoutLike,
  lang: AppLangCode,
) {
  if (lang === "ru") {
    return pickText(workout.nameRu, workout.name_ru, workout.name);
  }

  if (lang === "kk") {
    return pickText(workout.nameKk, workout.name_kk, workout.name);
  }

  return pickText(workout.name);
}

function getLocalizedWorkoutCategory(
  workout: LocalizedWorkoutLike,
  lang: AppLangCode,
) {
  if (lang === "ru") {
    return pickText(workout.categoryRu, workout.category_ru, workout.category);
  }

  if (lang === "kk") {
    return pickText(workout.categoryKk, workout.category_kk, workout.category);
  }

  return pickText(workout.category);
}

function getLocalizedWeeklyPlanTitle(
  workout: LocalizedWorkoutLike,
  lang: AppLangCode,
) {
  const L = TEXT[lang];

  if (lang === "ru") {
    return pickText(
      workout.weeklyPlanTitleRu,
      workout.weekly_plan_title_ru,
      L.weeklyPlan,
    );
  }

  if (lang === "kk") {
    return pickText(
      workout.weeklyPlanTitleKk,
      workout.weekly_plan_title_kk,
      L.weeklyPlan,
    );
  }

  return pickText(
    workout.weeklyPlanTitle,
    workout.weekly_plan_title,
    L.weeklyPlan,
  );
}

function getLocale(lang: AppLangCode) {
  if (lang === "ru") return "ru-RU";
  if (lang === "kk") return "kk-KZ";

  return "en-US";
}

function toLocalYMD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function parseLocalYMD(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day);
}

function getMonthName(date: Date, lang: AppLangCode) {
  return date.toLocaleString(getLocale(lang), {
    month: "long",
    year: "numeric",
  });
}

function getReadableDate(value: string, lang: AppLangCode) {
  return parseLocalYMD(value).toLocaleDateString(getLocale(lang), {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getWeekdayShort(date: Date, lang: AppLangCode) {
  return date
    .toLocaleDateString(getLocale(lang), {
      weekday: "short",
    })
    .replace(".", "")
    .slice(0, 2)
    .toUpperCase();
}

function getFirstDayOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getWorkoutCategoryLabel(category: string | undefined, lang: AppLangCode) {
  const L = TEXT[lang];
  const value = String(category ?? "").trim().toLowerCase();

  if (!value) return "";

  if (value === "strength") return L.categoryStrength;
  if (value === "cardio") return L.categoryCardio;
  if (value === "mobility") return L.categoryMobility;
  if (value === "stretching") return L.categoryStretching;
  if (value === "recovery") return L.categoryRecovery;

  return category ?? L.categoryOther;
}

function getSessionCountText(count: number, lang: AppLangCode) {
  const L = TEXT[lang];

  if (count === 1) return `1 ${L.sessionSingle}`;

  return `${count} ${L.sessionPlural}`;
}

export default function CoachCalendar() {
  const { theme } = useTheme();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { db } = useData();

  const currentLang = getLangSafe(lang);
  const L = TEXT[currentLang];

  const now = useMemo(() => new Date(), []);
  const [month, setMonth] = useState<Date>(() => getFirstDayOfMonth(now));
  const [selected, setSelected] = useState<string>(() => toLocalYMD(now));

  const monthName = useMemo(
    () => getMonthName(month, currentLang),
    [month, currentLang],
  );

  const weekLabels = useMemo(() => {
    const baseMonday = new Date(2026, 0, 5);

    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(baseMonday);
      day.setDate(baseMonday.getDate() + index);

      return getWeekdayShort(day, currentLang);
    });
  }, [currentLang]);

  const grid = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const startDay = (first.getDay() + 6) % 7;

    const cells: (Date | null)[] = [];

    for (let i = 0; i < startDay; i++) {
      cells.push(null);
    }

    for (let i = 1; i <= last.getDate(); i++) {
      cells.push(new Date(month.getFullYear(), month.getMonth(), i));
    }

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    return cells;
  }, [month]);

  const linkedClientIds = useMemo(() => {
    if (!db || !user) return new Set<string>();

    return new Set(
      db.clientProfiles
        .filter((client) => client.coachId === user.id)
        .map((client) => client.userId),
    );
  }, [db, user]);

  const dayMap = useMemo(() => {
    if (!db || !user) return new Map<string, string[]>();

    const m = new Map<string, string[]>();

    db.workouts
      .filter(
        (workout) =>
          workout.coachId === user.id && linkedClientIds.has(workout.clientId),
      )
      .forEach((workout) => {
        const idx =
          db.clientProfiles.findIndex(
            (client) => client.userId === workout.clientId,
          ) % COLORS.length;

        const arr = m.get(workout.date) ?? [];

        arr.push(COLORS[Math.max(0, idx)]);
        m.set(workout.date, arr);
      });

    return m;
  }, [db, user, linkedClientIds]);

  const sessions = useMemo(() => {
    if (!db || !user) return [];

    return db.workouts
      .filter(
        (workout) =>
          workout.coachId === user.id &&
          workout.date === selected &&
          linkedClientIds.has(workout.clientId),
      )
      .slice()
      .sort((a, b) => {
        const at = a.time || "99:99";
        const bt = b.time || "99:99";

        return at.localeCompare(bt);
      })
      .map((workout) => {
        const clientUser = db.users.find((x) => x.id === workout.clientId);

        const colorIdx =
          db.clientProfiles.findIndex(
            (client) => client.userId === workout.clientId,
          ) % COLORS.length;

        return {
          workout,
          clientUser,
          color: COLORS[Math.max(0, colorIdx)],
        };
      });
  }, [db, user, selected, linkedClientIds]);

  const goPreviousMonth = () => {
    const nextMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1);
    setMonth(nextMonth);
    setSelected(toLocalYMD(nextMonth));
  };

  const goNextMonth = () => {
    const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    setMonth(nextMonth);
    setSelected(toLocalYMD(nextMonth));
  };

  return (
    <ScreenContainer scroll>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginVertical: 8,
        }}
      >
        <Pressable onPress={goPreviousMonth} hitSlop={10}>
          <ChevronLeft color={theme.colors.text} size={24} />
        </Pressable>

        <View style={{ alignItems: "center" }}>
          <AppText variant="h2">{monthName}</AppText>

          <AppText variant="caption" color={theme.colors.textMuted}>
            {getReadableDate(selected, currentLang)}
          </AppText>
        </View>

        <Pressable onPress={goNextMonth} hitSlop={10}>
          <ChevronRight color={theme.colors.text} size={24} />
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", marginTop: 8 }}>
        {weekLabels.map((day, index) => (
          <View key={`${day}_${index}`} style={{ flex: 1, alignItems: "center" }}>
            <AppText variant="caption" color={theme.colors.textMuted}>
              {day}
            </AppText>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
        {grid.map((date, index) => {
          if (!date) {
            return (
              <View
                key={`empty_${index}`}
                style={{ width: `${100 / 7}%`, height: 54 }}
              />
            );
          }

          const key = toLocalYMD(date);
          const dots = dayMap.get(key) ?? [];
          const isSelected = selected === key;
          const isToday = key === toLocalYMD(new Date());

          return (
            <Pressable
              key={key}
              onPress={() => setSelected(key)}
              style={{
                width: `${100 / 7}%`,
                height: 54,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isSelected
                    ? theme.colors.primary
                    : isToday
                      ? theme.colors.surfaceAlt
                      : "transparent",
                }}
              >
                <AppText
                  variant="small"
                  color={
                    isSelected
                      ? theme.colors.primaryContrast
                      : theme.colors.text
                  }
                  style={{ fontWeight: "800" }}
                >
                  {date.getDate()}
                </AppText>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  gap: 2,
                  marginTop: 3,
                  height: 5,
                }}
              >
                {dots.slice(0, 3).map((color, idx) => (
                  <View
                    key={`${key}_${idx}`}
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: color,
                    }}
                  />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: 18, gap: 10 }}>
        <View>
          <AppText variant="h3">
            {t("calendar.sessionsOn", { date: selected })}
          </AppText>

          <AppText
            variant="small"
            color={theme.colors.textMuted}
            style={{ marginTop: 4 }}
          >
            {sessions.length > 0
              ? getSessionCountText(sessions.length, currentLang)
              : getReadableDate(selected, currentLang)}
          </AppText>
        </View>

        {sessions.length === 0 ? (
          <AppCard variant="outline">
            <AppEmptyState
              title={t("calendar.noSessions")}
              message={t("calendar.noSessionsMsg")}
            />
          </AppCard>
        ) : (
          sessions.map(({ workout, clientUser, color }) => {
            if (!clientUser) return null;

            const workoutName = getLocalizedWorkoutName(workout, currentLang);
            const localizedCategory = getLocalizedWorkoutCategory(
              workout,
              currentLang,
            );

            return (
              <Pressable
                key={workout.id}
                onPress={() =>
                  router.push({
                    pathname: "/client/[id]",
                    params: { id: workout.clientId },
                  } as any)
                }
              >
                <AppCard variant="elevated">
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 4,
                        height: 62,
                        borderRadius: 2,
                        backgroundColor: color,
                      }}
                    />

                    <AppAvatar
                      uri={toAbsoluteUrl(clientUser.avatarUrl)}
                      name={clientUser.name}
                      size={50}
                    />

                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyStrong">
                        {workoutName || L.categoryOther}
                      </AppText>

                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          marginTop: 4,
                        }}
                      >
                        <Clock3 color={theme.colors.textMuted} size={14} />

                        <AppText variant="small" color={theme.colors.textMuted}>
                          {workout.time ? `${workout.time} · ` : ""}
                          {clientUser.name}
                        </AppText>
                      </View>

                      <AppText
                        variant="caption"
                        color={theme.colors.textMuted}
                        style={{ marginTop: 3 }}
                      >
                        {workout.durationMinutes ?? 0}
                        {L.minuteShort}
                        {localizedCategory
                          ? ` · ${getWorkoutCategoryLabel(
                              localizedCategory,
                              currentLang,
                            )}`
                          : ""}
                        {workout.source === "weekly_template"
                          ? ` · ${getLocalizedWeeklyPlanTitle(
                              workout,
                              currentLang,
                            )}`
                          : ""}
                        {workout.completed ? ` · ${L.completed}` : ""}
                      </AppText>
                    </View>

                    <Dumbbell color={theme.colors.textMuted} size={18} />
                  </View>
                </AppCard>
              </Pressable>
            );
          })
        )}
      </View>
    </ScreenContainer>
  );
}