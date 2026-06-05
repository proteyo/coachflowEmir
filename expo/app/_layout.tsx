import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "@/src/context/AuthContext";
import { DataProvider } from "@/src/context/DataContext";
import { SubscriptionProvider } from "@/src/context/SubscriptionContext";
import { ThemeProvider, useTheme } from "@/src/context/ThemeContext";
import { I18nProvider, useI18n } from "@/src/i18n/I18nContext";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function Nav() {
  const { theme } = useTheme();
  const { t, lang } = useI18n();

  const faqTitle =
    lang === "ru"
      ? "FAQ / Помощь"
      : lang === "kk"
        ? "FAQ / Көмек"
        : "FAQ / Help";

  const coachProfileTitle =
    lang === "ru"
      ? "Профиль тренера"
      : lang === "kk"
        ? "Жаттықтырушы профилі"
        : "Coach profile";

  const clientsBackTitle =
    lang === "ru" ? "Клиенты" : lang === "kk" ? "Клиенттер" : "Clients";

  return (
    <>
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />

      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.colors.bg,
          },
          headerTitleStyle: {
            color: theme.colors.text,
            fontWeight: "700",
          },
          headerTintColor: theme.colors.text,
          contentStyle: {
            backgroundColor: theme.colors.bg,
          },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />

        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(coach)" options={{ headerShown: false }} />
        <Stack.Screen name="(client)" options={{ headerShown: false }} />

        <Stack.Screen
          name="subscription"
          options={{
            title: t("profile.subscription"),
            presentation: "modal",
          }}
        />

        <Stack.Screen
          name="faq"
          options={{
            title: faqTitle,
            presentation: "modal",
          }}
        />

        <Stack.Screen
          name="client/[id]"
          options={{
            title: t("clients.profile"),
            headerBackTitle: clientsBackTitle,
          }}
        />

        <Stack.Screen
          name="coach/[id]"
          options={{
            title: coachProfileTitle,
          }}
        />

        <Stack.Screen
          name="chat/[id]"
          options={{
            title: t("messages.title"),
          }}
        />

        <Stack.Screen
          name="workout/[id]"
          options={{
            title: t("workouts.workout"),
            presentation: "modal",
          }}
        />

        <Stack.Screen
          name="add-client"
          options={{
            title: t("clients.add"),
            presentation: "modal",
          }}
        />

        <Stack.Screen
          name="add-weight"
          options={{
            title: t("progress.logWeight"),
            presentation: "modal",
          }}
        />

        <Stack.Screen
          name="add-workout"
          options={{
            title: t("workouts.workout"),
            presentation: "modal",
          }}
        />

        <Stack.Screen
          name="weekly-goals"
          options={{
            title: t("clients.weeklyGoal"),
            presentation: "modal",
          }}
        />

        <Stack.Screen
          name="manage-supplements"
          options={{
            title: t("supps.title"),
            presentation: "modal",
          }}
        />

        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ThemeProvider>
            <I18nProvider>
              <AuthProvider>
                <DataProvider>
                  <SubscriptionProvider>
                    <Nav />
                  </SubscriptionProvider>
                </DataProvider>
              </AuthProvider>
            </I18nProvider>
          </ThemeProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}