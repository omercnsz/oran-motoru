// Raporda oyun jetonunun para karşılığı: 1 jeton = 0,10 / 1 / 10 para birimi. Telefonda saklanır.
// Jetonun gerçek bir değeri yok; bu sadece "gerçek parayla oynasaydın" sorusunu oyunlar için de cevaplamak için.
import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';

export const TOKEN_VALUES = [0.1, 1, 10] as const;
export type TokenValue = (typeof TOKEN_VALUES)[number];

const STORAGE_KEY = 'report';

function load(): TokenValue {
  try {
    const v = (JSON.parse(Storage.getItemSync(STORAGE_KEY) ?? '{}') as { tokenValue?: number }).tokenValue;
    return TOKEN_VALUES.find((x) => x === v) ?? 1;
  } catch {
    return 1;
  }
}

export const useReportSettings = create<{ tokenValue: TokenValue; setTokenValue: (v: TokenValue) => void }>((set) => ({
  tokenValue: load(),
  setTokenValue: (tokenValue) => {
    Storage.setItemSync(STORAGE_KEY, JSON.stringify({ tokenValue }));
    set({ tokenValue });
  },
}));
