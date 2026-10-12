// İlk açılış tanıtımı bir kez gösterilir; Ayarlar → Hakkında'dan yeniden açılabilir. Telefonda saklanır.
import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';

const STORAGE_KEY = 'introSeen';

export const useIntro = create<{ visible: boolean; show: () => void; done: () => void }>((set) => ({
  visible: Storage.getItemSync(STORAGE_KEY) !== '1',
  show: () => set({ visible: true }),
  done: () => {
    Storage.setItemSync(STORAGE_KEY, '1');
    set({ visible: false });
  },
}));
