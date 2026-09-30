// Lig seçimi: favori turnuvalar (Maçlar ekranının üst çubuğu) ve en son seçilen turnuva. Telefonda saklanır.
import { defaultFavorites } from '@oran/leagues';
import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';

import { localization } from '@/i18n';

const STORAGE_KEY = 'leagues';

interface Saved {
  /** Kullanıcı hiç değiştirmediyse yok: cihazın ülkesine göre varsayılanlar kullanılır */
  favorites?: string[];
  current?: string;
}

function load(): Saved {
  try {
    return JSON.parse(Storage.getItemSync(STORAGE_KEY) ?? '{}') as Saved;
  } catch {
    return {};
  }
}

function save(change: Saved) {
  Storage.setItemSync(STORAGE_KEY, JSON.stringify({ ...load(), ...change }));
}

interface LeagueState {
  favorites: string[];
  /** Son seçilen turnuva; hiç seçilmediyse undefined */
  current: string | undefined;
  pick: (code: string) => void;
  toggleFavorite: (code: string) => void;
}

const saved = load();

export const useLeagues = create<LeagueState>((set, get) => ({
  favorites: saved.favorites ?? defaultFavorites(localization().regionCode),
  current: saved.current,
  pick: (code) => {
    set({ current: code });
    save({ current: code });
  },
  toggleFavorite: (code) => {
    const { favorites } = get();
    const next = favorites.includes(code) ? favorites.filter((x) => x !== code) : [...favorites, code];
    set({ favorites: next });
    save({ favorites: next });
  },
}));
