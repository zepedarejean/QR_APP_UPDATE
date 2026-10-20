/**
 * Color palettes for the app.
 *
 * The app ships with two palettes:
 *   - DARK  (default "night mode")
 *   - LIGHT
 *
 * Components should NOT import COLORS directly anymore. Use the
 * `useColors()` hook (see lib/theme.tsx) so the palette follows the
 * theme the user picked in Settings.
 */
export type Palette = {
  primary: string;
  background: string;
  card: string;
  textPrimary: string;
  textSecondary: string;
  textOnPrimary: string;
  surface: string;
  border: string;
  shadow: string;

  warning: string;
  success: string;
  danger: string;
  accent: string;
  magenta: string;

  cardBorderNeon: string;
  muted: string;

  info: string;
  infoSoft: string;
  successSoft: string;
  warningSoft: string;
  dangerSoft: string;
  overlay: string;
  elevated: string;
  inputBackground: string;
  skeleton: string;
};

/** Dark palette — deep navy night mode with white text. */
export const DARK_COLORS: Palette = {
  primary: '#2563EB', // Royal blue — buttons, accents, progress
  background: '#0A1026', // Deep navy black
  card: '#0F1735', // Navy card
  textPrimary: '#FFFFFF', // White
  textSecondary: '#AAB6D8', // Muted blue-gray
  textOnPrimary: '#FFFFFF', // White text on blue buttons
  surface: '#131D42', // Elevated navy surface
  border: '#232F5E', // Subtle navy border
  shadow: '#000000',

  warning: '#FBBF24', // Amber
  success: '#34D399', // Emerald (on-time / present)
  danger: '#F87171', // Soft red (late / absent)
  accent: '#5B8CFF', // Light royal accent
  magenta: '#818CF8', // Indigo accent

  cardBorderNeon: '#3B82F633', // Transparent blue
  muted: '#7E8CB3', // Muted blue-gray

  info: '#60A5FA', // Sky blue
  infoSoft: '#60A5FA22',
  successSoft: '#34D39922',
  warningSoft: '#FBBF2422',
  dangerSoft: '#F8717122',
  overlay: 'rgba(4, 8, 22, 0.72)',
  elevated: '#17214B',
  inputBackground: '#0C1330',
  skeleton: '#1B2552',
};

/** Light palette — white surfaces with a dark-blue accent (professional). */
export const LIGHT_COLORS: Palette = {
  primary: '#1E3A8A', // Dark blue (navy) — buttons, accents
  background: '#F4F6FC', // Soft blue-white
  card: '#FFFFFF', // White
  textPrimary: '#0B1430', // Near-navy black
  textSecondary: '#4C5C7E', // Muted slate
  textOnPrimary: '#FFFFFF', // White text on dark-blue buttons
  surface: '#FFFFFF',
  border: '#DCE3F2', // Light blue-gray border
  shadow: '#12214A',

  warning: '#B45309', // Amber-700
  success: '#15803D', // Green-700
  danger: '#DC2626',
  accent: '#1E3A8A', // Dark blue
  magenta: '#4F46E5', // Indigo

  cardBorderNeon: '#1E3A8A26',
  muted: '#8492AD',

  info: '#2563EB',
  infoSoft: '#2563EB1A',
  successSoft: '#15803D1A',
  warningSoft: '#B453091A',
  dangerSoft: '#DC26261A',
  overlay: 'rgba(10, 16, 38, 0.45)',
  elevated: '#FFFFFF',
  inputBackground: '#FAFBFF',
  skeleton: '#E6EAF6',
};

export const THEMES = {
  dark: DARK_COLORS,
  light: LIGHT_COLORS,
} as const;

/**
 * @deprecated Legacy static palette kept so nothing breaks during the
 * theming migration. Prefer `const COLORS = useColors();` inside your
 * component instead.
 */
export const COLORS = DARK_COLORS;
