import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Arena } from '@/constants/arena';
import { useT } from '@/i18n';

// Ana sekmeler. İkonlar: iOS'ta SF Symbols, Android'de Material ikonları.
const TABS = [
  { name: 'index', label: 'tabs.matches', sf: 'sportscourt', md: 'sports_soccer' },
  { name: 'kuponlar', label: 'tabs.coupons', sf: 'list.bullet.rectangle', md: 'receipt_long' },
  { name: 'oyunlar', label: 'tabs.games', sf: 'dice', md: 'casino' },
  { name: 'kumbara', label: 'tabs.savings', sf: 'banknote', md: 'savings' },
] as const;

// Sekme çubuğu koyu stadyum temasında (maçlar, kuponlar ve oyunlar koyu)
export default function AppTabs() {
  const { t } = useT();

  return (
    <NativeTabs
      backgroundColor={Arena.bgBottom}
      indicatorColor="rgba(43,255,168,0.16)"
      iconColor={{ default: Arena.textDim, selected: Arena.neon }}
      labelStyle={{ default: { color: Arena.textDim }, selected: { color: Arena.neon } }}>
      {TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{t(tab.label)}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={tab.sf} md={tab.md} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
