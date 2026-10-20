import { Platform, TextStyle, ViewStyle } from 'react-native';
import { DARK_COLORS, type Palette } from './colors';

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const FONT = {
  h1: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 } as TextStyle,
  h2: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 } as TextStyle,
  h3: { fontSize: 18, fontWeight: '700' } as TextStyle,
  title: { fontSize: 16, fontWeight: '700' } as TextStyle,
  body: { fontSize: 15, fontWeight: '400' } as TextStyle,
  small: { fontSize: 13, fontWeight: '400' } as TextStyle,
  caption: { fontSize: 11, fontWeight: '500' } as TextStyle,
} as const;

/**
 * Build the shadow set for a palette. Use it from a style factory:
 *
 *   const styles = makeStyles((COLORS) => StyleSheet.create({
 *     card: { ...makeShadow(COLORS).card },
 *   }));
 */
export function makeShadow(colors: Palette = DARK_COLORS) {
  return {
    card: Platform.select<ViewStyle>({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
      default: {},
    })!,
    floating: Platform.select<ViewStyle>({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 18,
      },
      android: { elevation: 8 },
      default: {},
    })!,
    primary: Platform.select<ViewStyle>({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
      },
      android: { elevation: 6 },
      default: {},
    })!,
  } as const;
}

/**
 * @deprecated Legacy static shadow set (dark palette). Prefer
 * `makeShadow(COLORS)` inside a `makeStyles` factory.
 */
export const SHADOW = makeShadow(DARK_COLORS);
