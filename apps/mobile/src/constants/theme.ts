/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Sade bölümler (Kumbara, Rapor, Ayarlar): telefonun açık/koyu ayarını izler. Marka yeşili vurgu, yumuşak gölgeli kartlar.
// Oyunlar ve maçlar her zaman koyu "arena" temasındadır (constants/arena.ts).
export const Colors = {
  light: {
    text: '#0B1220',
    background: '#F4F6F9',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E7EBF1',
    textSecondary: '#5B6475',
    accent: '#0E7C55',
    accentText: '#ffffff',
    success: '#12965A',
    danger: '#D93A45',
  },
  dark: {
    text: '#F2F5F9',
    background: '#0A0E14',
    backgroundElement: '#141A23',
    backgroundSelected: '#212A36',
    textSecondary: '#8C97A8',
    accent: '#22C38E',
    accentText: '#03140D',
    success: '#3DD68C',
    danger: '#FF6369',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
