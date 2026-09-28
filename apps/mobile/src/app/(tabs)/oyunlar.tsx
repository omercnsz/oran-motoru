import { ComingSoon, Screen } from '@/components/screen';

export default function OyunlarScreen() {
  return (
    <Screen title="Oyunlar" subtitle="Sadece sanal jetonla. Satın alma yok, paraya çevrilemez.">
      <ComingSoon phase="Faz 3" items={['Crash']} />
      <ComingSoon phase="Faz 4" items={['Rulet']} />
      <ComingSoon phase="Faz 5" items={['Slot']} />
    </Screen>
  );
}
