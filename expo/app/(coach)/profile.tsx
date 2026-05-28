import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import {
  Award,
  Bell,
  Camera,
  ChevronRight,
  Check,
  CreditCard,
  Edit3,
  Globe,
  HelpCircle,
  LogOut,
  Mail,
  Moon,
  Star,
  Sun,
  X,
} from "lucide-react-native";
import React from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
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
} from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { useSubscription } from "@/src/context/SubscriptionContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";
import { LANGUAGES } from "@/src/i18n/translations";
import { apiPatch, apiUploadFile, toAbsoluteUrl } from "@/src/services/api";

type AppLangCode = "en" | "ru" | "kk";

type NotificationKey =
  | "workoutReminders"
  | "supplementReminders"
  | "messageNotifications"
  | "weeklyGoalReminders";

const COACH_PROFILE_TEXT = {
  en: {
    defaultSpecialty: "Personal Trainer",
    specialtyPlaceholder: "Example: Personal trainer, bodybuilding coach...",
    profileTitle: "Coach profile",
    subscription: "Subscription",
    activePlan: "Active plan",
    inactivePlan: "No active plan",
    activeUntil: "Active until {date}",
    activateSubscription: "Activate subscription",
    coachInfo: "Coach information",
    specialty: "Specialty",
    bio: "Bio",
    experience: "Experience",
    years: "{n} years",
    rating: "Rating",
    achievements: "Achievements",
    certificates: "Certificates",
    noAchievements: "No achievements yet.",
    noCertificates: "No certificates yet.",
    editProfile: "Edit profile",
    preferences: "Preferences",
    notifications: "Notifications",
    workoutReminders: "Workout reminders",
    supplementReminders: "Supplement reminders",
    messageNotifications: "Message notifications",
    weeklyGoalReminders: "Weekly goal reminders",
    darkMode: "Dark mode",
    language: "Language",
    languageHint: "Tap to choose English, Russian or Kazakh",
    faq: "FAQ",
    faqHint: "Tap to read answers and app instructions",
    support: "Tech support",
    supportHint: "Send an email to klaevers001@gmail.com",
    open: "Open",
    write: "Write",
    darkModeHint: "Tap this row or the switch to change the app theme",
    phoneHint: "Kazakhstan format: +7 777 123 45 67",
    phoneInvalidTitle: "Invalid phone number",
    phoneInvalidText: "Phone number must contain exactly 11 digits and start with 7. Example: +7 777 123 45 67.",
    logout: "Log out",
    phone: "Phone",
    coverImageUrl: "Cover image URL",
    coverImage: "Cover image",
    coverImageHint: "Choose a wide profile cover from gallery",
    changeCover: "Choose cover from gallery",
    coverUpdated: "Cover image was updated.",
    coverUrlMissing: "Backend did not return cover image URL.",
    coverUploadError: "Could not upload cover image.",
    achievementsHint: "Each achievement from a new line",
    certificatesHint: "Each certificate from a new line",
    saveChanges: "Save changes",
    savingChanges: "Saving...",
    savedTitle: "Saved",
    profileUpdated: "Coach profile was updated.",
    authErrorTitle: "Auth error",
    loginAgainText: "Please log in again.",
    permissionTitle: "Permission required",
    permissionMsg: "Please allow access to your photo library.",
    uploadErrorTitle: "Upload error",
    avatarUrlMissing: "Backend did not return avatar URL.",
    avatarErrorTitle: "Avatar error",
    avatarUploadError: "Could not upload avatar.",
    avatarUpdated: "Avatar was updated.",
    saveErrorTitle: "Save error",
    saveProfileError: "Could not save profile.",
    invalidExperienceTitle: "Invalid experience",
    invalidExperienceText: "Experience must be a valid positive number.",
    defaultBio:
      "Add a short bio so clients understand your coaching style, experience and training approach.",
  },
  ru: {
    defaultSpecialty: "Персональный тренер",
    specialtyPlaceholder: "Например: персональный тренер, тренер по бодибилдингу...",
    profileTitle: "Профиль тренера",
    subscription: "Подписка",
    activePlan: "Активный план",
    inactivePlan: "Нет активного плана",
    activeUntil: "Активна до {date}",
    activateSubscription: "Активировать подписку",
    coachInfo: "Информация о тренере",
    specialty: "Специализация",
    bio: "О себе",
    experience: "Опыт",
    years: "{n} лет",
    rating: "Рейтинг",
    achievements: "Достижения",
    certificates: "Сертификаты",
    noAchievements: "Достижений пока нет.",
    noCertificates: "Сертификатов пока нет.",
    editProfile: "Редактировать профиль",
    preferences: "Настройки",
    notifications: "Уведомления",
    workoutReminders: "Напоминания о тренировках",
    supplementReminders: "Напоминания о добавках",
    messageNotifications: "Уведомления о сообщениях",
    weeklyGoalReminders: "Напоминания о недельных целях",
    darkMode: "Тёмная тема",
    language: "Язык",
    languageHint: "Нажмите, чтобы выбрать русский, английский или казахский",
    faq: "FAQ",
    faqHint: "Нажмите, чтобы открыть ответы и инструкцию по приложению",
    support: "Техподдержка",
    supportHint: "Написать письмо на klaevers001@gmail.com",
    open: "Открыть",
    write: "Написать",
    darkModeHint: "Нажмите на строку или переключатель, чтобы сменить тему",
    phoneHint: "Формат Казахстана: +7 777 123 45 67",
    phoneInvalidTitle: "Неверный номер телефона",
    phoneInvalidText: "Номер должен содержать ровно 11 цифр и начинаться с 7. Пример: +7 777 123 45 67.",
    logout: "Выйти",
    phone: "Телефон",
    coverImageUrl: "Ссылка на обложку",
    coverImage: "Обложка профиля",
    coverImageHint: "Выберите широкую обложку из галереи",
    changeCover: "Выбрать обложку из галереи",
    coverUpdated: "Обложка профиля обновлена.",
    coverUrlMissing: "Сервер не вернул ссылку на обложку.",
    coverUploadError: "Не удалось загрузить обложку.",
    achievementsHint: "Каждое достижение с новой строки",
    certificatesHint: "Каждый сертификат с новой строки",
    saveChanges: "Сохранить изменения",
    savingChanges: "Сохранение...",
    savedTitle: "Сохранено",
    profileUpdated: "Профиль тренера обновлён.",
    authErrorTitle: "Ошибка входа",
    loginAgainText: "Пожалуйста, войдите снова.",
    permissionTitle: "Нужно разрешение",
    permissionMsg: "Разрешите доступ к галерее.",
    uploadErrorTitle: "Ошибка загрузки",
    avatarUrlMissing: "Сервер не вернул ссылку на аватар.",
    avatarErrorTitle: "Ошибка аватара",
    avatarUploadError: "Не удалось загрузить аватар.",
    avatarUpdated: "Аватар обновлён.",
    saveErrorTitle: "Ошибка сохранения",
    saveProfileError: "Не удалось сохранить профиль.",
    invalidExperienceTitle: "Неверный опыт",
    invalidExperienceText: "Опыт должен быть корректным положительным числом.",
    defaultBio:
      "Добавьте короткое описание, чтобы клиенты понимали ваш стиль, опыт и подход к тренировкам.",
  },
  kk: {
    defaultSpecialty: "Жеке жаттықтырушы",
    specialtyPlaceholder: "Мысалы: жеке жаттықтырушы, бодибилдинг жаттықтырушысы...",
    profileTitle: "Жаттықтырушы профилі",
    subscription: "Жазылым",
    activePlan: "Белсенді жоспар",
    inactivePlan: "Белсенді жоспар жоқ",
    activeUntil: "{date} дейін белсенді",
    activateSubscription: "Жазылымды қосу",
    coachInfo: "Жаттықтырушы туралы ақпарат",
    specialty: "Мамандану",
    bio: "Өзі туралы",
    experience: "Тәжірибе",
    years: "{n} жыл",
    rating: "Рейтинг",
    achievements: "Жетістіктер",
    certificates: "Сертификаттар",
    noAchievements: "Әзірге жетістіктер жоқ.",
    noCertificates: "Әзірге сертификаттар жоқ.",
    editProfile: "Профильді өңдеу",
    preferences: "Баптаулар",
    notifications: "Хабарландырулар",
    workoutReminders: "Жаттығу ескертулері",
    supplementReminders: "Қоспалар ескертулері",
    messageNotifications: "Хабарлама ескертулері",
    weeklyGoalReminders: "Апталық мақсат ескертулері",
    darkMode: "Қараңғы режим",
    language: "Тіл",
    languageHint: "Қазақша, орысша немесе ағылшынша таңдау үшін басыңыз",
    faq: "FAQ",
    faqHint: "Жауаптар мен қолданба нұсқаулығын ашу үшін басыңыз",
    support: "Техқолдау",
    supportHint: "klaevers001@gmail.com поштасына хат жазу",
    open: "Ашу",
    write: "Жазу",
    darkModeHint: "Тақырыпты ауыстыру үшін жолды немесе қосқышты басыңыз",
    phoneHint: "Қазақстан форматы: +7 777 123 45 67",
    phoneInvalidTitle: "Телефон нөмірі қате",
    phoneInvalidText: "Нөмір дәл 11 цифрдан тұрып, 7-ден басталуы керек. Мысал: +7 777 123 45 67.",
    logout: "Шығу",
    phone: "Телефон",
    coverImageUrl: "Мұқаба суретінің сілтемесі",
    coverImage: "Профиль мұқабасы",
    coverImageHint: "Галереядан кең мұқаба таңдаңыз",
    changeCover: "Галереядан мұқаба таңдау",
    coverUpdated: "Профиль мұқабасы жаңартылды.",
    coverUrlMissing: "Сервер мұқаба сілтемесін қайтармады.",
    coverUploadError: "Мұқабаны жүктеу мүмкін болмады.",
    achievementsHint: "Әр жетістікті жаңа жолдан жазыңыз",
    certificatesHint: "Әр сертификатты жаңа жолдан жазыңыз",
    saveChanges: "Өзгерістерді сақтау",
    savingChanges: "Сақталуда...",
    savedTitle: "Сақталды",
    profileUpdated: "Жаттықтырушы профилі жаңартылды.",
    authErrorTitle: "Кіру қатесі",
    loginAgainText: "Қайта кіріңіз.",
    permissionTitle: "Рұқсат қажет",
    permissionMsg: "Галереяға кіруге рұқсат беріңіз.",
    uploadErrorTitle: "Жүктеу қатесі",
    avatarUrlMissing: "Сервер аватар сілтемесін қайтармады.",
    avatarErrorTitle: "Аватар қатесі",
    avatarUploadError: "Аватарды жүктеу мүмкін болмады.",
    avatarUpdated: "Аватар жаңартылды.",
    saveErrorTitle: "Сақтау қатесі",
    saveProfileError: "Профильді сақтау мүмкін болмады.",
    invalidExperienceTitle: "Қате тәжірибе",
    invalidExperienceText: "Тәжірибе дұрыс оң сан болуы керек.",
    defaultBio:
      "Клиенттер сіздің стиліңізді, тәжірибеңізді және жаттығу тәсіліңізді түсінуі үшін қысқа сипаттама қосыңыз.",
  },
};

function getLangSafe(lang: string): AppLangCode {
  if (lang === "ru" || lang === "kk" || lang === "en") return lang;

  return "en";
}

function getLocale(lang: AppLangCode) {
  if (lang === "ru") return "ru-RU";
  if (lang === "kk") return "kk-KZ";

  return "en-US";
}

function formatSubscriptionDate(
  value: string | null | undefined,
  lang: AppLangCode,
) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date.toLocaleDateString(getLocale(lang), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normalizeSpecialty(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function isDefaultSpecialty(value?: string | null) {
  const normalized = normalizeSpecialty(value);

  return (
    !normalized ||
    normalized === "personal_trainer" ||
    normalized === "personal_training" ||
    normalized === "trainer" ||
    normalized === "coach" ||
    normalized === "персональный_тренер" ||
    normalized === "жеке_жаттықтырушы"
  );
}

function getSpecialtyLabel(value: string | undefined, lang: AppLangCode) {
  if (isDefaultSpecialty(value)) {
    return COACH_PROFILE_TEXT[lang].defaultSpecialty;
  }

  return value ?? COACH_PROFILE_TEXT[lang].defaultSpecialty;
}

function getSpecialtyValueForEdit(value?: string | null) {
  if (isDefaultSpecialty(value)) return "";

  return value ?? "";
}

function getSpecialtyForBackend(value: string) {
  const trimmed = value.trim();

  return trimmed || "personal_trainer";
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sanitizeExperience(value: string) {
  return value.replace(/[^\d]/g, "");
}

function normalizePhoneDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function formatKazakhstanPhone(value: string) {
  const digits = normalizePhoneDigits(value);

  if (!digits) return "";

  const part1 = digits.slice(0, 1);
  const part2 = digits.slice(1, 4);
  const part3 = digits.slice(4, 7);
  const part4 = digits.slice(7, 9);
  const part5 = digits.slice(9, 11);

  let formatted = `+${part1}`;

  if (part2) formatted += ` ${part2}`;
  if (part3) formatted += ` ${part3}`;
  if (part4) formatted += ` ${part4}`;
  if (part5) formatted += ` ${part5}`;

  return formatted;
}

function getPhoneForBackend(value: string) {
  const digits = normalizePhoneDigits(value);

  return digits ? `+${digits}` : undefined;
}

function isValidOptionalKazakhstanPhone(value: string) {
  const digits = normalizePhoneDigits(value);

  if (!digits) return true;

  return digits.length === 11 && digits.startsWith("7");
}

function getLocalizedSubscriptionPlanName(name: string | undefined, lang: AppLangCode) {
  const value = String(name ?? "").trim().toLowerCase();

  if (!value) return "";

  const isTrial =
    value.includes("free trial") ||
    value.includes("trial") ||
    value.includes("проб") ||
    value.includes("сынақ");

  if (isTrial) {
    if (lang === "ru") return "Пробный период";
    if (lang === "kk") return "Сынақ кезеңі";

    return "Free trial";
  }

  const plans: Record<string, Record<AppLangCode, string>> = {
    start: {
      en: "Start",
      ru: "Старт",
      kk: "Бастау",
    },
    basic: {
      en: "Basic",
      ru: "Базовый",
      kk: "Базалық",
    },
    pro: {
      en: "Pro",
      ru: "Про",
      kk: "Про",
    },
    unlimited: {
      en: "Unlimited",
      ru: "Безлимит",
      kk: "Шексіз",
    },
    monthly: {
      en: "Monthly",
      ru: "Месячный",
      kk: "Айлық",
    },
  };

  for (const key of Object.keys(plans)) {
    if (value.includes(key)) {
      return plans[key][lang];
    }
  }

  return name ?? "";
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

export default function CoachProfile() {
  const { theme, mode, toggle } = useTheme();
  const { user, token, logout, updateMe } = useAuth();
  const { db, update, refreshFromBackend } = useData();
  const { sub, isActive, currentPlan } = useSubscription();
  const { t, lang, setLanguage } = useI18n();

  const currentLang = getLangSafe(lang);
  const L = COACH_PROFILE_TEXT[currentLang];

  const [langOpen, setLangOpen] = React.useState<boolean>(false);
  const [editOpen, setEditOpen] = React.useState<boolean>(false);
  const [saving, setSaving] = React.useState<boolean>(false);
  const [avatarVersion, setAvatarVersion] = React.useState<number>(Date.now());

  const [editName, setEditName] = React.useState<string>("");
  const [editPhone, setEditPhone] = React.useState<string>("");
  const [editSpecialty, setEditSpecialty] = React.useState<string>("");
  const [editBio, setEditBio] = React.useState<string>("");
  const [editExperienceYears, setEditExperienceYears] =
    React.useState<string>("");
  const [editAchievements, setEditAchievements] = React.useState<string>("");
  const [editCertificates, setEditCertificates] = React.useState<string>("");
  const [editCoverImageUrl, setEditCoverImageUrl] =
    React.useState<string>("");

  if (!user || !db) return null;

  const profile = db.coachProfiles.find((item) => item.userId === user.id);

  const notif =
    db.notifications.find((item) => item.userId === user.id) ??
    getDefaultNotifications(user.id);

  const rawAvatarUrl = profile?.profileImageUrl ?? user.avatarUrl;
  const avatarUri = rawAvatarUrl
    ? `${toAbsoluteUrl(rawAvatarUrl)}?v=${avatarVersion}`
    : undefined;

  const coverUri = profile?.coverImageUrl
    ? toAbsoluteUrl(profile.coverImageUrl)
    : undefined;

  const specialtyText = getSpecialtyLabel(profile?.specialty, currentLang);
  const experienceYears = profile?.experienceYears ?? 0;
  const experienceText = L.years.replace("{n}", String(experienceYears));
  const activeUntil = formatSubscriptionDate(sub?.endDate, currentLang);

  const openEdit = () => {
    setEditName(user.name ?? "");
    setEditPhone(formatKazakhstanPhone(user.phone ?? ""));
    setEditSpecialty(getSpecialtyValueForEdit(profile?.specialty));
    setEditBio(profile?.bio ?? "");
    setEditExperienceYears(String(profile?.experienceYears ?? 0));
    setEditAchievements((profile?.achievements ?? []).join("\n"));
    setEditCertificates((profile?.certificates ?? []).join("\n"));
    setEditCoverImageUrl(profile?.coverImageUrl ?? "");
    setEditOpen(true);
  };

  const pickAvatar = async () => {
    if (!token || !user) {
      Alert.alert(L.authErrorTitle, L.loginAgainText);
      return;
    }

    const applyAvatarLocally = (uploadedAvatarUrl: string) => {
      update((data) => {
        const hasCoachProfile = data.coachProfiles.some(
          (item) => item.userId === user.id,
        );

        return {
          ...data,
          users: data.users.map((item) =>
            item.id === user.id
              ? { ...item, avatarUrl: uploadedAvatarUrl }
              : item,
          ),
          coachProfiles: hasCoachProfile
            ? data.coachProfiles.map((item) =>
                item.userId === user.id
                  ? { ...item, profileImageUrl: uploadedAvatarUrl }
                  : item,
              )
            : [
                ...data.coachProfiles,
                {
                  userId: user.id,
                  specialty: "personal_trainer",
                  bio: "",
                  experienceYears: 0,
                  achievements: [],
                  certificates: [],
                  rating: 5,
                  profileImageUrl: uploadedAvatarUrl,
                  coverImageUrl: undefined,
                },
              ],
        };
      });

      setAvatarVersion(Date.now());

      Image.prefetch(toAbsoluteUrl(uploadedAvatarUrl) ?? uploadedAvatarUrl).catch(
        () => {},
      );
    };

    try {
      if (Platform.OS !== "web") {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
          Alert.alert(L.permissionTitle, L.permissionMsg);
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (result.canceled || !result.assets[0]?.uri) return;

      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 900 } }],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
        },
      );

      const uploadRes = await apiUploadFile(
        "/uploads/avatar",
        manipulated.uri,
        "file",
        { token },
      );

      const uploadedAvatarUrl = uploadRes.avatarUrl ?? uploadRes.avatar_url;

      if (!uploadedAvatarUrl) {
        Alert.alert(L.uploadErrorTitle, L.avatarUrlMissing);
        return;
      }

      applyAvatarLocally(uploadedAvatarUrl);

      try {
        await updateMe({
          avatarUrl: uploadedAvatarUrl,
        });
      } catch (e) {
        console.log("[coach-avatar] local auth avatar update warning", e);
      }

      try {
        await apiPatch(
          "/users/me",
          {
            avatar_url: uploadedAvatarUrl,
          },
          { token },
        );
      } catch (e) {
        console.log("[coach-avatar] user avatar patch warning", e);
      }

      try {
        await apiPatch(
          "/users/me/coach-profile",
          {
            profile_image_url: uploadedAvatarUrl,
            specialty: getSpecialtyForBackend(profile?.specialty ?? ""),
            bio: profile?.bio ?? "",
            experience_years: profile?.experienceYears ?? 0,
            achievements: profile?.achievements ?? [],
            certificates: profile?.certificates ?? [],
            cover_image_url: profile?.coverImageUrl ?? undefined,
          },
          { token },
        );
      } catch (e) {
        console.log("[coach-avatar] coach profile image patch warning", e);
      }

      try {
        await refreshFromBackend();
      } catch (e) {
        console.log("[coach-avatar] refresh warning", e);
      }

      applyAvatarLocally(uploadedAvatarUrl);

      Alert.alert(L.savedTitle, L.avatarUpdated);
    } catch (e: any) {
      console.log("[coach-avatar] upload err", e);

      Alert.alert(L.avatarErrorTitle, e?.message || L.avatarUploadError);
    }
  };

  const pickCover = async () => {
    if (!token || !user) {
      Alert.alert(L.authErrorTitle, L.loginAgainText);
      return;
    }

    const applyCoverLocally = (uploadedCoverUrl: string) => {
      update((data) => {
        const hasCoachProfile = data.coachProfiles.some(
          (item) => item.userId === user.id,
        );

        return {
          ...data,
          coachProfiles: hasCoachProfile
            ? data.coachProfiles.map((item) =>
                item.userId === user.id
                  ? { ...item, coverImageUrl: uploadedCoverUrl }
                  : item,
              )
            : [
                ...data.coachProfiles,
                {
                  userId: user.id,
                  specialty: getSpecialtyForBackend(profile?.specialty ?? ""),
                  bio: profile?.bio ?? "",
                  experienceYears: profile?.experienceYears ?? 0,
                  achievements: profile?.achievements ?? [],
                  certificates: profile?.certificates ?? [],
                  rating: profile?.rating ?? 5,
                  profileImageUrl: profile?.profileImageUrl ?? user.avatarUrl,
                  coverImageUrl: uploadedCoverUrl,
                },
              ],
        };
      });

      setEditCoverImageUrl(uploadedCoverUrl);

      Image.prefetch(toAbsoluteUrl(uploadedCoverUrl) ?? uploadedCoverUrl).catch(
        () => {},
      );
    };

    try {
      if (Platform.OS !== "web") {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
          Alert.alert(L.permissionTitle, L.permissionMsg);
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [16, 7],
        quality: 0.9,
      });

      if (result.canceled || !result.assets[0]?.uri) return;

      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1600 } }],
        {
          compress: 0.82,
          format: ImageManipulator.SaveFormat.JPEG,
        },
      );

      const uploadRes = await apiUploadFile(
        "/uploads/avatar",
        manipulated.uri,
        "file",
        { token },
      );

      const uploadedCoverUrl =
        uploadRes.avatarUrl ??
        uploadRes.avatar_url ??
        uploadRes.publicUrl ??
        uploadRes.public_url;

      if (!uploadedCoverUrl) {
        Alert.alert(L.uploadErrorTitle, L.coverUrlMissing);
        return;
      }

      applyCoverLocally(uploadedCoverUrl);

      try {
        await apiPatch(
          "/users/me/coach-profile",
          {
            specialty: getSpecialtyForBackend(profile?.specialty ?? ""),
            bio: profile?.bio ?? "",
            experience_years: profile?.experienceYears ?? 0,
            achievements: profile?.achievements ?? [],
            certificates: profile?.certificates ?? [],
            profile_image_url: profile?.profileImageUrl ?? user.avatarUrl,
            cover_image_url: uploadedCoverUrl,
          },
          { token },
        );
      } catch (e) {
        console.log("[coach-cover] coach profile cover patch warning", e);
      }

      try {
        await refreshFromBackend();
      } catch (e) {
        console.log("[coach-cover] refresh warning", e);
      }

      applyCoverLocally(uploadedCoverUrl);

      Alert.alert(L.savedTitle, L.coverUpdated);
    } catch (e: any) {
      console.log("[coach-cover] upload err", e);

      Alert.alert(L.uploadErrorTitle, e?.message || L.coverUploadError);
    }
  };

  const saveCoachProfile = async () => {
    if (!token || !user) return;

    const experienceValue = editExperienceYears.trim()
      ? parseInt(editExperienceYears.trim(), 10)
      : 0;

    if (Number.isNaN(experienceValue) || experienceValue < 0) {
      Alert.alert(L.invalidExperienceTitle, L.invalidExperienceText);
      return;
    }

    const nextName = editName.trim();
    if (!isValidOptionalKazakhstanPhone(editPhone)) {
      Alert.alert(L.phoneInvalidTitle, L.phoneInvalidText);
      return;
    }

    const nextPhone = getPhoneForBackend(editPhone);
    const nextSpecialty = getSpecialtyForBackend(editSpecialty);
    const nextBio = editBio.trim();
    const nextAchievements = splitLines(editAchievements);
    const nextCertificates = splitLines(editCertificates);
    const nextCoverImageUrl = editCoverImageUrl.trim() || undefined;

    try {
      setSaving(true);

      await apiPatch(
        "/users/me",
        {
          name: nextName,
          phone: nextPhone,
        },
        { token },
      );

      await apiPatch(
        "/users/me/coach-profile",
        {
          specialty: nextSpecialty,
          bio: nextBio || undefined,
          experience_years: experienceValue,
          achievements: nextAchievements,
          certificates: nextCertificates,
          cover_image_url: nextCoverImageUrl,
          profile_image_url: profile?.profileImageUrl ?? user.avatarUrl,
        },
        { token },
      );

      update((data) => {
        const hasCoachProfile = data.coachProfiles.some(
          (item) => item.userId === user.id,
        );

        return {
          ...data,
          users: data.users.map((item) =>
            item.id === user.id
              ? {
                  ...item,
                  name: nextName,
                  phone: nextPhone,
                }
              : item,
          ),
          coachProfiles: hasCoachProfile
            ? data.coachProfiles.map((item) =>
                item.userId === user.id
                  ? {
                      ...item,
                      specialty: nextSpecialty,
                      bio: nextBio,
                      experienceYears: experienceValue,
                      achievements: nextAchievements,
                      certificates: nextCertificates,
                      coverImageUrl: nextCoverImageUrl,
                      profileImageUrl: item.profileImageUrl ?? user.avatarUrl,
                    }
                  : item,
              )
            : [
                ...data.coachProfiles,
                {
                  userId: user.id,
                  specialty: nextSpecialty,
                  bio: nextBio,
                  experienceYears: experienceValue,
                  achievements: nextAchievements,
                  certificates: nextCertificates,
                  rating: 5,
                  profileImageUrl: user.avatarUrl,
                  coverImageUrl: nextCoverImageUrl,
                },
              ],
        };
      });

      await updateMe({
        name: nextName,
        phone: nextPhone,
      });

      await refreshFromBackend();

      setEditOpen(false);

      Alert.alert(L.savedTitle, L.profileUpdated);
    } catch (e: any) {
      console.log("[coach-profile] save err", e);

      Alert.alert(L.saveErrorTitle, e?.message || L.saveProfileError);
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
      console.log("[coach-profile] notification update err", e);

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

      Alert.alert(L.saveErrorTitle, L.saveProfileError);
    }
  };

  const openSupportEmail = async () => {
    const subject = encodeURIComponent("CoachFlow support");
    const body = encodeURIComponent(
      `Hello, CoachFlow support.\n\nUser: ${user?.name ?? ""}\nEmail: ${user?.email ?? ""}\n\nDescribe your question here:\n`,
    );

    const url = `mailto:klaevers001@gmail.com?subject=${subject}&body=${body}`;

    try {
      const canOpen = await Linking.canOpenURL(url);

      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert(L.support, "klaevers001@gmail.com");
      }
    } catch (e) {
      console.log("[coach-profile] support email err", e);
      Alert.alert(L.support, "klaevers001@gmail.com");
    }
  };

  return (
    <ScreenContainer scroll padded={false}>
      <GradientHeader height={250}>
        {coverUri ? (
          <Image
            source={{ uri: coverUri }}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              opacity: 0.28,
            }}
            resizeMode="cover"
          />
        ) : null}

        <View style={{ alignItems: "center", marginTop: 18, gap: 8 }}>
          <Pressable onPress={pickAvatar}>
            <View>
              <AppAvatar uri={avatarUri} name={user.name} size={88} ring />

              <View
                style={{
                  position: "absolute",
                  right: -2,
                  bottom: -2,
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: theme.colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 2,
                  borderColor: "#fff",
                }}
              >
                <Camera color={theme.colors.primaryContrast} size={15} />
              </View>
            </View>
          </Pressable>

          <AppText variant="h2" color="#fff" numberOfLines={1}>
            {user.name}
          </AppText>

          <AppText variant="small" color="rgba(255,255,255,0.82)" numberOfLines={1}>
            {specialtyText}
          </AppText>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.14)",
            }}
          >
            <Star color="#FFB020" size={15} fill="#FFB020" />

            <AppText variant="bodyStrong" color="#fff">
              {profile?.rating ? profile.rating.toFixed(1) : "5.0"}
            </AppText>
          </View>
        </View>
      </GradientHeader>

      <View style={{ paddingHorizontal: 20, marginTop: 16, gap: 12 }}>
        <SectionHeader title={L.profileTitle} />

        <AppCard variant="outline">
          <Row label={L.specialty} value={specialtyText} />
          <Row label={L.experience} value={experienceText} />
          <Row
            label={L.rating}
            value={profile?.rating ? profile.rating.toFixed(1) : "5.0"}
          />
          <Row label={L.phone} value={user.phone || "—"} />

          <View style={{ marginTop: 12 }}>
            <AppButton
              title={L.editProfile}
              variant="secondary"
              icon={<Edit3 size={18} color={theme.colors.text} />}
              onPress={openEdit}
              fullWidth
            />
          </View>
        </AppCard>

        <SectionHeader title={L.subscription} />

        <Pressable onPress={() => router.push("/subscription")}>
          <AppCard variant="outline">
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  backgroundColor: isActive
                    ? "rgba(22,199,132,0.14)"
                    : "rgba(255,176,32,0.16)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CreditCard
                  color={isActive ? theme.colors.primary : theme.colors.fire}
                  size={20}
                />
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {isActive
                    ? `${L.activePlan}: ${getLocalizedSubscriptionPlanName(currentPlan?.name, currentLang)}`
                    : L.inactivePlan}
                </AppText>

                <AppText
                  variant="small"
                  color={theme.colors.textMuted}
                  style={{ marginTop: 2 }}
                  numberOfLines={2}
                >
                  {isActive
                    ? L.activeUntil.replace("{date}", activeUntil)
                    : L.activateSubscription}
                </AppText>
              </View>
            </View>
          </AppCard>
        </Pressable>

        <SectionHeader title={L.coachInfo} />

        <AppCard variant="outline">
          <AppText variant="body">
            {profile?.bio?.trim() || L.defaultBio}
          </AppText>
        </AppCard>

        <SectionHeader
          title={L.achievements}
          icon={<Award color={theme.colors.fire} size={18} />}
        />

        <AppCard variant="outline">
          {(profile?.achievements ?? []).length > 0 ? (
            <View style={{ gap: 8 }}>
              {(profile?.achievements ?? []).map((item, index) => (
                <View
                  key={`${item}_${index}`}
                  style={{ flexDirection: "row", gap: 10 }}
                >
                  <View
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 4,
                      backgroundColor: theme.colors.primary,
                      marginTop: 8,
                    }}
                  />

                  <AppText variant="small" style={{ flex: 1 }}>
                    {item}
                  </AppText>
                </View>
              ))}
            </View>
          ) : (
            <AppText variant="small" color={theme.colors.textMuted}>
              {L.noAchievements}
            </AppText>
          )}
        </AppCard>

        <SectionHeader title={L.certificates} />

        <AppCard variant="outline">
          {(profile?.certificates ?? []).length > 0 ? (
            <View style={{ gap: 6 }}>
              {(profile?.certificates ?? []).map((item, index) => (
                <AppText key={`${item}_${index}`} variant="small">
                  · {item}
                </AppText>
              ))}
            </View>
          ) : (
            <AppText variant="small" color={theme.colors.textMuted}>
              {L.noCertificates}
            </AppText>
          )}
        </AppCard>

        <SectionHeader
          title={L.notifications}
          icon={<Bell color={theme.colors.primary} size={18} />}
        />

        <AppCard variant="outline">
          <SwitchRow
            label={L.workoutReminders}
            value={Boolean(notif.workoutReminders)}
            onValueChange={(value) => setNotif("workoutReminders", value)}
          />

          <SwitchRow
            label={L.supplementReminders}
            value={Boolean(notif.supplementReminders)}
            onValueChange={(value) => setNotif("supplementReminders", value)}
          />

          <SwitchRow
            label={L.messageNotifications}
            value={Boolean(notif.messageNotifications)}
            onValueChange={(value) => setNotif("messageNotifications", value)}
          />

          <SwitchRow
            label={L.weeklyGoalReminders}
            value={Boolean(notif.weeklyGoalReminders)}
            onValueChange={(value) => setNotif("weeklyGoalReminders", value)}
          />
        </AppCard>

        <SectionHeader title={L.preferences} />

        <AppCard variant="outline">
          <SettingsActionRow
            icon={
              mode === "dark" ? (
                <Moon color={theme.colors.text} size={20} />
              ) : (
                <Sun color={theme.colors.text} size={20} />
              )
            }
            title={L.darkMode}
            subtitle={L.darkModeHint}
            onPress={toggle}
            right={
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <AppText
                  variant="small"
                  color={mode === "dark" ? theme.colors.primary : theme.colors.textMuted}
                  style={{ fontWeight: "800" }}
                >
                  {mode === "dark" ? t("common.on") : t("common.off")}
                </AppText>

                <Switch
                  value={mode === "dark"}
                  onValueChange={toggle}
                  trackColor={{
                    true: theme.colors.primary,
                    false: theme.colors.border,
                  }}
                  thumbColor="#fff"
                />
              </View>
            }
          />

          <SettingsActionRow
            icon={<Globe color={theme.colors.text} size={20} />}
            title={L.language}
            subtitle={L.languageHint}
            onPress={() => setLangOpen(true)}
            rightText={LANGUAGES.find((item) => item.code === lang)?.label}
          />

          <SettingsActionRow
            icon={<HelpCircle color={theme.colors.text} size={20} />}
            title={L.faq}
            subtitle={L.faqHint}
            onPress={() => router.push("/faq")}
            rightText={L.open}
          />

          <SettingsActionRow
            icon={<Mail color={theme.colors.text} size={20} />}
            title={L.support}
            subtitle={L.supportHint}
            onPress={openSupportEmail}
            rightText={L.write}
            last
          />
        </AppCard>

        <View style={{ marginTop: 8 }}>
          <AppButton
            title={L.logout}
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

      <EditCoachProfileModal
        visible={editOpen}
        saving={saving}
        onClose={() => setEditOpen(false)}
        onSave={saveCoachProfile}
        editName={editName}
        setEditName={setEditName}
        editPhone={editPhone}
        setEditPhone={setEditPhone}
        editSpecialty={editSpecialty}
        setEditSpecialty={setEditSpecialty}
        editBio={editBio}
        setEditBio={setEditBio}
        editExperienceYears={editExperienceYears}
        setEditExperienceYears={setEditExperienceYears}
        editAchievements={editAchievements}
        setEditAchievements={setEditAchievements}
        editCertificates={editCertificates}
        setEditCertificates={setEditCertificates}
        editCoverImageUrl={editCoverImageUrl}
        onPickCover={pickCover}
        text={L}
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

function EditCoachProfileModal({
  visible,
  saving,
  onClose,
  onSave,
  editName,
  setEditName,
  editPhone,
  setEditPhone,
  editSpecialty,
  setEditSpecialty,
  editBio,
  setEditBio,
  editExperienceYears,
  setEditExperienceYears,
  editAchievements,
  setEditAchievements,
  editCertificates,
  setEditCertificates,
  editCoverImageUrl,
  onPickCover,
  text,
}: {
  visible: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  editName: string;
  setEditName: (value: string) => void;
  editPhone: string;
  setEditPhone: (value: string) => void;
  editSpecialty: string;
  setEditSpecialty: (value: string) => void;
  editBio: string;
  setEditBio: (value: string) => void;
  editExperienceYears: string;
  setEditExperienceYears: (value: string) => void;
  editAchievements: string;
  setEditAchievements: (value: string) => void;
  editCertificates: string;
  setEditCertificates: (value: string) => void;
  editCoverImageUrl: string;
  onPickCover: () => void;
  text: typeof COACH_PROFILE_TEXT.en;
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

            <AppText variant="h3" numberOfLines={1} style={{ flex: 1, textAlign: "center" }}>
              {text.editProfile}
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
              label={text.phone}
              value={editPhone}
              onChangeText={(value) => setEditPhone(formatKazakhstanPhone(value))}
              placeholder={text.phoneHint}
              keyboardType="phone-pad"
              inputMode="tel"
              textContentType="telephoneNumber"
              autoComplete="tel"
              maxLength={16}
              returnKeyType="next"
              submitBehavior="submit"
            />

            <AppInput
              label={text.specialty}
              value={editSpecialty}
              onChangeText={setEditSpecialty}
              placeholder={text.specialtyPlaceholder}
              autoCapitalize="sentences"
              autoCorrect={false}
              returnKeyType="next"
              submitBehavior="submit"
            />

            <AppInput
              label={text.bio}
              value={editBio}
              onChangeText={setEditBio}
              multiline
              autoCapitalize="sentences"
              autoCorrect
              returnKeyType="next"
              submitBehavior="submit"
              style={{
                minHeight: 96,
                textAlignVertical: "top",
                paddingTop: 10,
              }}
            />

            <AppInput
              label={text.experience}
              value={editExperienceYears}
              onChangeText={(value) => setEditExperienceYears(sanitizeExperience(value))}
              keyboardType="numeric"
              inputMode="numeric"
              returnKeyType="next"
              submitBehavior="submit"
              maxLength={2}
            />

            <AppInput
              label={text.achievements}
              value={editAchievements}
              onChangeText={setEditAchievements}
              placeholder={text.achievementsHint}
              multiline
              autoCapitalize="sentences"
              autoCorrect
              returnKeyType="next"
              submitBehavior="submit"
              style={{
                minHeight: 110,
                textAlignVertical: "top",
                paddingTop: 10,
              }}
            />

            <AppInput
              label={text.certificates}
              value={editCertificates}
              onChangeText={setEditCertificates}
              placeholder={text.certificatesHint}
              multiline
              autoCapitalize="sentences"
              autoCorrect
              returnKeyType="next"
              submitBehavior="submit"
              style={{
                minHeight: 110,
                textAlignVertical: "top",
                paddingTop: 10,
              }}
            />

            <View style={{ gap: 8 }}>
              <AppText variant="small" color={theme.colors.textMuted}>
                {text.coverImage}
              </AppText>

              <Pressable
                onPress={onPickCover}
                disabled={saving}
                style={({ pressed }) => ({
                  minHeight: 118,
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: theme.colors.borderSoft,
                  backgroundColor: "rgba(255, 255, 255, 0.04)",
                  overflow: "hidden",
                  opacity: pressed ? 0.82 : 1,
                  alignItems: "center",
                  justifyContent: "center",
                })}
              >
                {editCoverImageUrl ? (
                  <Image
                    source={{ uri: toAbsoluteUrl(editCoverImageUrl) ?? editCoverImageUrl }}
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: 0,
                      bottom: 0,
                      opacity: 0.72,
                    }}
                    resizeMode="cover"
                  />
                ) : null}

                <View
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 999,
                    backgroundColor: "rgba(0, 0, 0, 0.46)",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Camera color="#fff" size={17} />

                  <AppText variant="bodyStrong" color="#fff">
                    {text.changeCover}
                  </AppText>
                </View>
              </Pressable>

              <AppText variant="caption" color={theme.colors.textMuted}>
                {text.coverImageHint}
              </AppText>
            </View>

            <View style={{ marginTop: 12 }}>
              <AppButton
                title={saving ? text.savingChanges : text.saveChanges}
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


function SettingsActionRow({
  icon,
  title,
  subtitle,
  onPress,
  right,
  rightText,
  last = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
  right?: React.ReactNode;
  rightText?: string;
  last?: boolean;
}) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(255,255,255,0.06)" }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.colors.borderSoft,
        opacity: pressed ? 0.78 : 1,
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 14,
          backgroundColor: "rgba(255, 255, 255, 0.06)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {title}
        </AppText>

        {subtitle ? (
          <AppText
            variant="caption"
            color={theme.colors.textMuted}
            numberOfLines={2}
            style={{ marginTop: 3, lineHeight: 17 }}
          >
            {subtitle}
          </AppText>
        ) : null}
      </View>

      {right ? (
        right
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {rightText ? (
            <AppText
              variant="small"
              color={theme.colors.primary}
              style={{ fontWeight: "800" }}
              numberOfLines={1}
            >
              {rightText}
            </AppText>
          ) : null}

          <ChevronRight color={theme.colors.textMuted} size={18} />
        </View>
      )}
    </Pressable>
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