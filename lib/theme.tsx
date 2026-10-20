import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';

import { DARK_COLORS, LIGHT_COLORS, type Palette } from '@/constants/colors';

export type ThemeName = 'dark' | 'light';

const STORAGE_KEY = 'qratt.theme';

type ThemeContextValue = {
  theme: ThemeName;
  colors: Palette;
  isDark: boolean;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  colors: DARK_COLORS,
  isDark: true,
  setTheme: () => {},
  toggleTheme: () => {},
});

/** The palette that style factories read from. */
let activeColors: Palette = DARK_COLORS;

export function getActiveColors(): Palette {
  return activeColors;
}

// ---------------------------------------------------------------------------
// Style cache
// ---------------------------------------------------------------------------
// Styles are built lazily from the ACTIVE palette and cached per factory
// function. When the theme changes we bump `styleVersion`, which invalidates
// every cached stylesheet. Components remount (the root view is keyed by the
// theme name) so they rebuild their styles with the new palette.
// ---------------------------------------------------------------------------
let styleVersion = 0;
const styleCache = new WeakMap<object, { version: number; value: unknown }>();

/**
 * Returns a `useStyles()` hook that builds (and caches) the stylesheet from
 * the ACTIVE palette. When the theme changes, `styleVersion` bumps and every
 * cached stylesheet is rebuilt on the next render.
 */
export function makeStyles<T>(factory: (colors: Palette) => T): () => T {
  const key = factory as unknown as object;
  return () => {
    const hit = styleCache.get(key);
    if (hit && hit.version === styleVersion) return hit.value as T;
    const value = factory(activeColors);
    styleCache.set(key, { version: styleVersion, value });
    return value;
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('dark');

  // Restore the saved theme as soon as possible.
  useEffect(() => {
    let mounted = true;
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((value) => {
        if (!mounted) return;
        if (value === 'light' || value === 'dark') setThemeState(value);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const colors = theme === 'light' ? LIGHT_COLORS : DARK_COLORS;

  // Keep the palette read by style factories in sync.
  useEffect(() => {
    activeColors = colors;
    styleVersion += 1;
  }, [colors]);

  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next);
    SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      colors,
      isDark: theme === 'dark',
      setTheme,
      toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    }),
    [theme, colors, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * The current palette. Use it for inline color values:
 *
 *   const COLORS = useColors();
 *   <Text style={{ color: COLORS.textPrimary }}>Hi</Text>
 */
export function useColors(): Palette {
  return useContext(ThemeContext).colors;
}
