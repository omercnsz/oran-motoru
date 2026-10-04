// Oyun kartı: köşede değer ve renk işareti, ortada büyük renk işareti. Kapalı kart desenli arka yüz.
import { cardRank, cardSuit, type Card } from '@oran/games-math';
import { StyleSheet, Text, View } from 'react-native';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
// \uFE0E: emoji değil yazı karakteri olarak çizilsin (iOS kırmızı kalbi emojiye çevirmesin)
const SUITS = ['\u2660\uFE0E', '\u2665\uFE0E', '\u2666\uFE0E', '\u2663\uFE0E'];
const RED = '#C62828';
const BLACK = '#111111';

export const CARD_WIDTH = 58;
export const CARD_HEIGHT = 82;

export function PlayingCard({ card, hidden }: { card: Card; hidden?: boolean }) {
  if (hidden) {
    return (
      <View style={[styles.card, styles.back]} accessibilityLabel="?">
        <View style={styles.backInner}>
          <View style={styles.backMark} />
        </View>
      </View>
    );
  }
  const suit = cardSuit(card);
  const color = suit === 1 || suit === 2 ? RED : BLACK;
  const rank = RANKS[cardRank(card)];
  return (
    <View style={styles.card} accessibilityLabel={`${rank} ${SUITS[suit]}`}>
      <Text style={[styles.rank, { color }]}>{rank}</Text>
      <Text style={[styles.corner, { color }]}>{SUITS[suit]}</Text>
      <Text style={[styles.center, { color }]}>{SUITS[suit]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: 6, backgroundColor: '#ffffff', padding: 4,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#00000033',
    shadowColor: '#000000', shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3,
  },
  rank: { fontSize: 17, lineHeight: 19, fontWeight: 800 },
  corner: { fontSize: 13, lineHeight: 15 },
  center: { position: 'absolute', right: 6, bottom: 2, fontSize: 30, lineHeight: 36 },
  back: {
    backgroundColor: '#0D1A3A', padding: 4, borderColor: '#2BFFA866',
    experimental_backgroundImage: 'linear-gradient(135deg, #13265A 0%, #0A1430 100%)',
  },
  backInner: {
    flex: 1, borderRadius: 4, borderWidth: 1.5, borderColor: '#2BFFA8AA', alignItems: 'center', justifyContent: 'center',
    experimental_backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(43,255,168,0.25) 0%, rgba(43,255,168,0) 70%)',
  },
  backMark: { width: 16, height: 16, borderRadius: 3, borderWidth: 2, borderColor: '#2BFFA8', transform: [{ rotate: '45deg' }] },
});
