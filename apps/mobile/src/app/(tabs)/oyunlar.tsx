import { ComingSoon, Screen } from '@/components/screen';
import { useT } from '@/i18n';

export default function OyunlarScreen() {
  const { t } = useT();
  return (
    <Screen title={t('games.title')} subtitle={t('games.subtitle')}>
      <ComingSoon phase={3} items={[t('games.crash')]} />
      <ComingSoon phase={4} items={[t('games.roulette')]} />
      <ComingSoon phase={5} items={[t('games.slot')]} />
    </Screen>
  );
}
