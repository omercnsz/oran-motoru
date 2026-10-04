// Titreşim: dokunuş, kazanç ve kayıp hissi. Ayarlardan kapatılabilir; desteklenmeyen cihazda sessizce geçer.
import * as Haptics from 'expo-haptics';

import { useFeedback } from '@/state/feedback';

const run = (f: () => Promise<void>) => {
  if (!useFeedback.getState().haptics) return;
  f().catch(() => {});
};

export const haptic = {
  /** Seçim değişti (fiş, sekme, adım) */
  select: () => run(() => Haptics.selectionAsync()),
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  heavy: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
