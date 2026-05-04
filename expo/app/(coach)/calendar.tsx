import { router } from "expo-router";
import { ChevronLeft, ChevronRight, Dumbbell } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import {
  AppAvatar,
  AppCard,
  AppEmptyState,
  AppText,
  ScreenContainer,
} from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useData } from "@/src/context/DataContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

const COLORS = ["#16C784", "#3B82F6", "#FF7A1A", "#A855F7", "#EF4444", "#FFB020"];

export default function CoachCalendar() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const { db } = useData();
  const [month, setMonth] = useState<Date>(new Date());
  const [selected, setSelected] = useState<string>(ymd(new Date()));

  const grid = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const startDay = (first.getDay() + 6) % 7;
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let i = 1; i <= last.getDate(); i++) {
      cells.push(new Date(month.getFullYear(), month.getMonth(), i));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [month]);

  const sessions = useMemo(() => {
    if (!db || !user) return [];
    return db.workouts
      .filter((w) => w.coachId === user.id && w.date === selected)
      .map((w) => {
        const u = db.users.find((x) => x.id === w.clientId);
        const colorIdx =
          db.clientProfiles.findIndex((c) => c.userId === w.clientId) % COLORS.length;
        return { w, u, color: COLORS[Math.max(0, colorIdx)] };
      });
  }, [db, user, selected]);

  const monthName = month.toLocaleString("default", { month: "long", year: "numeric" });
  const dayMap = useMemo(() => {
    if (!db || !user) return new Map<string, string[]>();
    const m = new Map<string, string[]>();
    db.workouts
      .filter((w) => w.coachId === user.id)
      .forEach((w) => {
        const idx =
          db.clientProfiles.findIndex((c) => c.userId === w.clientId) % COLORS.length;
        const arr = m.get(w.date) ?? [];
        arr.push(COLORS[Math.max(0, idx)]);
        m.set(w.date, arr);
      });
    return m;
  }, [db, user]);

  return (
    <ScreenContainer scroll>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginVertical: 8,
        }}
      >
        <Pressable
          onPress={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
          }
        >
          <ChevronLeft color={theme.colors.text} size={22} />
        </Pressable>
        <AppText variant="h2">{monthName}</AppText>
        <Pressable
          onPress={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
          }
        >
          <ChevronRight color={theme.colors.text} size={22} />
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", marginTop: 4 }}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center" }}>
            <AppText variant="caption" color={theme.colors.textMuted}>
              {d}
            </AppText>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 6 }}>
        {grid.map((d, i) => {
          if (!d)
            return <View key={i} style={{ width: `${100 / 7}%`, height: 46 }} />;
          const k = ymd(d);
          const dots = dayMap.get(k) ?? [];
          const isSelected = selected === k;
          const isToday = k === ymd(new Date());
          return (
            <Pressable
              key={i}
              onPress={() => setSelected(k)}
              style={{
                width: `${100 / 7}%`,
                height: 46,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isSelected
                    ? theme.colors.primary
                    : isToday
                      ? theme.colors.surfaceAlt
                      : "transparent",
                }}
              >
                <AppText
                  variant="small"
                  color={isSelected ? theme.colors.primaryContrast : theme.colors.text}
                  style={{ fontWeight: "700" }}
                >
                  {d.getDate()}
                </AppText>
              </View>
              <View style={{ flexDirection: "row", gap: 2, marginTop: 2 }}>
                {dots.slice(0, 3).map((c, idx) => (
                  <View
                    key={idx}
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: c,
                    }}
                  />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: 16, gap: 10 }}>
        <AppText variant="h3">{t("calendar.sessionsOn", { date: selected })}</AppText>
        {sessions.length === 0 ? (
          <AppCard variant="outline">
            <AppEmptyState title={t("calendar.noSessions")} message={t("calendar.noSessionsMsg")} />
          </AppCard>
        ) : (
          sessions.map(({ w, u, color }) => (
            <Pressable key={w.id} onPress={() => router.push(`/client/${w.clientId}`)}>
              <AppCard variant="elevated">
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View
                    style={{
                      width: 4,
                      height: 56,
                      borderRadius: 2,
                      backgroundColor: color,
                    }}
                  />
                  <AppAvatar uri={u?.avatarUrl} name={u?.name} size={48} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyStrong">{w.name}</AppText>
                    <AppText variant="small" color={theme.colors.textMuted}>
                      {w.time ? `${w.time} · ` : ""}{u?.name} · {w.durationMinutes}m · {w.category}
                    </AppText>
                  </View>
                  <Dumbbell color={theme.colors.textMuted} size={18} />
                </View>
              </AppCard>
            </Pressable>
          ))
        )}
      </View>
    </ScreenContainer>
  );
}
