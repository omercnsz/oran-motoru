import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

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
            {/* Gezinme çubuklu ekranlarda başlık zaten üstte yazar; tekrarlanmaz */}
            {compact ? null : (
              <View style={styles.titleRow}>
                <ThemedText type="title" style={styles.title}>{title}</ThemedText>
                {accessory}
              </View>
            )}
            {subtitle ? <ThemedText themeColor="textSecondary">{subtitle}</ThemedText> : null}
            {children}
          </View>
        </ScrollView>
      </SafeAreaView>
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
  title: { flex: 1, fontSize: 32, lineHeight: 42 },
  inner: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.three },
});
