import { StyleSheet } from 'react-native';

import { AText, Glass } from '@/components/arena/kit';
import { Arena } from '@/constants/arena';
import { useT } from '@/i18n';

/** Veri alınamadı kartı (koyu stadyum teması) */
export function ErrorCard({ message }: { message: string }) {
  const { t } = useT();
  return (
    <Glass style={styles.card}>
      <AText style={styles.title}>{t('common.dataError')}</AText>
      <AText dim style={styles.message}>{message}</AText>
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 6, borderColor: 'rgba(255,77,109,0.35)' },
  title: { fontWeight: '800', color: Arena.danger },
  message: { fontSize: 13, lineHeight: 18 },
});
