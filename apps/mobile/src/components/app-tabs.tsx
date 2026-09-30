import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { useT } from '@/i18n';

// Ana sekmeler. İkonlar: iOS'ta SF Symbols, Android'de Material ikonları.
const TABS = [
  { name: 'index', label: 'tabs.matches', sf: 'sportscourt', md: 'sports_soccer' },
  { name: 'kuponlar', label: 'tabs.coupons', sf: 'list.bullet.rectangle', md: 'receipt_long' },
  { name: 'oyunlar', label: 'tabs.games', sf: 'dice', md: 'casino' },
  { name: 'kumbara', label: 'tabs.savings', sf: 'banknote', md: 'savings' },
] as const;

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const { t } = useT();

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      {TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{t(tab.label)}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={tab.sf} md={tab.md} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
