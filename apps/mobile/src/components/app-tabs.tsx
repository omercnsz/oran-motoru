import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

// Ana sekmeler. İkonlar: iOS'ta SF Symbols, Android'de Material ikonları.
const TABS = [
  { name: 'index', label: 'Maçlar', sf: 'sportscourt', md: 'sports_soccer' },
  { name: 'kuponlar', label: 'Kuponlar', sf: 'list.bullet.rectangle', md: 'receipt_long' },
  { name: 'oyunlar', label: 'Oyunlar', sf: 'dice', md: 'casino' },
  { name: 'kumbara', label: 'Kumbara', sf: 'turkishlirasign.circle', md: 'savings' },
] as const;

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      {TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={tab.sf} md={tab.md} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
