import React, { useMemo } from "react";
import { View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGrad,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import { useTheme } from "@/src/context/ThemeContext";

type WeightChartItem = {
  date?: string;
  createdAt?: string;
  created_at?: string;
  weight?: number | string;
};

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

function normalizeWeightEntry(entry: WeightChartItem) {
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

export function WeightChart({
  values,
  width = 320,
  height = 160,
}: {
  values: WeightChartItem[];
  width?: number;
  height?: number;
}) {
  const { theme } = useTheme();

  const data = useMemo(() => {
    return values
      .map(normalizeWeightEntry)
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => {
        if (a.time !== b.time) {
          return a.time - b.time;
        }

        return a.date.localeCompare(b.date);
      });
  }, [values]);

  if (data.length === 0) {
    return (
      <View
        style={{
          width,
          height,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 18,
          backgroundColor: theme.colors.surfaceAlt,
        }}
      >
        <Svg width={width} height={height}>
          <SvgText
            x={width / 2}
            y={height / 2 - 6}
            fill={theme.colors.textMuted}
            fontSize="14"
            fontWeight="700"
            textAnchor="middle"
          >
            No weight data yet
          </SvgText>

          <SvgText
            x={width / 2}
            y={height / 2 + 16}
            fill={theme.colors.textMuted}
            fontSize="11"
            fontWeight="500"
            textAnchor="middle"
          >
            Add a weight entry to see progress
          </SvgText>
        </Svg>
      </View>
    );
  }

  const paddingX = 20;
  const paddingTop = 22;
  const paddingBottom = 34;

  const chartWidth = Math.max(1, width - paddingX * 2);
  const chartHeight = Math.max(1, height - paddingTop - paddingBottom);

  const weights = data.map((item) => item.weight);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);

  const rawRange = maxWeight - minWeight;
  const range = rawRange === 0 ? 2 : rawRange;

  const visualMin = rawRange === 0 ? minWeight - 1 : minWeight;
  const visualMax = rawRange === 0 ? maxWeight + 1 : maxWeight;

  const points = data.map((item, index) => {
    const x =
      data.length === 1
        ? paddingX + chartWidth / 2
        : paddingX + (index / (data.length - 1)) * chartWidth;

    const y =
      paddingTop +
      chartHeight -
      ((item.weight - visualMin) / Math.max(1, visualMax - visualMin)) *
        chartHeight;

    return {
      x,
      y,
      item,
    };
  });

  const path =
    points.length === 1
      ? ""
      : points
          .map((point, index) =>
            index === 0 ? `M${point.x},${point.y}` : `L${point.x},${point.y}`,
          )
          .join(" ");

  const area =
    points.length === 1
      ? ""
      : `${path} L${points[points.length - 1].x},${paddingTop + chartHeight} L${
          points[0].x
        },${paddingTop + chartHeight} Z`;

  const current = data[data.length - 1];
  const first = data[0];
  const diff = current.weight - first.weight;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGrad id="weight-area-gradient" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={theme.colors.primary} stopOpacity={0.35} />
          <Stop offset="1" stopColor={theme.colors.primary} stopOpacity={0} />
        </SvgGrad>
      </Defs>

      <Path
        d={`M${paddingX},${paddingTop + chartHeight} L${
          paddingX + chartWidth
        },${paddingTop + chartHeight}`}
        stroke={theme.colors.borderSoft}
        strokeWidth={1}
        fill="none"
      />

      <SvgText
        x={paddingX}
        y={14}
        fill={theme.colors.textMuted}
        fontSize="11"
        fontWeight="700"
      >
        {formatWeight(maxWeight)} kg
      </SvgText>

      <SvgText
        x={paddingX}
        y={height - 8}
        fill={theme.colors.textMuted}
        fontSize="11"
        fontWeight="700"
      >
        {formatWeight(minWeight)} kg
      </SvgText>

      <SvgText
        x={width - paddingX}
        y={14}
        fill={diff >= 0 ? theme.colors.fire : theme.colors.success}
        fontSize="11"
        fontWeight="800"
        textAnchor="end"
      >
        {diff >= 0 ? "+" : ""}
        {formatWeight(diff)} kg
      </SvgText>

      {area ? <Path d={area} fill="url(#weight-area-gradient)" /> : null}

      {path ? (
        <Path
          d={path}
          stroke={theme.colors.primary}
          strokeWidth={3}
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
              r={isLast ? 6 : 4}
              fill={theme.colors.primary}
            />

            <Circle
              cx={point.x}
              cy={point.y}
              r={isLast ? 10 : 7}
              fill="transparent"
              stroke={theme.colors.primary}
              strokeOpacity={isLast ? 0.22 : 0.12}
              strokeWidth={2}
            />
          </React.Fragment>
        );
      })}

      {points.length === 1 ? (
        <>
          <SvgText
            x={points[0].x}
            y={points[0].y - 16}
            fill={theme.colors.text}
            fontSize="13"
            fontWeight="800"
            textAnchor="middle"
          >
            {formatWeight(points[0].item.weight)} kg
          </SvgText>

          <SvgText
            x={points[0].x}
            y={points[0].y + 28}
            fill={theme.colors.textMuted}
            fontSize="11"
            fontWeight="600"
            textAnchor="middle"
          >
            {formatShortDate(points[0].item.date)}
          </SvgText>
        </>
      ) : (
        <>
          <SvgText
            x={points[0].x}
            y={height - 8}
            fill={theme.colors.textMuted}
            fontSize="10"
            fontWeight="600"
            textAnchor="start"
          >
            {formatShortDate(points[0].item.date)}
          </SvgText>

          <SvgText
            x={points[points.length - 1].x}
            y={height - 8}
            fill={theme.colors.textMuted}
            fontSize="10"
            fontWeight="600"
            textAnchor="end"
          >
            {formatShortDate(points[points.length - 1].item.date)}
          </SvgText>

          <SvgText
            x={points[points.length - 1].x}
            y={Math.max(14, points[points.length - 1].y - 12)}
            fill={theme.colors.text}
            fontSize="12"
            fontWeight="800"
            textAnchor="end"
          >
            {formatWeight(current.weight)} kg
          </SvgText>
        </>
      )}
    </Svg>
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
        <SvgText fill={theme.colors.text} fontWeight="600" fontSize="14">
          {label}
        </SvgText>
      ) : null}

      <View style={{ flexDirection: "row", gap: 12 }}>
        {[
          { d: -step, l: `-${step}` },
          { d: step, l: `+${step}` },
          { d: step * 4, l: `+${step * 4}` },
        ].map((b) => (
          <View key={b.l} />
        ))}
      </View>
    </View>
  );
}