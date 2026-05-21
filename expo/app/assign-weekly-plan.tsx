import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Dumbbell,
  Flame,
  Info,
  Sparkles,
  Target,
  X,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";

import {
  AppButton,
  AppCard,
  AppChip,
  AppText,
  ScreenContainer,
  StatCard,
} from "@/src/components/ui";
import { apiPost } from "@/src/services/api";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { useTheme } from "@/src/context/ThemeContext";
import {
  buildPlanFitAnalysis,
  getLocalizedDayDescription,
  getLocalizedDayName,
  getLocalizedExerciseName,
  getLocalizedPlanCoachAnalysis,
  getLocalizedPlanDescription,
  getLocalizedPlanGoalLabel,
  getLocalizedPlanSubtitle,
  getLocalizedPlanTitle,
  getLocalizedProgressionNotes,
  getLocalizedSafetyNotes,
  getRecommendedWorkoutTemplates,
  WORKOUT_TEMPLATES,
} from "@/src/data/workoutTemplates";
import { useI18n } from "@/src/i18n/I18nContext";
import {
  FitnessLevel,
  WeeklyPlanGoal,
  WeeklyTrainingPlan,
} from "@/src/types/models";

type FilterKey = "all" | WeeklyPlanGoal;

type FilterItem = {
  key: FilterKey;
  labelRu: string;
  labelEn: string;
  labelKk: string;
};

type ClientBundle = {
  profile: NonNullable<ReturnType<typeof useData>["db"]>["clientProfiles"][number];
  user: NonNullable<ReturnType<typeof useData>["db"]>["users"][number];
};

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&auto=format&fit=crop&q=80";

const FILTERS: FilterItem[] = [
  { key: "all", labelRu: "Все", labelEn: "All", labelKk: "Барлығы" },
  { key: "fat_loss", labelRu: "Похудение", labelEn: "Fat loss", labelKk: "Арықтау" },
  { key: "muscle_gain", labelRu: "Масса", labelEn: "Muscle gain", labelKk: "Бұлшықет" },
  { key: "strength", labelRu: "Сила", labelEn: "Strength", labelKk: "Күш" },
  { key: "mobility", labelRu: "Мобильность", labelEn: "Mobility", labelKk: "Қозғалыс" },
  { key: "endurance", labelRu: "Выносливость", labelEn: "Endurance", labelKk: "Төзімділік" },
  { key: "glutes_legs", labelRu: "Ягодицы/ноги", labelEn: "Glutes/legs", labelKk: "Бөксе/аяқ" },
  { key: "home_training", labelRu: "Дом", labelEn: "Home", labelKk: "Үй" },
  { key: "general_fitness", labelRu: "Общая форма", labelEn: "Fitness", labelKk: "Форма" },
  { key: "posture_back", labelRu: "Осанка/спина", labelEn: "Posture/back", labelKk: "Қалып/арқа" },
  { key: "recomposition", labelRu: "Рекомпозиция", labelEn: "Recomposition", labelKk: "Рекомпозиция" },
  { key: "upper_body", labelRu: "Верх тела", labelEn: "Upper body", labelKk: "Жоғарғы дене" },
  { key: "dumbbell_home", labelRu: "Гантели дома", labelEn: "Dumbbell home", labelKk: "Үйде гантель" },
  { key: "beginner_gym", labelRu: "Старт в зале", labelEn: "Beginner gym", labelKk: "Залда бастау" },
];

function getLevelLabel(level: FitnessLevel, lang: string): string {
  if (lang === "ru") {
    if (level === "beginner") return "Новичок";
    if (level === "intermediate") return "Средний";
    return "Продвинутый";
  }

  if (lang === "kk") {
    if (level === "beginner") return "Бастапқы";
    if (level === "intermediate") return "Орта";
    return "Жоғары";
  }

  if (level === "beginner") return "Beginner";
  if (level === "intermediate") return "Intermediate";
  return "Advanced";
}

function getGoalLabel(goal: WeeklyPlanGoal, lang: string): string {
  const ru: Record<WeeklyPlanGoal, string> = {
    fat_loss: "Похудение",
    muscle_gain: "Набор мышц",
    strength: "Сила",
    mobility: "Мобильность",
    endurance: "Выносливость",
    general_fitness: "Общая форма",
    glutes_legs: "Ягодицы и ноги",
    home_training: "Домашние тренировки",
    posture_back: "Осанка и спина",
    recomposition: "Рекомпозиция",
    upper_body: "Верх тела",
    dumbbell_home: "Гантели дома",
    beginner_gym: "Старт в зале",
  };

  const kk: Record<WeeklyPlanGoal, string> = {
    fat_loss: "Арықтау",
    muscle_gain: "Бұлшықет жинау",
    strength: "Күш",
    mobility: "Қозғалғыштық",
    endurance: "Төзімділік",
    general_fitness: "Жалпы форма",
    glutes_legs: "Бөксе және аяқ",
    home_training: "Үй жаттығулары",
    posture_back: "Қалып және арқа",
    recomposition: "Рекомпозиция",
    upper_body: "Жоғарғы дене",
    dumbbell_home: "Үйде гантель",
    beginner_gym: "Залда бастау",
  };

  const en: Record<WeeklyPlanGoal, string> = {
    fat_loss: "Fat loss",
    muscle_gain: "Muscle gain",
    strength: "Strength",
    mobility: "Mobility",
    endurance: "Endurance",
    general_fitness: "General fitness",
    glutes_legs: "Glutes & legs",
    home_training: "Home training",
    posture_back: "Posture & back",
    recomposition: "Recomposition",
    upper_body: "Upper body",
    dumbbell_home: "Dumbbell home",
    beginner_gym: "Beginner gym",
  };

  if (lang === "ru") return ru[goal];
  if (lang === "kk") return kk[goal];
  return en[goal];
}


function getGoalTypeLabel(goalType: string | null | undefined, lang: string): string {
  if (!goalType || goalType === "custom") {
    if (lang === "ru") return "Индивидуальная цель";
    if (lang === "kk") return "Жеке мақсат";
    return "Custom goal";
  }

  const ru: Record<string, string> = {
    lose_weight: "Похудение",
    gain_muscle: "Набор мышц",
    improve_mobility: "Мобильность",
    maintain_shape: "Поддержание формы",
  };

  const kk: Record<string, string> = {
    lose_weight: "Арықтау",
    gain_muscle: "Бұлшықет жинау",
    improve_mobility: "Қозғалғыштық",
    maintain_shape: "Форманы сақтау",
  };

  const en: Record<string, string> = {
    lose_weight: "Fat loss",
    gain_muscle: "Muscle gain",
    improve_mobility: "Mobility",
    maintain_shape: "Maintain shape",
  };

  if (lang === "ru") return ru[goalType] ?? goalType;
  if (lang === "kk") return kk[goalType] ?? goalType;
  return en[goalType] ?? goalType;
}

function getRecommendationReasonText(
  label: string,
  fallback: string,
  lang: string,
): string {
  const ru: Record<string, string> = {
    "General fit": "Профиль клиента заполнен не полностью, поэтому план показан как универсальный вариант.",
    "Goal match": "План совпадает с выбранной целью клиента.",
    "General base": "План подходит как сбалансированная база для общей формы.",
    "Priority match": "План совпадает с приоритетом клиента по ногам и ягодицам.",
    "Environment match": "План подходит под формат тренировок клиента дома.",
    "Posture match": "План помогает улучшать осанку, верх спины и контроль корпуса.",
    "Level match": "Сложность плана соответствует уровню клиента.",
    "Intensity warning": "План может быть немного интенсивным для новичка.",
    "Too easy": "План может быть слишком лёгким для продвинутого клиента.",
    "Joint-friendly option": "План можно адаптировать для клиента с чувствительными коленями.",
    "Knee caution": "В плане больше нагрузки на ноги, поэтому тренеру нужно аккуратно отредактировать упражнения.",
    "Back-friendly": "Мобильность, осанка и работа на корпус могут быть более безопасной стартовой точкой.",
    "Back caution": "Тяжёлые приседы и тяги требуют внимательного контроля техники.",
  };

  const kk: Record<string, string> = {
    "General fit": "Клиент профилі толық емес, сондықтан жоспар жалпы нұсқа ретінде көрсетілді.",
    "Goal match": "Жоспар клиент таңдаған мақсатқа сәйкес келеді.",
    "General base": "Жоспар жалпы формаға арналған теңгерімді база ретінде жарайды.",
    "Priority match": "Жоспар клиенттің аяқ пен бөксе басымдығына сәйкес келеді.",
    "Environment match": "Жоспар клиенттің үйде жаттығу форматына сәйкес келеді.",
    "Posture match": "Жоспар қалыпты, жоғарғы арқаны және корпус бақылауын жақсартуға көмектеседі.",
    "Level match": "Жоспар күрделілігі клиент деңгейіне сәйкес келеді.",
    "Intensity warning": "Жоспар бастапқы деңгей үшін сәл ауыр болуы мүмкін.",
    "Too easy": "Жоспар жоғары деңгейлі клиентке тым жеңіл болуы мүмкін.",
    "Joint-friendly option": "Жоспарды тізесі сезімтал клиентке бейімдеуге болады.",
    "Knee caution": "Жоспарда аяққа жүктеме көбірек, сондықтан жаттықтырушы жаттығуларды мұқият түзетуі керек.",
    "Back-friendly": "Қозғалыс, қалып және корпус жұмысы қауіпсіздеу бастау болуы мүмкін.",
    "Back caution": "Ауыр отырып-тұру мен тарту техникаға мұқият бақылауды талап етеді.",
  };

  if (lang === "ru") return ru[label] ?? fallback;
  if (lang === "kk") return kk[label] ?? fallback;
  return fallback;
}

function getFilterLabel(filter: FilterItem, lang: string): string {
  if (lang === "ru") return filter.labelRu;
  if (lang === "kk") return filter.labelKk;
  return filter.labelEn;
}

function getAssignTitle(lang: string): string {
  if (lang === "ru") return "Назначить недельный план";
  if (lang === "kk") return "Апталық жоспар беру";
  return "Assign weekly plan";
}

function getAssignButton(lang: string): string {
  if (lang === "ru") return "Назначить клиенту";
  if (lang === "kk") return "Клиентке беру";
  return "Assign to client";
}

function getAiTitle(lang: string): string {
  if (lang === "ru") return "AI-анализ плана";
  if (lang === "kk") return "AI жоспар талдауы";
  return "AI plan analysis";
}

function getRecommendedLabel(lang: string): string {
  if (lang === "ru") return "Рекомендовано";
  if (lang === "kk") return "Ұсынылады";
  return "Recommended";
}

function getSessionsLabel(lang: string): string {
  if (lang === "ru") return "тренировки";
  if (lang === "kk") return "жаттығу";
  return "sessions";
}

function getMinutesLabel(lang: string): string {
  return "мин";
}

function getOpenDetailsLabel(lang: string): string {
  if (lang === "ru") return "Посмотреть план";
  if (lang === "kk") return "Жоспарды көру";
  return "View plan";
}

function getSelectLabel(lang: string, selected: boolean): string {
  if (selected) {
    if (lang === "ru") return "Выбран";
    if (lang === "kk") return "Таңдалды";
    return "Selected";
  }

  if (lang === "ru") return "Выбрать";
  if (lang === "kk") return "Таңдау";
  return "Select";
}

function getEmptyClientText(lang: string): string {
  if (lang === "ru") return "Клиент не найден.";
  if (lang === "kk") return "Клиент табылмады.";
  return "Client not found.";
}

function getBackLabel(lang: string): string {
  if (lang === "ru") return "Назад";
  if (lang === "kk") return "Артқа";
  return "Back";
}

function getSuccessTitle(lang: string): string {
  if (lang === "ru") return "План назначен";
  if (lang === "kk") return "Жоспар берілді";
  return "Plan assigned";
}

function getSuccessMessage(lang: string, count: number): string {
  if (lang === "ru") {
    return `Клиенту создано ${count} тренировки на неделю. Теперь тренер может открыть каждую тренировку и отредактировать упражнения, подходы, повторы, вес и заметки.`;
  }

  if (lang === "kk") {
    return `Клиентке аптаға ${count} жаттығу құрылды. Енді тренер әр жаттығуды ашып, жаттығуларды, сеттерді, қайталауды, салмақты және ескертпелерді өзгерте алады.`;
  }

  return `${count} weekly workouts were created for the client. The coach can now open each workout and edit exercises, sets, reps, weight and notes.`;
}

function getNoPlanTitle(lang: string): string {
  if (lang === "ru") return "Выберите план";
  if (lang === "kk") return "Жоспар таңдаңыз";
  return "Choose a plan";
}

function getNoPlanMessage(lang: string): string {
  if (lang === "ru") return "Сначала выбери готовый недельный план.";
  if (lang === "kk") return "Алдымен дайын апталық жоспарды таңдаңыз.";
  return "Please choose a weekly plan first.";
}

function getErrorTitle(lang: string): string {
  if (lang === "ru") return "Ошибка";
  if (lang === "kk") return "Қате";
  return "Error";
}

function getAssigningLabel(lang: string): string {
  if (lang === "ru") return "Назначаем...";
  if (lang === "kk") return "Берілуде...";
  return "Assigning...";
}

function getHealthNotesLabel(lang: string): string {
  if (lang === "ru") return "Заметки по здоровью";
  if (lang === "kk") return "Денсаулық ескертпелері";
  return "Health notes";
}

function getGoalStatLabel(lang: string): string {
  if (lang === "ru") return "Цель";
  if (lang === "kk") return "Мақсат";
  return "Goal";
}

function getPlansStatLabel(lang: string): string {
  if (lang === "ru") return "Планы";
  if (lang === "kk") return "Жоспарлар";
  return "Plans";
}

function getClientGoalFallback(lang: string): string {
  if (lang === "ru") return "Цель клиента";
  if (lang === "kk") return "Клиент мақсаты";
  return "Client goal";
}

function getExercisesLabel(lang: string): string {
  if (lang === "ru") return "упражнений";
  if (lang === "kk") return "жаттығу";
  return "exercises";
}

function getSafetyNotesLabel(lang: string): string {
  if (lang === "ru") return "Безопасность";
  if (lang === "kk") return "Қауіпсіздік";
  return "Safety notes";
}

function getProgressionLabel(lang: string): string {
  if (lang === "ru") return "Прогрессия";
  if (lang === "kk") return "Прогрессия";
  return "Progression";
}

function getRestLabel(lang: string): string {
  if (lang === "ru") return "отдых";
  if (lang === "kk") return "демалыс";
  return "rest";
}

function getExercisePreview(plan: WeeklyTrainingPlan): string {
  const firstExercise = plan.days[0]?.exercises[0];

  return (
    firstExercise?.gifUrl ||
    firstExercise?.animationFrames?.[0] ||
    firstExercise?.imageUrl ||
    FALLBACK_IMAGE
  );
}

function getPlanScoreColor(score: number, theme: any): string {
  if (score >= 80) return theme.colors.success ?? theme.colors.primary;
  if (score >= 60) return theme.colors.primary;
  if (score >= 40) return theme.colors.fire ?? theme.colors.warning ?? theme.colors.primary;
  return theme.colors.danger;
}

export default function AssignWeeklyPlanScreen() {
  const { clientId } = useLocalSearchParams<{ clientId?: string }>();
  const { theme } = useTheme();
  const { lang } = useI18n();
  const { user, token } = useAuth();
  const { db, refreshFromBackend } = useData();

  const [selectedFilter, setSelectedFilter] = useState<FilterKey>("all");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [detailsPlan, setDetailsPlan] = useState<WeeklyTrainingPlan | null>(null);
  const [assigning, setAssigning] = useState(false);

  const client = useMemo<ClientBundle | null>(() => {
    if (!db || !clientId) return null;

    const profile = db.clientProfiles.find(
      (profileItem) => profileItem.userId === String(clientId),
    );
    const userInfo = db.users.find(
      (userItem) => userItem.id === String(clientId),
    );

    if (!profile || !userInfo) return null;

    return {
      profile,
      user: userInfo,
    };
  }, [db, clientId]);

  const clientProgress = useMemo(() => {
    if (!db || !clientId) return [];

    return db.progress.filter(
      (progressItem) => progressItem.clientId === String(clientId),
    );
  }, [db, clientId]);

  const clientWorkouts = useMemo(() => {
    if (!db || !clientId) return [];

    return db.workouts.filter(
      (workoutItem) => workoutItem.clientId === String(clientId),
    );
  }, [db, clientId]);

  const recommendations = useMemo(() => {
    const recommended = getRecommendedWorkoutTemplates(client?.profile);

    if (selectedFilter === "all") return recommended;

    return recommended.filter(
      (recommendationItem) => recommendationItem.plan.goal === selectedFilter,
    );
  }, [client?.profile, selectedFilter]);

  const selectedPlan = useMemo(() => {
    if (!selectedPlanId) return null;

    return (
      WORKOUT_TEMPLATES.find((templateItem) => templateItem.id === selectedPlanId) ??
      null
    );
  }, [selectedPlanId]);

  const selectedAnalysis = useMemo(() => {
    if (!selectedPlan) return "";

    return buildPlanFitAnalysis({
      plan: selectedPlan,
      client: client?.profile,
      progress: clientProgress,
      workouts: clientWorkouts,
      lang,
    });
  }, [selectedPlan, client?.profile, clientProgress, clientWorkouts]);

  const assignPlan = async () => {
    if (!clientId || !user?.id) return;

    if (!selectedPlan) {
      Alert.alert(getNoPlanTitle(lang), getNoPlanMessage(lang));
      return;
    }

    if (!token) {
      Alert.alert(
        getErrorTitle(lang),
        lang === "ru"
          ? "Сессия истекла. Выйди из аккаунта и зайди снова."
          : lang === "kk"
            ? "Сессия аяқталды. Аккаунттан шығып, қайта кіріңіз."
            : "Session expired. Please log out and sign in again.",
      );
      return;
    }

    try {
      setAssigning(true);

      const result = await apiPost(
        "/workouts/assign-weekly-plan",
        {
          client_id: String(clientId),
          plan_id: selectedPlan.id,
          start_date: new Date().toISOString().slice(0, 10),
          plan: selectedPlan,
        },
        { token },
      );

      await refreshFromBackend();

      Alert.alert(
        getSuccessTitle(lang),
        getSuccessMessage(
          lang,
          Array.isArray(result?.workoutIds) ? result.workoutIds.length : selectedPlan.days.length,
        ),
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ],
      );
    } catch (error: any) {
      Alert.alert(
        getErrorTitle(lang),
        error?.message || "Could not assign weekly plan.",
      );
    } finally {
      setAssigning(false);
    }
  };

  if (!db || !user) return null;

  if (!client) {
    return (
      <ScreenContainer>
        <Stack.Screen
          options={{
            title: getAssignTitle(lang),
            headerLeft: () => (
              <Pressable onPress={() => router.back()} hitSlop={10}>
                <ChevronLeft color={theme.colors.text} size={24} />
              </Pressable>
            ),
          }}
        />

        <AppCard variant="outline">
          <AppText variant="h3">{getEmptyClientText(lang)}</AppText>

          <AppButton
            title={getBackLabel(lang)}
            variant="secondary"
            onPress={() => router.back()}
            style={{ marginTop: 12 }}
          />
        </AppCard>
      </ScreenContainer>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: getAssignTitle(lang),
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <ChevronLeft color={theme.colors.text} size={24} />
            </Pressable>
          ),
        }}
      />

      <ScreenContainer scroll padded={false}>
        <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 14 }}>
          <AppCard variant="elevated">
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(22,199,132,0.14)",
                }}
              >
                <Sparkles color={theme.colors.primary} size={22} />
              </View>

              <View style={{ flex: 1 }}>
                <AppText variant="h2">{getAssignTitle(lang)}</AppText>

                <AppText variant="small" color={theme.colors.textMuted}>
                  {client.user.name} ·{" "}
                  {getLevelLabel(client.profile.fitnessLevel, lang)} ·{" "}
                  {client.profile.currentWeight} kg
                </AppText>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <StatCard
                label={getGoalStatLabel(lang)}
                value={getGoalTypeLabel(client.profile.goalType, lang)}
                hint={client.profile.goal || getClientGoalFallback(lang)}
              />

              <StatCard
                label={getPlansStatLabel(lang)}
                value={WORKOUT_TEMPLATES.length}
                hint={`3 ${getSessionsLabel(lang)}/week`}
                tone="primary"
              />
            </View>

            {client.profile.healthNotes ? (
              <View
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: theme.radius.md,
                  backgroundColor: "rgba(255,176,32,0.12)",
                  borderWidth: 1,
                  borderColor: "rgba(255,176,32,0.24)",
                  flexDirection: "row",
                  gap: 8,
                }}
              >
                <AlertTriangle color={theme.colors.fire} size={18} />

                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">
                    {getHealthNotesLabel(lang)}
                  </AppText>

                  <AppText variant="small" color={theme.colors.textMuted}>
                    {client.profile.healthNotes}
                  </AppText>
                </View>
              </View>
            ) : null}
          </AppCard>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
          >
            {FILTERS.map((filterItem) => (
              <AppChip
                key={filterItem.key}
                label={getFilterLabel(filterItem, lang)}
                active={selectedFilter === filterItem.key}
                onPress={() => setSelectedFilter(filterItem.key)}
              />
            ))}
          </ScrollView>

          <View style={{ gap: 12 }}>
            {recommendations.map((recommendation) => {
              const { plan, score, reasons } = recommendation;
              const selected = selectedPlanId === plan.id;
              const scoreColor = getPlanScoreColor(score, theme);

              return (
                <Pressable
                  key={plan.id}
                  onPress={() => setSelectedPlanId(plan.id)}
                >
                  <AppCard
                    variant="outline"
                    style={{
                      borderWidth: selected ? 2 : 1,
                      borderColor: selected
                        ? theme.colors.primary
                        : theme.colors.border,
                    }}
                  >
                    <View style={{ flexDirection: "row", gap: 12 }}>
                      <View
                        style={{
                          width: 78,
                          height: 78,
                          borderRadius: 18,
                          overflow: "hidden",
                          backgroundColor: theme.colors.surfaceAlt,
                        }}
                      >
                        <Image
                          source={{ uri: getExercisePreview(plan) }}
                          style={{ width: 78, height: 78 }}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                        />
                      </View>

                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <AppText
                            variant="bodyStrong"
                            numberOfLines={1}
                            style={{ flex: 1 }}
                          >
                            {getLocalizedPlanTitle(plan, lang)}
                          </AppText>

                          {selected ? (
                            <CheckCircle2
                              color={theme.colors.primary}
                              size={20}
                            />
                          ) : null}
                        </View>

                        <AppText
                          variant="small"
                          color={theme.colors.textMuted}
                          numberOfLines={2}
                          style={{ marginTop: 3 }}
                        >
                          {getLocalizedPlanSubtitle(plan, lang)}
                        </AppText>

                        <View
                          style={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: 6,
                            marginTop: 8,
                          }}
                        >
                          <Badge
                            icon={
                              <Target color={theme.colors.primary} size={13} />
                            }
                            text={getLocalizedPlanGoalLabel(plan, lang)}
                          />

                          <Badge
                            icon={
                              <Dumbbell color={theme.colors.accent} size={13} />
                            }
                            text={getLevelLabel(plan.level, lang)}
                          />

                          <Badge
                            icon={
                              <Clock3 color={theme.colors.fire} size={13} />
                            }
                            text={`${plan.estimatedMinutesPerSession} ${getMinutesLabel(
                              lang,
                            )}`}
                          />
                        </View>
                      </View>
                    </View>

                    <View
                      style={{
                        marginTop: 12,
                        padding: 10,
                        borderRadius: theme.radius.md,
                        backgroundColor: theme.colors.surfaceAlt,
                        gap: 6,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <AppText variant="small" style={{ fontWeight: "800" }}>
                          {getRecommendedLabel(lang)}
                        </AppText>

                        <AppText
                          variant="small"
                          color={scoreColor}
                          style={{ fontWeight: "900" }}
                        >
                          {score}%
                        </AppText>
                      </View>

                      <View
                        style={{
                          height: 8,
                          borderRadius: 999,
                          backgroundColor: theme.colors.surface,
                          overflow: "hidden",
                        }}
                      >
                        <View
                          style={{
                            width: `${score}%`,
                            height: 8,
                            borderRadius: 999,
                            backgroundColor: scoreColor,
                          }}
                        />
                      </View>

                      {reasons[0] ? (
                        <AppText
                          variant="caption"
                          color={theme.colors.textMuted}
                        >
                          {getRecommendationReasonText(reasons[0].label, reasons[0].reason, lang)}
                        </AppText>
                      ) : null}
                    </View>

                    <View
                      style={{
                        flexDirection: "row",
                        gap: 10,
                        marginTop: 12,
                      }}
                    >
                      <AppButton
                        title={getOpenDetailsLabel(lang)}
                        variant="secondary"
                        size="sm"
                        icon={<Info color={theme.colors.text} size={15} />}
                        onPress={() => setDetailsPlan(plan)}
                        style={{ flex: 1 }}
                      />

                      <AppButton
                        title={getSelectLabel(lang, selected)}
                        size="sm"
                        onPress={() => setSelectedPlanId(plan.id)}
                        style={{ flex: 1 }}
                      />
                    </View>
                  </AppCard>
                </Pressable>
              );
            })}
          </View>

          {selectedPlan ? (
            <AppCard variant="elevated">
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <Sparkles color={theme.colors.primary} size={20} />

                <AppText variant="h3">{getAiTitle(lang)}</AppText>
              </View>

              <AppText
                variant="small"
                color={theme.colors.textMuted}
                style={{ marginTop: 8, lineHeight: 20 }}
              >
                {selectedAnalysis}
              </AppText>
            </AppCard>
          ) : null}

          <View style={{ paddingBottom: 32 }}>
            <AppButton
              title={
                assigning ? getAssigningLabel(lang) : getAssignButton(lang)
              }
              size="lg"
              loading={assigning}
              disabled={assigning || !selectedPlan}
              icon={<Flame color={theme.colors.primaryContrast} size={18} />}
              onPress={assignPlan}
              fullWidth
            />
          </View>
        </View>
      </ScreenContainer>

      <PlanDetailsModal
        visible={!!detailsPlan}
        plan={detailsPlan}
        onClose={() => setDetailsPlan(null)}
      />
    </>
  );
}

function Badge({ icon, text }: { icon: React.ReactNode; text: string }) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: theme.colors.surfaceAlt,
      }}
    >
      {icon}

      <AppText variant="caption" color={theme.colors.textMuted}>
        {text}
      </AppText>
    </View>
  );
}

function PlanDetailsModal({
  visible,
  plan,
  onClose,
}: {
  visible: boolean;
  plan: WeeklyTrainingPlan | null;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const { lang } = useI18n();

  if (!plan) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
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
            gap: 12,
          }}
        >
          <Pressable onPress={onClose} hitSlop={8}>
            <X color={theme.colors.text} size={22} />
          </Pressable>

          <View style={{ flex: 1 }}>
            <AppText variant="h3" numberOfLines={1}>
              {getLocalizedPlanTitle(plan, lang)}
            </AppText>

            <AppText variant="caption" color={theme.colors.textMuted}>
              {plan.sessionsPerWeek} {getSessionsLabel(lang)} ·{" "}
              {plan.estimatedMinutesPerSession} {getMinutesLabel(lang)}
            </AppText>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            padding: 20,
            gap: 14,
            paddingBottom: Platform.OS === "ios" ? 40 : 28,
          }}
        >
          <AppCard variant="elevated">
            <AppText variant="h3">{getLocalizedPlanSubtitle(plan, lang)}</AppText>

            <AppText
              variant="small"
              color={theme.colors.textMuted}
              style={{ marginTop: 8, lineHeight: 20 }}
            >
              {getLocalizedPlanDescription(plan, lang)}
            </AppText>
          </AppCard>

          <AppCard variant="outline">
            <AppText variant="h3">{getAiTitle(lang)}</AppText>

            <AppText
              variant="small"
              color={theme.colors.textMuted}
              style={{ marginTop: 8, lineHeight: 20 }}
            >
              {getLocalizedPlanCoachAnalysis(plan, lang)}
            </AppText>
          </AppCard>

          <AppCard variant="outline">
            <AppText variant="h3">{getSafetyNotesLabel(lang)}</AppText>

            <View style={{ marginTop: 10, gap: 8 }}>
              {getLocalizedSafetyNotes(plan, lang).map((note) => (
                <View key={note} style={{ flexDirection: "row", gap: 8 }}>
                  <AlertTriangle color={theme.colors.fire} size={16} />

                  <AppText
                    variant="small"
                    color={theme.colors.textMuted}
                    style={{ flex: 1 }}
                  >
                    {note}
                  </AppText>
                </View>
              ))}
            </View>
          </AppCard>

          <AppCard variant="outline">
            <AppText variant="h3">{getProgressionLabel(lang)}</AppText>

            <View style={{ marginTop: 10, gap: 8 }}>
              {getLocalizedProgressionNotes(plan, lang).map((note) => (
                <View key={note} style={{ flexDirection: "row", gap: 8 }}>
                  <CheckCircle2 color={theme.colors.success} size={16} />

                  <AppText
                    variant="small"
                    color={theme.colors.textMuted}
                    style={{ flex: 1 }}
                  >
                    {note}
                  </AppText>
                </View>
              ))}
            </View>
          </AppCard>

          {plan.days.map((day, dayIndex) => (
            <AppCard key={day.id} variant="outline">
              <View style={{ gap: 8 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: theme.colors.primary,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <AppText
                      variant="caption"
                      color={theme.colors.primaryContrast}
                      style={{ fontWeight: "900" }}
                    >
                      {dayIndex + 1}
                    </AppText>
                  </View>

                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyStrong">{getLocalizedDayName(day, lang)}</AppText>

                    <AppText variant="caption" color={theme.colors.textMuted}>
                      {day.durationMinutes} {getMinutesLabel(lang)} ·{" "}
                      {day.exercises.length} {getExercisesLabel(lang)}
                    </AppText>
                  </View>
                </View>

                <AppText variant="small" color={theme.colors.textMuted}>
                  {getLocalizedDayDescription(day, lang)}
                </AppText>

                <View style={{ gap: 8, marginTop: 4 }}>
                  {day.exercises.map((exercise, index) => {
                    const imageUrl =
                      exercise.gifUrl ||
                      exercise.animationFrames?.[0] ||
                      exercise.imageUrl ||
                      "";

                    return (
                      <View
                        key={exercise.id}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          padding: 10,
                          borderRadius: theme.radius.md,
                          backgroundColor: theme.colors.surfaceAlt,
                        }}
                      >
                        <View
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 12,
                            overflow: "hidden",
                            backgroundColor: theme.colors.surface,
                          }}
                        >
                          {imageUrl ? (
                            <Image
                              source={{ uri: imageUrl }}
                              style={{ width: 34, height: 34 }}
                              contentFit="cover"
                              cachePolicy="memory-disk"
                            />
                          ) : null}
                        </View>

                        <View style={{ flex: 1 }}>
                          <AppText variant="small" style={{ fontWeight: "800" }}>
                            {index + 1}. {getLocalizedExerciseName(exercise, lang)}
                          </AppText>

                          <AppText variant="caption" color={theme.colors.textMuted}>
                            {exercise.sets}×{exercise.reps} ·{" "}
                            {getRestLabel(lang)} {exercise.restSeconds}s
                            {exercise.targetRpe
                              ? ` · RPE ${exercise.targetRpe}`
                              : ""}
                          </AppText>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </AppCard>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}
