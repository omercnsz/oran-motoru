import { useColorScheme as useSystemColorScheme } from 'react-native';

import { useAppearance } from '@/state/appearance';

/** Ayarlar'da açık ya da koyu seçildiyse o, yoksa telefonun teması */
export function useColorScheme() {
  const appearance = useAppearance((s) => s.appearance);
  const system = useSystemColorScheme();
  return appearance === 'auto' ? system : appearance;
}
