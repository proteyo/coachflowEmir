import { Tabs, useRouter, useSegments } from "expo-router";
import {
  Calendar,
  LayoutDashboard,
  MessageCircle,
  User as UserIcon,
  Users,
} from "lucide-react-native";
import React, { useEffect, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/context/AuthContext";
import { useSubscription } from "@/src/context/SubscriptionContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";

const PROTECTED_COACH_TABS = new Set([
  "dashboard",
  "clients",
  "calendar",
  "messages",
]);

export default function CoachLayout() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();

  const { user } = useAuth();
  const { isActive } = useSubscription();

  const currentTab = useMemo(() => {
    const lastSegment = segments[segments.length - 1];
    return typeof lastSegment === "string" ? lastSegment : "";
  }, [segments]);

  const isCoach = user?.role === "coach";
  const isSubscriptionLocked = isCoach && !isActive;
  const isProtectedTab = PROTECTED_COACH_TABS.has(currentTab);

  useEffect(() => {
    if (isSubscriptionLocked && isProtectedTab) {
      router.replace("/(coach)/profile");
    }
  }, [isSubscriptionLocked, isProtectedTab, router]);

  const protectedTabOptions = {
    href: isSubscriptionLocked ? null : undefined,
  };

  /*
    Универсальная логика для всех устройств:
    - Android с нижними системными кнопками
    - Android с жестами
    - iPhone с нижней полоской
    - iPhone без большой safe-area зоны

    Navbar становится чуть выше от нижнего края,
    но остаётся аккуратным и не слишком огромным.
  */
  const bottomSafePadding = Math.max(insets.bottom, 26);
  const tabBarHeight = 74 + bottomSafePadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,

        tabBarHideOnKeyboard: true,

        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.borderSoft,
          borderTopWidth: 1,

          height: tabBarHeight,
          paddingTop: 9,
          paddingBottom: bottomSafePadding,

          elevation: 14,
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: {
            width: 0,
            height: -2,
          },
        },

        tabBarItemStyle: {
  paddingTop: 0,
  paddingBottom: 12,
  justifyContent: "center",
  alignItems: "center",
},

tabBarLabelStyle: {
  fontSize: 11,
  fontWeight: "700",
  marginTop: 0,
  marginBottom: 0,
  includeFontPadding: false,
},

tabBarIconStyle: {
  marginTop: -5,
  marginBottom: 0,
},

        headerStyle: {
          backgroundColor: theme.colors.bg,
        },

        headerTitleStyle: {
          color: theme.colors.text,
          fontWeight: "800",
        },

        headerTintColor: theme.colors.text,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          ...protectedTabOptions,
          title: t("tabs.dashboard"),
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="clients"
        options={{
          ...protectedTabOptions,
          title: t("tabs.clients"),
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="calendar"
        options={{
          ...protectedTabOptions,
          title: t("tabs.calendar"),
          tabBarIcon: ({ color, size }) => (
            <Calendar color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="messages"
        options={{
          ...protectedTabOptions,
          title: t("tabs.messages"),
          tabBarIcon: ({ color, size }) => (
            <MessageCircle color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          tabBarIcon: ({ color, size }) => (
            <UserIcon color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}