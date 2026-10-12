// Görünüm tercihi: telefonu izle, hep açık ya da hep koyu. Sadece sade bölümleri değiştirir (Kumbara, Rapor, Ayarlar);
// oyunlar ve maçlar her zaman koyu arena temasındadır. Telefonda saklanır.
import Storage from 'expo-sqlite/kv-store';
import { Appearance, Platform } from 'react-native';
import { create } from 'zustand';

export type AppearancePref = 'auto' | 'light' | 'dark';
export const APPEARANCES: AppearancePref[] = ['auto', 'light', 'dark'];

const STORAGE_KEY = 'appearance';

function load(): AppearancePref {
  const saved = Storage.getItemSync(STORAGE_KEY);
  return saved === 'light' || saved === 'dark' ? saved : 'auto';
}

// Sistem öğeleri (klavye, uyarılar, kaydırma çubukları) da seçilen temaya uysun
function apply(pref: AppearancePref) {
  if (Platform.OS === 'web') return;
  Appearance.setColorScheme(pref === 'auto' ? 'unspecified' : pref);
}

export const useAppearance = create<{ appearance: AppearancePref; set: (p: AppearancePref) => void }>((set) => ({
  appearance: load(),
  set: (appearance) => {
    Storage.setItemSync(STORAGE_KEY, appearance);
    apply(appearance);
    set({ appearance });
  },
}));

apply(useAppearance.getState().appearance);
