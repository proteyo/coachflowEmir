import { Tabs, useRouter, useSegments } from "expo-router";
import {
  Calendar,
  LayoutDashboard,
  MessageCircle,
  User as UserIcon,
  Users,
} from "lucide-react-native";
import React, { useEffect, useMemo } from "react";
import { Platform } from "react-native";
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

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,

        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.borderSoft,
          borderTopWidth: 1,

          height: Platform.OS === "android" ? 78 : 64 + insets.bottom,

          paddingTop: 6,

          paddingBottom:
            Platform.OS === "android"
              ? Math.max(insets.bottom, 12)
              : Math.max(insets.bottom, 8),

          marginBottom: Platform.OS === "android" ? 14 : 0,
        },

        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },

        tabBarIconStyle: {
          marginTop: 2,
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
          tabBarIcon: ({ color, size }) => (
            <Users color={color} size={size} />
          ),
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