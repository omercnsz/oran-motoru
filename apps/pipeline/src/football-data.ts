// football-data.co.uk ücretsiz CSV'lerinden geçmiş maç sonuçlarını okur (fikstür ESPN'den gelir).
// Lig kodları: T1 = Süper Lig, E0 = Premier League, SP1 = La Liga, I1 = Serie A, D1 = Bundesliga ...
// Sezon kodu: 2025/26 → "2526".

import { readFile, writeFile } from 'node:fs/promises';
import type { MatchResult } from '@oran/odds-engine';

export interface CsvMatch extends MatchResult {
  time: string;
  league: string;
  /** Piyasa ortalama oranları: sadece motorumuzu test etmek için */
  marketOdds: { H: number; D: number; A: number };
}

export function parseCsv(text: string): CsvMatch[] {
  const lines = text.replace(/^﻿/, '').trim().split(/\r?\n/);
  const header = lines[0].split(',');
  const col = (name: string) => header.indexOf(name);
  const idx = {
    date: col('Date'), time: col('Time'), home: col('HomeTeam'), away: col('AwayTeam'), hg: col('FTHG'), ag: col('FTAG'),
    avgH: col('AvgH'), avgD: col('AvgD'), avgA: col('AvgA'),
  };
  return lines.slice(1).map((line) => {
    const c = line.split(',');
    const [d, mo, y] = c[idx.date].split('/').map(Number);
    const num = (i: number) => (i >= 0 && c[i] !== '' ? Number(c[i]) : NaN);
    return {
      date: new Date(Date.UTC(y < 100 ? 2000 + y : y, mo - 1, d)),
      time: idx.time >= 0 ? c[idx.time] : '',
      league: c[0],
      home: c[idx.home], away: c[idx.away],
      hg: num(idx.hg), ag: num(idx.ag),
      marketOdds: { H: num(idx.avgH), D: num(idx.avgD), A: num(idx.avgA) },
    };
  }).filter((m) => m.home && m.away);
}

/** Sezon dosyasını indirir; ağ yoksa yerel kopyayı kullanır. */
export async function loadSeason(league: string, season: string, dir = '.'): Promise<CsvMatch[]> {
  const path = `${dir}/${league}_${season}.csv`;
  try {
    const res = await fetch(`https://www.football-data.co.uk/mmz4281/${season}/${league}.csv`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    await writeFile(path, text);
    return parseCsv(text);
  } catch (err) {
    console.warn(`İndirilemedi (${(err as Error).message}), yerel dosya kullanılıyor: ${path}`);
    return parseCsv(await readFile(path, 'utf8'));
  }
}

/** Güncel sezon kodu: Temmuz'dan itibaren yeni sezon sayılır (2026-09 → "2627"). */
export function seasonCode(date = new Date(), offset = 0): string {
  const start = date.getUTCFullYear() - (date.getUTCMonth() < 6 ? 1 : 0) + offset;
  return `${String(start % 100).padStart(2, '0')}${String((start + 1) % 100).padStart(2, '0')}`;
}

