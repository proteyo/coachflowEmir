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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";

export default function ClientLayout() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  /*
    Универсальная логика для всех устройств:
    - Android с кнопками навигации внутри экрана
    - Android с жестами
    - iPhone с нижней полоской
    - iPhone без большой нижней safe-area зоны

    Navbar становится чуть выше от нижнего края,
    но высота остаётся аккуратной.
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