// Gerçeklik uyarısı: oyun ekranında belli aralıklarla (tur bitince) süre, tur sayısı ve net sonuç gösterilir.
// "Mola ver" oyundan çıkarır. Oturum ilk turdan önce başlar; ekrandan çıkınca sıfırlanır.
import { router } from 'expo-router';
import { useRef } from 'react';
import { Alert } from 'react-native';

import { gameReport, type Game } from '@/db/games';
import { useT } from '@/i18n';
import { formatNet } from '@/lib/tokens';

export const REALITY_CHECK_MS = 15 * 60_000;

export function useRealityCheck(game: Game) {
  const { t } = useT();
  const session = useRef<{ since: string; startedAt: number; nextCheck: number } | null>(null);

  /** Tur başlamadan hemen önce (ilk turda oturumu başlatır) */
  const begin = (now: Date) => {
    session.current ??= { since: now.toISOString(), startedAt: now.getTime(), nextCheck: now.getTime() + REALITY_CHECK_MS };
  };

  /** Tur bittikten sonra: süre dolduysa uyarı */
  const check = () => {
    const s = session.current;
    if (!s || Date.now() < s.nextCheck) return;
    s.nextCheck = Date.now() + REALITY_CHECK_MS;
    const report = gameReport(game, s.since);
    Alert.alert(t('crash.realityTitle'), t('crash.realityBody', {
      minutes: Math.round((Date.now() - s.startedAt) / 60_000),
      rounds: report.rounds,
      net: formatNet(report.returned - report.staked),
    }), [
      { text: t('crash.takeBreak'), style: 'cancel', onPress: () => router.back() },
      { text: t('crash.keepPlaying') },
    ]);
  };

  return { begin, check };
}
