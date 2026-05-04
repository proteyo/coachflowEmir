import React, { useMemo } from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, LinearGradient as SvgGrad, Path, Stop, Text as SvgText } from "react-native-svg";
import { useTheme } from "@/src/context/ThemeContext";

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
  progress: number; // 0..1
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
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGrad id="g" x1="0" y1="0" x2="1" y2="1">
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
          stroke="url(#g)"
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

export function WeightChart({
  values,
  width = 320,
  height = 160,
}: {
  values: { date: string; weight: number }[];
  width?: number;
  height?: number;
}) {
  const { theme } = useTheme();
  const data = useMemo(() => {
    const sorted = [...values].sort((a, b) => (a.date > b.date ? 1 : -1));
    return sorted;
  }, [values]);

  if (data.length < 2) {
    return (
      <View style={{ width, height, alignItems: "center", justifyContent: "center" }}>
        <SvgText x={0} y={0} fill={theme.colors.textMuted}>
          Not enough data
        </SvgText>
      </View>
    );
  }

  const padding = 16;
  const w = width - padding * 2;
  const h = height - padding * 2;
  const min = Math.min(...data.map((d) => d.weight));
  const max = Math.max(...data.map((d) => d.weight));
  const range = max - min || 1;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * w;
    const y = padding + h - ((d.weight - min) / range) * h;
    return { x, y };
  });

  const path = points
    .map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`))
    .join(" ");
  const area = `${path} L${points[points.length - 1].x},${padding + h} L${points[0].x},${padding + h} Z`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGrad id="area" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={theme.colors.primary} stopOpacity={0.35} />
          <Stop offset="1" stopColor={theme.colors.primary} stopOpacity={0} />
        </SvgGrad>
      </Defs>
      <Path d={area} fill="url(#area)" />
      <Path d={path} stroke={theme.colors.primary} strokeWidth={3} fill="none" strokeLinecap="round" />
      {points.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={4} fill={theme.colors.primary} />
      ))}
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
