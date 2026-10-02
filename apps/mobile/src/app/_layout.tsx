import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { ActivityIndicator, AppState, Platform, StyleSheet, useColorScheme, View } from 'react-native';

import migrations from '../../drizzle/migrations';
import { ThemedText } from '@/components/themed-text';
import { db } from '@/db/client';
import { useT } from '@/i18n';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

// Uygulama arka plandayken canlı skor sorgusu durur, öne gelince yenilenir
if (Platform.OS !== 'web') {
  focusManager.setEventListener((setFocused) => {
    const sub = AppState.addEventListener('change', (s) => setFocused(s === 'active'));
    return () => sub.remove();
  });
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { t } = useT();
  // Veritabanı şeması güncel değilse ekranlar açılmadan önce güncellenir
  const { success, error } = useMigrations(db, migrations);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {error ? (
        <View style={styles.center}><ThemedText>{t('common.dbError', { message: error.message })}</ThemedText></View>
      ) : !success ? (
        <View style={styles.center}><ActivityIndicator /></View>
      ) : (
        <QueryClientProvider client={queryClient}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="mac/[id]" options={{ title: t('nav.match'), headerBackTitle: t('nav.back') }} />
            <Stack.Screen name="canli/[espnId]" options={{ title: t('nav.live'), headerBackTitle: t('nav.back') }} />
            <Stack.Screen name="ligler" options={{ title: t('leagues.title'), presentation: 'modal' }} />
            <Stack.Screen name="kupon" options={{ title: t('nav.coupon'), presentation: 'modal' }} />
            <Stack.Screen name="crash" options={{ title: t('games.crash'), headerBackTitle: t('tabs.games') }} />
            <Stack.Screen name="rulet" options={{ title: t('games.roulette'), headerBackTitle: t('tabs.games') }} />
            <Stack.Screen name="slot" options={{ title: t('games.slot'), headerBackTitle: t('tabs.games') }} />
            <Stack.Screen name="rapor" options={{ title: t('report.title'), headerBackButtonDisplayMode: 'minimal' }} />
            <Stack.Screen name="ayarlar" options={{ title: t('nav.settings'), headerBackTitle: t('nav.back') }} />
          </Stack>
        </QueryClientProvider>
      )}
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 } });
