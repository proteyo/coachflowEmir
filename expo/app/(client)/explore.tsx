import { Image } from "expo-image";
import {
  Compass,
  Dumbbell,
  ExternalLink,
  Filter,
  MapPin,
  Navigation,
  Salad,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Star,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Linking,
  Pressable,
  TextInput,
  View,
} from "react-native";

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

type FilterType = "all" | "gym" | "nutrition" | "shop";
type SortMode = "rating" | "name";

type ExtendedPlace = Place & {
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
  phone?: string;
  website?: string;
  workingHours?: string;
};

const FILTERS: FilterType[] = ["all", "gym", "nutrition", "shop"];
const SORTS: SortMode[] = ["rating", "name"];

const LOCAL_TEXT = {
  en: {
    title: "Explore",
    heroTitle: "Find places near you",
    heroSubtitle:
      "Gyms, healthy nutrition spots and sport shops will be shown here based on your location.",
    searchPlaceholder: "Search gyms, nutrition, shops...",
    mapPreview: "Map preview",
    mapHint: "Real map integration will be connected here later",
    categories: "Categories",
    sort: "Sort",
    nearbyTitle: "Nearby places",
    bestRated: "Best rated",
    sortByName: "By name",
    openRoute: "Open route",
    noAddress: "Address is not available",
    noResultsTitle: "No places found",
    noResultsMessage: "Try another search or change the category.",
    futureMapTitle: "Ready for real map",
    futureMapText:
      "Later this screen can connect Expo Location and Google Places API to show the nearest gyms, nutrition spots and sport shops by rating.",
    results: "results",
    result: "result",
    all: "All",
    gym: "Gyms",
    nutrition: "Nutrition",
    shop: "Shops",
    distanceSoon: "Distance after location",
  },
  ru: {
    title: "Карта",
    heroTitle: "Найди места рядом",
    heroSubtitle:
      "Здесь будут отображаться залы, спортивное питание и магазины рядом с тобой.",
    searchPlaceholder: "Поиск залов, питания, магазинов...",
    mapPreview: "Предпросмотр карты",
    mapHint: "Позже здесь будет подключена настоящая карта",
    categories: "Категории",
    sort: "Сортировка",
    nearbyTitle: "Ближайшие места",
    bestRated: "По рейтингу",
    sortByName: "По названию",
    openRoute: "Открыть маршрут",
    noAddress: "Адрес недоступен",
    noResultsTitle: "Ничего не найдено",
    noResultsMessage: "Попробуй другой поиск или измени категорию.",
    futureMapTitle: "Готово под настоящую карту",
    futureMapText:
      "Позже сюда можно подключить Expo Location и Google Places API, чтобы показывать ближайшие залы, спортпит и магазины по рейтингу.",
    results: "результатов",
    result: "результат",
    all: "Все",
    gym: "Залы",
    nutrition: "Питание",
    shop: "Магазины",
    distanceSoon: "Расстояние после геолокации",
  },
  kk: {
    title: "Карта",
    heroTitle: "Жақын орындарды тап",
    heroSubtitle:
      "Мұнда саған жақын залдар, спорттық тамақтану орындары және дүкендер көрсетіледі.",
    searchPlaceholder: "Зал, тамақтану, дүкен іздеу...",
    mapPreview: "Карта көрінісі",
    mapHint: "Кейін мұнда нақты карта қосылады",
    categories: "Санаттар",
    sort: "Сұрыптау",
    nearbyTitle: "Жақын орындар",
    bestRated: "Рейтинг бойынша",
    sortByName: "Атауы бойынша",
    openRoute: "Маршрут ашу",
    noAddress: "Мекенжай қолжетімсіз",
    noResultsTitle: "Ештеңе табылмады",
    noResultsMessage: "Басқа іздеу енгізіп көр немесе санатты өзгерт.",
    futureMapTitle: "Нақты картаға дайын",
    futureMapText:
      "Кейін Expo Location және Google Places API қосып, жақын залдарды, спорттық тамақтану орындарын және дүкендерді рейтинг бойынша көрсетуге болады.",
    results: "нәтиже",
    result: "нәтиже",
    all: "Барлығы",
    gym: "Залдар",
    nutrition: "Тамақтану",
    shop: "Дүкендер",
    distanceSoon: "Қашықтық геолокациядан кейін",
  },
};

function getLocalText(lang: string) {
  if (lang === "ru") return LOCAL_TEXT.ru;
  if (lang === "kk") return LOCAL_TEXT.kk;
  return LOCAL_TEXT.en;
}

function getPlaceRating(place: ExtendedPlace) {
  const rating = Number(place.rating ?? 0);
  return Number.isFinite(rating) ? rating : 0;
}

function getPlaceSearchText(place: ExtendedPlace) {
  return [
    place.name,
    place.address,
    place.description,
    place.type,
    place.workingHours,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function buildMapsUrl(place: ExtendedPlace) {
  if (
    typeof place.latitude === "number" &&
    typeof place.longitude === "number"
  ) {
    return `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
  }

  const query = encodeURIComponent(
    [place.name, place.address].filter(Boolean).join(" "),
  );

  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function formatDistance(place: ExtendedPlace) {
  if (place.distanceKm === undefined || place.distanceKm === null) return null;

  const distance = Number(place.distanceKm);

  if (!Number.isFinite(distance)) return null;

  if (distance < 1) return `${Math.round(distance * 1000)} m`;

  return `${distance.toFixed(1)} km`;
}

export default function Explore() {
  const { theme } = useTheme();
  const { lang } = useI18n();
  const { db } = useData();

  const txt = getLocalText(lang);

  const [filter, setFilter] = useState<FilterType>("all");
  const [sortMode, setSortMode] = useState<SortMode>("rating");
  const [query, setQuery] = useState("");

  const places = useMemo(() => {
    if (!db?.places) return [];
    return db.places as ExtendedPlace[];
  }, [db]);

  const items = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return places
      .filter((place) => {
        if (filter !== "all" && place.type !== filter) return false;

        if (!normalizedQuery) return true;

        return getPlaceSearchText(place).includes(normalizedQuery);
      })
      .slice()
      .sort((a, b) => {
        if (sortMode === "name") {
          return a.name.localeCompare(b.name);
        }

        const ratingDiff = getPlaceRating(b) - getPlaceRating(a);

        if (ratingDiff !== 0) return ratingDiff;

        return a.name.localeCompare(b.name);
      });
  }, [places, filter, sortMode, query]);

  const topPlace = useMemo(() => {
    if (items.length === 0) return null;

    return items
      .slice()
      .sort((a, b) => getPlaceRating(b) - getPlaceRating(a))[0];
  }, [items]);

  const resultLabel = items.length === 1 ? txt.result : txt.results;

  const iconFor = (type: Place["type"], size = 16) => {
    if (type === "gym") {
      return <Dumbbell color={theme.colors.primary} size={size} />;
    }

    if (type === "nutrition") {
      return <Salad color={theme.colors.success} size={size} />;
    }

    return <ShoppingBag color={theme.colors.accent} size={size} />;
  };

  const labelForFilter = (value: FilterType) => {
    if (value === "all") return txt.all;
    if (value === "gym") return txt.gym;
    if (value === "nutrition") return txt.nutrition;
    return txt.shop;
  };

  const labelForPlaceType = (type: Place["type"]) => {
    if (type === "gym") return txt.gym;
    if (type === "nutrition") return txt.nutrition;
    return txt.shop;
  };

  const openPlaceInMaps = async (place: ExtendedPlace) => {
    const url = buildMapsUrl(place);

    try {
      await Linking.openURL(url);
    } catch (error) {
      console.log("[explore] open maps error", error);
    }
  };

  const ListHeader = () => (
    <View>
      <SectionHeader
        title={txt.title}
        icon={<MapPin color={theme.colors.primary} size={18} />}
      />

      <AppCard variant="elevated">
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 50,
                height: 50,
                borderRadius: 18,
                backgroundColor: "rgba(82,118,255,0.14)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Compass color={theme.colors.primary} size={25} />
            </View>

            <View style={{ flex: 1 }}>
              <AppText variant="h3">{txt.heroTitle}</AppText>

              <AppText
                variant="small"
                color={theme.colors.textMuted}
                style={{ marginTop: 3 }}
              >
                {txt.heroSubtitle}
              </AppText>
            </View>
          </View>

          <View
            style={{
              minHeight: 50,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.inputBg,
              borderWidth: 1,
              borderColor: theme.colors.borderSoft,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 13,
              gap: 9,
            }}
          >
            <Search color={theme.colors.textMuted} size={18} />

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={txt.searchPlaceholder}
              placeholderTextColor={theme.colors.textFaint}
              autoCapitalize="none"
              style={{
                flex: 1,
                color: theme.colors.text,
                fontSize: 14,
                paddingVertical: 10,
              }}
            />
          </View>
        </View>
      </AppCard>

      <View
        style={{
          height: 190,
          borderRadius: 26,
          backgroundColor: theme.colors.surfaceAlt,
          marginTop: 14,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: theme.colors.borderSoft,
        }}
      >
        <Image
          source={{
            uri: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1200",
          }}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            opacity: 0.45,
          }}
          contentFit="cover"
        />

        <View
          style={{
            position: "absolute",
            left: 14,
            right: 14,
            top: 14,
            flexDirection: "row",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <View
            style={{
              paddingHorizontal: 11,
              paddingVertical: 7,
              borderRadius: 999,
              backgroundColor: "rgba(0,0,0,0.36)",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Navigation color="#FFFFFF" size={14} />

            <AppText
              variant="caption"
              style={{ color: "#FFFFFF", fontWeight: "800" }}
            >
              {items.length} {resultLabel}
            </AppText>
          </View>

          {topPlace ? (
            <View
              style={{
                maxWidth: 170,
                paddingHorizontal: 11,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: "rgba(0,0,0,0.36)",
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Star color="#FFD166" fill="#FFD166" size={14} />

              <AppText
                variant="caption"
                numberOfLines={1}
                style={{ color: "#FFFFFF", fontWeight: "800" }}
              >
                {topPlace.name}
              </AppText>
            </View>
          ) : null}
        </View>

        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 22,
          }}
        >
          <View
            style={{
              width: 62,
              height: 62,
              borderRadius: 23,
              backgroundColor: "rgba(255,255,255,0.22)",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.30)",
            }}
          >
            <MapPin color={theme.colors.text} size={30} />
          </View>

          <AppText
            variant="bodyStrong"
            style={{
              marginTop: 10,
              textAlign: "center",
            }}
          >
            {txt.mapPreview}
          </AppText>

          <AppText
            variant="small"
            color={theme.colors.textMuted}
            style={{
              textAlign: "center",
              marginTop: 3,
            }}
          >
            {txt.mapHint}
          </AppText>
        </View>
      </View>

      <View style={{ marginTop: 15 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 7,
            marginBottom: 9,
          }}
        >
          <Filter color={theme.colors.textMuted} size={16} />

          <AppText variant="caption" color={theme.colors.textMuted}>
            {txt.categories}
          </AppText>
        </View>

        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {FILTERS.map((item) => (
            <AppChip
              key={item}
              label={labelForFilter(item)}
              active={filter === item}
              onPress={() => setFilter(item)}
            />
          ))}
        </View>
      </View>

      <View style={{ marginTop: 13 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 7,
            marginBottom: 9,
          }}
        >
          <SlidersHorizontal color={theme.colors.textMuted} size={16} />

          <AppText variant="caption" color={theme.colors.textMuted}>
            {txt.sort}
          </AppText>
        </View>

        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {SORTS.map((item) => (
            <AppChip
              key={item}
              label={item === "rating" ? txt.bestRated : txt.sortByName}
              active={sortMode === item}
              onPress={() => setSortMode(item)}
            />
          ))}
        </View>
      </View>

      <AppCard variant="outline" style={{ marginTop: 15 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 15,
              backgroundColor: "rgba(82,118,255,0.12)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Navigation color={theme.colors.primary} size={19} />
          </View>

          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">{txt.futureMapTitle}</AppText>

            <AppText
              variant="small"
              color={theme.colors.textMuted}
              style={{ marginTop: 3 }}
            >
              {txt.futureMapText}
            </AppText>
          </View>
        </View>
      </AppCard>

      <View
        style={{
          marginTop: 18,
          marginBottom: 11,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <AppText variant="h3">{txt.nearbyTitle}</AppText>

        <AppText variant="caption" color={theme.colors.textMuted}>
          {items.length} {resultLabel}
        </AppText>
      </View>
    </View>
  );

  return (
    <ScreenContainer>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={<ListHeader />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingBottom: 120,
        }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <AppEmptyState
            title={txt.noResultsTitle}
            message={txt.noResultsMessage}
          />
        }
        renderItem={({ item }) => {
          const distance = formatDistance(item);
          const rating = getPlaceRating(item);

          return (
            <AppCard variant="elevated" padded={false}>
              {item.imageUrl ? (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={{
                    height: 158,
                    width: "100%",
                  }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <View
                  style={{
                    height: 158,
                    width: "100%",
                    backgroundColor: theme.colors.surfaceAlt,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {iconFor(item.type, 32)}
                </View>
              )}

              <View style={{ padding: 14, gap: 9 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {iconFor(item.type)}

                  <AppText variant="caption" color={theme.colors.textMuted}>
                    {labelForPlaceType(item.type)}
                  </AppText>

                  <View style={{ flex: 1 }} />

                  {rating > 0 ? (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 3,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor: theme.colors.surfaceAlt,
                      }}
                    >
                      <Star
                        color={theme.colors.fire}
                        size={14}
                        fill={theme.colors.fire}
                      />

                      <AppText variant="small" style={{ fontWeight: "800" }}>
                        {rating.toFixed(1)}
                      </AppText>
                    </View>
                  ) : null}
                </View>

                <AppText variant="h3">{item.name}</AppText>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 6,
                  }}
                >
                  <MapPin color={theme.colors.textMuted} size={15} />

                  <AppText
                    variant="small"
                    color={theme.colors.textMuted}
                    style={{ flex: 1 }}
                  >
                    {item.address || txt.noAddress}
                  </AppText>
                </View>

                {distance ? (
                  <AppText variant="caption" color={theme.colors.textFaint}>
                    {distance}
                  </AppText>
                ) : (
                  <AppText variant="caption" color={theme.colors.textFaint}>
                    {txt.distanceSoon}
                  </AppText>
                )}

                {item.description ? (
                  <AppText
                    variant="small"
                    color={theme.colors.textMuted}
                    numberOfLines={2}
                  >
                    {item.description}
                  </AppText>
                ) : null}

                {item.workingHours ? (
                  <AppText variant="caption" color={theme.colors.textFaint}>
                    {item.workingHours}
                  </AppText>
                ) : null}

                <Pressable
                  onPress={() => openPlaceInMaps(item)}
                  style={{
                    marginTop: 5,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderRadius: theme.radius.md,
                    backgroundColor: theme.colors.primary,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <ExternalLink color="#FFFFFF" size={16} />

                  <AppText
                    variant="small"
                    style={{
                      color: "#FFFFFF",
                      fontWeight: "800",
                    }}
                  >
                    {txt.openRoute}
                  </AppText>
                </Pressable>
              </View>
            </AppCard>
          );
        }}
      />
    </ScreenContainer>
  );
}