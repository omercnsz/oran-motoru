// Titreşim: dokunuş, kazanç ve kayıp hissi. Ayarlardan kapatılabilir; desteklenmeyen cihazda sessizce geçer.
import * as Haptics from 'expo-haptics';

import { useFeedback } from '@/state/feedback';

// Hafif titreşimler (seçim, hafif darbe) bundan sık tetiklenmez: plinko çivileri gibi art arda gelen
// olaylarda hem el hissi bulanıklaşıyor hem de her çağrı ana iş parçacığına yük bindiriyordu.
const LIGHT_GAP_MS = 60;
let lastLight = 0;

const run = (f: () => Promise<void>) => {
  if (!useFeedback.getState().haptics) return;
  f().catch(() => {});
};

const runLight = (f: () => Promise<void>) => {
  const now = Date.now();
  if (now - lastLight < LIGHT_GAP_MS) return;
  lastLight = now;
  run(f);
};

export const haptic = {
  /** Seçim değişti (fiş, sekme, adım) */
  select: () => runLight(() => Haptics.selectionAsync()),
  light: () => runLight(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  heavy: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
