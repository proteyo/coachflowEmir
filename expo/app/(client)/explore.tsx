import { Image } from "expo-image";
import { Dumbbell, MapPin, Salad, ShoppingBag, Star } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import {
  AppCard,
  AppChip,
  AppEmptyState,
  AppText,
  ScreenContainer,
  SectionHeader,
} from "@/src/components/ui";
import { useData } from "@/src/context/DataContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";
import { Place } from "@/src/types/models";

type Filter = "all" | "gym" | "nutrition" | "shop";

export default function Explore() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const { db } = useData();
  const [filter, setFilter] = useState<Filter>("all");

  const items = useMemo(() => {
    if (!db) return [];
    return db.places.filter((p) => filter === "all" || p.type === filter);
  }, [db, filter]);

  const iconFor = (t: Place["type"]) => {
    if (t === "gym") return <Dumbbell color={theme.colors.primary} size={16} />;
    if (t === "nutrition") return <Salad color={theme.colors.success} size={16} />;
    return <ShoppingBag color={theme.colors.accent} size={16} />;
  };

  return (
    <ScreenContainer>
      <SectionHeader title={t("explore.title")} icon={<MapPin color={theme.colors.primary} size={18} />} />
      <View style={{ flexDirection: "row", gap: 8, marginVertical: 8 }}>
        {(["all", "gym", "nutrition", "shop"] as Filter[]).map((f) => {
          const k = ("explore." + f) as never;
          return (
            <AppChip
              key={f}
              label={t(k)}
              active={filter === f}
              onPress={() => setFilter(f)}
            />
          );
        })}
      </View>

      <View
        style={{
          height: 140,
          borderRadius: 18,
          backgroundColor: theme.colors.surfaceAlt,
          marginVertical: 12,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <Image
          source={{
            uri: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1200",
          }}
          style={{ position: "absolute", inset: 0, opacity: 0.45 }}
          contentFit="cover"
        />
        <MapPin color={theme.colors.text} size={24} />
        <AppText variant="bodyStrong" style={{ marginTop: 6 }}>
          {t("explore.mapPreview")}
        </AppText>
        <AppText variant="small" color={theme.colors.textMuted}>
          {t("explore.mapHint")}
        </AppText>
      </View>

      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
        ListEmptyComponent={<AppEmptyState title={t("explore.nothing")} />}
        renderItem={({ item }) => (
          <AppCard variant="elevated" padded={false}>
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={{ height: 140, width: "100%" }}
                contentFit="cover"
              />
            ) : null}
            <View style={{ padding: 14, gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {iconFor(item.type)}
                <AppText variant="caption" color={theme.colors.textMuted}>
                  {item.type.toUpperCase()}
                </AppText>
                {item.rating ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 2, marginLeft: "auto" }}>
                    <Star color={theme.colors.fire} size={14} fill={theme.colors.fire} />
                    <AppText variant="small" style={{ fontWeight: "700" }}>
                      {item.rating}
                    </AppText>
                  </View>
                ) : null}
              </View>
              <AppText variant="h3">{item.name}</AppText>
              <AppText variant="small" color={theme.colors.textMuted}>
                {item.address}
              </AppText>
              {item.description ? (
                <AppText variant="small" color={theme.colors.textMuted}>
                  {item.description}
                </AppText>
              ) : null}
            </View>
          </AppCard>
        )}
      />
    </ScreenContainer>
  );
}
