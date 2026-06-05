import React, { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGrad,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import { useTheme } from "@/src/context/ThemeContext";
import { useI18n } from "@/src/i18n/I18nContext";

type WeightChartItem = {
  date?: string;
  createdAt?: string;
  created_at?: string;
  weight?: number | string;
};

type NormalizedWeightEntry = {
  date: string;
  time: number;
  weight: number;
};

type ChartTexts = {
  noDataTitle: string;
  noDataSubtitle: string;
  max: string;
  min: string;
  change: string;
  latest: string;
  entries: string;
};

type PercentageChartItem = {
  label: string;
  rate?: number;
  value?: number;
  attended?: number;
  missed?: number;
  rest?: number;
  taken?: number;
  skipped?: number;
  total?: number;
};

type VolumeChartItem = {
  label: string;
  value: number;
  subtitle?: string;
  meta?: string;
  unit?: string;
  previous?: number;
};

type PerformancePoint = {
  label: string;
  date?: string;
  value: number;
  reps?: number;
  weight?: number;
  volume?: number;
};

type RepRangeChartItem = {
  label: string;
  current: number;
  previous?: number;
  unit?: string;
  meta?: string;
};

type TrendChartTexts = {
  emptyTitle: string;
  emptySubtitle: string;
  attended: string;
  missed: string;
  rest: string;
  taken: string;
  skipped: string;
  volume: string;
  best: string;
  latest: string;
  previous: string;
  change: string;
  average: string;
  noWeightedData: string;
  current: string;
};

function getLocale(lang?: string) {
  if (lang === "ru") return "ru-RU";
  if (lang === "kk") return "kk-KZ";

  return "en-US";
}

function getWeightUnit(lang?: string) {
  if (lang === "ru" || lang === "kk") return "кг";

  return "kg";
}

function getChartTexts(lang?: string): ChartTexts {
  if (lang === "ru") {
    return {
      noDataTitle: "Данных о весе пока нет",
      noDataSubtitle: "Добавьте первую запись, чтобы увидеть динамику",
      max: "макс.",
      min: "мин.",
      change: "изменение",
      latest: "последний",
      entries: "записей",
    };
  }

  if (lang === "kk") {
    return {
      noDataTitle: "Салмақ деректері әлі жоқ",
      noDataSubtitle: "Динамиканы көру үшін алғашқы жазбаны қосыңыз",
      max: "макс.",
      min: "мин.",
      change: "өзгеріс",
      latest: "соңғы",
      entries: "жазба",
    };
  }

  return {
    noDataTitle: "No weight data yet",
    noDataSubtitle: "Add a weight entry to see progress",
    max: "max",
    min: "min",
    change: "change",
    latest: "latest",
    entries: "entries",
  };
}

function getTrendChartTexts(lang?: string): TrendChartTexts {
  if (lang === "ru") {
    return {
      emptyTitle: "Данных пока нет",
      emptySubtitle: "Когда появятся записи, график обновится автоматически",
      attended: "посетил",
      missed: "пропустил",
      rest: "отдых",
      taken: "принял",
      skipped: "пропустил",
      volume: "объём",
      best: "лучший",
      latest: "последний",
      previous: "раньше",
      change: "изменение",
      average: "среднее",
      noWeightedData: "Нет данных с рабочим весом",
      current: "сейчас",
    };
  }

  if (lang === "kk") {
    return {
      emptyTitle: "Деректер әлі жоқ",
      emptySubtitle: "Жазбалар пайда болғанда график автоматты түрде жаңарады",
      attended: "қатысты",
      missed: "өткізді",
      rest: "демалыс",
      taken: "қабылдады",
      skipped: "өткізді",
      volume: "көлем",
      best: "үздік",
      latest: "соңғы",
      previous: "бұрын",
      change: "өзгеріс",
      average: "орташа",
      noWeightedData: "Жұмыс салмағы бойынша дерек жоқ",
      current: "қазір",
    };
  }

  return {
    emptyTitle: "No data yet",
    emptySubtitle: "The chart will update automatically after new entries",
    attended: "attended",
    missed: "missed",
    rest: "rest",
    taken: "taken",
    skipped: "skipped",
    volume: "volume",
    best: "best",
    latest: "latest",
    previous: "previous",
    change: "change",
    average: "average",
    noWeightedData: "No weighted data",
    current: "current",
  };
}

function getEntryDate(entry: WeightChartItem) {
  return entry.date ?? entry.createdAt ?? entry.created_at ?? "";
}

function getEntryTime(entry: WeightChartItem) {
  const rawDate = getEntryDate(entry);

  if (!rawDate) return 0;

  const time = new Date(rawDate).getTime();

  if (Number.isNaN(time)) return 0;

  return time;
}

function normalizeWeightEntry(entry: WeightChartItem): NormalizedWeightEntry | null {
  const weight = Number(entry.weight);
  const date = getEntryDate(entry);
  const time = getEntryTime(entry);

  if (!Number.isFinite(weight) || weight <= 0 || !date || !time) {
    return null;
  }

  return { date, time, weight };
}

function formatNumber(value: number, digits = 0) {
  if (!Number.isFinite(value)) return "—";

  if (Number.isInteger(value)) return String(value);

  return value.toFixed(digits);
}

function formatWeight(value: number) {
  if (!Number.isFinite(value)) return "—";

  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatWeightWithUnit(value: number, lang?: string) {
  if (!Number.isFinite(value)) return "—";

  return `${formatWeight(value)} ${getWeightUnit(lang)}`;
}

function formatShortDate(value: string, lang?: string) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.includes("T") ? value.slice(0, 10) : value;
  }

  return date.toLocaleDateString(getLocale(lang), {
    month: "short",
    day: "numeric",
  });
}

function formatFullDate(value: string, lang?: string) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.includes("T") ? value.slice(0, 10) : value;
  }

  return date.toLocaleDateString(getLocale(lang), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function buildLinePath(points: { x: number; y: number }[]) {
  if (points.length <= 1) return "";

  return points
    .map((point, index) =>
      index === 0 ? `M${point.x},${point.y}` : `L${point.x},${point.y}`,
    )
    .join(" ");
}

function getChartSummary(data: NormalizedWeightEntry[], lang?: string) {
  const first = data[0];
  const last = data[data.length - 1];
  const diff = last.weight - first.weight;

  return {
    first,
    last,
    diff,
    diffLabel: `${diff >= 0 ? "+" : ""}${formatWeightWithUnit(diff, lang)}`,
  };
}

function filterByRange(data: NormalizedWeightEntry[], rangeDays?: number) {
  if (!rangeDays || data.length === 0) return data;

  const lastTime = data[data.length - 1].time;
  const startTime = lastTime - rangeDays * 24 * 60 * 60 * 1000;

  return data.filter((item) => item.time >= startTime);
}

function thinChartData<T>(data: T[], maxPoints = 12) {
  if (data.length <= maxPoints) return data;

  const result: T[] = [];
  const lastIndex = data.length - 1;

  for (let i = 0; i < maxPoints; i++) {
    const index = Math.round((i / (maxPoints - 1)) * lastIndex);
    const item = data[index];

    if (!result.includes(item)) result.push(item);
  }

  return result;
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizeRate(value?: number) {
  if (!Number.isFinite(Number(value))) return 0;
  const numeric = Number(value);
  return numeric > 1 ? clamp01(numeric / 100) : clamp01(numeric);
}

function percentageLabel(value?: number) {
  const normalized = normalizeRate(value);
  return `${Math.round(normalized * 100)}%`;
}

function getRateColor(theme: any, value: number) {
  const rate = normalizeRate(value);

  if (rate >= 0.75) return theme.colors.primary;
  if (rate >= 0.5) return theme.colors.fire;

  return theme.colors.danger;
}

function getDeltaColor(theme: any, value: number) {
  if (value > 0) return theme.colors.primary;
  if (value < 0) return theme.colors.danger;

  return theme.colors.textMuted;
}

function ChartHeader({
  title,
  subtitle,
  value,
  valueColor,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  valueColor?: string;
}) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 10,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: "900" }}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: 11,
              fontWeight: "700",
              marginTop: 2,
            }}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {value ? (
        <Text
          style={{
            color: valueColor ?? theme.colors.primary,
            fontSize: 22,
            fontWeight: "900",
            textAlign: "right",
          }}
        >
          {value}
        </Text>
      ) : null}
    </View>
  );
}

export function ChartEmptyState({ width, height }: { width: number; height: number }) {
  const { theme } = useTheme();
  const { lang } = useI18n();
  const texts = useMemo(() => getTrendChartTexts(lang), [lang]);

  return (
    <View
      style={{
        width,
        height,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 18,
        backgroundColor: theme.colors.surfaceAlt,
        paddingHorizontal: 18,
      }}
    >
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: 14,
          fontWeight: "900",
          textAlign: "center",
        }}
      >
        {texts.emptyTitle}
      </Text>
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: 11,
          fontWeight: "600",
          textAlign: "center",
          marginTop: 6,
        }}
      >
        {texts.emptySubtitle}
      </Text>
    </View>
  );
}

export function ProgressRing({
  size = 160,
  stroke = 14,
  progress,
  label,
  sublabel,
  color,
}: {
  size?: number;
  stroke?: number;
  progress: number;
  label?: string;
  sublabel?: string;
  color?: string;
}) {
  const { theme } = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = clamp01(progress);
  const dash = c * clamped;
  const ringColor = color ?? theme.colors.primary;

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <SvgGrad id={`progress-ring-${size}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={ringColor} stopOpacity={1} />
            <Stop offset="1" stopColor={ringColor} stopOpacity={0.6} />
          </SvgGrad>
        </Defs>

        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={theme.colors.surfaceAlt}
          strokeWidth={stroke}
          fill="none"
        />

        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#progress-ring-${size})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />

        {label ? (
          <SvgText
            x={size / 2}
            y={size / 2 - (sublabel ? 4 : -6)}
            fill={theme.colors.text}
            fontSize={size > 120 ? "28" : "16"}
            fontWeight="800"
            textAnchor="middle"
          >
            {label}
          </SvgText>
        ) : null}

        {sublabel ? (
          <SvgText
            x={size / 2}
            y={size / 2 + (size > 120 ? 18 : 14)}
            fill={theme.colors.textMuted}
            fontSize={size > 120 ? "11" : "8"}
            fontWeight="600"
            textAnchor="middle"
          >
            {sublabel}
          </SvgText>
        ) : null}
      </Svg>
    </View>
  );
}

export function WeightChart({
  values,
  width = 320,
  height = 210,
  rangeDays,
  maxPoints = 12,
}: {
  values: WeightChartItem[];
  width?: number;
  height?: number;
  rangeDays?: number;
  maxPoints?: number;
}) {
  const { theme } = useTheme();
  const { lang } = useI18n();

  const texts = useMemo(() => getChartTexts(lang), [lang]);

  const data = useMemo(() => {
    const normalized = values
      .map(normalizeWeightEntry)
      .filter((item): item is NormalizedWeightEntry => Boolean(item))
      .sort((a, b) => {
        if (a.time !== b.time) return a.time - b.time;
        return a.date.localeCompare(b.date);
      });

    const ranged = filterByRange(normalized, rangeDays);

    return thinChartData(ranged.length > 0 ? ranged : normalized, maxPoints);
  }, [values, rangeDays, maxPoints]);

  const safeWidth = Math.max(260, width);
  const safeHeight = Math.max(210, height);

  if (data.length === 0) {
    return (
      <View
        style={{
          width: safeWidth,
          height: safeHeight,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 18,
          backgroundColor: theme.colors.surfaceAlt,
        }}
      >
        <Svg width={safeWidth} height={safeHeight}>
          <SvgText
            x={safeWidth / 2}
            y={safeHeight / 2 - 8}
            fill={theme.colors.textMuted}
            fontSize="14"
            fontWeight="800"
            textAnchor="middle"
          >
            {texts.noDataTitle}
          </SvgText>

          <SvgText
            x={safeWidth / 2}
            y={safeHeight / 2 + 17}
            fill={theme.colors.textMuted}
            fontSize="11"
            fontWeight="600"
            textAnchor="middle"
          >
            {texts.noDataSubtitle}
          </SvgText>
        </Svg>
      </View>
    );
  }

  const paddingLeft = 46;
  const paddingRight = 28;
  const paddingTop = 66;
  const paddingBottom = 48;

  const chartWidth = Math.max(1, safeWidth - paddingLeft - paddingRight);
  const chartHeight = Math.max(1, safeHeight - paddingTop - paddingBottom);
  const chartBottom = paddingTop + chartHeight;

  const weights = data.map((item) => item.weight);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);

  const rawRange = maxWeight - minWeight;
  const extraPadding = rawRange === 0 ? 1 : Math.max(0.8, rawRange * 0.18);

  const visualMin = minWeight - extraPadding;
  const visualMax = maxWeight + extraPadding;
  const visualRange = Math.max(1, visualMax - visualMin);

  const points = data.map((item, index) => {
    const x =
      data.length === 1
        ? paddingLeft + chartWidth / 2
        : paddingLeft + (index / (data.length - 1)) * chartWidth;

    const y =
      paddingTop +
      chartHeight -
      ((item.weight - visualMin) / visualRange) * chartHeight;

    return { x, y, item };
  });

  const path = buildLinePath(points);

  const area =
    points.length <= 1 || !path
      ? ""
      : `${path} L${points[points.length - 1].x},${chartBottom} L${
          points[0].x
        },${chartBottom} Z`;

  const summary = getChartSummary(data, lang);
  const firstDateLabel = formatShortDate(summary.first.date, lang);
  const lastDateLabel = formatShortDate(summary.last.date, lang);
  const sameDateLabel = firstDateLabel === lastDateLabel;

  return (
    <View style={{ width: safeWidth, height: safeHeight, borderRadius: 18, overflow: "hidden" }}>
      <Svg width={safeWidth} height={safeHeight}>
        <Defs>
          <SvgGrad id="weight-area-gradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.colors.primary} stopOpacity={0.26} />
            <Stop offset="1" stopColor={theme.colors.primary} stopOpacity={0} />
          </SvgGrad>

          <SvgGrad id="weight-line-gradient" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={theme.colors.primary} stopOpacity={0.76} />
            <Stop offset="1" stopColor={theme.colors.primary} stopOpacity={1} />
          </SvgGrad>
        </Defs>

        <Path
          d={`M${paddingLeft},${chartBottom} L${paddingLeft + chartWidth},${chartBottom}`}
          stroke={theme.colors.borderSoft}
          strokeWidth={1}
          fill="none"
        />

        <Path
          d={`M${paddingLeft},${paddingTop + chartHeight / 2} L${
            paddingLeft + chartWidth
          },${paddingTop + chartHeight / 2}`}
          stroke={theme.colors.borderSoft}
          strokeWidth={1}
          strokeOpacity={0.55}
          fill="none"
        />

        <SvgText
          x={paddingLeft}
          y={21}
          fill={theme.colors.textMuted}
          fontSize="11"
          fontWeight="900"
          textAnchor="start"
        >
          {formatWeightWithUnit(maxWeight, lang)}
        </SvgText>

        <SvgText
          x={paddingLeft}
          y={39}
          fill={theme.colors.textMuted}
          fontSize="10"
          fontWeight="700"
          textAnchor="start"
        >
          {texts.max}
        </SvgText>

        <SvgText
          x={safeWidth - paddingRight}
          y={21}
          fill={summary.diff >= 0 ? theme.colors.fire : theme.colors.success}
          fontSize="12"
          fontWeight="900"
          textAnchor="end"
        >
          {summary.diffLabel}
        </SvgText>

        <SvgText
          x={safeWidth - paddingRight}
          y={39}
          fill={theme.colors.textMuted}
          fontSize="10"
          fontWeight="700"
          textAnchor="end"
        >
          {texts.change}
        </SvgText>

        <Rect
          x={safeWidth / 2 - 52}
          y={16}
          width={104}
          height={32}
          rx={16}
          fill={theme.colors.surfaceAlt}
          opacity={0.9}
        />

        <SvgText
          x={safeWidth / 2}
          y={29}
          fill={theme.colors.text}
          fontSize="11"
          fontWeight="900"
          textAnchor="middle"
        >
          {formatWeightWithUnit(summary.last.weight, lang)}
        </SvgText>

        <SvgText
          x={safeWidth / 2}
          y={43}
          fill={theme.colors.textMuted}
          fontSize="8.5"
          fontWeight="800"
          textAnchor="middle"
        >
          {texts.latest}
        </SvgText>

        <SvgText
          x={8}
          y={paddingTop + 5}
          fill={theme.colors.textMuted}
          fontSize="10"
          fontWeight="800"
          textAnchor="start"
        >
          {formatWeight(maxWeight)}
        </SvgText>

        <SvgText
          x={8}
          y={chartBottom}
          fill={theme.colors.textMuted}
          fontSize="10"
          fontWeight="800"
          textAnchor="start"
        >
          {formatWeight(minWeight)}
        </SvgText>

        {area ? <Path d={area} fill="url(#weight-area-gradient)" /> : null}

        {path ? (
          <Path
            d={path}
            stroke="url(#weight-line-gradient)"
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {points.map((point, index) => {
          const isLast = index === points.length - 1;

          return (
            <React.Fragment key={`${point.item.date}_${index}`}>
              <Circle cx={point.x} cy={point.y} r={isLast ? 11 : 8} fill={theme.colors.primary} fillOpacity={0.12} />
              <Circle cx={point.x} cy={point.y} r={isLast ? 6.5 : 5} fill={theme.colors.primary} />
              <Circle
                cx={point.x}
                cy={point.y}
                r={isLast ? 15 : 11}
                fill="transparent"
                stroke={theme.colors.primary}
                strokeOpacity={isLast ? 0.25 : 0.13}
                strokeWidth={2}
              />
            </React.Fragment>
          );
        })}

        {points.length === 1 ? (
          <SvgText
            x={points[0].x}
            y={safeHeight - 14}
            fill={theme.colors.textMuted}
            fontSize="11"
            fontWeight="800"
            textAnchor="middle"
          >
            {formatFullDate(points[0].item.date, lang)}
          </SvgText>
        ) : sameDateLabel ? (
          <SvgText
            x={safeWidth / 2}
            y={safeHeight - 14}
            fill={theme.colors.textMuted}
            fontSize="11"
            fontWeight="800"
            textAnchor="middle"
          >
            {firstDateLabel}
          </SvgText>
        ) : (
          <>
            <SvgText
              x={paddingLeft}
              y={safeHeight - 14}
              fill={theme.colors.textMuted}
              fontSize="10"
              fontWeight="800"
              textAnchor="start"
            >
              {firstDateLabel}
            </SvgText>

            <SvgText
              x={safeWidth - paddingRight}
              y={safeHeight - 14}
              fill={theme.colors.textMuted}
              fontSize="10"
              fontWeight="800"
              textAnchor="end"
            >
              {lastDateLabel}
            </SvgText>
          </>
        )}
      </Svg>
    </View>
  );
}

export function AttendanceTrendChart({
  data,
  width = 320,
  height = 210,
}: {
  data: PercentageChartItem[];
  width?: number;
  height?: number;
}) {
  const { theme } = useTheme();
  const { lang } = useI18n();
  const texts = useMemo(() => getTrendChartTexts(lang), [lang]);

  const safeWidth = Math.max(260, width);
  const safeHeight = Math.max(190, height);

  const chartData = useMemo(
    () =>
      data
        .filter((item) => item && item.label)
        .slice(-8)
        .map((item) => ({
          ...item,
          rate: normalizeRate(item.rate ?? item.value ?? 0),
        })),
    [data],
  );

  if (chartData.length === 0) {
    return <ChartEmptyState width={safeWidth} height={safeHeight} />;
  }

  const paddingLeft = 24;
  const paddingRight = 18;
  const paddingTop = 28;
  const paddingBottom = 44;
  const chartWidth = safeWidth - paddingLeft - paddingRight;
  const chartHeight = safeHeight - paddingTop - paddingBottom;
  const barGap = chartData.length <= 4 ? 18 : 10;
  const barWidth = Math.max(
    18,
    Math.min(34, (chartWidth - barGap * (chartData.length - 1)) / chartData.length),
  );
  const usedWidth = barWidth * chartData.length + barGap * (chartData.length - 1);
  const startX = paddingLeft + Math.max(0, (chartWidth - usedWidth) / 2);
  const latest = chartData[chartData.length - 1];

  return (
    <View style={{ width: safeWidth }}>
      <ChartHeader
        title={`${texts.attended} / ${texts.missed}`}
        subtitle={`${texts.rest} не снижает процент`}
        value={percentageLabel(latest.rate)}
        valueColor={getRateColor(theme, latest.rate ?? 0)}
      />

      <Svg width={safeWidth} height={safeHeight}>
        <Defs>
          <SvgGrad id="attendance-grid-fade" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={theme.colors.borderSoft} stopOpacity={0.12} />
            <Stop offset="1" stopColor={theme.colors.borderSoft} stopOpacity={0.55} />
          </SvgGrad>
        </Defs>

        {[0, 0.5, 1].map((line) => {
          const y = paddingTop + chartHeight - line * chartHeight;

          return (
            <Path
              key={line}
              d={`M${paddingLeft},${y} L${paddingLeft + chartWidth},${y}`}
              stroke="url(#attendance-grid-fade)"
              strokeWidth={1}
              fill="none"
            />
          );
        })}

        {chartData.map((item, index) => {
          const x = startX + index * (barWidth + barGap);
          const barHeight = Math.max(6, (item.rate ?? 0) * chartHeight);
          const y = paddingTop + chartHeight - barHeight;
          const color = getRateColor(theme, item.rate ?? 0);

          return (
            <React.Fragment key={`${item.label}_${index}`}>
              <Rect
                x={x}
                y={paddingTop}
                width={barWidth}
                height={chartHeight}
                rx={barWidth / 2}
                fill={theme.colors.surfaceAlt}
                opacity={0.7}
              />

              <Rect x={x} y={y} width={barWidth} height={barHeight} rx={barWidth / 2} fill={color} />

              <SvgText
                x={x + barWidth / 2}
                y={Math.max(14, y - 8)}
                fill={color}
                fontSize="10"
                fontWeight="900"
                textAnchor="middle"
              >
                {Math.round((item.rate ?? 0) * 100)}%
              </SvgText>

              <SvgText
                x={x + barWidth / 2}
                y={safeHeight - 18}
                fill={theme.colors.textMuted}
                fontSize="9"
                fontWeight="800"
                textAnchor="middle"
              >
                {item.label.length > 7 ? `${item.label.slice(0, 6)}…` : item.label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
        <LegendDot label={texts.attended} color={theme.colors.primary} />
        <LegendDot label={texts.missed} color={theme.colors.danger} />
        <LegendDot label={texts.rest} color={theme.colors.textMuted} />
      </View>
    </View>
  );
}

export function MuscleVolumeChart({
  data,
  width = 320,
  height = 220,
  unit,
}: {
  data: VolumeChartItem[];
  width?: number;
  height?: number;
  unit?: string;
}) {
  const { theme } = useTheme();
  const { lang } = useI18n();
  const texts = useMemo(() => getTrendChartTexts(lang), [lang]);
  const resolvedUnit = unit ?? getWeightUnit(lang);

  const safeWidth = Math.max(260, width);

  const chartData = useMemo(
    () =>
      data
        .filter((item) => item && Number.isFinite(Number(item.value)) && Number(item.value) > 0)
        .sort((a, b) => Number(b.value) - Number(a.value))
        .slice(0, 7),
    [data],
  );

  const dynamicHeight = Math.max(132, Math.min(height, 72 + chartData.length * 42));

  if (chartData.length === 0) {
    return <ChartEmptyState width={safeWidth} height={dynamicHeight} />;
  }

  const maxValue = Math.max(1, ...chartData.map((item) => Number(item.value)));

  return (
    <View style={{ width: safeWidth, gap: 10 }}>
      <ChartHeader
        title={texts.volume}
        subtitle={`${texts.best}: ${chartData[0].label}`}
        value={`${Math.round(chartData[0].value)} ${resolvedUnit}`}
      />

      <View style={{ gap: 12 }}>
        {chartData.map((item, index) => {
          const value = Number(item.value);
          const ratio = Math.max(0.04, value / maxValue);
          const isTop = index === 0;
          const color = isTop ? theme.colors.primary : theme.colors.fire;
          const label = item.label.length > 13 ? `${item.label.slice(0, 12)}…` : item.label;

          return (
            <View key={`${item.label}_${index}`} style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    width: 82,
                    color: theme.colors.textMuted,
                    fontSize: 12,
                    fontWeight: "900",
                  }}
                >
                  {label}
                </Text>

                <View style={{ flex: 1, gap: 5 }}>
                  <View
                    style={{
                      height: 15,
                      borderRadius: 999,
                      overflow: "hidden",
                      backgroundColor: theme.colors.surfaceAlt,
                    }}
                  >
                    <View
                      style={{
                        width: `${Math.round(ratio * 100)}%`,
                        height: 15,
                        borderRadius: 999,
                        backgroundColor: color,
                        opacity: isTop ? 1 : 0.86,
                      }}
                    />
                  </View>

                  <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: theme.colors.textMuted,
                        fontSize: 10,
                        fontWeight: "900",
                      }}
                    >
                      {Math.round(value)} {resolvedUnit}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function MuscleGroupProgressChart({
  data,
  width = 320,
  height = 230,
  unit,
}: {
  data: VolumeChartItem[];
  width?: number;
  height?: number;
  unit?: string;
}) {
  const { theme } = useTheme();
  const { lang } = useI18n();
  const texts = useMemo(() => getTrendChartTexts(lang), [lang]);
  const resolvedUnit = unit ?? getWeightUnit(lang);

  const safeWidth = Math.max(260, width);
  const chartData = useMemo(
    () =>
      data
        .filter((item) => item && Number.isFinite(Number(item.value)))
        .sort((a, b) => Math.abs(Number(b.value) - Number(b.previous ?? 0)) - Math.abs(Number(a.value) - Number(a.previous ?? 0)))
        .slice(0, 6),
    [data],
  );

  const dynamicHeight = Math.max(160, Math.min(height, 78 + chartData.length * 42));

  if (chartData.length === 0) {
    return <ChartEmptyState width={safeWidth} height={dynamicHeight} />;
  }

  const maxValue = Math.max(1, ...chartData.map((item) => Math.max(Number(item.value), Number(item.previous ?? 0))));
  const paddingLeft = 94;
  const paddingRight = 44;
  const rowHeight = 42;
  const paddingTop = 18;
  const barWidth = safeWidth - paddingLeft - paddingRight;

  return (
    <View style={{ width: safeWidth }}>
      <ChartHeader title={texts.change} subtitle={`${texts.previous} / ${texts.current}`} />

      <Svg width={safeWidth} height={dynamicHeight}>
        {chartData.map((item, index) => {
          const y = paddingTop + index * rowHeight;
          const current = Number(item.value);
          const previous = Number(item.previous ?? 0);
          const currentW = Math.max(4, (current / maxValue) * barWidth);
          const previousW = Math.max(4, (previous / maxValue) * barWidth);
          const delta = current - previous;
          const color = getDeltaColor(theme, delta);

          return (
            <React.Fragment key={`${item.label}_${index}`}>
              <SvgText
                x={0}
                y={y + 18}
                fill={theme.colors.textMuted}
                fontSize="10"
                fontWeight="800"
                textAnchor="start"
              >
                {item.label.length > 12 ? `${item.label.slice(0, 11)}…` : item.label}
              </SvgText>

              <Rect x={paddingLeft} y={y + 2} width={barWidth} height={8} rx={4} fill={theme.colors.surfaceAlt} />
              <Rect x={paddingLeft} y={y + 2} width={previousW} height={8} rx={4} fill={theme.colors.textMuted} opacity={0.45} />

              <Rect x={paddingLeft} y={y + 15} width={barWidth} height={10} rx={5} fill={theme.colors.surfaceAlt} />
              <Rect x={paddingLeft} y={y + 15} width={currentW} height={10} rx={5} fill={color} />

              <SvgText
                x={safeWidth - paddingRight + 36}
                y={y + 22}
                fill={color}
                fontSize="10"
                fontWeight="900"
                textAnchor="end"
              >
                {delta >= 0 ? "+" : ""}{formatNumber(delta, 1)} {resolvedUnit}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

export function SupplementAdherenceChart({
  data,
  width = 320,
}: {
  data: PercentageChartItem[];
  width?: number;
}) {
  const { theme } = useTheme();
  const { lang } = useI18n();
  const texts = useMemo(() => getTrendChartTexts(lang), [lang]);

  const safeWidth = Math.max(260, width);
  const chartData = useMemo(
    () =>
      data
        .filter((item) => item && item.label)
        .map((item) => ({
          ...item,
          rate: normalizeRate(item.rate ?? item.value ?? 0),
        }))
        .slice(0, 8),
    [data],
  );

  if (chartData.length === 0) {
    return <ChartEmptyState width={safeWidth} height={120} />;
  }

  const avg = chartData.reduce((sum, item) => sum + (item.rate ?? 0), 0) / Math.max(1, chartData.length);

  return (
    <View style={{ width: safeWidth, gap: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: "900" }}>
            {texts.taken} / {texts.skipped}
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: "700", marginTop: 2 }}>
            {chartData.length} {getChartTexts(lang).entries}
          </Text>
        </View>

        <ProgressRing
          size={78}
          stroke={8}
          progress={avg}
          label={`${Math.round(avg * 100)}%`}
          sublabel={texts.taken}
          color={getRateColor(theme, avg)}
        />
      </View>

      <View style={{ gap: 9 }}>
        {chartData.map((item, index) => {
          const color = getRateColor(theme, item.rate ?? 0);

          return (
            <View key={`${item.label}_${index}`} style={{ gap: 5 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                <Text style={{ flex: 1, color: theme.colors.text, fontSize: 12, fontWeight: "800" }} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={{ color, fontSize: 12, fontWeight: "900" }}>{percentageLabel(item.rate)}</Text>
              </View>

              <View style={{ height: 9, borderRadius: 999, overflow: "hidden", backgroundColor: theme.colors.surfaceAlt }}>
                <View style={{ height: 9, width: `${Math.round((item.rate ?? 0) * 100)}%`, borderRadius: 999, backgroundColor: color }} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function ExerciseProgressChart({
  data,
  width = 320,
  height = 210,
  unit,
}: {
  data: VolumeChartItem[];
  width?: number;
  height?: number;
  unit?: string;
}) {
  const { theme } = useTheme();
  const { lang } = useI18n();
  const texts = useMemo(() => getTrendChartTexts(lang), [lang]);
  const resolvedUnit = unit ?? getWeightUnit(lang);

  const safeWidth = Math.max(260, width);
  const chartData = useMemo(
    () =>
      data
        .filter((item) => item && Number.isFinite(Number(item.value)))
        .slice(0, 8),
    [data],
  );

  const dynamicHeight = Math.max(150, Math.min(height, 64 + chartData.length * 44));

  if (chartData.length === 0) {
    return <ChartEmptyState width={safeWidth} height={dynamicHeight} />;
  }

  const values = chartData.map((item) => Math.abs(Number(item.value)));
  const maxValue = Math.max(1, ...values);

  return (
    <View style={{ width: safeWidth, gap: 12 }}>
      <ChartHeader
        title={texts.change}
        subtitle={
          lang === "ru"
            ? "прогресс по упражнениям клиента"
            : lang === "kk"
              ? "клиент жаттығуларының прогресі"
              : "client exercise progress"
        }
      />

      <View style={{ gap: 12 }}>
        {chartData.map((item, index) => {
          const value = Number(item.value);
          const abs = Math.abs(value);
          const ratio = abs > 0 ? Math.max(0.06, abs / maxValue) : 0;
          const color = getDeltaColor(theme, value);
          const label = item.label.length > 17 ? `${item.label.slice(0, 16)}…` : item.label;
          const valueText =
            abs > 0
              ? `${value > 0 ? "+" : ""}${formatNumber(value, 1)} ${item.unit ?? resolvedUnit}`
              : lang === "ru"
                ? "без изменений"
                : lang === "kk"
                  ? "өзгеріс жоқ"
                  : "no change";

          return (
            <View key={`${item.label}_${index}`} style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    color: theme.colors.textMuted,
                    fontSize: 12,
                    fontWeight: "900",
                  }}
                >
                  {label}
                </Text>

                <Text
                  numberOfLines={1}
                  style={{
                    maxWidth: 96,
                    color: abs > 0 ? color : theme.colors.textMuted,
                    fontSize: 11,
                    fontWeight: "900",
                    textAlign: "right",
                  }}
                >
                  {valueText}
                </Text>
              </View>

              <View
                style={{
                  height: 13,
                  borderRadius: 999,
                  overflow: "hidden",
                  backgroundColor: theme.colors.surfaceAlt,
                }}
              >
                <View
                  style={{
                    width: `${Math.round(ratio * 100)}%`,
                    minWidth: abs > 0 ? 6 : 0,
                    height: 13,
                    borderRadius: 999,
                    backgroundColor: color,
                    opacity: abs > 0 ? 1 : 0,
                  }}
                />
              </View>

              {item.meta ? (
                <Text
                  numberOfLines={1}
                  style={{
                    color: theme.colors.textMuted,
                    fontSize: 9,
                    fontWeight: "700",
                  }}
                >
                  {item.meta}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function ExercisePerformanceLineChart({
  data,
  width = 320,
  height = 230,
  unit,
  metricLabel,
}: {
  data: PerformancePoint[];
  width?: number;
  height?: number;
  unit?: string;
  metricLabel?: string;
}) {
  const { theme } = useTheme();
  const { lang } = useI18n();
  const texts = useMemo(() => getTrendChartTexts(lang), [lang]);
  const resolvedUnit = unit ?? getWeightUnit(lang);

  const safeWidth = Math.max(260, width);
  const safeHeight = Math.max(190, height);

  const chartData = useMemo(
    () =>
      thinChartData(
        data
          .filter((item) => item && Number.isFinite(Number(item.value)))
          .map((item) => ({ ...item, value: Number(item.value) })),
        10,
      ),
    [data],
  );

  if (chartData.length === 0) {
    return <ChartEmptyState width={safeWidth} height={safeHeight} />;
  }

  const first = chartData[0];
  const last = chartData[chartData.length - 1];
  const diff = last.value - first.value;
  const values = chartData.map((item) => item.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const rawRange = maxValue - minValue;
  const paddingValue = rawRange === 0 ? 1 : rawRange * 0.18;
  const visualMin = minValue - paddingValue;
  const visualMax = maxValue + paddingValue;
  const range = Math.max(1, visualMax - visualMin);

  const paddingLeft = 36;
  const paddingRight = 20;
  const paddingTop = 46;
  const paddingBottom = 44;
  const chartWidth = safeWidth - paddingLeft - paddingRight;
  const chartHeight = safeHeight - paddingTop - paddingBottom;
  const chartBottom = paddingTop + chartHeight;

  const points = chartData.map((item, index) => {
    const x =
      chartData.length === 1
        ? paddingLeft + chartWidth / 2
        : paddingLeft + (index / (chartData.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((item.value - visualMin) / range) * chartHeight;

    return { x, y, item };
  });

  const path = buildLinePath(points);
  const area =
    points.length <= 1 || !path
      ? ""
      : `${path} L${points[points.length - 1].x},${chartBottom} L${points[0].x},${chartBottom} Z`;
  const color = getDeltaColor(theme, diff);

  return (
    <View style={{ width: safeWidth }}>
      <ChartHeader
        title={metricLabel ?? texts.current}
        subtitle={`${texts.previous}: ${formatNumber(first.value, 1)} ${resolvedUnit}`}
        value={`${diff >= 0 ? "+" : ""}${formatNumber(diff, 1)} ${resolvedUnit}`}
        valueColor={color}
      />

      <Svg width={safeWidth} height={safeHeight}>
        <Defs>
          <SvgGrad id="performance-area-gradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.colors.primary} stopOpacity={0.23} />
            <Stop offset="1" stopColor={theme.colors.primary} stopOpacity={0} />
          </SvgGrad>
        </Defs>

        <Path d={`M${paddingLeft},${chartBottom} L${paddingLeft + chartWidth},${chartBottom}`} stroke={theme.colors.borderSoft} strokeWidth={1} fill="none" />
        <Path d={`M${paddingLeft},${paddingTop + chartHeight / 2} L${paddingLeft + chartWidth},${paddingTop + chartHeight / 2}`} stroke={theme.colors.borderSoft} strokeWidth={1} strokeOpacity={0.5} fill="none" />

        <SvgText x={4} y={paddingTop + 6} fill={theme.colors.textMuted} fontSize="9" fontWeight="800" textAnchor="start">
          {formatNumber(maxValue, 1)}
        </SvgText>
        <SvgText x={4} y={chartBottom} fill={theme.colors.textMuted} fontSize="9" fontWeight="800" textAnchor="start">
          {formatNumber(minValue, 1)}
        </SvgText>

        {area ? <Path d={area} fill="url(#performance-area-gradient)" /> : null}
        {path ? <Path d={path} stroke={theme.colors.primary} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}

        {points.map((point, index) => {
          const isLast = index === points.length - 1;

          return (
            <React.Fragment key={`${point.item.label}_${index}`}>
              <Circle cx={point.x} cy={point.y} r={isLast ? 10 : 7} fill={theme.colors.primary} fillOpacity={0.16} />
              <Circle cx={point.x} cy={point.y} r={isLast ? 5.5 : 4.5} fill={theme.colors.primary} />
            </React.Fragment>
          );
        })}

        {points.length === 1 ? (
          <SvgText x={points[0].x} y={safeHeight - 14} fill={theme.colors.textMuted} fontSize="10" fontWeight="800" textAnchor="middle">
            {points[0].item.label}
          </SvgText>
        ) : (
          <>
            <SvgText x={paddingLeft} y={safeHeight - 14} fill={theme.colors.textMuted} fontSize="10" fontWeight="800" textAnchor="start">
              {first.label}
            </SvgText>
            <SvgText x={safeWidth - paddingRight} y={safeHeight - 14} fill={theme.colors.textMuted} fontSize="10" fontWeight="800" textAnchor="end">
              {last.label}
            </SvgText>
          </>
        )}
      </Svg>
    </View>
  );
}

export function RepRangePerformanceChart({
  data,
  width = 320,
  height = 220,
  unit,
}: {
  data: RepRangeChartItem[];
  width?: number;
  height?: number;
  unit?: string;
}) {
  const { theme } = useTheme();
  const { lang } = useI18n();
  const texts = useMemo(() => getTrendChartTexts(lang), [lang]);
  const resolvedUnit = unit ?? getWeightUnit(lang);

  const safeWidth = Math.max(260, width);
  const chartData = useMemo(
    () =>
      data
        .filter((item) => item && Number.isFinite(Number(item.current)))
        .slice(0, 7),
    [data],
  );

  const dynamicHeight = Math.max(170, Math.min(height, 62 + chartData.length * 42));

  if (chartData.length === 0) {
    return <ChartEmptyState width={safeWidth} height={dynamicHeight} />;
  }

  const maxValue = Math.max(
    1,
    ...chartData.map((item) => Math.max(Number(item.current), Number(item.previous ?? 0))),
  );

  return (
    <View style={{ width: safeWidth, gap: 12 }}>
      <ChartHeader title={texts.current} subtitle={`${texts.previous} / ${texts.current}`} />

      <View style={{ gap: 14 }}>
        {chartData.map((item, index) => {
          const current = Number(item.current);
          const previous = Number(item.previous ?? 0);
          const currentRatio = current > 0 ? Math.max(0.04, current / maxValue) : 0;
          const previousRatio = previous > 0 ? Math.max(0.04, previous / maxValue) : 0;
          const delta = current - previous;
          const color = getDeltaColor(theme, delta);
          const hasData = current > 0 || previous > 0;
          const currentLabel = hasData
            ? `${formatNumber(current, 1)} ${item.unit ?? resolvedUnit}`
            : "—";

          return (
            <View key={`${item.label}_${index}`} style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text
                  style={{
                    width: 50,
                    color: theme.colors.textMuted,
                    fontSize: 12,
                    fontWeight: "900",
                  }}
                >
                  {item.label}
                </Text>

                <View style={{ flex: 1, gap: 5 }}>
                  <View
                    style={{
                      height: 9,
                      borderRadius: 999,
                      overflow: "hidden",
                      backgroundColor: theme.colors.surfaceAlt,
                    }}
                  >
                    {previous > 0 ? (
                      <View
                        style={{
                          width: `${Math.round(previousRatio * 100)}%`,
                          height: 9,
                          borderRadius: 999,
                          backgroundColor: theme.colors.textMuted,
                          opacity: 0.42,
                        }}
                      />
                    ) : null}
                  </View>

                  <View
                    style={{
                      height: 10,
                      borderRadius: 999,
                      overflow: "hidden",
                      backgroundColor: theme.colors.surfaceAlt,
                    }}
                  >
                    {current > 0 ? (
                      <View
                        style={{
                          width: `${Math.round(currentRatio * 100)}%`,
                          height: 10,
                          borderRadius: 999,
                          backgroundColor: color,
                        }}
                      />
                    ) : null}
                  </View>
                </View>

                <Text
                  numberOfLines={1}
                  style={{
                    width: 64,
                    color: hasData ? color : theme.colors.textMuted,
                    fontSize: 12,
                    fontWeight: "900",
                    textAlign: "right",
                  }}
                >
                  {currentLabel}
                </Text>
              </View>

              {item.meta ? (
                <Text
                  numberOfLines={1}
                  style={{
                    marginLeft: 60,
                    color: theme.colors.textMuted,
                    fontSize: 9,
                    fontWeight: "700",
                  }}
                >
                  {item.meta}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function DistributionDonutChart({
  data,
  width = 320,
  size = 160,
  centerLabel,
  centerValue,
}: {
  data: VolumeChartItem[];
  width?: number;
  size?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const { theme } = useTheme();

  const safeWidth = Math.max(260, width);
  const chartData = useMemo(
    () => data.filter((item) => item && Number.isFinite(Number(item.value)) && Number(item.value) > 0).slice(0, 6),
    [data],
  );

  if (chartData.length === 0) {
    return <ChartEmptyState width={safeWidth} height={size + 40} />;
  }

  const total = chartData.reduce((sum, item) => sum + Number(item.value), 0);
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const colors = [
    theme.colors.primary,
    theme.colors.fire,
    theme.colors.accent,
    theme.colors.success,
    theme.colors.warn,
    theme.colors.textMuted,
  ];

  let offset = 0;

  return (
    <View style={{ width: safeWidth, alignItems: "center", gap: 14 }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.colors.surfaceAlt} strokeWidth={stroke} fill="none" />

        {chartData.map((item, index) => {
          const portion = Number(item.value) / Math.max(1, total);
          const dash = portion * c;
          const currentOffset = offset;
          offset += dash;

          return (
            <Circle
              key={`${item.label}_${index}`}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={colors[index % colors.length]}
              strokeWidth={stroke}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-currentOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
        })}

        <SvgText x={size / 2} y={size / 2 - 2} fill={theme.colors.text} fontSize="20" fontWeight="900" textAnchor="middle">
          {centerValue ?? `${Math.round(total)}`}
        </SvgText>
        <SvgText x={size / 2} y={size / 2 + 17} fill={theme.colors.textMuted} fontSize="9" fontWeight="800" textAnchor="middle">
          {centerLabel ?? "total"}
        </SvgText>
      </Svg>

      <View style={{ width: "100%", flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
        {chartData.map((item, index) => (
          <LegendDot key={`${item.label}_${index}`} label={`${item.label} ${Math.round((Number(item.value) / Math.max(1, total)) * 100)}%`} color={colors[index % colors.length]} />
        ))}
      </View>
    </View>
  );
}

function LegendDot({ label, color }: { label: string; color: string }) {
  const { theme } = useTheme();

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color: theme.colors.textMuted, fontSize: 10, fontWeight: "800" }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function CircularGoalSelector({
  size = 220,
  value,
  min = 60,
  max = 600,
  step = 15,
  onChange,
  label,
  unit = "min",
}: {
  size?: number;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  label?: string;
  unit?: string;
}) {
  const { theme } = useTheme();
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(min, Math.min(max, value));
  const progress = (clamped - min) / (max - min);
  const dash = c * progress;

  const changeValue = (delta: number) => {
    const next = Math.max(min, Math.min(max, clamped + delta));
    onChange(next);
  };

  return (
    <View style={{ alignItems: "center", gap: 12 }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={theme.colors.surfaceAlt}
          strokeWidth={stroke}
          fill="none"
        />

        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={theme.colors.primary}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />

        <SvgText
          x={size / 2}
          y={size / 2 - 4}
          fill={theme.colors.text}
          fontSize="40"
          fontWeight="800"
          textAnchor="middle"
        >
          {clamped}
        </SvgText>

        <SvgText
          x={size / 2}
          y={size / 2 + 22}
          fill={theme.colors.textMuted}
          fontSize="13"
          fontWeight="600"
          textAnchor="middle"
        >
          {unit.toUpperCase()}
        </SvgText>
      </Svg>

      {label ? (
        <Text style={{ color: theme.colors.text, fontWeight: "700", fontSize: 14 }}>
          {label}
        </Text>
      ) : null}

      <View style={{ flexDirection: "row", gap: 12 }}>
        {[
          { d: -step, l: `-${step}` },
          { d: step, l: `+${step}` },
          { d: step * 4, l: `+${step * 4}` },
        ].map((button) => (
          <Pressable
            key={button.l}
            onPress={() => changeValue(button.d)}
            style={{
              minWidth: 64,
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.colors.surfaceAlt,
              borderWidth: 1,
              borderColor: theme.colors.borderSoft,
            }}
          >
            <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: 13 }}>
              {button.l}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
