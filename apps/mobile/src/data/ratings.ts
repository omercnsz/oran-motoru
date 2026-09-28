import type { RatingsFile } from '@oran/contracts';
import { useQueries } from '@tanstack/react-query';

import { fetchJson } from '@/data/api';

/** Liglerin takım güçleri (canlı oranlar telefonda bunlarla hesaplanır) */
export function useRatings(leagues: string[]): Map<string, RatingsFile> {
  const results = useQueries({
    queries: leagues.map((l) => ({
      queryKey: ['ratings', l],
      queryFn: () => fetchJson<RatingsFile>(`ratings/${l}.json`),
      staleTime: 60 * 60_000,
    })),
  });
  const map = new Map<string, RatingsFile>();
  results.forEach((r, i) => { if (r.data) map.set(leagues[i], r.data); });
  return map;
}
