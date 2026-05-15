import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import {
  Bell,
  Camera,
  Check,
  Copy,
  Edit3,
  Globe,
  LogOut,
  Moon,
  Sun,
  X,
} from "lucide-react-native";
import React from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  View,
} from "react-native";

import { LanguageModal } from "@/src/components/LanguageModal";
import {
  AppAvatar,
  AppButton,
  AppCard,
  AppInput,
  AppText,
  GradientHeader,
  ScreenContainer,
  SectionHeader,
  StreakPill,
} from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";
import { LANGUAGES } from "@/src/i18n/translations";
import { apiPatch, apiUploadFile, toAbsoluteUrl } from "@/src/services/api";

type FitnessLevel = "beginner" | "intermediate" | "advanced";

type NotificationKey =
  | "workoutReminders"
  | "supplementReminders"
  | "messageNotifications"
  | "weeklyGoalReminders";

type AppLangCode = "en" | "ru" | "kk";

const FITNESS_LEVEL_KEYS: { key: FitnessLevel; tKey: string }[] = [
  { key: "beginner", tKey: "auth.fitnessBeginner" },
  { key: "intermediate", tKey: "auth.fitnessIntermediate" },
  { key: "advanced", tKey: "auth.fitnessAdvanced" },
];

const CLIENT_PROFILE_TEXT = {
  en: {
    goalLose: "Lose weight",
    goalGain: "Gain muscle",
    goalMobility: "Improve mobility",
    goalMaintain: "Maintain shape",
    customGoalPlaceholder: "Write your personal goal...",
  },
  ru: {
    goalLose: "Снижение веса",
    goalGain: "Набор мышц",
    goalMobility: "Улучшение мобильности",
    goalMaintain: "Поддержание формы",
    customGoalPlaceholder: "Напишите личную цель...",
  },
  kk: {
    goalLose: "Салмақ тастау",
    goalGain: "Бұлшықет жинау",
    goalMobility: "Қозғалысты жақсарту",
    goalMaintain: "Форманы сақтау",
    customGoalPlaceholder: "Жеке мақсатыңызды жазыңыз...",
  },
};

function getLangSafe(lang: string): AppLangCode {
  if (lang === "ru" || lang === "kk" || lang === "en") return lang;

  return "en";
}

function getFitnessLevelLabel(
  level: string | undefined,
  t: (key: any) => string,
) {
  if (level === "beginner") return t("auth.fitnessBeginner");
  if (level === "intermediate") return t("auth.fitnessIntermediate");
  if (level === "advanced") return t("auth.fitnessAdvanced");

  return "—";
}

function normalizeGoalValue(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function getGoalLabel(
  goal: string | undefined,
  goalType: string | undefined,
  lang: AppLangCode,
) {
  const L = CLIENT_PROFILE_TEXT[lang];

  const normalizedType = normalizeGoalValue(goalType);
  const normalizedGoal = normalizeGoalValue(goal);

  const key = normalizedType || normalizedGoal;

  if (key === "lose_weight" || key === "lose" || key === "cut") {
    return L.goalLose;
  }

  if (key === "gain_muscle" || key === "gain" || key === "muscle") {
    return L.goalGain;
  }

  if (
    key === "improve_mobility" ||
    key === "mobility" ||
    key === "posture"
  ) {
    return L.goalMobility;
  }

  if (key === "maintain_shape" || key === "maintain") {
    return L.goalMaintain;
  }

  if (!goal) return "—";

  return goal;
}

function getGoalValueForEdit(goal?: string | null, goalType?: string | null) {
  const normalizedType = normalizeGoalValue(goalType);
  const normalizedGoal = normalizeGoalValue(goal);

  if (
    normalizedType === "lose_weight" ||
    normalizedType === "gain_muscle" ||
    normalizedType === "improve_mobility" ||
    normalizedType === "maintain_shape" ||
    normalizedGoal === "lose_weight" ||
    normalizedGoal === "gain_muscle" ||
    normalizedGoal === "improve_mobility" ||
    normalizedGoal === "maintain_shape"
  ) {
    return "";
  }

  return goal ?? "";
}

function getGoalTypeForBackend(goal?: string | null, goalType?: string | null) {
  const normalizedType = normalizeGoalValue(goalType);
  const normalizedGoal = normalizeGoalValue(goal);

  if (
    normalizedType === "lose_weight" ||
    normalizedType === "gain_muscle" ||
    normalizedType === "improve_mobility" ||
    normalizedType === "maintain_shape" ||
    normalizedType === "custom"
  ) {
    return normalizedType;
  }

  if (
    normalizedGoal === "lose_weight" ||
    normalizedGoal === "gain_muscle" ||
    normalizedGoal === "improve_mobility" ||
    normalizedGoal === "maintain_shape"
  ) {
    return normalizedGoal;
  }

  return "custom";
}

function getGoalTextForBackend(editGoal: string, oldGoal?: string | null) {
  const trimmed = editGoal.trim();

  if (trimmed) return trimmed;

  const normalizedOld = normalizeGoalValue(oldGoal);

  if (
    normalizedOld === "lose_weight" ||
    normalizedOld === "gain_muscle" ||
    normalizedOld === "improve_mobility" ||
    normalizedOld === "maintain_shape"
  ) {
    return normalizedOld;
  }

  return trimmed;
}

function getDefaultNotifications(userId: string) {
  return {
    userId,
    workoutReminders: true,
    supplementReminders: true,
    messageNotifications: true,
    weeklyGoalReminders: true,
  };
}

function sanitizeIntegerInput(value: string) {
  return value.replace(/[^\d]/g, "");
}

function sanitizeDecimalInput(value: string) {
  return value.replace(/[^0-9.,]/g, "");
}

function parseOptionalInteger(value: string) {
  const clean = value.trim();

  if (!clean) return undefined;

  const parsed = parseInt(clean, 10);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseDecimalOrZero(value: string) {
  const clean = value.trim();

  if (!clean) return 0;

  const parsed = parseFloat(clean.replace(",", "."));

  return Number.isFinite(parsed) ? parsed : 0;
}

export default function ClientProfile() {
  const { theme, mode, toggle } = useTheme();
  const { t, lang, setLanguage } = useI18n();
  const { user, token, logout, updateMe } = useAuth();
  const { db, update, refreshFromBackend } = useData();

  const currentLang = getLangSafe(lang);
  const L = CLIENT_PROFILE_TEXT[currentLang];

  const [langOpen, setLangOpen] = React.useState<boolean>(false);
  const [editOpen, setEditOpen] = React.useState<boolean>(false);
  const [saving, setSaving] = React.useState<boolean>(false);

  const [editName, setEditName] = React.useState<string>("");
  const [editPhone, setEditPhone] = React.useState<string>("");
  const [editGoal, setEditGoal] = React.useState<string>("");
  const [editAge, setEditAge] = React.useState<string>("");
  const [editStartWeight, setEditStartWeight] = React.useState<string>("");
  const [editCurrentWeight, setEditCurrentWeight] =
    React.useState<string>("");
  const [editHeight, setEditHeight] = React.useState<string>("");
  const [editFitnessLevel, setEditFitnessLevel] =
    React.useState<FitnessLevel>("beginner");

  if (!user || !db) return null;

  const profile = db.clientProfiles.find((client) => client.userId === user.id);
  const streak = db.streaks.find((item) => item.clientId === user.id);

  const notif =
    db.notifications.find((item) => item.userId === user.id) ??
    getDefaultNotifications(user.id);

  const openEdit = () => {
    setEditName(user.name ?? "");
    setEditPhone(user.phone ?? "");
    setEditGoal(getGoalValueForEdit(profile?.goal, (profile as any)?.goalType));
    setEditAge(profile?.age ? String(profile.age) : "");
    setEditStartWeight(profile?.startWeight ? String(profile.startWeight) : "");
    setEditCurrentWeight(
      profile?.currentWeight ? String(profile.currentWeight) : "",
    );
    setEditHeight(profile?.height ? String(profile.height) : "");
    setEditFitnessLevel((profile?.fitnessLevel as FitnessLevel) ?? "beginner");
    setEditOpen(true);
  };

  const copyClientCode = async () => {
    if (!user.clientCode) return;

    try {
      await Clipboard.setStringAsync(user.clientCode);

      Alert.alert(t("profile.copiedTitle"), t("profile.clientCodeCopied"));
    } catch (e) {
      console.log("[profile] copy code err", e);

      Alert.alert(t("profile.copyErrorTitle"), t("profile.copyErrorText"));
    }
  };

  const saveProfile = async () => {
    if (!token || !user || saving) return;

    const ageValue = parseOptionalInteger(editAge);
    const startWeightValue = parseDecimalOrZero(editStartWeight);
    const currentWeightValue = parseDecimalOrZero(editCurrentWeight);
    const heightValue = parseDecimalOrZero(editHeight);

    if (ageValue !== undefined && (Number.isNaN(ageValue) || ageValue <= 0)) {
      Alert.alert(t("profile.invalidAgeTitle"), t("profile.invalidAgeText"));
      return;
    }

    if (Number.isNaN(startWeightValue) || startWeightValue < 0) {
      Alert.alert(
        t("profile.invalidWeightTitle"),
        t("profile.invalidStartWeightText"),
      );
      return;
    }

    if (Number.isNaN(currentWeightValue) || currentWeightValue < 0) {
      Alert.alert(
        t("profile.invalidWeightTitle"),
        t("profile.invalidCurrentWeightText"),
      );
      return;
    }

    if (Number.isNaN(heightValue) || heightValue < 0) {
      Alert.alert(
        t("profile.invalidHeightTitle"),
        t("profile.invalidHeightText"),
      );
      return;
    }

    const nextGoal = getGoalTextForBackend(editGoal, profile?.goal);
    const nextGoalType = editGoal.trim()
      ? "custom"
      : getGoalTypeForBackend(profile?.goal, (profile as any)?.goalType);

    try {
      setSaving(true);

      await apiPatch(
        "/users/me",
        {
          name: editName.trim(),
          phone: editPhone.trim() || undefined,
        },
        { token },
      );

      await apiPatch(
        "/users/me/client-profile",
        {
          goal: nextGoal,
          goal_type: nextGoalType,
          age: ageValue,
          start_weight: startWeightValue,
          current_weight: currentWeightValue,
          height: heightValue,
          fitness_level: editFitnessLevel,
        },
        { token },
      );

      update((data) => {
        const hasProfile = data.clientProfiles.some(
          (item) => item.userId === user.id,
        );

        return {
          ...data,
          users: data.users.map((item) =>
            item.id === user.id
              ? {
                  ...item,
                  name: editName.trim(),
                  phone: editPhone.trim() || undefined,
                }
              : item,
          ),
          clientProfiles: hasProfile
            ? data.clientProfiles.map((item) =>
                item.userId === user.id
                  ? {
                      ...item,
                      goal: nextGoal,
                      goalType: nextGoalType as any,
                      age: ageValue,
                      startWeight: startWeightValue,
                      currentWeight: currentWeightValue,
                      height: heightValue,
                      fitnessLevel: editFitnessLevel,
                    }
                  : item,
              )
            : [
                ...data.clientProfiles,
                {
                  userId: user.id,
                  coachId: "",
                  goal: nextGoal,
                  goalType: nextGoalType as any,
                  age: ageValue,
                  startWeight: startWeightValue,
                  currentWeight: currentWeightValue,
                  height: heightValue,
                  fitnessLevel: editFitnessLevel,
                  createdAt: new Date().toISOString(),
                } as any,
              ],
        };
      });

      await updateMe({
        name: editName.trim(),
        phone: editPhone.trim() || undefined,
      });

      await refreshFromBackend();

      setEditOpen(false);

      Alert.alert(t("profile.savedTitle"), t("profile.profileUpdated"));
    } catch (e: any) {
      console.log("[profile] save profile err", e);

      Alert.alert(
        t("profile.saveErrorTitle"),
        e?.message || t("profile.saveProfileError"),
      );
    } finally {
      setSaving(false);
    }
  };

  const setNotif = async (key: NotificationKey, value: boolean) => {
    if (!user) return;

    const currentNotif = {
      ...getDefaultNotifications(user.id),
      ...notif,
    };

    const nextNotif = {
      ...currentNotif,
      [key]: value,
    };

    update((data) => {
      const hasNotif = data.notifications.some(
        (item) => item.userId === user.id,
      );

      return {
        ...data,
        notifications: hasNotif
          ? data.notifications.map((item) =>
              item.userId === user.id
                ? {
                    ...item,
                    [key]: value,
                  }
                : item,
            )
          : [
              ...data.notifications,
              {
                userId: user.id,
                workoutReminders: nextNotif.workoutReminders,
                supplementReminders: nextNotif.supplementReminders,
                messageNotifications: nextNotif.messageNotifications,
                weeklyGoalReminders: nextNotif.weeklyGoalReminders,
              } as any,
            ],
      };
    });

    if (!token) return;

    try {
      await apiPatch(
        "/users/me/notifications",
        {
          workout_reminders: nextNotif.workoutReminders,
          supplement_reminders: nextNotif.supplementReminders,
          message_notifications: nextNotif.messageNotifications,
          weekly_goal_reminders: nextNotif.weeklyGoalReminders,
        },
        { token },
      );
    } catch (e) {
      console.log("[profile] notification update err", e);

      update((data) => ({
        ...data,
        notifications: data.notifications.map((item) =>
          item.userId === user.id
            ? {
                ...item,
                workoutReminders: currentNotif.workoutReminders,
                supplementReminders: currentNotif.supplementReminders,
                messageNotifications: currentNotif.messageNotifications,
                weeklyGoalReminders: currentNotif.weeklyGoalReminders,
              }
            : item,
        ),
      }));

      Alert.alert(t("profile.saveErrorTitle"), t("profile.saveProfileError"));
    }
  };

  const pickAvatar = async () => {
    if (!token) {
      Alert.alert(t("profile.authErrorTitle"), t("profile.loginAgainText"));
      return;
    }

    try {
      if (Platform.OS !== "web") {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
          Alert.alert(t("profile.permissionTitle"), t("profile.permissionMsg"));
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (result.canceled || !result.assets[0]?.uri) return;

      const uploadRes = await apiUploadFile(
        "/uploads/avatar",
        result.assets[0].uri,
        "file",
        { token },
      );

      const uploadedAvatarUrl = uploadRes.avatarUrl ?? uploadRes.avatar_url;

      if (!uploadedAvatarUrl) {
        Alert.alert(
          t("profile.uploadErrorTitle"),
          t("profile.avatarUrlMissing"),
        );
        return;
      }

      update((data) => ({
        ...data,
        users: data.users.map((item) =>
          item.id === user.id
            ? { ...item, avatarUrl: uploadedAvatarUrl }
            : item,
        ),
      }));

      try {
        await apiPatch(
          "/users/me",
          {
            avatar_url: uploadedAvatarUrl,
          },
          { token },
        );
      } catch (patchError) {
        console.log("[avatar] user avatar patch warning", patchError);
      }

      try {
        await updateMe({
          avatarUrl: uploadedAvatarUrl,
        });
      } catch (updateMeError) {
        console.log("[avatar] auth context avatar update warning", updateMeError);
      }

      try {
        await refreshFromBackend();
      } catch (refreshError) {
        console.log("[avatar] refresh after avatar upload warning", refreshError);
      }

      Alert.alert(t("profile.savedTitle"), t("profile.avatarUpdated"));
    } catch (e: any) {
      console.log("[avatar] upload err", e);

      Alert.alert(
        t("profile.avatarErrorTitle"),
        e?.message || t("profile.avatarUploadError"),
      );
    }
  };

  return (
    <ScreenContainer scroll padded={false}>
      <GradientHeader height={210}>
        <View style={{ alignItems: "center", marginTop: 12, gap: 8 }}>
          <Pressable onPress={pickAvatar}>
            <View>
              <AppAvatar
                uri={toAbsoluteUrl(user.avatarUrl)}
                name={user.name}
                size={84}
                ring
              />

              <View
                style={{
                  position: "absolute",
                  right: -2,
                  bottom: -2,
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: theme.colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 2,
                  borderColor: "#fff",
                }}
              >
                <Camera color={theme.colors.primaryContrast} size={14} />
              </View>
            </View>
          </Pressable>

          <AppText variant="h2" color="#fff" numberOfLines={1}>
            {user.name}
          </AppText>

          <AppText variant="small" color="rgba(255,255,255,0.8)" numberOfLines={1}>
            {user.email}
          </AppText>

          <StreakPill count={streak?.currentStreak ?? 0} />
        </View>
      </GradientHeader>

      <View style={{ paddingHorizontal: 20, marginTop: 16, gap: 12 }}>
        <SectionHeader title={t("profile.myProfile")} />

        <AppCard variant="outline">
          <Row
            label={t("profile.goal")}
            value={getGoalLabel(
              profile?.goal,
              (profile as any)?.goalType,
              currentLang,
            )}
          />

          <Row
            label={t("clients.age")}
            value={profile?.age ? String(profile.age) : "—"}
          />

          <Row
            label={t("profile.startWeight")}
            value={`${profile?.startWeight ?? 0} ${t("common.kg")}`}
          />

          <Row
            label={t("profile.currentWeight")}
            value={`${profile?.currentWeight ?? 0} ${t("common.kg")}`}
          />

          <Row
            label={t("clients.height")}
            value={`${profile?.height ?? 0} cm`}
          />

          <Row
            label={t("clients.fitnessLevel")}
            value={getFitnessLevelLabel(profile?.fitnessLevel, t)}
          />

          <View style={{ marginTop: 12 }}>
            <AppButton
              title={t("profile.editProfile")}
              variant="secondary"
              icon={<Edit3 size={18} color={theme.colors.text} />}
              onPress={openEdit}
              fullWidth
            />
          </View>
        </AppCard>

        {user.clientCode ? (
          <Pressable onPress={copyClientCode}>
            <AppCard variant="outline">
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText
                    variant="caption"
                    color={theme.colors.textMuted}
                    style={{ textTransform: "uppercase" }}
                  >
                    {t("profile.yourCode")}
                  </AppText>

                  <AppText
                    variant="title"
                    color={theme.colors.primary}
                    style={{ marginTop: 4 }}
                    numberOfLines={1}
                  >
                    {user.clientCode}
                  </AppText>
                </View>

                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 14,
                    backgroundColor: theme.colors.surfaceAlt,
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Copy color={theme.colors.primary} size={18} />
                </View>
              </View>

              <AppText
                variant="small"
                color={theme.colors.textMuted}
                style={{ marginTop: 4 }}
              >
                {t("profile.copyCodeHint")}
              </AppText>
            </AppCard>
          </Pressable>
        ) : null}

        <SectionHeader
          title={t("profile.notifications")}
          icon={<Bell color={theme.colors.primary} size={18} />}
        />

        <AppCard variant="outline">
          <SwitchRow
            label={t("profile.workoutReminders")}
            value={Boolean(notif.workoutReminders)}
            onValueChange={(value) => setNotif("workoutReminders", value)}
          />

          <SwitchRow
            label={t("profile.suppReminders")}
            value={Boolean(notif.supplementReminders)}
            onValueChange={(value) => setNotif("supplementReminders", value)}
          />

          <SwitchRow
            label={t("profile.messageNotifs")}
            value={Boolean(notif.messageNotifications)}
            onValueChange={(value) => setNotif("messageNotifications", value)}
          />

          <SwitchRow
            label={t("profile.weeklyGoalReminders")}
            value={Boolean(notif.weeklyGoalReminders)}
            onValueChange={(value) => setNotif("weeklyGoalReminders", value)}
          />
        </AppCard>

        <SectionHeader title={t("profile.preferences")} />

        <AppCard variant="outline">
          <Pressable
            onPress={toggle}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingVertical: 8,
              gap: 12,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                flex: 1,
              }}
            >
              {mode === "dark" ? (
                <Moon color={theme.colors.text} size={18} />
              ) : (
                <Sun color={theme.colors.text} size={18} />
              )}

              <AppText variant="body" style={{ flex: 1 }}>
                {t("profile.darkMode")}
              </AppText>
            </View>

            <AppText
              variant="small"
              color={theme.colors.primary}
              style={{ fontWeight: "700" }}
            >
              {mode === "dark" ? t("common.on") : t("common.off")}
            </AppText>
          </Pressable>

          <Pressable
            onPress={() => setLangOpen(true)}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingVertical: 8,
              gap: 12,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                flex: 1,
              }}
            >
              <Globe color={theme.colors.text} size={18} />

              <AppText variant="body" style={{ flex: 1 }}>
                {t("profile.language")}
              </AppText>
            </View>

            <AppText
              variant="small"
              color={theme.colors.primary}
              style={{ fontWeight: "700" }}
              numberOfLines={1}
            >
              {LANGUAGES.find((item) => item.code === lang)?.label}
            </AppText>
          </Pressable>
        </AppCard>

        <View style={{ marginTop: 8 }}>
          <AppButton
            title={t("profile.logout")}
            variant="secondary"
            icon={<LogOut size={18} color={theme.colors.text} />}
            onPress={async () => {
              await logout();
              router.replace("/(auth)/login");
            }}
            fullWidth
          />
        </View>

        <View style={{ height: 32 }} />
      </View>

      <EditProfileModal
        visible={editOpen}
        saving={saving}
        onClose={() => setEditOpen(false)}
        onSave={saveProfile}
        editName={editName}
        setEditName={setEditName}
        editPhone={editPhone}
        setEditPhone={setEditPhone}
        editGoal={editGoal}
        setEditGoal={setEditGoal}
        editAge={editAge}
        setEditAge={setEditAge}
        editStartWeight={editStartWeight}
        setEditStartWeight={setEditStartWeight}
        editCurrentWeight={editCurrentWeight}
        setEditCurrentWeight={setEditCurrentWeight}
        editHeight={editHeight}
        setEditHeight={setEditHeight}
        editFitnessLevel={editFitnessLevel}
        setEditFitnessLevel={setEditFitnessLevel}
        goalPlaceholder={L.customGoalPlaceholder}
      />

      <LanguageModal
        visible={langOpen}
        onClose={() => setLangOpen(false)}
        current={lang}
        onSelect={(code) => {
          setLanguage(code);
          setLangOpen(false);
        }}
      />
    </ScreenContainer>
  );
}

function EditProfileModal({
  visible,
  saving,
  onClose,
  onSave,
  editName,
  setEditName,
  editPhone,
  setEditPhone,
  editGoal,
  setEditGoal,
  editAge,
  setEditAge,
  editStartWeight,
  setEditStartWeight,
  editCurrentWeight,
  setEditCurrentWeight,
  editHeight,
  setEditHeight,
  editFitnessLevel,
  setEditFitnessLevel,
  goalPlaceholder,
}: {
  visible: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  editName: string;
  setEditName: (value: string) => void;
  editPhone: string;
  setEditPhone: (value: string) => void;
  editGoal: string;
  setEditGoal: (value: string) => void;
  editAge: string;
  setEditAge: (value: string) => void;
  editStartWeight: string;
  setEditStartWeight: (value: string) => void;
  editCurrentWeight: string;
  setEditCurrentWeight: (value: string) => void;
  editHeight: string;
  setEditHeight: (value: string) => void;
  editFitnessLevel: FitnessLevel;
  setEditFitnessLevel: (value: FitnessLevel) => void;
  goalPlaceholder: string;
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
              justifyContent: "space-between",
              alignItems: "center",
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
              {t("profile.editProfile")}
            </AppText>

            <Pressable onPress={onSave} disabled={saving} hitSlop={8}>
              <Check
                color={saving ? theme.colors.textMuted : theme.colors.primary}
                size={22}
              />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              padding: 20,
              gap: 12,
              paddingBottom: 96,
            }}
          >
            <AppInput
              label={t("auth.name")}
              value={editName}
              onChangeText={setEditName}
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="name"
              autoComplete="name"
              returnKeyType="next"
              submitBehavior="submit"
            />

            <AppInput
              label={t("profile.phone")}
              value={editPhone}
              onChangeText={setEditPhone}
              keyboardType="phone-pad"
              inputMode="tel"
              textContentType="telephoneNumber"
              autoComplete="tel"
              returnKeyType="next"
              submitBehavior="submit"
            />

            <AppInput
              label={t("profile.goal")}
              value={editGoal}
              onChangeText={setEditGoal}
              multiline
              placeholder={goalPlaceholder}
              autoCapitalize="sentences"
              autoCorrect
              returnKeyType="next"
              submitBehavior="submit"
              style={{
                minHeight: 88,
                textAlignVertical: "top",
                paddingTop: 10,
              }}
            />

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <AppInput
                  label={t("clients.age")}
                  value={editAge}
                  onChangeText={(value) =>
                    setEditAge(sanitizeIntegerInput(value))
                  }
                  keyboardType="numeric"
                  inputMode="numeric"
                  returnKeyType="next"
                  submitBehavior="submit"
                  maxLength={3}
                />
              </View>

              <View style={{ flex: 1 }}>
                <AppInput
                  label={t("profile.heightCm")}
                  value={editHeight}
                  onChangeText={(value) =>
                    setEditHeight(sanitizeDecimalInput(value))
                  }
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  returnKeyType="next"
                  submitBehavior="submit"
                  maxLength={6}
                />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <AppInput
                  label={t("profile.startWeight")}
                  value={editStartWeight}
                  onChangeText={(value) =>
                    setEditStartWeight(sanitizeDecimalInput(value))
                  }
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  returnKeyType="next"
                  submitBehavior="submit"
                  maxLength={6}
                />
              </View>

              <View style={{ flex: 1 }}>
                <AppInput
                  label={t("profile.currentWeight")}
                  value={editCurrentWeight}
                  onChangeText={(value) =>
                    setEditCurrentWeight(sanitizeDecimalInput(value))
                  }
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  returnKeyType="done"
                  submitBehavior="blurAndSubmit"
                  onSubmitEditing={onSave}
                  maxLength={6}
                />
              </View>
            </View>

            <AppText variant="small" color={theme.colors.textMuted}>
              {t("clients.fitnessLevel")}
            </AppText>

            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {FITNESS_LEVEL_KEYS.map((level) => {
                const active = editFitnessLevel === level.key;

                return (
                  <Pressable
                    key={level.key}
                    onPress={() => setEditFitnessLevel(level.key)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      backgroundColor: active
                        ? theme.colors.primary
                        : theme.colors.surfaceAlt,
                    }}
                  >
                    <AppText
                      variant="small"
                      color={
                        active
                          ? theme.colors.primaryContrast
                          : theme.colors.text
                      }
                      style={{ fontWeight: "700" }}
                    >
                      {t(level.tKey as never)}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ marginTop: 12 }}>
              <AppButton
                title={
                  saving ? t("profile.savingChanges") : t("profile.saveChanges")
                }
                loading={saving}
                disabled={saving}
                onPress={onSave}
                fullWidth
              />
            </View>

            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.borderSoft,
        gap: 12,
      }}
    >
      <AppText variant="small" color={theme.colors.textMuted}>
        {label}
      </AppText>

      <AppText
        variant="bodyStrong"
        style={{ flex: 1, textAlign: "right" }}
        numberOfLines={2}
      >
        {value}
      </AppText>
    </View>
  );
}

function SwitchRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 8,
        gap: 12,
      }}
    >
      <AppText variant="body" style={{ flex: 1 }}>
        {label}
      </AppText>

      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
        thumbColor="#fff"
      />
    </View>
  );
}