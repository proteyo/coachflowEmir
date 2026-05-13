import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import {
  Compass,
  Dumbbell,
  ExternalLink,
  LocateFixed,
  MapPin,
  Navigation,
  RefreshCw,
  Salad,
  Search,
  ShoppingBag,
  Star,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Region } from "react-native-maps";

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

type PlaceType = "gym" | "nutrition" | "shop";
type FilterType = "all" | PlaceType;
type SortMode = "distance" | "rating" | "name";

type UserLocation = {
  latitude: number;
  longitude: number;
};

type ExtendedPlace = Omit<Place, "type"> & {
  type: PlaceType;
  distanceKm?: number;
  phone?: string;
  website?: string;
  workingHours?: string;
  source?: "backend" | "local";
};

const TOKEN_KEY = "coachflow:token";
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

const FILTERS: FilterType[] = ["all", "gym", "nutrition", "shop"];
const SORTS: SortMode[] = ["distance", "rating", "name"];

const DEFAULT_REGION: Region = {
  latitude: 43.238949,
  longitude: 76.889709,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const LOCAL_TEXT = {
  en: {
    title: "Explore",
    heroTitle: "Find places near you",
    heroSubtitle:
      "Discover nearby gyms, healthy nutrition spots and sport shops based on your current location.",
    searchPlaceholder: "Search gyms, nutrition, shops...",
    mapHint: "Allow location access to show places around you.",
    categories: "Categories",
    sort: "Sort",
    nearbyTitle: "Nearby places",
    distance: "Nearest",
    bestRated: "Best rated",
    sortByName: "By name",
    openRoute: "Open route",
    useMyLocation: "Use my location",
    noAddress: "Address is not available",
    noResultsTitle: "No places found",
    noResultsMessage:
      "Try another search, change category, or refresh nearby places.",
    results: "results",
    result: "result",
    all: "All",
    gym: "Gyms",
    nutrition: "Nutrition",
    shop: "Shops",
    distanceSoon: "Distance unavailable",
    loadingLocation: "Getting your location...",
    loadingPlaces: "Loading nearby places...",
    locationDenied:
      "Location permission was denied. You can still browse saved places.",
    backendFallback:
      "Nearby search is not available yet. Showing saved places from CoachFlow.",
    routeUnavailable: "Route is unavailable for this place.",
  },
  ru: {
    title: "Карта",
    heroTitle: "Найди места рядом",
    heroSubtitle:
      "Показываем ближайшие залы, места со здоровым питанием и спортивные магазины по твоей геолокации.",
    searchPlaceholder: "Поиск залов, питания, магазинов...",
    mapHint: "Разреши геолокацию, чтобы показать места рядом с тобой.",
    categories: "Категории",
    sort: "Сортировка",
    nearbyTitle: "Ближайшие места",
    distance: "Ближайшие",
    bestRated: "По рейтингу",
    sortByName: "По названию",
    openRoute: "Маршрут",
    useMyLocation: "Моя геолокация",
    noAddress: "Адрес недоступен",
    noResultsTitle: "Ничего не найдено",
    noResultsMessage:
      "Попробуй другой поиск, категорию или обнови места рядом.",
    results: "результатов",
    result: "результат",
    all: "Все",
    gym: "Залы",
    nutrition: "Питание",
    shop: "Магазины",
    distanceSoon: "Расстояние недоступно",
    loadingLocation: "Получаем геолокацию...",
    loadingPlaces: "Загружаем места рядом...",
    locationDenied:
      "Доступ к геолокации запрещён. Можно смотреть сохранённые места.",
    backendFallback:
      "Поиск мест рядом пока недоступен. Показываем сохранённые места CoachFlow.",
    routeUnavailable: "Маршрут для этого места недоступен.",
  },
  kk: {
    title: "Карта",
    heroTitle: "Жақын орындарды тап",
    heroSubtitle:
      "Геолокация бойынша жақын залдарды, дұрыс тамақтану орындарын және спорт дүкендерін көрсетеміз.",
    searchPlaceholder: "Зал, тамақтану, дүкен іздеу...",
    mapHint: "Жақын орындарды көру үшін геолокацияға рұқсат бер.",
    categories: "Санаттар",
    sort: "Сұрыптау",
    nearbyTitle: "Жақын орындар",
    distance: "Жақындары",
    bestRated: "Рейтинг бойынша",
    sortByName: "Атауы бойынша",
    openRoute: "Маршрут",
    useMyLocation: "Менің геолокациям",
    noAddress: "Мекенжай қолжетімсіз",
    noResultsTitle: "Ештеңе табылмады",
    noResultsMessage:
      "Басқа іздеу енгізіп көр, санатты өзгерт немесе жаңарт.",
    results: "нәтиже",
    result: "нәтиже",
    all: "Барлығы",
    gym: "Залдар",
    nutrition: "Тамақтану",
    shop: "Дүкендер",
    distanceSoon: "Қашықтық қолжетімсіз",
    loadingLocation: "Геолокация алынуда...",
    loadingPlaces: "Жақын орындар жүктелуде...",
    locationDenied:
      "Геолокацияға рұқсат берілмеді. Сақталған орындарды көре аласың.",
    backendFallback:
      "Жақын орындарды іздеу әзірше қолжетімсіз. CoachFlow сақталған орындарын көрсетеміз.",
    routeUnavailable: "Бұл орын үшін маршрут қолжетімсіз.",
  },
};

function getLocalText(lang: string) {
  if (lang === "ru") return LOCAL_TEXT.ru;
  if (lang === "kk") return LOCAL_TEXT.kk;

  return LOCAL_TEXT.en;
}

function getThemeColor(theme: any, key: string, fallback: string): string {
  return theme?.colors?.[key] ?? theme?.[key] ?? fallback;
}

function normalizeType(value: unknown): PlaceType {
  if (value === "gym" || value === "nutrition" || value === "shop") {
    return value;
  }

  return "gym";
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
    place.phone,
    place.website,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function calculateDistanceKm(
  from: UserLocation,
  to: { latitude?: number; longitude?: number },
): number | undefined {
  if (typeof to.latitude !== "number" || typeof to.longitude !== "number") {
    return undefined;
  }

  const earthRadiusKm = 6371;

  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);

  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) *
      Math.sin(dLng / 2) *
      Math.cos(lat1) *
      Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function formatDistance(place: ExtendedPlace) {
  if (place.distanceKm === undefined || place.distanceKm === null) {
    return null;
  }

  const distance = Number(place.distanceKm);

  if (!Number.isFinite(distance)) {
    return null;
  }

  if (distance < 1) {
    return `${Math.round(distance * 1000)} m`;
  }

  return `${distance.toFixed(1)} km`;
}

function buildMapsUrl(place: ExtendedPlace) {
  if (
    typeof place.latitude === "number" &&
    typeof place.longitude === "number"
  ) {
    return `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}&travelmode=walking`;
  }

  const query = encodeURIComponent(
    [place.name, place.address].filter(Boolean).join(" "),
  );

  if (!query) {
    return null;
  }

  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function getPlaceIcon(type: PlaceType) {
  if (type === "nutrition") return Salad;
  if (type === "shop") return ShoppingBag;

  return Dumbbell;
}

function normalizeBackendPlace(place: any): ExtendedPlace {
  const latitude = Number(
    place.latitude ?? place.lat ?? place.location?.lat ?? 0,
  );

  const longitude = Number(
    place.longitude ?? place.lng ?? place.location?.lng ?? 0,
  );

  const distanceRaw = place.distanceKm ?? place.distance_km;

  return {
    id: String(place.id ?? place.place_id ?? `${place.name}-${place.address}`),
    type: normalizeType(place.type),
    name: String(place.name ?? "Unknown place"),
    address: String(
      place.address ?? place.vicinity ?? place.formatted_address ?? "",
    ),
    latitude: Number.isFinite(latitude) ? latitude : 0,
    longitude: Number.isFinite(longitude) ? longitude : 0,
    description: place.description ?? undefined,
    imageUrl: place.imageUrl ?? place.image_url ?? place.photoUrl ?? undefined,
    rating:
      place.rating === undefined || place.rating === null
        ? undefined
        : Number(place.rating),
    distanceKm:
      distanceRaw === undefined || distanceRaw === null
        ? undefined
        : Number(distanceRaw),
    phone: place.phone ?? place.formatted_phone_number ?? undefined,
    website: place.website ?? undefined,
    workingHours:
      place.workingHours ??
      place.working_hours ??
      place.opening_hours?.weekday_text?.join(", ") ??
      undefined,
    source: "backend",
  };
}

async function fetchNearbyPlaces(input: {
  location: UserLocation;
  type: FilterType;
}): Promise<ExtendedPlace[] | null> {
  if (!API_URL) {
    return null;
  }

  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);

    const params = new URLSearchParams({
      lat: String(input.location.latitude),
      lng: String(input.location.longitude),
    });

    if (input.type !== "all") {
      params.set("type", input.type);
    }

    const response = await fetch(`${API_URL}/places/nearby?${params}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();

    const rawItems = Array.isArray(json)
      ? json
      : Array.isArray(json?.items)
        ? json.items
        : Array.isArray(json?.data)
          ? json.data
          : [];

    return rawItems.map(normalizeBackendPlace);
  } catch (error) {
    console.log("[explore] nearby load failed", error);

    return null;
  }
}

export default function Explore() {
  const { theme } = useTheme();
  const { lang } = useI18n();
  const { db } = useData();

  const mapRef = useRef<MapView | null>(null);

  const txt = getLocalText(lang);

  const background = getThemeColor(theme, "background", "#F8FAFC");
  const card = getThemeColor(theme, "card", "#FFFFFF");
  const text = getThemeColor(theme, "text", "#0F172A");
  const muted = getThemeColor(theme, "muted", "#64748B");
  const border = getThemeColor(theme, "border", "#E2E8F0");
  const primary = getThemeColor(theme, "primary", "#2563EB");

  const [filter, setFilter] = useState<FilterType>("all");
  const [sortMode, setSortMode] = useState<SortMode>("distance");
  const [query, setQuery] = useState("");

  const [location, setLocation] = useState<UserLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);

  const [nearbyPlaces, setNearbyPlaces] = useState<ExtendedPlace[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);

  const localPlaces = useMemo<ExtendedPlace[]>(() => {
    if (!db?.places) {
      return [];
    }

    return db.places.map((place) => {
      const typedPlace: ExtendedPlace = {
        ...place,
        type: normalizeType(place.type),
        source: "local",
      };

      const distanceKm = location
        ? calculateDistanceKm(location, {
            latitude: typedPlace.latitude,
            longitude: typedPlace.longitude,
          })
        : typedPlace.distanceKm;

      return {
        ...typedPlace,
        distanceKm,
      };
    });
  }, [db, location]);

  const loadLocation = useCallback(async () => {
    try {
      setLoadingLocation(true);
      setLocationError(null);

      const currentPermission = await Location.getForegroundPermissionsAsync();

      let permission = currentPermission;

      if (!currentPermission.granted) {
        permission = await Location.requestForegroundPermissionsAsync();
      }

      if (!permission.granted) {
        setLocationError(txt.locationDenied);
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const nextLocation = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };

      setLocation(nextLocation);

      mapRef.current?.animateToRegion(
        {
          ...nextLocation,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        },
        600,
      );
    } catch (error) {
      console.log("[explore] location error", error);
      setLocationError(txt.locationDenied);
    } finally {
      setLoadingLocation(false);
    }
  }, [txt.locationDenied]);

  const loadNearby = useCallback(async () => {
    if (!location) {
      return;
    }

    try {
      setLoadingPlaces(true);

      const remotePlaces = await fetchNearbyPlaces({
        location,
        type: filter,
      });

      if (remotePlaces && remotePlaces.length > 0) {
        const withDistances = remotePlaces.map((place) => ({
          ...place,
          distanceKm:
            place.distanceKm ??
            calculateDistanceKm(location, {
              latitude: place.latitude,
              longitude: place.longitude,
            }),
        }));

        setNearbyPlaces(withDistances);
        setUsingFallback(false);
      } else {
        setNearbyPlaces([]);
        setUsingFallback(true);
      }
    } finally {
      setLoadingPlaces(false);
    }
  }, [filter, location]);

  useEffect(() => {
    loadLocation();
  }, [loadLocation]);

  useEffect(() => {
    loadNearby();
  }, [loadNearby]);

  const sourcePlaces = nearbyPlaces.length > 0 ? nearbyPlaces : localPlaces;

  const items = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return sourcePlaces
      .filter((place) => {
        if (filter !== "all" && place.type !== filter) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        return getPlaceSearchText(place).includes(normalizedQuery);
      })
      .slice()
      .sort((a, b) => {
        if (sortMode === "name") {
          return a.name.localeCompare(b.name);
        }

        if (sortMode === "distance") {
          const aDistance = a.distanceKm ?? Number.POSITIVE_INFINITY;
          const bDistance = b.distanceKm ?? Number.POSITIVE_INFINITY;

          if (aDistance !== bDistance) {
            return aDistance - bDistance;
          }
        }

        const ratingDiff = getPlaceRating(b) - getPlaceRating(a);

        if (ratingDiff !== 0) {
          return ratingDiff;
        }

        return a.name.localeCompare(b.name);
      });
  }, [sourcePlaces, filter, sortMode, query]);

  const mapRegion = useMemo<Region>(() => {
    if (location) {
      return {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      };
    }

    const firstWithCoordinates = items.find(
      (item) =>
        typeof item.latitude === "number" &&
        typeof item.longitude === "number",
    );

    if (firstWithCoordinates) {
      return {
        latitude: firstWithCoordinates.latitude,
        longitude: firstWithCoordinates.longitude,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      };
    }

    return DEFAULT_REGION;
  }, [items, location]);

  const resultLabel = items.length === 1 ? txt.result : txt.results;

  const openRoute = useCallback(
    async (place: ExtendedPlace) => {
      const url = buildMapsUrl(place);

      if (!url) {
        console.log("[explore]", txt.routeUnavailable);
        return;
      }

      const supported = await Linking.canOpenURL(url);

      if (supported || Platform.OS !== "web") {
        await Linking.openURL(url);
      }
    },
    [txt.routeUnavailable],
  );

  const centerToUser = useCallback(() => {
    if (!location) {
      loadLocation();
      return;
    }

    mapRef.current?.animateToRegion(
      {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      },
      600,
    );
  }, [loadLocation, location]);

  return (
    <ScreenContainer>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ gap: 16 }}>
            <View style={{ gap: 8 }}>
              <AppText variant="title">{txt.title}</AppText>
              <AppText variant="body" color={muted}>
                {txt.heroSubtitle}
              </AppText>
            </View>

            <AppCard>
              <View style={{ gap: 14 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1, gap: 4 }}>
                    <AppText variant="h3">{txt.heroTitle}</AppText>
                    <AppText variant="caption" color={muted}>
                      {location
                        ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
                        : txt.mapHint}
                    </AppText>
                  </View>

                  <Compass color={primary} size={26} />
                </View>

                <View
                  style={{
                    borderRadius: 24,
                    borderWidth: 1,
                    borderColor: border,
                    overflow: "hidden",
                    height: 260,
                    backgroundColor: background,
                  }}
                >
                  <MapView
                    ref={mapRef}
                    provider={
                      Platform.OS === "android" ? PROVIDER_GOOGLE : undefined
                    }
                    style={{ flex: 1 }}
                    initialRegion={mapRegion}
                    region={mapRegion}
                    showsUserLocation={!!location}
                    showsMyLocationButton={false}
                    showsCompass
                    toolbarEnabled={false}
                  >
                    {items
                      .filter(
                        (place) =>
                          typeof place.latitude === "number" &&
                          typeof place.longitude === "number",
                      )
                      .slice(0, 40)
                      .map((place) => {
                        const Icon = getPlaceIcon(place.type);

                        return (
                          <Marker
                            key={`marker-${place.id}`}
                            coordinate={{
                              latitude: Number(place.latitude),
                              longitude: Number(place.longitude),
                            }}
                            title={place.name}
                            description={place.address}
                            onPress={() => openRoute(place)}
                          >
                            <View
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: 19,
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: card,
                                borderWidth: 2,
                                borderColor: primary,
                              }}
                            >
                              <Icon color={primary} size={18} />
                            </View>
                          </Marker>
                        );
                      })}
                  </MapView>

                  {(loadingLocation || loadingPlaces) && (
                    <View
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: 0,
                        bottom: 0,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "rgba(15, 23, 42, 0.22)",
                      }}
                    >
                      <View
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderRadius: 999,
                          backgroundColor: card,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <ActivityIndicator />
                        <AppText variant="body">
                          {loadingLocation
                            ? txt.loadingLocation
                            : txt.loadingPlaces}
                        </AppText>
                      </View>
                    </View>
                  )}

                  <Pressable
                    onPress={centerToUser}
                    style={{
                      position: "absolute",
                      right: 14,
                      bottom: 14,
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: card,
                      borderWidth: 1,
                      borderColor: border,
                    }}
                  >
                    <LocateFixed color={primary} size={21} />
                  </Pressable>
                </View>

                {locationError ? (
                  <AppText variant="caption" color={muted}>
                    {locationError}
                  </AppText>
                ) : null}

                {usingFallback ? (
                  <AppText variant="caption" color={muted}>
                    {txt.backendFallback}
                  </AppText>
                ) : null}

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable
                    onPress={loadLocation}
                    style={{
                      flex: 1,
                      borderRadius: 18,
                      paddingVertical: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: primary,
                      flexDirection: "row",
                      gap: 8,
                    }}
                  >
                    <Navigation color="#FFFFFF" size={18} />
                    <AppText variant="bodyStrong" color="#FFFFFF">
                      {txt.useMyLocation}
                    </AppText>
                  </Pressable>

                  <Pressable
                    onPress={loadNearby}
                    style={{
                      borderRadius: 18,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: card,
                      borderWidth: 1,
                      borderColor: border,
                    }}
                  >
                    <RefreshCw color={primary} size={18} />
                  </Pressable>
                </View>
              </View>
            </AppCard>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderWidth: 1,
                borderColor: border,
                borderRadius: 18,
                paddingHorizontal: 14,
                backgroundColor: card,
              }}
            >
              <Search color={muted} size={18} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={txt.searchPlaceholder}
                placeholderTextColor={muted}
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  paddingHorizontal: 10,
                  color: text,
                }}
              />
            </View>

            <View style={{ gap: 10 }}>
              <SectionHeader title={txt.categories} />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {FILTERS.map((item) => (
                  <AppChip
                    key={item}
                    label={txt[item]}
                    active={filter === item}
                    onPress={() => setFilter(item)}
                  />
                ))}
              </View>
            </View>

            <View style={{ gap: 10 }}>
              <SectionHeader title={txt.sort} />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {SORTS.map((item) => (
                  <AppChip
                    key={item}
                    label={
                      item === "distance"
                        ? txt.distance
                        : item === "rating"
                          ? txt.bestRated
                          : txt.sortByName
                    }
                    active={sortMode === item}
                    onPress={() => setSortMode(item)}
                  />
                ))}
              </View>
            </View>

            <SectionHeader
  title={txt.nearbyTitle}
  action={
    <AppText variant="caption" color={muted}>
      {items.length} {resultLabel}
    </AppText>
  }
/>
          </View>
        }
        renderItem={({ item }) => {
          const Icon = getPlaceIcon(item.type);
          const distance = formatDistance(item);

          return (
            <AppCard style={{ marginTop: 12 }}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: 22,
                    overflow: "hidden",
                    backgroundColor: background,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: border,
                  }}
                >
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                  ) : (
                    <Icon color={primary} size={30} />
                  )}
                </View>

                <View style={{ flex: 1, gap: 7 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyStrong">{item.name}</AppText>
                      <AppText
                        variant="caption"
                        color={muted}
                        numberOfLines={2}
                      >
                        {item.address || txt.noAddress}
                      </AppText>
                    </View>

                    {getPlaceRating(item) > 0 ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Star color="#F59E0B" size={15} fill="#F59E0B" />
                        <AppText variant="caption">
                          {getPlaceRating(item).toFixed(1)}
                        </AppText>
                      </View>
                    ) : null}
                  </View>

                  {item.description ? (
                    <AppText
                      variant="caption"
                      color={muted}
                      numberOfLines={2}
                    >
                      {item.description}
                    </AppText>
                  ) : null}

                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                        paddingHorizontal: 9,
                        paddingVertical: 5,
                        borderRadius: 999,
                        backgroundColor: background,
                      }}
                    >
                      <MapPin color={muted} size={14} />
                      <AppText variant="caption" color={muted}>
                        {distance ?? txt.distanceSoon}
                      </AppText>
                    </View>

                    <Pressable
                      onPress={() => openRoute(item)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: primary,
                      }}
                    >
                      <ExternalLink color="#FFFFFF" size={14} />
                      <AppText variant="caption" color="#FFFFFF">
                        {txt.openRoute}
                      </AppText>
                    </Pressable>
                  </View>
                </View>
              </View>
            </AppCard>
          );
        }}
        ListEmptyComponent={
          <AppEmptyState
            title={txt.noResultsTitle}
            message={txt.noResultsMessage}
          />
        }
        contentContainerStyle={{ paddingBottom: 120 }}
      />
    </ScreenContainer>
  );
}