// Özet ekranlarındaki reklam afişi; yüklenince üstünde "Reklam" etiketiyle görünür, yüklenemezse yer kaplamaz.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';

import { AD_REQUEST, BANNER_ID, useAds } from '@/ads';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useT } from '@/i18n';

/** Afiş yüksekliği sınırı: içerikle yarışmasın */
const MAX_HEIGHT = 100;

export function AdBanner() {
  const { t } = useT();
  const ready = useAds((s) => s.ready);
  const [width, setWidth] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!ready || failed) return null;
  return (
    <View style={styles.wrap} onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}>
      {loaded ? <ThemedText type="small" themeColor="textSecondary">{t('ads.label')}</ThemedText> : null}
      {width > 0 ? (
        <BannerAd
          unitId={BANNER_ID}
          size={BannerAdSize.INLINE_ADAPTIVE_BANNER}
          width={width}
          maxHeight={MAX_HEIGHT}
          requestOptions={AD_REQUEST}
          onAdLoaded={() => setLoaded(true)}
          onAdFailedToLoad={(err) => {
            console.warn('Reklam yüklenemedi:', err.message);
            setFailed(true);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: Spacing.one },
});
