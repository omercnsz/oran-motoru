// Ses efektleri, müzik ve titreşim tercihleri. Telefonda saklanır; hepsi varsayılan olarak açık.
import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';

const STORAGE_KEY = 'feedback';

export interface FeedbackPrefs { sound: boolean; music: boolean; haptics: boolean }
const DEFAULTS: FeedbackPrefs = { sound: true, music: true, haptics: true };

function load(): FeedbackPrefs {
  try {
    return { ...DEFAULTS, ...(JSON.parse(Storage.getItemSync(STORAGE_KEY) ?? '{}') as Partial<FeedbackPrefs>) };
  } catch {
    return DEFAULTS;
  }
}

export const useFeedback = create<FeedbackPrefs & { set: (p: Partial<FeedbackPrefs>) => void }>((set, get) => ({
  ...load(),
  set: (p) => {
    const { sound, music, haptics } = { ...get(), ...p };
    Storage.setItemSync(STORAGE_KEY, JSON.stringify({ sound, music, haptics }));
    set(p);
  },
}));
