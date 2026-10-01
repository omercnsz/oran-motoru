import AppTabs from '@/components/app-tabs';
import { useReminderSetup } from '@/notifications';

export default function TabsLayout() {
  // Gezinme burada hazır: bildirime dokununca ilgili ekran açılabilir
  useReminderSetup();
  return <AppTabs />;
}
