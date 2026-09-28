// Hazırlanan (henüz kaydedilmemiş) kupon
import type { Selection } from '@oran/betting';
import { create } from 'zustand';

/** Kupondaki seçim; canlı oranın ne zaman alındığını da tutar */
export type SlipSelection = Selection & { pickedAt: number };

/** Canlı oran bu kadar eskiyse kupon oluşturulmaz (oran değişmiş olabilir) */
export const LIVE_ODDS_MAX_AGE_MS = 60_000;

interface SlipState {
  selections: SlipSelection[];
  /** Aynı sonuç tekrar seçilirse çıkarır; aynı maçtan başka sonuç seçilirse eskisinin yerine koyar */
  toggle: (s: Selection) => void;
  remove: (matchId: string) => void;
  clear: () => void;
}

export const useSlip = create<SlipState>((set) => ({
  selections: [],
  toggle: (s) => set(({ selections }) => {
    const existing = selections.find((x) => x.matchId === s.matchId);
    if (existing && existing.marketKey === s.marketKey && existing.outcomeKey === s.outcomeKey && !!existing.live === !!s.live) {
      return { selections: selections.filter((x) => x.matchId !== s.matchId) };
    }
    return { selections: [...selections.filter((x) => x.matchId !== s.matchId), { ...s, pickedAt: Date.now() }] };
  }),
  remove: (matchId) => set(({ selections }) => ({ selections: selections.filter((x) => x.matchId !== matchId) })),
  clear: () => set({ selections: [] }),
}));

export const isSelected = (selections: Selection[], matchId: string, marketKey: string, outcomeKey: string, live = false) =>
  selections.some((x) => x.matchId === matchId && x.marketKey === marketKey && x.outcomeKey === outcomeKey && !!x.live === live);

/** Süresi geçmiş canlı oran var mı? */
export const staleLiveSelection = (selections: SlipSelection[], now: number) =>
  selections.find((s) => s.live && now - s.pickedAt > LIVE_ODDS_MAX_AGE_MS);
