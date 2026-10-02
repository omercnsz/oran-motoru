import { useEffect } from 'react';

import { startAds } from '@/ads';
import AppTabs from '@/components/app-tabs';
import { useReminderSetup } from '@/notifications';

export default function TabsLayout() {
  // Gezinme burada hazır: bildirime dokununca ilgili ekran açılabilir
  useReminderSetup();
  useEffect(() => { void startAds(); }, []);
  return <AppTabs />;
}
