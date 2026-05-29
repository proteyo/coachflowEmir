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

  const bottomInset = Math.max(insets.bottom, Platform.OS === "android" ? 10 : 8);
  const tabBarHeight = Platform.OS === "android" ? 86 : 74 + bottomInset;

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
          paddingTop: 8,
          paddingBottom: bottomInset,

          marginBottom: 0,

          elevation: 16,
          shadowColor: "#000",
          shadowOpacity: 0.14,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: -4 },
        },

        tabBarItemStyle: {
          minHeight: 64,
          paddingTop: 6,
          paddingBottom: 6,
          justifyContent: "center",
          alignItems: "center",
        },

        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "800",
          marginTop: 2,
          marginBottom: 0,
          includeFontPadding: false,
        },

        tabBarIconStyle: {
          marginTop: 0,
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
        name="today"
        options={{
          title: t("tabs.today"),
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Home color={color} size={focused ? 24 : 22} />
          ),
        }}
      />

      <Tabs.Screen
        name="schedule"
        options={{
          title: t("tabs.schedule"),
          tabBarIcon: ({ color, focused }) => (
            <Calendar color={color} size={focused ? 24 : 22} />
          ),
        }}
      />

      <Tabs.Screen
        name="progress"
        options={{
          title: t("tabs.progress"),
          tabBarIcon: ({ color, focused }) => (
            <TrendingUp color={color} size={focused ? 24 : 22} />
          ),
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: t("tabs.explore"),
          tabBarIcon: ({ color, focused }) => (
            <MapPin color={color} size={focused ? 24 : 22} />
          ),
        }}
      />

      <Tabs.Screen
        name="messages"
        options={{
          title: t("tabs.coach"),
          tabBarIcon: ({ color, focused }) => (
            <MessageCircle color={color} size={focused ? 24 : 22} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          tabBarIcon: ({ color, focused }) => (
            <UserIcon color={color} size={focused ? 24 : 22} />
          ),
        }}
      />
    </Tabs>
  );
}