import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useT } from '@/i18n';

/**
 * Ekranların ortak iskeleti: başlık, açıklama, kaydırılabilir içerik.
 * compact: üstte gezinme çubuğu olan (sekme dışı) ekranlar için; güvenli alan ve büyük başlık boşluğu eklenmez.
 */
export function Screen({ title, subtitle, compact, accessory, children }: {
  title: string; subtitle?: string; compact?: boolean;
  /** Başlığın yanında (ör. ayarlar düğmesi) */
  accessory?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={compact ? [] : ['top']}>
        <ScrollView contentContainerStyle={[styles.content, compact && styles.compact]}>
          <View style={styles.inner}>
            <View style={styles.titleRow}>
              <ThemedText type={compact ? 'default' : 'subtitle'} style={[styles.title, compact && styles.compactTitle]}>{title}</ThemedText>
              {accessory}
            </View>
            {subtitle ? <ThemedText themeColor="textSecondary">{subtitle}</ThemedText> : null}
            {children}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** Henüz yapılmamış bölümler için bilgi kartı */
export function ComingSoon({ phase, items }: { phase: number; items: string[] }) {
  const { t } = useT();
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">{t('common.comingSoon', { n: phase })}</ThemedText>
      {items.map((item) => (
        <ThemedText key={item} type="small" themeColor="textSecondary">• {item}</ThemedText>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    padding: Spacing.three,
    // Web'de sekmeler üstte duruyor; içerik altında kalmasın
    paddingTop: Platform.OS === 'web' ? Spacing.six + Spacing.three : Spacing.three,
    // Kupon çubuğu son satırları kapatmasın
    paddingBottom: BottomTabInset + Spacing.six + Spacing.four,
    alignItems: 'center',
  },
  compact: { paddingTop: Spacing.three },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { flex: 1 },
  compactTitle: { fontWeight: 700 },
  inner: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.three },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.one },
});
