const sharedSpacing = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
} as const;

const sharedRadius = {
  sm: "6px",
  md: "10px",
  lg: "14px",
} as const;

const sharedTypography = {
  body: "14px",
  title: "20px",
  regular: 400,
  semibold: 600,
} as const;

export const themeTokens = {
  light: {
    colors: {
      bgCanvas: "#f2f3f5",
      surfaceDefault: "#ffffff",
      surfaceMuted: "#e9ebef",
      textPrimary: "#1f2328",
      textMuted: "#59636e",
      borderSubtle: "#d4d9e0",
      accent: "#5865f2",
      accentMuted: "#dde2ff",
      danger: "#d83c3e",
    },
    spacing: sharedSpacing,
    radius: sharedRadius,
    typography: sharedTypography,
  },
  dark: {
    colors: {
      bgCanvas: "#1e1f22",
      surfaceDefault: "#2b2d31",
      surfaceMuted: "#232428",
      textPrimary: "#f2f3f5",
      textMuted: "#b5bac1",
      borderSubtle: "#3b3f45",
      accent: "#5865f2",
      accentMuted: "#31366f",
      danger: "#ed4245",
    },
    spacing: sharedSpacing,
    radius: sharedRadius,
    typography: sharedTypography,
  },
} as const;

export type ThemeName = keyof typeof themeTokens;
export type ThemeTokens = (typeof themeTokens)[ThemeName];
