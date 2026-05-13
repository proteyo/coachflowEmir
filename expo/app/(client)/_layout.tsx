import { Tabs } from "expo-router";
import {
  Calendar,
  Home,
  MapPin,
  MessageCircle,
  TrendingUp,
  User as UserIcon,
} from "lucide-react-native";
import React from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";

export default function ClientLayout() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

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
        name="today"
        options={{
          title: t("tabs.today"),
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Home color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="schedule"
        options={{
          title: t("tabs.schedule"),
          tabBarIcon: ({ color, size }) => (
            <Calendar color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="progress"
        options={{
          title: t("tabs.progress"),
          tabBarIcon: ({ color, size }) => (
            <TrendingUp color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: t("tabs.explore"),
          tabBarIcon: ({ color, size }) => (
            <MapPin color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="messages"
        options={{
          title: t("tabs.coach"),
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