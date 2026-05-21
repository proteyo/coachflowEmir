import { Stack } from "expo-router";
import {
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Mail,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import {
  AppCard,
  AppText,
  ScreenContainer,
  SectionHeader,
} from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";

type AppLangCode = "en" | "ru" | "kk";
type FaqAudience = "all" | "client" | "coach";

type FaqItem = {
  id: string;
  audience: FaqAudience;
  category: string;
  question: string;
  answer: string;
};

type FaqTexts = {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  all: string;
  client: string;
  coach: string;
  common: string;
  noResultsTitle: string;
  noResultsText: string;
  quickTipTitle: string;
  quickTipText: string;
  supportTitle: string;
  supportText: string;
  supportEmailLabel: string;
};

const TEXT: Record<AppLangCode, FaqTexts> = {
  en: {
    title: "FAQ",
    subtitle:
      "Clear answers about CoachFlow, chats, workouts, progress, subscriptions and account settings.",
    searchPlaceholder: "Search a question...",
    all: "All",
    client: "For clients",
    coach: "For coaches",
    common: "General",
    noResultsTitle: "Nothing found",
    noResultsText:
      "Try another word, for example: chat, workout, progress, subscription, client, coach.",
    quickTipTitle: "Quick tip",
    quickTipText:
      "Most problems are solved by checking internet connection, opening the latest app version and refreshing the screen.",
    supportTitle: "Still have a question?",
    supportText:
      "If you cannot find an answer here, contact support. Send a clear description of the problem, your role, device model and screenshots if possible. We usually reply within 24 hours.",
    supportEmailLabel: "Support email",
  },
  ru: {
    title: "FAQ",
    subtitle:
      "Простые ответы про CoachFlow, чат, тренировки, прогресс, подписку и настройки аккаунта.",
    searchPlaceholder: "Найти вопрос...",
    all: "Все",
    client: "Для клиента",
    coach: "Для тренера",
    common: "Общее",
    noResultsTitle: "Ничего не найдено",
    noResultsText:
      "Попробуйте другое слово: чат, тренировка, прогресс, подписка, клиент, тренер.",
    quickTipTitle: "Быстрый совет",
    quickTipText:
      "Большинство проблем решается проверкой интернета, обновлением приложения и повторным открытием экрана.",
    supportTitle: "Остался вопрос?",
    supportText:
      "Если ответа нет в FAQ, напишите в поддержку. Опишите проблему простыми словами, укажите вашу роль, модель устройства и по возможности приложите скриншоты. Обычно отвечаем в течение суток.",
    supportEmailLabel: "Почта поддержки",
  },
  kk: {
    title: "FAQ",
    subtitle:
      "CoachFlow, чат, жаттығу, прогресс, жазылым және аккаунт баптаулары туралы қарапайым жауаптар.",
    searchPlaceholder: "Сұрақ іздеу...",
    all: "Барлығы",
    client: "Клиент үшін",
    coach: "Жаттықтырушы үшін",
    common: "Жалпы",
    noResultsTitle: "Ештеңе табылмады",
    noResultsText:
      "Басқа сөз жазып көріңіз: чат, жаттығу, прогресс, жазылым, клиент, жаттықтырушы.",
    quickTipTitle: "Жылдам кеңес",
    quickTipText:
      "Көп мәселе интернетті тексеру, қолданбаны жаңарту және экранды қайта ашу арқылы шешіледі.",
    supportTitle: "Сұрағыңыз қалды ма?",
    supportText:
      "FAQ ішінде жауап таппасаңыз, қолдау қызметіне жазыңыз. Мәселені түсінікті етіп сипаттаңыз, рөліңізді, құрылғы моделін және мүмкін болса скриншоттарды жіберіңіз. Әдетте 24 сағат ішінде жауап береміз.",
    supportEmailLabel: "Қолдау поштасы",
  },
};

function getLangSafe(lang: string): AppLangCode {
  if (lang === "ru" || lang === "kk" || lang === "en") return lang;
  return "en";
}

const FAQS: Record<AppLangCode, FaqItem[]> = {
  en: [
    {
      id: "en_all_1",
      audience: "all",
      category: "Account",
      question: "What is CoachFlow?",
      answer:
        "CoachFlow is an app for communication between a fitness coach and a client. A coach can manage clients, workouts, supplements, progress and messages. A client can see assigned workouts, track weight, receive reminders, communicate with the coach and follow the plan in one place.",
    },
    {
      id: "en_all_2",
      audience: "all",
      category: "Account",
      question: "Who can use the app?",
      answer:
        "There are two main roles: coach and client. A coach uses the app to manage clients and create plans. A client uses the app to follow the plan, check workouts, log progress and stay in contact with the coach.",
    },
    {
      id: "en_all_3",
      audience: "all",
      category: "Login",
      question: "How do I log in?",
      answer:
        "Open the login screen, enter your email and password, then press the login button. If the data is correct, the app will open the correct interface for your role. Coaches see coach pages, clients see client pages.",
    },
    {
      id: "en_all_4",
      audience: "all",
      category: "Login",
      question: "What should I do if I forgot my password?",
      answer:
        "Use the password reset screen. Enter your email and follow the instructions. If email reset is connected on the backend, you will receive a reset link. If you do not receive it, check spam or contact support.",
    },
    {
      id: "en_all_5",
      audience: "all",
      category: "Chat",
      question: "How does chat work?",
      answer:
        "Chat lets a coach and a client exchange text and voice messages. Messages are loaded from the backend and refreshed automatically. When the other person opens the conversation, your message can change from sent to read.",
    },
    {
      id: "en_all_6",
      audience: "all",
      category: "Chat",
      question: "What do one check mark and two check marks mean?",
      answer:
        "One check mark means the message was sent. Two check marks mean the other person opened the chat or was active in the conversation, so the app treats your message as read.",
    },
    {
      id: "en_all_7",
      audience: "all",
      category: "Chat",
      question: "Why can I see online or last seen status?",
      answer:
        "The app updates activity time when a user makes authenticated requests. If the user was active recently, the app shows online status. If not, it shows the last activity time.",
    },
    {
      id: "en_all_8",
      audience: "all",
      category: "Profile",
      question: "How do I change my avatar?",
      answer:
        "Open your profile, press the avatar or camera button, choose an image from your gallery and wait until it uploads. If the upload fails, check internet connection and try again.",
    },
    {
      id: "en_all_9",
      audience: "all",
      category: "Settings",
      question: "How do I change the app language?",
      answer:
        "Open Profile, go to Preferences, press Language and choose English, Russian or Kazakh. The interface will switch to the selected language and remember your choice.",
    },
    {
      id: "en_all_10",
      audience: "all",
      category: "Settings",
      question: "How do I change dark mode?",
      answer:
        "Open Profile, go to Preferences and press Dark mode. The app will switch between light and dark themes and save your choice for next time.",
    },
    {
      id: "en_all_11",
      audience: "all",
      category: "Notifications",
      question: "Why am I not receiving notifications?",
      answer:
        "Check that notifications are enabled in the profile settings and in your phone system settings. Also check that the app has permission to send notifications.",
    },
    {
      id: "en_all_12",
      audience: "all",
      category: "Internet",
      question: "Why does data not update?",
      answer:
        "Usually it happens because the backend is not reachable, internet is weak, or the app is using an old API URL. Restart the app, check internet connection and make sure the backend is running.",
    },

    {
      id: "en_client_1",
      audience: "client",
      category: "Client",
      question: "How do I connect with a coach?",
      answer:
        "A coach can invite you or connect your account using your client code. Open your profile and copy your client code. Send it to the coach. After linking, your coach will appear in Messages and Profile sections.",
    },
    {
      id: "en_client_2",
      audience: "client",
      category: "Client",
      question: "Where do I find my client code?",
      answer:
        "Open your client profile. If your account has a client code, it is shown in the profile card. You can press it to copy and send it to your coach.",
    },
    {
      id: "en_client_3",
      audience: "client",
      category: "Workouts",
      question: "Where are my workouts?",
      answer:
        "Open Today or Schedule. Today shows workouts planned for the current day. Schedule shows workouts by date. If nothing appears, your coach may not have assigned a workout yet.",
    },
    {
      id: "en_client_4",
      audience: "client",
      category: "Workouts",
      question: "What should I do after completing a workout?",
      answer:
        "Open the workout and mark it as completed if the app provides this option. This helps your coach understand your activity and track your consistency.",
    },
    {
      id: "en_client_5",
      audience: "client",
      category: "Progress",
      question: "How do I add my weight?",
      answer:
        "Open Progress and press the button to add weight. Enter the value and save it. The app will store the entry so you and your coach can track changes over time.",
    },
    {
      id: "en_client_6",
      audience: "client",
      category: "Progress",
      question: "Why is progress important?",
      answer:
        "Progress helps your coach understand whether the plan works. Weight, attendance and completed workouts show if the training program needs to be changed.",
    },
    {
      id: "en_client_7",
      audience: "client",
      category: "Supplements",
      question: "Where do I see supplements?",
      answer:
        "If your coach creates a supplement plan, it appears in the client interface. You can see supplement names, dosage, time and days of the week.",
    },
    {
      id: "en_client_8",
      audience: "client",
      category: "Chat",
      question: "Can I send voice messages to my coach?",
      answer:
        "Yes. Open the chat and press the microphone button. Allow microphone permission if the phone asks. Record your message and send it.",
    },
    {
      id: "en_client_9",
      audience: "client",
      category: "Coach",
      question: "Can I use the app without a coach?",
      answer:
        "You can log in and see your profile, but most useful features become available after a coach connects your account and assigns workouts or plans.",
    },
    {
      id: "en_client_10",
      audience: "client",
      category: "Safety",
      question: "Should I follow every workout without changes?",
      answer:
        "Follow your coach's plan, but stop if you feel sharp pain, dizziness or serious discomfort. Tell your coach about any health issues before training.",
    },

    {
      id: "en_coach_1",
      audience: "coach",
      category: "Coach",
      question: "How do I add a client?",
      answer:
        "Open the coach client section and use Add Client. You can invite a client or connect them using their client code. After connection, the client appears in your client list.",
    },
    {
      id: "en_coach_2",
      audience: "coach",
      category: "Coach",
      question: "Why can I not add more clients?",
      answer:
        "Your current subscription plan may have a client limit. Free or trial plans can be limited. Open Subscription to check your active plan and client limit.",
    },
    {
      id: "en_coach_3",
      audience: "coach",
      category: "Subscription",
      question: "Why does the app ask for subscription?",
      answer:
        "Coach accounts can require an active subscription because coaches manage clients and professional features. If subscription is inactive, protected coach actions can be blocked.",
    },
    {
      id: "en_coach_4",
      audience: "coach",
      category: "Workouts",
      question: "How do I assign a workout?",
      answer:
        "Open a client profile or workout section, create a workout, choose date, time, category and exercises, then save it. The client will see it in their app.",
    },
    {
      id: "en_coach_5",
      audience: "coach",
      category: "Workouts",
      question: "Can I add exercises with sets, reps and rest time?",
      answer:
        "Yes. When creating or editing a workout, add exercises and specify sets, reps, rest seconds, weight, notes and muscle group if needed.",
    },
    {
      id: "en_coach_6",
      audience: "coach",
      category: "Clients",
      question: "How do I open a client profile?",
      answer:
        "Open Clients and select a client. You will see their profile, progress, workouts, attendance and other available information.",
    },
    {
      id: "en_coach_7",
      audience: "coach",
      category: "Progress",
      question: "How do I track client progress?",
      answer:
        "Use the client's progress section. You can check weight entries, completed workouts, attendance and weekly goals. This helps you adjust the training plan.",
    },
    {
      id: "en_coach_8",
      audience: "coach",
      category: "Supplements",
      question: "How do I create a supplement plan?",
      answer:
        "Open supplement management, choose a client and create a plan. Add supplement names, dosage, times per day, exact times, days of week and notes.",
    },
    {
      id: "en_coach_9",
      audience: "coach",
      category: "Chat",
      question: "How do read receipts work for coaches?",
      answer:
        "When you open a client's chat, incoming messages from that client are marked as read. The client can then see two check marks and read status.",
    },
    {
      id: "en_coach_10",
      audience: "coach",
      category: "Profile",
      question: "Why should I fill coach bio, achievements and certificates?",
      answer:
        "A complete profile builds trust. Clients can better understand your experience, specialization, training style and professional background.",
    },
    {
      id: "en_coach_11",
      audience: "coach",
      category: "Attendance",
      question: "What is attendance used for?",
      answer:
        "Attendance helps track whether clients follow the plan. It can show attended, missed or rest days and gives you a clearer picture of consistency.",
    },
    {
      id: "en_coach_12",
      audience: "coach",
      category: "Safety",
      question: "What should I ask before giving a plan?",
      answer:
        "Ask about injuries, medical restrictions, training level, goal, schedule, weight, height and experience. A plan should match the client's condition.",
    },
  ],

  ru: [
    {
      id: "ru_all_1",
      audience: "all",
      category: "Аккаунт",
      question: "Что такое CoachFlow?",
      answer:
        "CoachFlow — это приложение для связи между фитнес-тренером и клиентом. Тренер может управлять клиентами, тренировками, добавками, прогрессом и сообщениями. Клиент может смотреть свои тренировки, отслеживать вес, получать напоминания и общаться с тренером в одном месте.",
    },
    {
      id: "ru_all_2",
      audience: "all",
      category: "Аккаунт",
      question: "Кто может пользоваться приложением?",
      answer:
        "В приложении есть две основные роли: тренер и клиент. Тренер создаёт планы, ведёт клиентов и следит за прогрессом. Клиент выполняет план, смотрит тренировки, добавляет вес и общается с тренером.",
    },
    {
      id: "ru_all_3",
      audience: "all",
      category: "Вход",
      question: "Как войти в аккаунт?",
      answer:
        "Откройте экран входа, введите email и пароль, затем нажмите кнопку входа. Если данные правильные, приложение само откроет нужный интерфейс: тренерский или клиентский.",
    },
    {
      id: "ru_all_4",
      audience: "all",
      category: "Вход",
      question: "Что делать, если я забыл пароль?",
      answer:
        "Откройте экран восстановления пароля, введите email и следуйте инструкции. Если восстановление подключено на сервере, на почту придёт ссылка. Если письма нет, проверьте папку Спам.",
    },
    {
      id: "ru_all_5",
      audience: "all",
      category: "Чат",
      question: "Как работает чат?",
      answer:
        "Чат нужен для переписки между тренером и клиентом. Можно отправлять текстовые и голосовые сообщения. Сообщения загружаются с сервера и автоматически обновляются. Когда собеседник открывает чат, сообщение может перейти из статуса «отправлено» в «прочитано».",
    },
    {
      id: "ru_all_6",
      audience: "all",
      category: "Чат",
      question: "Что означает одна галочка и две галочки?",
      answer:
        "Одна галочка означает, что сообщение отправлено. Две галочки означают, что собеседник открыл чат или был активен в переписке, поэтому приложение считает сообщение прочитанным.",
    },
    {
      id: "ru_all_7",
      audience: "all",
      category: "Чат",
      question: "Почему показывается «в сети» или время последнего входа?",
      answer:
        "Приложение обновляет время активности, когда пользователь делает запросы к серверу. Если человек был активен недавно, показывается зелёный статус «в сети». Если давно не был активен, показывается время последнего входа.",
    },
    {
      id: "ru_all_8",
      audience: "all",
      category: "Профиль",
      question: "Как поменять аватар?",
      answer:
        "Откройте профиль, нажмите на аватар или кнопку камеры, выберите фото из галереи и дождитесь загрузки. Если фото не загрузилось, проверьте интернет и попробуйте ещё раз.",
    },
    {
      id: "ru_all_9",
      audience: "all",
      category: "Настройки",
      question: "Как изменить язык приложения?",
      answer:
        "Откройте Профиль, перейдите в Настройки, нажмите Язык и выберите русский, английский или казахский. Приложение запомнит выбранный язык.",
    },
    {
      id: "ru_all_10",
      audience: "all",
      category: "Настройки",
      question: "Как включить или выключить тёмную тему?",
      answer:
        "Откройте Профиль, перейдите в Настройки и нажмите Тёмная тема. Приложение переключится между светлым и тёмным режимом и сохранит выбор.",
    },
    {
      id: "ru_all_11",
      audience: "all",
      category: "Уведомления",
      question: "Почему не приходят уведомления?",
      answer:
        "Проверьте, включены ли уведомления в профиле приложения и в системных настройках телефона. Также убедитесь, что приложению разрешено отправлять уведомления.",
    },
    {
      id: "ru_all_12",
      audience: "all",
      category: "Интернет",
      question: "Почему данные не обновляются?",
      answer:
        "Чаще всего причина в слабом интернете, недоступном backend-сервере или неправильном API URL. Перезапустите приложение, проверьте интернет и убедитесь, что сервер работает.",
    },

    {
      id: "ru_client_1",
      audience: "client",
      category: "Клиент",
      question: "Как подключиться к тренеру?",
      answer:
        "Тренер может отправить вам приглашение или подключить вас по клиентскому коду. Откройте профиль, скопируйте свой код и отправьте тренеру. После подключения тренер появится в сообщениях и профиле.",
    },
    {
      id: "ru_client_2",
      audience: "client",
      category: "Клиент",
      question: "Где найти мой клиентский код?",
      answer:
        "Откройте профиль клиента. Если код создан, он будет показан в карточке профиля. Нажмите на код, чтобы скопировать его и отправить тренеру.",
    },
    {
      id: "ru_client_3",
      audience: "client",
      category: "Тренировки",
      question: "Где находятся мои тренировки?",
      answer:
        "Откройте Сегодня или Расписание. В разделе Сегодня видны тренировки на текущий день. В расписании можно смотреть тренировки по датам. Если там пусто, тренер ещё не назначил тренировку.",
    },
    {
      id: "ru_client_4",
      audience: "client",
      category: "Тренировки",
      question: "Что делать после выполнения тренировки?",
      answer:
        "Откройте тренировку и отметьте её выполненной, если такая кнопка доступна. Так тренер поймёт, что вы выполнили задание, и сможет следить за вашей регулярностью.",
    },
    {
      id: "ru_client_5",
      audience: "client",
      category: "Прогресс",
      question: "Как добавить вес?",
      answer:
        "Откройте раздел Прогресс и нажмите кнопку добавления веса. Введите значение и сохраните. Запись появится в истории, чтобы вы и тренер могли видеть изменения.",
    },
    {
      id: "ru_client_6",
      audience: "client",
      category: "Прогресс",
      question: "Зачем отслеживать прогресс?",
      answer:
        "Прогресс помогает понять, работает ли план. Вес, посещаемость и выполненные тренировки показывают тренеру, нужно ли менять программу.",
    },
    {
      id: "ru_client_7",
      audience: "client",
      category: "Добавки",
      question: "Где смотреть добавки?",
      answer:
        "Если тренер создал план добавок, он появится в клиентском интерфейсе. Там можно увидеть название добавки, дозировку, время приёма и дни недели.",
    },
    {
      id: "ru_client_8",
      audience: "client",
      category: "Чат",
      question: "Можно ли отправлять голосовые сообщения тренеру?",
      answer:
        "Да. Откройте чат и нажмите кнопку микрофона. Если телефон попросит разрешение на микрофон, разрешите доступ. Затем запишите сообщение и отправьте его.",
    },
    {
      id: "ru_client_9",
      audience: "client",
      category: "Тренер",
      question: "Можно ли пользоваться приложением без тренера?",
      answer:
        "Вы можете войти и открыть профиль, но основные функции становятся полезными после подключения тренера: тренировки, планы, добавки, контроль прогресса и переписка.",
    },
    {
      id: "ru_client_10",
      audience: "client",
      category: "Безопасность",
      question: "Нужно ли выполнять тренировку, если стало плохо?",
      answer:
        "Нет. Если появилась резкая боль, головокружение или сильный дискомфорт, остановитесь и сообщите тренеру. Перед тренировками важно говорить тренеру о травмах и ограничениях.",
    },

    {
      id: "ru_coach_1",
      audience: "coach",
      category: "Тренер",
      question: "Как добавить клиента?",
      answer:
        "Откройте раздел клиентов и нажмите добавление клиента. Можно отправить приглашение или подключить клиента по его клиентскому коду. После подключения клиент появится в вашем списке.",
    },
    {
      id: "ru_coach_2",
      audience: "coach",
      category: "Тренер",
      question: "Почему я не могу добавить больше клиентов?",
      answer:
        "Возможно, у вашего тарифа есть лимит клиентов. Бесплатный или пробный план может ограничивать количество клиентов. Откройте раздел Подписка и проверьте активный план.",
    },
    {
      id: "ru_coach_3",
      audience: "coach",
      category: "Подписка",
      question: "Зачем тренеру нужна подписка?",
      answer:
        "Тренерский аккаунт использует профессиональные функции: управление клиентами, тренировками, прогрессом, добавками и сообщениями. Поэтому часть действий может требовать активную подписку.",
    },
    {
      id: "ru_coach_4",
      audience: "coach",
      category: "Тренировки",
      question: "Как назначить тренировку клиенту?",
      answer:
        "Откройте профиль клиента или раздел тренировок, создайте тренировку, выберите дату, время, категорию и упражнения, затем сохраните. Клиент увидит тренировку у себя в приложении.",
    },
    {
      id: "ru_coach_5",
      audience: "coach",
      category: "Тренировки",
      question: "Можно ли добавлять подходы, повторения и отдых?",
      answer:
        "Да. При создании или редактировании тренировки можно указать упражнения, количество подходов, повторений, время отдыха, вес, заметки и мышечную группу.",
    },
    {
      id: "ru_coach_6",
      audience: "coach",
      category: "Клиенты",
      question: "Как открыть профиль клиента?",
      answer:
        "Откройте раздел Клиенты и выберите нужного клиента. Там отображаются профиль, прогресс, тренировки, посещаемость и другая доступная информация.",
    },
    {
      id: "ru_coach_7",
      audience: "coach",
      category: "Прогресс",
      question: "Как отслеживать прогресс клиента?",
      answer:
        "Откройте профиль клиента и смотрите записи веса, выполненные тренировки, посещаемость и недельные цели. Эти данные помогают корректировать план.",
    },
    {
      id: "ru_coach_8",
      audience: "coach",
      category: "Добавки",
      question: "Как создать план добавок?",
      answer:
        "Откройте управление добавками, выберите клиента и создайте план. Добавьте название добавки, дозировку, количество приёмов, точное время, дни недели и заметки.",
    },
    {
      id: "ru_coach_9",
      audience: "coach",
      category: "Чат",
      question: "Как работают прочитанные сообщения у тренера?",
      answer:
        "Когда тренер открывает чат клиента, входящие сообщения от клиента отмечаются как прочитанные. После этого клиент видит две галочки и статус «прочитано».",
    },
    {
      id: "ru_coach_10",
      audience: "coach",
      category: "Профиль",
      question: "Зачем заполнять био, достижения и сертификаты?",
      answer:
        "Полный профиль повышает доверие. Клиенту легче понять ваш опыт, специализацию, стиль тренировок и профессиональный уровень.",
    },
    {
      id: "ru_coach_11",
      audience: "coach",
      category: "Посещаемость",
      question: "Для чего нужна посещаемость?",
      answer:
        "Посещаемость показывает, насколько регулярно клиент выполняет план. Можно отмечать посещение, пропуск или день отдыха. Это помогает видеть дисциплину клиента.",
    },
    {
      id: "ru_coach_12",
      audience: "coach",
      category: "Безопасность",
      question: "Что нужно узнать перед составлением плана?",
      answer:
        "Уточните травмы, ограничения по здоровью, уровень подготовки, цель, график, вес, рост и опыт тренировок. План должен подходить состоянию клиента.",
    },
  ],

  kk: [
    {
      id: "kk_all_1",
      audience: "all",
      category: "Аккаунт",
      question: "CoachFlow деген не?",
      answer:
        "CoachFlow — жаттықтырушы мен клиенттің байланысына арналған қолданба. Жаттықтырушы клиенттерді, жаттығуларды, қоспаларды, прогресті және хабарламаларды басқара алады. Клиент жаттығуларын көріп, салмағын бақылап, ескертулер алып, жаттықтырушымен сөйлесе алады.",
    },
    {
      id: "kk_all_2",
      audience: "all",
      category: "Аккаунт",
      question: "Қолданбаны кім пайдалана алады?",
      answer:
        "Қолданбада екі негізгі рөл бар: жаттықтырушы және клиент. Жаттықтырушы жоспар құрады және клиенттерді бақылайды. Клиент жоспарды орындайды, жаттығуларды көреді, салмақ қосады және жаттықтырушымен сөйлеседі.",
    },
    {
      id: "kk_all_3",
      audience: "all",
      category: "Кіру",
      question: "Аккаунтқа қалай кіремін?",
      answer:
        "Кіру экранын ашып, email мен құпиясөзді енгізіңіз. Деректер дұрыс болса, қолданба сіздің рөліңізге сәйкес интерфейсті ашады.",
    },
    {
      id: "kk_all_4",
      audience: "all",
      category: "Кіру",
      question: "Құпиясөзді ұмытсам не істеймін?",
      answer:
        "Құпиясөзді қалпына келтіру экранын ашыңыз, email енгізіңіз және нұсқаулықты орындаңыз. Хат келмесе, Спам бумасын тексеріңіз.",
    },
    {
      id: "kk_all_5",
      audience: "all",
      category: "Чат",
      question: "Чат қалай жұмыс істейді?",
      answer:
        "Чат жаттықтырушы мен клиенттің хат алмасуына арналған. Мәтін және дауыс хабарламаларын жіберуге болады. Хабарламалар серверден жүктеліп, автоматты түрде жаңарып тұрады.",
    },
    {
      id: "kk_all_6",
      audience: "all",
      category: "Чат",
      question: "Бір белгі және екі белгі нені білдіреді?",
      answer:
        "Бір белгі хабарлама жіберілгенін білдіреді. Екі белгі собеседник чатты ашқанын немесе сөйлесуде белсенді болғанын білдіреді, сондықтан хабарлама оқылды деп есептеледі.",
    },
    {
      id: "kk_all_7",
      audience: "all",
      category: "Чат",
      question: "Неге онлайн немесе соңғы кіру уақыты көрсетіледі?",
      answer:
        "Қолданба пайдаланушы серверге сұраныс жасағанда белсенділік уақытын жаңартады. Егер пайдаланушы жақында белсенді болса, жасыл онлайн белгісі көрсетіледі. Әйтпесе соңғы белсенділік уақыты шығады.",
    },
    {
      id: "kk_all_8",
      audience: "all",
      category: "Профиль",
      question: "Аватарды қалай өзгертемін?",
      answer:
        "Профильді ашып, аватар немесе камера батырмасын басыңыз. Галереядан сурет таңдап, жүктелгенін күтіңіз. Жүктелмесе, интернетті тексеріңіз.",
    },
    {
      id: "kk_all_9",
      audience: "all",
      category: "Баптаулар",
      question: "Қолданба тілін қалай өзгертемін?",
      answer:
        "Профильді ашып, Баптаулар бөліміне өтіңіз. Тіл батырмасын басып, қазақ, орыс немесе ағылшын тілін таңдаңыз. Қолданба таңдауды сақтайды.",
    },
    {
      id: "kk_all_10",
      audience: "all",
      category: "Баптаулар",
      question: "Қараңғы режимді қалай қосамын?",
      answer:
        "Профильдегі Баптаулар бөлімінде Қараңғы режимді басыңыз. Қолданба ашық және қараңғы тақырып арасында ауысады және таңдауды сақтайды.",
    },
    {
      id: "kk_all_11",
      audience: "all",
      category: "Хабарландырулар",
      question: "Неге хабарландырулар келмейді?",
      answer:
        "Қолданба ішіндегі және телефонның жүйелік баптауларындағы хабарландыру рұқсаттарын тексеріңіз. Қолданбаға хабарландыру жіберуге рұқсат болуы керек.",
    },
    {
      id: "kk_all_12",
      audience: "all",
      category: "Интернет",
      question: "Неге деректер жаңармайды?",
      answer:
        "Көбіне себеп — интернет әлсіз, backend сервер қолжетімсіз немесе API URL қате. Қолданбаны қайта ашып, интернет пен серверді тексеріңіз.",
    },

    {
      id: "kk_client_1",
      audience: "client",
      category: "Клиент",
      question: "Жаттықтырушыға қалай қосыламын?",
      answer:
        "Жаттықтырушы сізге шақыру жібере алады немесе клиенттік код арқылы қоса алады. Профильді ашып, клиенттік кодты көшіріп, жаттықтырушыға жіберіңіз.",
    },
    {
      id: "kk_client_2",
      audience: "client",
      category: "Клиент",
      question: "Клиенттік код қай жерде?",
      answer:
        "Клиент профилін ашыңыз. Егер код жасалған болса, ол профиль карточкасында көрсетіледі. Кодты басып көшіріп, жаттықтырушыға жібере аласыз.",
    },
    {
      id: "kk_client_3",
      audience: "client",
      category: "Жаттығулар",
      question: "Менің жаттығуларым қайда?",
      answer:
        "Бүгін немесе Кесте бөлімін ашыңыз. Бүгін бөлімінде ағымдағы күннің жаттығулары көрінеді. Кестеде жаттығуларды күн бойынша көруге болады.",
    },
    {
      id: "kk_client_4",
      audience: "client",
      category: "Жаттығулар",
      question: "Жаттығуды аяқтаған соң не істеу керек?",
      answer:
        "Жаттығуды ашып, мүмкіндік болса аяқталды деп белгілеңіз. Бұл жаттықтырушыға сіздің тапсырманы орындағаныңызды көруге көмектеседі.",
    },
    {
      id: "kk_client_5",
      audience: "client",
      category: "Прогресс",
      question: "Салмақты қалай қосамын?",
      answer:
        "Прогресс бөлімін ашып, салмақ қосу батырмасын басыңыз. Мәнді енгізіп, сақтаңыз. Жазба тарихта сақталады.",
    },
    {
      id: "kk_client_6",
      audience: "client",
      category: "Прогресс",
      question: "Прогресті бақылау не үшін керек?",
      answer:
        "Прогресс жоспардың жұмыс істеп жатқанын түсінуге көмектеседі. Салмақ, қатысу және орындалған жаттығулар арқылы жаттықтырушы бағдарламаны өзгерте алады.",
    },
    {
      id: "kk_client_7",
      audience: "client",
      category: "Қоспалар",
      question: "Қоспаларды қайдан көремін?",
      answer:
        "Егер жаттықтырушы қоспалар жоспарын құрса, ол клиент интерфейсінде көрінеді. Онда атауы, дозасы, уақыты және апта күндері көрсетіледі.",
    },
    {
      id: "kk_client_8",
      audience: "client",
      category: "Чат",
      question: "Жаттықтырушыға дауыс хабарламасын жібере аламын ба?",
      answer:
        "Иә. Чатты ашып, микрофон батырмасын басыңыз. Телефон рұқсат сұраса, микрофонға рұқсат беріңіз. Содан кейін хабарламаны жазып жіберіңіз.",
    },
    {
      id: "kk_client_9",
      audience: "client",
      category: "Жаттықтырушы",
      question: "Жаттықтырушысыз қолдануға бола ма?",
      answer:
        "Аккаунтқа кіріп, профильді көруге болады. Бірақ негізгі функциялар жаттықтырушы қосылғаннан кейін пайдалы болады: жаттығулар, жоспарлар, қоспалар және прогресс.",
    },
    {
      id: "kk_client_10",
      audience: "client",
      category: "Қауіпсіздік",
      question: "Жаттығу кезінде өзімді жаман сезінсем не істеймін?",
      answer:
        "Жаттығуды тоқтатып, жаттықтырушыға хабарлаңыз. Қатты ауырсыну, бас айналу немесе жайсыздық болса, жаттығуды жалғастырмаңыз.",
    },

    {
      id: "kk_coach_1",
      audience: "coach",
      category: "Жаттықтырушы",
      question: "Клиентті қалай қосамын?",
      answer:
        "Клиенттер бөлімін ашып, клиент қосу батырмасын басыңыз. Шақыру жіберуге немесе клиенттік код арқылы қосуға болады.",
    },
    {
      id: "kk_coach_2",
      audience: "coach",
      category: "Жаттықтырушы",
      question: "Неге көбірек клиент қоса алмаймын?",
      answer:
        "Сіздің жоспарыңызда клиент санына лимит болуы мүмкін. Жазылым бөлімін ашып, белсенді жоспар мен лимитті тексеріңіз.",
    },
    {
      id: "kk_coach_3",
      audience: "coach",
      category: "Жазылым",
      question: "Жаттықтырушыға жазылым не үшін керек?",
      answer:
        "Жаттықтырушы аккаунты кәсіби функцияларды қолданады: клиенттер, жаттығулар, прогресс, қоспалар және хабарламалар. Сондықтан кей әрекеттер белсенді жазылымды талап етуі мүмкін.",
    },
    {
      id: "kk_coach_4",
      audience: "coach",
      category: "Жаттығулар",
      question: "Клиентке жаттығуды қалай тағайындаймын?",
      answer:
        "Клиент профилін немесе жаттығулар бөлімін ашып, жаттығу құрыңыз. Күн, уақыт, категория және жаттығуларды таңдап, сақтаңыз.",
    },
    {
      id: "kk_coach_5",
      audience: "coach",
      category: "Жаттығулар",
      question: "Подход, қайталау және демалыс уақытын қосуға бола ма?",
      answer:
        "Иә. Жаттығу жасағанда немесе өңдегенде подход, қайталау, демалыс секундтары, салмақ, ескерту және бұлшықет тобын көрсетуге болады.",
    },
    {
      id: "kk_coach_6",
      audience: "coach",
      category: "Клиенттер",
      question: "Клиент профилін қалай ашамын?",
      answer:
        "Клиенттер бөлімін ашып, қажетті клиентті таңдаңыз. Профиль, прогресс, жаттығулар, қатысу және басқа ақпарат көрінеді.",
    },
    {
      id: "kk_coach_7",
      audience: "coach",
      category: "Прогресс",
      question: "Клиент прогресін қалай бақылаймын?",
      answer:
        "Клиент профиліндегі салмақ жазбаларын, орындалған жаттығуларды, қатысуды және апталық мақсаттарды қараңыз. Бұл жоспарды түзетуге көмектеседі.",
    },
    {
      id: "kk_coach_8",
      audience: "coach",
      category: "Қоспалар",
      question: "Қоспалар жоспарын қалай құрамын?",
      answer:
        "Қоспаларды басқару бөлімін ашып, клиентті таңдаңыз. Қоспа атауын, дозасын, қабылдау санын, нақты уақытын, апта күндерін және ескертулерді қосыңыз.",
    },
    {
      id: "kk_coach_9",
      audience: "coach",
      category: "Чат",
      question: "Жаттықтырушыда оқылған хабарламалар қалай жұмыс істейді?",
      answer:
        "Жаттықтырушы клиенттің чатын ашқанда, клиенттен келген хабарламалар оқылды деп белгіленеді. Клиент екі белгі мен оқылды статусын көреді.",
    },
    {
      id: "kk_coach_10",
      audience: "coach",
      category: "Профиль",
      question: "Био, жетістіктер және сертификаттар не үшін керек?",
      answer:
        "Толық профиль сенімді арттырады. Клиент сіздің тәжірибеңізді, мамандануыңызды, жаттығу стиліңізді және кәсіби деңгейіңізді жақсы түсінеді.",
    },
    {
      id: "kk_coach_11",
      audience: "coach",
      category: "Қатысу",
      question: "Қатысу не үшін қажет?",
      answer:
        "Қатысу клиенттің жоспарды қаншалықты тұрақты орындайтынын көрсетеді. Қатысты, өткізіп алды немесе демалыс күнін белгілеуге болады.",
    },
    {
      id: "kk_coach_12",
      audience: "coach",
      category: "Қауіпсіздік",
      question: "Жоспар құрмас бұрын не сұрау керек?",
      answer:
        "Жарақат, денсаулық шектеулері, дайындық деңгейі, мақсат, кесте, салмақ, бой және тәжірибе туралы сұраңыз. Жоспар клиент жағдайына сай болуы керек.",
    },
  ],
};

const EXTRA_FAQS: Record<AppLangCode, FaqItem[]> = {
  "en": [
    {
      "id": "en_extra_all_1",
      "audience": "all",
      "category": "Support",
      "question": "Where can I contact support?",
      "answer": "If you cannot find your answer in FAQ, contact us at klaevers001@gmail.com. Describe the issue, your account role, what screen you are using and attach screenshots if possible. We usually reply within 24 hours."
    },
    {
      "id": "en_extra_all_2",
      "audience": "all",
      "category": "Account",
      "question": "Can one person be both a coach and a client?",
      "answer": "The app is designed around one main role per account. If you need to test both sides, it is better to create two separate accounts: one coach account and one client account. This keeps permissions, chats and data clean."
    },
    {
      "id": "en_extra_all_3",
      "audience": "all",
      "category": "Account",
      "question": "Can I change my role after registration?",
      "answer": "Usually the role is chosen during registration and controls which screens you see. If the role was selected incorrectly, the safest option is to create a new account with the correct role or contact support."
    },
    {
      "id": "en_extra_all_4",
      "audience": "all",
      "category": "Password",
      "question": "Why did password reset not arrive?",
      "answer": "First check spam, promotions and all mail folders. Then make sure the email is typed correctly. If the app is running in test mode, email delivery can depend on backend email settings, so contact support if the letter does not arrive."
    },
    {
      "id": "en_extra_all_5",
      "audience": "all",
      "category": "Security",
      "question": "Is my data private?",
      "answer": "Your account data is protected by authentication. Other users should not see your private profile or chat unless they are connected to you as a coach or client. Do not share your password or private codes with strangers."
    },
    {
      "id": "en_extra_all_6",
      "audience": "all",
      "category": "Security",
      "question": "Should I share my password with my coach or client?",
      "answer": "No. A coach never needs your password. A client never needs the coach password. Use the built-in invitation, client code and chat instead."
    },
    {
      "id": "en_extra_all_7",
      "audience": "all",
      "category": "Internet",
      "question": "Why does the app show old information?",
      "answer": "The app can temporarily show cached local data while it refreshes from the backend. Open the screen again, check internet connection and wait a few seconds. If backend is unavailable, the old data may remain until connection is restored."
    },
    {
      "id": "en_extra_all_8",
      "audience": "all",
      "category": "Notifications",
      "question": "Why do reminders sometimes arrive late?",
      "answer": "Phone systems can delay notifications to save battery. Check battery optimization, notification permissions and internet connection. On some devices, background restrictions can delay reminders."
    },
    {
      "id": "en_extra_all_9",
      "audience": "all",
      "category": "Images",
      "question": "Why does my avatar not update immediately?",
      "answer": "Images may be cached by the app or phone. Wait a few seconds, reopen the screen or restart the app. If upload failed, try a smaller image and check internet connection."
    },
    {
      "id": "en_extra_all_10",
      "audience": "all",
      "category": "App",
      "question": "What should I do if the app freezes?",
      "answer": "Close the app completely, open it again and check internet connection. If the problem repeats, send support the screen name, what you pressed before the freeze and a screenshot."
    },
    {
      "id": "en_extra_all_11",
      "audience": "all",
      "category": "Language",
      "question": "Will my selected language be saved?",
      "answer": "Yes. Language selection is saved locally on the device. If you reinstall the app or clear app data, you may need to choose the language again."
    },
    {
      "id": "en_extra_all_12",
      "audience": "all",
      "category": "Theme",
      "question": "Will dark mode and chat theme be saved?",
      "answer": "Yes. The app saves theme preferences. If the app is reinstalled or storage is cleared, the theme can return to default."
    },
    {
      "id": "en_extra_client_1",
      "audience": "client",
      "category": "Client",
      "question": "What should I send to my coach first?",
      "answer": "Send your goal, current weight, height, training experience, injuries, preferred schedule and what equipment you have. This helps the coach create a safer and more accurate plan."
    },
    {
      "id": "en_extra_client_2",
      "audience": "client",
      "category": "Client",
      "question": "What if I entered wrong weight or profile data?",
      "answer": "Open Profile and edit your information. If a progress entry was added incorrectly and cannot be edited, send a message to your coach so they understand the mistake."
    },
    {
      "id": "en_extra_client_3",
      "audience": "client",
      "category": "Workouts",
      "question": "Why do I not see today’s workout?",
      "answer": "The coach may not have assigned a workout for today, the date may be different, or the app has not refreshed yet. Open Schedule, check other dates and refresh the app."
    },
    {
      "id": "en_extra_client_4",
      "audience": "client",
      "category": "Supplements",
      "question": "Are supplements medical advice?",
      "answer": "No. Supplement plans in the app are informational and should be agreed with a qualified specialist if you have medical conditions, pregnancy, allergies or take medication."
    },
    {
      "id": "en_extra_client_5",
      "audience": "client",
      "category": "Chat",
      "question": "Why does the coach not answer immediately?",
      "answer": "Online status only shows recent activity. It does not guarantee that the person is free to reply immediately. Wait for a response or send a clear message with all details."
    },
    {
      "id": "en_extra_coach_1",
      "audience": "coach",
      "category": "Coach",
      "question": "What should I check before accepting a new client?",
      "answer": "Ask about the client goal, injuries, restrictions, training experience, schedule, available equipment, weight, height and health notes. This helps avoid unsafe plans."
    },
    {
      "id": "en_extra_coach_2",
      "audience": "coach",
      "category": "Clients",
      "question": "What happens when I remove or disconnect a client?",
      "answer": "The client may lose access to coach-related plans and management. Before removing a client, make sure you no longer need their workout, progress or chat history in your workflow."
    },
    {
      "id": "en_extra_coach_3",
      "audience": "coach",
      "category": "Subscription",
      "question": "Can I test the app before real Google payment is connected?",
      "answer": "Yes. During closed testing, the app can use demo or free subscription logic. Real payment should only be enabled when Google Play products and backend verification are fully configured."
    },
    {
      "id": "en_extra_coach_4",
      "audience": "coach",
      "category": "Workouts",
      "question": "How detailed should a workout be?",
      "answer": "A good workout should include exercise name, sets, reps, rest time, optional weight, notes and date. The clearer the plan is, the easier it is for the client to follow it correctly."
    },
    {
      "id": "en_extra_coach_5",
      "audience": "coach",
      "category": "Profile",
      "question": "How can I make my coach profile look trustworthy?",
      "answer": "Add a clear avatar, specialization, real experience, short bio, certificates and achievements. Avoid empty or generic descriptions because clients need to understand why they should trust you."
    }
  ],
  "ru": [
    {
      "id": "ru_extra_all_1",
      "audience": "all",
      "category": "Поддержка",
      "question": "Куда обращаться, если ответа нет в FAQ?",
      "answer": "Если вы не нашли ответ в FAQ, напишите на почту klaevers001@gmail.com. Опишите проблему, вашу роль в приложении, на каком экране она появилась, и по возможности приложите скриншот. Обычно отвечаем в течение суток."
    },
    {
      "id": "ru_extra_all_2",
      "audience": "all",
      "category": "Аккаунт",
      "question": "Можно ли быть одновременно тренером и клиентом?",
      "answer": "Приложение рассчитано на одну основную роль для одного аккаунта. Если нужно проверить обе стороны, лучше создать два аккаунта: один как тренер, второй как клиент. Так не смешиваются права, чаты и данные."
    },
    {
      "id": "ru_extra_all_3",
      "audience": "all",
      "category": "Аккаунт",
      "question": "Можно ли поменять роль после регистрации?",
      "answer": "Обычно роль выбирается при регистрации и определяет, какие экраны доступны. Если роль выбрана неправильно, безопаснее создать новый аккаунт с правильной ролью или написать в поддержку."
    },
    {
      "id": "ru_extra_all_4",
      "audience": "all",
      "category": "Пароль",
      "question": "Почему письмо для восстановления пароля не пришло?",
      "answer": "Сначала проверьте Спам, Промоакции и другие папки почты. Потом убедитесь, что email введён правильно. Если приложение работает в тестовом режиме, отправка писем зависит от настроек backend, поэтому при проблеме напишите в поддержку."
    },
    {
      "id": "ru_extra_all_5",
      "audience": "all",
      "category": "Безопасность",
      "question": "Мои данные защищены?",
      "answer": "Данные аккаунта защищены авторизацией. Другие пользователи не должны видеть ваш профиль и чат, если они не связаны с вами как тренер или клиент. Не передавайте пароль и личные коды посторонним."
    },
    {
      "id": "ru_extra_all_6",
      "audience": "all",
      "category": "Безопасность",
      "question": "Нужно ли давать пароль тренеру или клиенту?",
      "answer": "Нет. Тренеру не нужен пароль клиента, а клиенту не нужен пароль тренера. Для связи используйте приглашение, клиентский код и чат внутри приложения."
    },
    {
      "id": "ru_extra_all_7",
      "audience": "all",
      "category": "Интернет",
      "question": "Почему приложение показывает старые данные?",
      "answer": "Приложение может временно показывать локально сохранённые данные, пока обновляет информацию с сервера. Откройте экран заново, проверьте интернет и подождите несколько секунд. Если сервер недоступен, старые данные могут оставаться до восстановления соединения."
    },
    {
      "id": "ru_extra_all_8",
      "audience": "all",
      "category": "Уведомления",
      "question": "Почему напоминания иногда приходят позже?",
      "answer": "Телефон может задерживать уведомления для экономии батареи. Проверьте разрешения уведомлений, режим энергосбережения, фоновую активность приложения и интернет."
    },
    {
      "id": "ru_extra_all_9",
      "audience": "all",
      "category": "Изображения",
      "question": "Почему аватар не обновился сразу?",
      "answer": "Иногда изображение кэшируется телефоном или приложением. Подождите несколько секунд, откройте экран заново или перезапустите приложение. Если загрузка не прошла, попробуйте фото меньшего размера и проверьте интернет."
    },
    {
      "id": "ru_extra_all_10",
      "audience": "all",
      "category": "Приложение",
      "question": "Что делать, если приложение зависло?",
      "answer": "Полностью закройте приложение, откройте его снова и проверьте интернет. Если проблема повторяется, отправьте в поддержку название экрана, что вы нажали перед зависанием, и скриншот."
    },
    {
      "id": "ru_extra_all_11",
      "audience": "all",
      "category": "Язык",
      "question": "Сохранится ли выбранный язык?",
      "answer": "Да. Выбор языка сохраняется на устройстве. Если удалить приложение или очистить данные, язык может вернуться к стандартному, и его нужно будет выбрать заново."
    },
    {
      "id": "ru_extra_all_12",
      "audience": "all",
      "category": "Тема",
      "question": "Сохранится ли тёмная тема и тема чата?",
      "answer": "Да. Приложение сохраняет выбранные темы. Если удалить приложение или очистить хранилище, тема может вернуться к стандартной."
    },
    {
      "id": "ru_extra_client_1",
      "audience": "client",
      "category": "Клиент",
      "question": "Что лучше сразу написать тренеру?",
      "answer": "Напишите цель, текущий вес, рост, опыт тренировок, травмы, удобное расписание и какое оборудование у вас есть. Так тренеру проще составить безопасный и точный план."
    },
    {
      "id": "ru_extra_client_2",
      "audience": "client",
      "category": "Клиент",
      "question": "Что делать, если я неправильно указал вес или данные профиля?",
      "answer": "Откройте профиль и исправьте информацию. Если запись прогресса добавлена ошибочно и её нельзя изменить, напишите тренеру, чтобы он понимал, что это ошибка."
    },
    {
      "id": "ru_extra_client_3",
      "audience": "client",
      "category": "Тренировки",
      "question": "Почему я не вижу тренировку на сегодня?",
      "answer": "Возможно, тренер ещё не назначил тренировку на этот день, дата отличается или приложение ещё не обновилось. Проверьте расписание, другие даты и интернет."
    },
    {
      "id": "ru_extra_client_4",
      "audience": "client",
      "category": "Добавки",
      "question": "План добавок является медицинской рекомендацией?",
      "answer": "Нет. План добавок в приложении носит информационный характер. Если у вас есть болезни, беременность, аллергии или вы принимаете лекарства, согласуйте добавки со специалистом."
    },
    {
      "id": "ru_extra_client_5",
      "audience": "client",
      "category": "Чат",
      "question": "Почему тренер не отвечает сразу?",
      "answer": "Статус «в сети» показывает недавнюю активность, но не гарантирует, что человек свободен ответить прямо сейчас. Лучше отправьте одно понятное сообщение со всеми деталями и дождитесь ответа."
    },
    {
      "id": "ru_extra_coach_1",
      "audience": "coach",
      "category": "Тренер",
      "question": "Что проверить перед подключением нового клиента?",
      "answer": "Уточните цель, травмы, ограничения, опыт тренировок, расписание, доступное оборудование, вес, рост и заметки по здоровью. Это помогает избежать небезопасных планов."
    },
    {
      "id": "ru_extra_coach_2",
      "audience": "coach",
      "category": "Клиенты",
      "question": "Что будет, если отключить клиента?",
      "answer": "Клиент может потерять доступ к тренерским планам и управлению. Перед отключением убедитесь, что вам больше не нужны его тренировки, прогресс и история общения в работе."
    },
    {
      "id": "ru_extra_coach_3",
      "audience": "coach",
      "category": "Подписка",
      "question": "Можно ли тестировать приложение без настоящей оплаты Google?",
      "answer": "Да. На закрытом тестировании можно использовать demo/free-логику подписки. Настоящую оплату лучше включать только после полной настройки продуктов Google Play и проверки платежей на backend."
    },
    {
      "id": "ru_extra_coach_4",
      "audience": "coach",
      "category": "Тренировки",
      "question": "Насколько подробно нужно оформлять тренировку?",
      "answer": "Хорошая тренировка содержит название упражнения, подходы, повторения, отдых, при необходимости вес, заметки и дату. Чем понятнее план, тем меньше ошибок у клиента."
    },
    {
      "id": "ru_extra_coach_5",
      "audience": "coach",
      "category": "Профиль",
      "question": "Как сделать профиль тренера более доверительным?",
      "answer": "Добавьте качественный аватар, специализацию, реальный опыт, короткое описание, сертификаты и достижения. Пустой или слишком общий профиль хуже убеждает клиента."
    }
  ],
  "kk": [
    {
      "id": "kk_extra_all_1",
      "audience": "all",
      "category": "Қолдау",
      "question": "FAQ ішінде жауап болмаса қайда жазамын?",
      "answer": "Егер FAQ ішінде жауап таппасаңыз, klaevers001@gmail.com поштасына жазыңыз. Мәселені, қолданбадағы рөліңізді, қай экранда болғанын және мүмкін болса скриншотты жіберіңіз. Әдетте 24 сағат ішінде жауап береміз."
    },
    {
      "id": "kk_extra_all_2",
      "audience": "all",
      "category": "Аккаунт",
      "question": "Бір адам әрі жаттықтырушы, әрі клиент бола ала ма?",
      "answer": "Қолданба бір аккаунтқа бір негізгі рөлге есептелген. Екі жақты тексеру керек болса, екі бөлек аккаунт жасаған дұрыс: біреуі жаттықтырушы, біреуі клиент."
    },
    {
      "id": "kk_extra_all_3",
      "audience": "all",
      "category": "Аккаунт",
      "question": "Тіркелгеннен кейін рөлді өзгертуге бола ма?",
      "answer": "Әдетте рөл тіркелу кезінде таңдалады және қолжетімді экрандарды анықтайды. Рөл қате таңдалса, дұрыс рөлмен жаңа аккаунт ашқан немесе қолдау қызметіне жазған дұрыс."
    },
    {
      "id": "kk_extra_all_4",
      "audience": "all",
      "category": "Құпиясөз",
      "question": "Құпиясөзді қалпына келтіру хаты неге келмеді?",
      "answer": "Алдымен Спам және басқа пошта бумаларын тексеріңіз. Email дұрыс жазылғанына көз жеткізіңіз. Тест режимінде хат жіберу backend баптауларына байланысты болуы мүмкін, сондықтан мәселе болса қолдауға жазыңыз."
    },
    {
      "id": "kk_extra_all_5",
      "audience": "all",
      "category": "Қауіпсіздік",
      "question": "Менің деректерім қорғалған ба?",
      "answer": "Аккаунт деректері авторизациямен қорғалады. Басқа пайдаланушылар сізбен жаттықтырушы немесе клиент ретінде байланыспаса, жеке профиль мен чатты көрмеуі керек. Құпиясөзді ешкімге бермеңіз."
    },
    {
      "id": "kk_extra_all_6",
      "audience": "all",
      "category": "Қауіпсіздік",
      "question": "Құпиясөзді жаттықтырушыға немесе клиентке беру керек пе?",
      "answer": "Жоқ. Жаттықтырушыға клиенттің құпиясөзі қажет емес, клиентке де жаттықтырушының құпиясөзі қажет емес. Байланыс үшін шақыру, клиент коды және қолданба ішіндегі чат қолданылады."
    },
    {
      "id": "kk_extra_all_7",
      "audience": "all",
      "category": "Интернет",
      "question": "Неге қолданба ескі деректерді көрсетеді?",
      "answer": "Қолданба серверден жаңарғанша уақытша сақталған деректерді көрсетуі мүмкін. Экранды қайта ашыңыз, интернетті тексеріңіз және бірнеше секунд күтіңіз."
    },
    {
      "id": "kk_extra_all_8",
      "audience": "all",
      "category": "Хабарландырулар",
      "question": "Ескертулер неге кеш келеді?",
      "answer": "Телефон батареяны үнемдеу үшін хабарландыруларды кешіктіруі мүмкін. Хабарландыру рұқсаттарын, энергия үнемдеу режимін, фондық белсенділікті және интернетті тексеріңіз."
    },
    {
      "id": "kk_extra_all_9",
      "audience": "all",
      "category": "Суреттер",
      "question": "Аватар неге бірден жаңармады?",
      "answer": "Сурет телефонда немесе қолданбада кэштелуі мүмкін. Бірнеше секунд күтіңіз, экранды қайта ашыңыз немесе қолданбаны қайта іске қосыңыз. Жүктеу өтпесе, кішірек сурет қолданып көріңіз."
    },
    {
      "id": "kk_extra_all_10",
      "audience": "all",
      "category": "Қолданба",
      "question": "Қолданба қатып қалса не істеймін?",
      "answer": "Қолданбаны толық жауып, қайта ашыңыз және интернетті тексеріңіз. Мәселе қайталанса, қолдауға экран атауын, қандай әрекеттен кейін болғанын және скриншот жіберіңіз."
    },
    {
      "id": "kk_extra_all_11",
      "audience": "all",
      "category": "Тіл",
      "question": "Таңдалған тіл сақтала ма?",
      "answer": "Иә. Тіл таңдауы құрылғыда сақталады. Қолданбаны жойсаңыз немесе деректерді тазаласаңыз, тілді қайта таңдау керек болуы мүмкін."
    },
    {
      "id": "kk_extra_all_12",
      "audience": "all",
      "category": "Тақырып",
      "question": "Қараңғы режим және чат тақырыбы сақтала ма?",
      "answer": "Иә. Қолданба таңдалған тақырыптарды сақтайды. Қолданбаны қайта орнатсаңыз немесе хранилищені тазаласаңыз, тақырып стандартқа оралуы мүмкін."
    },
    {
      "id": "kk_extra_client_1",
      "audience": "client",
      "category": "Клиент",
      "question": "Жаттықтырушыға бірінші не жазған дұрыс?",
      "answer": "Мақсатыңызды, салмақты, бойды, жаттығу тәжірибесін, жарақаттарды, қолайлы кестені және қандай құрал бар екенін жазыңыз. Бұл қауіпсіз жоспар жасауға көмектеседі."
    },
    {
      "id": "kk_extra_client_2",
      "audience": "client",
      "category": "Клиент",
      "question": "Салмақты немесе профиль деректерін қате енгізсем не істеймін?",
      "answer": "Профильді ашып, ақпаратты түзетіңіз. Егер прогресс жазбасы қате қосылса және өзгерту мүмкін болмаса, жаттықтырушыға хабарлаңыз."
    },
    {
      "id": "kk_extra_client_3",
      "audience": "client",
      "category": "Жаттығулар",
      "question": "Неге бүгінгі жаттығу көрінбейді?",
      "answer": "Жаттықтырушы бүгінге жаттығу тағайындамаған болуы мүмкін, күн басқа болуы мүмкін немесе қолданба әлі жаңармаған. Кестені, басқа күндерді және интернетті тексеріңіз."
    },
    {
      "id": "kk_extra_client_4",
      "audience": "client",
      "category": "Қоспалар",
      "question": "Қоспалар жоспары медициналық кеңес пе?",
      "answer": "Жоқ. Қолданбадағы қоспалар жоспары ақпараттық сипатта. Ауру, жүктілік, аллергия немесе дәрі қабылдау болса, маманмен келісіңіз."
    },
    {
      "id": "kk_extra_client_5",
      "audience": "client",
      "category": "Чат",
      "question": "Жаттықтырушы неге бірден жауап бермейді?",
      "answer": "Онлайн статусы соңғы белсенділікті көрсетеді, бірақ адамның дәл қазір жауап беруге бос екенін білдірмейді. Толық әрі түсінікті хабарлама жіберіп, жауап күтіңіз."
    },
    {
      "id": "kk_extra_coach_1",
      "audience": "coach",
      "category": "Жаттықтырушы",
      "question": "Жаңа клиентті қоспас бұрын нені тексеру керек?",
      "answer": "Мақсат, жарақат, шектеулер, тәжірибе, кесте, қолжетімді құрал, салмақ, бой және денсаулық ескертулерін сұраңыз. Бұл қауіпсіз жоспар жасауға көмектеседі."
    },
    {
      "id": "kk_extra_coach_2",
      "audience": "coach",
      "category": "Клиенттер",
      "question": "Клиентті ажыратсам не болады?",
      "answer": "Клиент жаттықтырушы жоспарларына және басқаруға қолжетімділігін жоғалтуы мүмкін. Ажыратпас бұрын жаттығу, прогресс және чат тарихы сізге керек емес екеніне көз жеткізіңіз."
    },
    {
      "id": "kk_extra_coach_3",
      "audience": "coach",
      "category": "Жазылым",
      "question": "Google төлемі қосылмай тұрып қолданбаны тестілеуге бола ма?",
      "answer": "Иә. Жабық тестілеуде demo/free жазылым логикасын қолдануға болады. Нақты төлемді Google Play өнімдері және backend тексерісі толық дайын болғанда қосқан дұрыс."
    },
    {
      "id": "kk_extra_coach_4",
      "audience": "coach",
      "category": "Жаттығулар",
      "question": "Жаттығуды қаншалықты толық жазу керек?",
      "answer": "Жақсы жаттығуда жаттығу атауы, подход, қайталау, демалыс, қажет болса салмақ, ескертулер және күн көрсетіледі. Жоспар неғұрлым түсінікті болса, клиентке орындау оңай болады."
    },
    {
      "id": "kk_extra_coach_5",
      "audience": "coach",
      "category": "Профиль",
      "question": "Жаттықтырушы профилін қалай сенімді етуге болады?",
      "answer": "Сапалы аватар, мамандану, нақты тәжірибе, қысқа био, сертификаттар және жетістіктер қосыңыз. Бос немесе тым жалпы профиль клиентке аз сенім береді."
    }
  ]
};

function includesText(value: string, query: string) {
  return value.toLowerCase().includes(query.toLowerCase());
}

export default function FAQScreen() {
  const { theme } = useTheme();
  const { lang } = useI18n();
  const { user } = useAuth();

  const currentLang = getLangSafe(lang);
  const L = TEXT[currentLang];

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FaqAudience>("all");
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});

  const userRole = user?.role ?? "client";

  const allFaqItems = useMemo(
    () => [...FAQS[currentLang], ...EXTRA_FAQS[currentLang]],
    [currentLang],
  );

  const visibleItems = useMemo(() => {
    const q = search.trim();

    return allFaqItems.filter((item) => {
      const roleMatch =
        item.audience === "all" ||
        item.audience === userRole ||
        filter === item.audience;

      const filterMatch =
        filter === "all" ||
        item.audience === "all" ||
        item.audience === filter;

      const searchMatch =
        !q ||
        includesText(item.question, q) ||
        includesText(item.answer, q) ||
        includesText(item.category, q);

      return roleMatch && filterMatch && searchMatch;
    });
  }, [allFaqItems, filter, search, userRole]);

  const grouped = useMemo(() => {
    const map = new Map<string, FaqItem[]>();

    for (const item of visibleItems) {
      const group = map.get(item.category) ?? [];
      group.push(item);
      map.set(item.category, group);
    }

    return Array.from(map.entries());
  }, [visibleItems]);

  const toggleOpen = (id: string) => {
    setOpenIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <ScreenContainer scroll>
      <Stack.Screen options={{ title: L.title }} />

      <View style={{ gap: 14, paddingTop: 8 }}>
        <AppCard variant="elevated">
          <View style={{ gap: 10 }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 18,
                backgroundColor: theme.colors.surfaceAlt,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <HelpCircle color={theme.colors.primary} size={28} />
            </View>

            <AppText variant="title">{L.title}</AppText>

            <AppText variant="body" color={theme.colors.textMuted}>
              {L.subtitle}
            </AppText>
          </View>
        </AppCard>

        <AppCard variant="outline">
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              backgroundColor: theme.colors.inputBg,
              borderRadius: theme.radius.lg,
              paddingHorizontal: 12,
              minHeight: 48,
            }}
          >
            <Search color={theme.colors.textMuted} size={18} />

            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={L.searchPlaceholder}
              placeholderTextColor={theme.colors.textMuted}
              style={{
                flex: 1,
                color: theme.colors.text,
                fontSize: 15,
                fontWeight: "500",
              }}
            />
          </View>

          <View
            style={{
              flexDirection: "row",
              gap: 8,
              marginTop: 12,
              flexWrap: "wrap",
            }}
          >
            <FilterChip
              label={L.all}
              active={filter === "all"}
              onPress={() => setFilter("all")}
            />
            <FilterChip
              label={L.client}
              active={filter === "client"}
              onPress={() => setFilter("client")}
            />
            <FilterChip
              label={L.coach}
              active={filter === "coach"}
              onPress={() => setFilter("coach")}
            />
          </View>
        </AppCard>

        <AppCard variant="outline">
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Sparkles color={theme.colors.warn} size={20} />

            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{L.quickTipTitle}</AppText>
              <AppText
                variant="small"
                color={theme.colors.textMuted}
                style={{ marginTop: 4, lineHeight: 19 }}
              >
                {L.quickTipText}
              </AppText>
            </View>
          </View>
        </AppCard>

        <AppCard variant="elevated">
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Mail color={theme.colors.primary} size={20} />

            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{L.supportTitle}</AppText>
              <AppText
                variant="small"
                color={theme.colors.textMuted}
                style={{ marginTop: 4, lineHeight: 19 }}
              >
                {L.supportText}
              </AppText>

              <View
                style={{
                  marginTop: 10,
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 12,
                  backgroundColor: theme.colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <AppText variant="caption" color={theme.colors.textMuted}>
                  {L.supportEmailLabel}
                </AppText>
                <AppText
                  variant="bodyStrong"
                  color={theme.colors.primary}
                  selectable
                  style={{ marginTop: 2 }}
                >
                  klaevers001@gmail.com
                </AppText>
              </View>
            </View>
          </View>
        </AppCard>

        {grouped.length === 0 ? (
          <AppCard variant="outline">
            <View style={{ alignItems: "center", gap: 8, paddingVertical: 16 }}>
              <Search color={theme.colors.textMuted} size={30} />
              <AppText variant="h3">{L.noResultsTitle}</AppText>
              <AppText
                variant="small"
                color={theme.colors.textMuted}
                style={{ textAlign: "center" }}
              >
                {L.noResultsText}
              </AppText>
            </View>
          </AppCard>
        ) : null}

        {grouped.map(([category, items]) => (
          <View key={category} style={{ gap: 10 }}>
            <SectionHeader
              title={category}
              icon={
                category.toLowerCase().includes("чат") ||
                category.toLowerCase().includes("chat") ? (
                  <MessageCircle color={theme.colors.primary} size={18} />
                ) : category.toLowerCase().includes("клиент") ||
                  category.toLowerCase().includes("client") ||
                  category.toLowerCase().includes("coach") ||
                  category.toLowerCase().includes("тренер") ? (
                  <Users color={theme.colors.primary} size={18} />
                ) : (
                  <ShieldCheck color={theme.colors.primary} size={18} />
                )
              }
            />

            {items.map((item) => {
              const open = Boolean(openIds[item.id]);

              return (
                <AppCard key={item.id} variant="outline">
                  <Pressable
                    onPress={() => toggleOpen(item.id)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyStrong">{item.question}</AppText>

                      <AppText
                        variant="caption"
                        color={theme.colors.primary}
                        style={{ marginTop: 5 }}
                      >
                        {item.audience === "all"
                          ? L.common
                          : item.audience === "client"
                            ? L.client
                            : L.coach}
                      </AppText>
                    </View>

                    {open ? (
                      <ChevronUp color={theme.colors.textMuted} size={20} />
                    ) : (
                      <ChevronDown color={theme.colors.textMuted} size={20} />
                    )}
                  </Pressable>

                  {open ? (
                    <View
                      style={{
                        marginTop: 12,
                        paddingTop: 12,
                        borderTopWidth: 1,
                        borderTopColor: theme.colors.border,
                      }}
                    >
                      <AppText
                        variant="body"
                        color={theme.colors.textMuted}
                        style={{ lineHeight: 22 }}
                      >
                        {item.answer}
                      </AppText>
                    </View>
                  ) : null}
                </AppCard>
              );
            })}
          </View>
        ))}

        <View style={{ height: 26 }} />
      </View>
    </ScreenContainer>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: active ? theme.colors.primary : theme.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: active ? theme.colors.primary : theme.colors.border,
      }}
    >
      <AppText
        variant="caption"
        color={active ? theme.colors.primaryContrast : theme.colors.text}
      >
        {label}
      </AppText>
    </Pressable>
  );
}