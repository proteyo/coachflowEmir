import React, { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGrad,
  Path,
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
};

type SvgTextAnchor = NonNullable<
  React.ComponentProps<typeof SvgText>["textAnchor"]
>;

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
  const clamped = Math.max(0, Math.min(1, progress));
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
            fontSize="28"
            fontWeight="800"
            textAnchor="middle"
          >
            {label}
          </SvgText>
        ) : null}

        {sublabel ? (
          <SvgText
            x={size / 2}
            y={size / 2 + 18}
            fill={theme.colors.textMuted}
            fontSize="11"
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

function getChartTexts(lang?: string): ChartTexts {
  if (lang === "ru") {
    return {
      noDataTitle: "Данных о весе пока нет",
      noDataSubtitle: "Добавьте первую запись, чтобы увидеть динамику",
      max: "макс.",
      min: "мин.",
      change: "изменение",
    };
  }

  if (lang === "kk") {
    return {
      noDataTitle: "Салмақ деректері әлі жоқ",
      noDataSubtitle: "Динамиканы көру үшін алғашқы жазбаны қосыңыз",
      max: "макс.",
      min: "мин.",
      change: "өзгеріс",
    };
  }

  return {
    noDataTitle: "No weight data yet",
    noDataSubtitle: "Add a weight entry to see progress",
    max: "max",
    min: "min",
    change: "change",
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

function normalizeWeightEntry(
  entry: WeightChartItem,
): NormalizedWeightEntry | null {
  const weight = Number(entry.weight);
  const date = getEntryDate(entry);
  const time = getEntryTime(entry);

  if (!Number.isFinite(weight) || weight <= 0) {
    return null;
  }

  return {
    date,
    time,
    weight,
  };
}

function formatWeight(value: number) {
  if (!Number.isFinite(value)) return "—";

  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatShortDate(value: string) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.includes("T") ? value.slice(0, 10) : value;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatFullDate(value: string) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.includes("T") ? value.slice(0, 10) : value;
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function buildWeightPath(points: { x: number; y: number }[]) {
  if (points.length <= 1) return "";

  return points
    .map((point, index) =>
      index === 0 ? `M${point.x},${point.y}` : `L${point.x},${point.y}`,
    )
    .join(" ");
}

function getLastLabelPosition({
  x,
  y,
  width,
  paddingTop,
  chartBottom,
}: {
  x: number;
  y: number;
  width: number;
  paddingTop: number;
  chartBottom: number;
}): {
  x: number;
  y: number;
  anchor: SvgTextAnchor;
} {
  const nearTop = y < paddingTop + 20;
  const nearBottom = y > chartBottom - 22;
  const nearRight = x > width - 105;

  let labelY = y - 18;

  if (nearTop) {
    labelY = y + 32;
  }

  if (nearBottom) {
    labelY = y - 24;
  }

  return {
    x: nearRight ? x - 12 : x,
    y: labelY,
    anchor: nearRight ? "end" : "middle",
  };
}

function getChartSummary(data: NormalizedWeightEntry[]) {
  const first = data[0];
  const last = data[data.length - 1];
  const diff = last.weight - first.weight;

  return {
    first,
    last,
    diff,
    diffLabel: `${diff >= 0 ? "+" : ""}${formatWeight(diff)} kg`,
  };
}

export function WeightChart({
  values,
  width = 320,
  height = 210,
}: {
  values: WeightChartItem[];
  width?: number;
  height?: number;
}) {
  const { theme } = useTheme();
  const { lang } = useI18n();

  const texts = useMemo(() => getChartTexts(lang), [lang]);

  const data = useMemo(() => {
    return values
      .map(normalizeWeightEntry)
      .filter((item): item is NormalizedWeightEntry => Boolean(item))
      .sort((a, b) => {
        if (a.time !== b.time) {
          return a.time - b.time;
        }

        return a.date.localeCompare(b.date);
      });
  }, [values]);

  const safeWidth = Math.max(260, width);
  const safeHeight = Math.max(190, height);

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

  const paddingLeft = 48;
  const paddingRight = 34;
  const paddingTop = 58;
  const paddingBottom = 48;

  const chartWidth = Math.max(1, safeWidth - paddingLeft - paddingRight);
  const chartHeight = Math.max(1, safeHeight - paddingTop - paddingBottom);
  const chartBottom = paddingTop + chartHeight;

  const weights = data.map((item) => item.weight);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);

  const rawRange = maxWeight - minWeight;
  const extraPadding = rawRange === 0 ? 1 : Math.max(0.8, rawRange * 0.16);

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

    return {
      x,
      y,
      item,
    };
  });

  const path = buildWeightPath(points);

  const area =
    points.length <= 1 || !path
      ? ""
      : `${path} L${points[points.length - 1].x},${chartBottom} L${
          points[0].x
        },${chartBottom} Z`;

  const summary = getChartSummary(data);
  const lastPoint = points[points.length - 1];

  const lastLabel = getLastLabelPosition({
    x: lastPoint.x,
    y: lastPoint.y,
    width: safeWidth,
    paddingTop,
    chartBottom,
  });

  const firstDateLabel = formatShortDate(summary.first.date);
  const lastDateLabel = formatShortDate(summary.last.date);
  const sameDateLabel = firstDateLabel === lastDateLabel;

  return (
    <View
      style={{
        width: safeWidth,
        height: safeHeight,
        borderRadius: 18,
        overflow: "hidden",
      }}
    >
      <Svg width={safeWidth} height={safeHeight}>
        <Defs>
          <SvgGrad id="weight-area-gradient" x1="0" y1="0" x2="0" y2="1">
            <Stop
              offset="0"
              stopColor={theme.colors.primary}
              stopOpacity={0.28}
            />
            <Stop
              offset="1"
              stopColor={theme.colors.primary}
              stopOpacity={0}
            />
          </SvgGrad>

          <SvgGrad id="weight-line-gradient" x1="0" y1="0" x2="1" y2="0">
            <Stop
              offset="0"
              stopColor={theme.colors.primary}
              stopOpacity={0.78}
            />
            <Stop
              offset="1"
              stopColor={theme.colors.primary}
              stopOpacity={1}
            />
          </SvgGrad>
        </Defs>

        <Path
          d={`M${paddingLeft},${chartBottom} L${
            paddingLeft + chartWidth
          },${chartBottom}`}
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
          {formatWeight(maxWeight)} kg
        </SvgText>

        <SvgText
          x={paddingLeft}
          y={38}
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
          y={38}
          fill={theme.colors.textMuted}
          fontSize="10"
          fontWeight="700"
          textAnchor="end"
        >
          {texts.change}
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
              <Circle
                cx={point.x}
                cy={point.y}
                r={isLast ? 11 : 8}
                fill={theme.colors.primary}
                fillOpacity={0.12}
              />

              <Circle
                cx={point.x}
                cy={point.y}
                r={isLast ? 6.5 : 5}
                fill={theme.colors.primary}
              />

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
          <>
            <SvgText
              x={points[0].x}
              y={
                points[0].y > chartBottom - 28
                  ? points[0].y - 20
                  : points[0].y + 32
              }
              fill={theme.colors.text}
              fontSize="14"
              fontWeight="900"
              textAnchor="middle"
            >
              {formatWeight(points[0].item.weight)} kg
            </SvgText>

            <SvgText
              x={points[0].x}
              y={safeHeight - 14}
              fill={theme.colors.textMuted}
              fontSize="11"
              fontWeight="800"
              textAnchor="middle"
            >
              {formatFullDate(points[0].item.date)}
            </SvgText>
          </>
        ) : (
          <>
            <SvgText
              x={lastLabel.x}
              y={lastLabel.y}
              fill={theme.colors.text}
              fontSize="14"
              fontWeight="900"
              textAnchor={lastLabel.anchor}
            >
              {formatWeight(summary.last.weight)} kg
            </SvgText>

            {sameDateLabel ? (
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
          </>
        )}
      </Svg>
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
        <Text
          style={{
            color: theme.colors.text,
            fontWeight: "700",
            fontSize: 14,
          }}
        >
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
            <Text
              style={{
                color: theme.colors.text,
                fontWeight: "800",
                fontSize: 13,
              }}
            >
              {button.l}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}