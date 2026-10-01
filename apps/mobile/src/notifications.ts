// Maç hatırlatmaları: kupondaki bir maç başlamadan 15 dakika önce telefon kendisi bildirim gösterir (yerel bildirim;
// sunucu ve ücretli Apple hesabı gerekmez). Sadece kullanıcının kendi kuponları için: yeni bahse çağıran bildirim yok.
import { and, eq } from 'drizzle-orm';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import Storage from 'expo-sqlite/kv-store';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';

import { db } from '@/db/client';
import { coupons, selections } from '@/db/schema';
import { t, useLocalization } from '@/i18n';
import { formatTime } from '@/lib/format';

const LEAD_MS = 15 * 60_000;
const PREFIX = 'kickoff:';
const CHANNEL = 'matches';
const STORAGE_KEY = 'notifications';

// Uygulama açıkken gelen bildirim de gösterilir
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

type Permission = 'granted' | 'denied' | 'undetermined';

interface ReminderState {
  /** Kullanıcının tercihi (Ayarlar); izin verilmemişse bildirim yine gelmez */
  kickoff: boolean;
  permission: Permission;
  setKickoff: (on: boolean) => Promise<void>;
}

interface Saved {
  kickoff?: boolean;
  /** İzin kendiliğinden bir kez sorulur (ilk kupon); sonrası sadece Ayarlar'dan */
  asked?: boolean;
}

function loadSaved(): Saved {
  try {
    return JSON.parse(Storage.getItemSync(STORAGE_KEY) ?? '{}') as Saved;
  } catch {
    return {};
  }
}

const save = (change: Saved) => Storage.setItemSync(STORAGE_KEY, JSON.stringify({ ...loadSaved(), ...change }));

export const useReminders = create<ReminderState>((set) => ({
  kickoff: loadSaved().kickoff ?? true,
  permission: 'undetermined',
  setKickoff: async (on) => {
    save({ kickoff: on });
    set({ kickoff: on });
    if (on) await askPermission(true);
    await syncReminders();
  },
}));

// Android 13+ henüz sorulmamış izni de "denied" bildirir; sorulup sorulamayacağını canAskAgain söyler
async function refreshPermission(): Promise<boolean> {
  const { granted, canAskAgain } = await Notifications.getPermissionsAsync();
  useReminders.setState({ permission: granted ? 'granted' : canAskAgain && !loadSaved().asked ? 'undetermined' : 'denied' });
  return granted;
}

/** Android 13+ izin penceresi ancak bir bildirim kanalı varsa açılır */
async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: t('notifications.channel'),
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/** Bildirim iznini sorar: kendiliğinden (ilk kupon kaydedilince) en fazla bir kez, Ayarlar'dan açılınca yeniden. */
export async function askPermission(fromSettings = false): Promise<void> {
  if (!useReminders.getState().kickoff) return;
  const { granted, canAskAgain } = await Notifications.getPermissionsAsync();
  if (granted || !canAskAgain || (!fromSettings && loadSaved().asked)) return;
  save({ asked: true });
  await ensureChannel();
  await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
  await refreshPermission();
}

interface Reminder { identifier: string; date: number; title: string; body: string; url: string }

/** Açık kuponlardaki, henüz başlamamış maç öncesi seçimler (her maç bir kez) */
function wantedReminders(now: number): Reminder[] {
  const rows = db.selectDistinct({
    matchId: selections.matchId, home: selections.home, away: selections.away,
    kickoff: selections.kickoff, espnId: selections.espnId,
  }).from(selections)
    .innerJoin(coupons, eq(coupons.id, selections.couponId))
    .where(and(eq(coupons.status, 'open'), eq(selections.status, 'open'), eq(selections.live, false)))
    .all();
  const byMatch = new Map<string, Reminder>();
  for (const r of rows) {
    const date = Date.parse(r.kickoff) - LEAD_MS;
    if (date <= now || byMatch.has(r.matchId)) continue;
    byMatch.set(r.matchId, {
      identifier: `${PREFIX}${r.matchId}`,
      date,
      // Başlama saati başlıkta: bildirim gecikse de (Android tam zamanlı alarm izni yoksa) doğru kalır
      title: t('notifications.kickoffTitle', { match: `${r.home} – ${r.away}`, time: formatTime(r.kickoff) }),
      body: t('notifications.kickoffBody'),
      url: r.espnId ? `/canli/${r.espnId}` : '/kuponlar',
    });
  }
  return [...byMatch.values()];
}

/** Planlanmış hatırlatmaları kuponlara göre günceller: gerekenleri ekler, gereksizleri ve dili eskiyenleri siler. */
async function sync(): Promise<void> {
  const granted = await refreshPermission();
  const wanted = new Map((granted && useReminders.getState().kickoff ? wantedReminders(Date.now()) : [])
    .map((r) => [r.identifier, r]));
  const scheduled = (await Notifications.getAllScheduledNotificationsAsync()).filter((n) => n.identifier.startsWith(PREFIX));
  for (const n of scheduled) {
    const w = wanted.get(n.identifier);
    if (w && n.content.title === w.title && n.content.body === w.body) wanted.delete(n.identifier);
    else await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
  if (wanted.size > 0) await ensureChannel();
  for (const r of wanted.values()) {
    await Notifications.scheduleNotificationAsync({
      identifier: r.identifier,
      content: { title: r.title, body: r.body, data: { url: r.url } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.date, channelId: CHANNEL },
    });
  }
}

// Eşzamanlı çağrılar sıraya girer (aynı bildirimi iki kez kurmamak için)
let queue: Promise<void> = Promise.resolve();
export function syncReminders(): Promise<void> {
  queue = queue.then(sync).catch((err) => console.warn('Hatırlatmalar güncellenemedi:', (err as Error).message));
  return queue;
}

/**
 * Bildirime dokununca ilgili ekranı açar; uygulama açılınca, öne gelince ve dil değişince hatırlatmaları günceller.
 * Gezinme hazır olduktan sonra çalışmalı: sekmelerin düzeninde kullanılır.
 */
export function useReminderSetup() {
  const language = useLocalization((l) => l.language);
  useEffect(() => { void syncReminders(); }, [language]);
  useEffect(() => {
    const open = (n: Notifications.Notification) => {
      const url = n.request.content.data?.url;
      if (typeof url === 'string') router.push(url as never);
    };
    const last = Notifications.getLastNotificationResponse();
    if (last?.notification) {
      open(last.notification);
      Notifications.clearLastNotificationResponse();
    }
    const tap = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification));
    const state = AppState.addEventListener('change', (s) => { if (s === 'active') void syncReminders(); });
    return () => { tap.remove(); state.remove(); };
  }, []);
}
