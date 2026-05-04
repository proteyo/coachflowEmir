import { TextStyle } from "react-native";

export type ThemeMode = "light" | "dark";

export interface ThemeColors {
  bg: string;
  bgElevated: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderSoft: string;
  text: string;
  textMuted: string;
  textFaint: string;
  primary: string;
  primaryDark: string;
  primaryContrast: string;
  accent: string;
  warn: string;
  danger: string;
  success: string;
  fire: string;
  shadow: string;
  overlay: string;
  tabBar: string;
  inputBg: string;
}

const palette = {
  emerald: "#16C784",
  emeraldDark: "#0EA968",
  navy: "#0B1A2E",
  navyDeep: "#070F1C",
  navySoft: "#0E2440",
  ink: "#0A0F1A",
  fire: "#FF7A1A",
  amber: "#FFB020",
  rose: "#EF4444",
  white: "#FFFFFF",
  cloud: "#F5F7FA",
  mist: "#EEF1F6",
  steel: "#9AA4B2",
  graphite: "#3B4554",
};

export const lightColors: ThemeColors = {
  bg: palette.cloud,
  bgElevated: palette.white,
  surface: palette.white,
  surfaceAlt: palette.mist,
  border: "#E2E7EE",
  borderSoft: "#EDF1F6",
  text: "#0B1A2E",
  textMuted: "#5B6776",
  textFaint: "#94A0AF",
  primary: palette.emerald,
  primaryDark: palette.emeraldDark,
  primaryContrast: palette.white,
  accent: "#3B82F6",
  warn: palette.amber,
  danger: palette.rose,
  success: palette.emerald,
  fire: palette.fire,
  shadow: "rgba(11,26,46,0.10)",
  overlay: "rgba(11,26,46,0.45)",
  tabBar: palette.white,
  inputBg: "#F2F5F9",
};

export const darkColors: ThemeColors = {
  bg: palette.navyDeep,
  bgElevated: "#0F1B2D",
  surface: "#0F1B2D",
  surfaceAlt: "#152439",
  border: "#1E2E47",
  borderSoft: "#162236",
  text: "#F1F5FB",
  textMuted: "#9AA8BC",
  textFaint: "#5E6E84",
  primary: palette.emerald,
  primaryDark: palette.emeraldDark,
  primaryContrast: palette.navyDeep,
  accent: "#60A5FA",
  warn: palette.amber,
  danger: palette.rose,
  success: palette.emerald,
  fire: palette.fire,
  shadow: "rgba(0,0,0,0.4)",
  overlay: "rgba(0,0,0,0.6)",
  tabBar: "#0B1525",
  inputBg: "#152439",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 28,
  pill: 999,
};

export const typography: Record<string, TextStyle> = {
  display: { fontSize: 34, fontWeight: "800", letterSpacing: -0.5 },
  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.3 },
  h2: { fontSize: 20, fontWeight: "700", letterSpacing: -0.2 },
  h3: { fontSize: 17, fontWeight: "700" },
  body: { fontSize: 15, fontWeight: "500" },
  bodyStrong: { fontSize: 15, fontWeight: "700" },
  small: { fontSize: 13, fontWeight: "500" },
  caption: { fontSize: 11, fontWeight: "600", letterSpacing: 0.4 },
};

export const gradients = {
  primary: ["#0E2440", "#0B1A2E"] as const,
  emerald: ["#16C784", "#0EA968"] as const,
  fire: ["#FFB020", "#FF7A1A"] as const,
  hero: ["#0E2440", "#16C784"] as const,
  card: ["#16243E", "#0B1A2E"] as const,
  rose: ["#F472B6", "#EF4444"] as const,
};

export const shadows = {
  card: {
    shadowColor: "#0B1A2E",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  big: {
    shadowColor: "#0B1A2E",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
};

export type AppTheme = {
  mode: ThemeMode;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  gradients: typeof gradients;
  shadows: typeof shadows;
};

export function buildTheme(mode: ThemeMode): AppTheme {
  return {
    mode,
    colors: mode === "dark" ? darkColors : lightColors,
    spacing,
    radius,
    typography,
    gradients,
    shadows,
  };
}
