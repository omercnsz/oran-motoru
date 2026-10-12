import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { useAppearance } from '@/state/appearance';

const subscribe = () => () => {};

/**
 * Statik web çıktısında sunucu tarafı 'light' ile render eder; tarayıcıda gerçek tema kullanılır.
 * Ayarlar'da açık ya da koyu seçildiyse o kullanılır.
 */
export function useColorScheme() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const appearance = useAppearance((s) => s.appearance);
  const colorScheme = useRNColorScheme();
  if (!hydrated) return 'light';
  return appearance === 'auto' ? colorScheme : appearance;
}
