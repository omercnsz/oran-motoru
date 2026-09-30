// Uygulamadaki turnuvalar. Kod (code) veri dosyalarında ve kuponlarda kalıcı anahtar olarak kullanılır;
// bir kez yayınlandıktan sonra değiştirilmemeli. Sıra, uygulamadaki lig seçicinin sırasıdır.
// Veri kaynağı: ESPN (slug). ESPN'de adresi olup verisi boş gelen ligler (TFF 1. Lig, Çekya, İsrail,
// Finlandiya, İsviçre, Romanya, Hindistan) şimdilik listede yok.

export type CompetitionKind = 'league' | 'cup' | 'continental';

export interface Competition {
  code: string;
  slug: string;
  name: string;
  kind: CompetitionKind;
  /**
   * Ülke: ISO 3166-1 alpha-2 (TR, ES…); İngiltere ve İskoçya ayrı futbol ülkeleri olduğu için ISO 3166-2 (GB-ENG, GB-SCT).
   * Kıta kupalarında (continental) kıta kodu: EU, SA, NA, AS, AF, WORLD.
   */
  region: string;
}

const c = (code: string, slug: string, name: string, kind: CompetitionKind, region: string): Competition =>
  ({ code, slug, name, kind, region });

export const COMPETITIONS: Competition[] = [
  // Kıta ve dünya kupaları
  c('UCL', 'uefa.champions', 'Champions League', 'continental', 'EU'),
  c('UEL', 'uefa.europa', 'Europa League', 'continental', 'EU'),
  c('UECL', 'uefa.europa.conf', 'Conference League', 'continental', 'EU'),
  c('LIB', 'conmebol.libertadores', 'Copa Libertadores', 'continental', 'SA'),
  c('SUD', 'conmebol.sudamericana', 'Copa Sudamericana', 'continental', 'SA'),
  c('CCC', 'concacaf.champions', 'Concacaf Champions Cup', 'continental', 'NA'),
  c('ACL', 'afc.champions', 'AFC Champions League', 'continental', 'AS'),
  c('CAFCL', 'caf.champions', 'CAF Champions League', 'continental', 'AF'),
  c('CWC', 'fifa.cwc', 'FIFA Club World Cup', 'continental', 'WORLD'),

  // Avrupa ligleri
  c('T1', 'tur.1', 'Süper Lig', 'league', 'TR'),
  c('E0', 'eng.1', 'Premier League', 'league', 'GB-ENG'),
  c('E1', 'eng.2', 'Championship', 'league', 'GB-ENG'),
  c('E2', 'eng.3', 'League One', 'league', 'GB-ENG'),
  c('E3', 'eng.4', 'League Two', 'league', 'GB-ENG'),
  c('EC', 'eng.5', 'National League', 'league', 'GB-ENG'),
  c('SP1', 'esp.1', 'La Liga', 'league', 'ES'),
  c('SP2', 'esp.2', 'La Liga 2', 'league', 'ES'),
  c('I1', 'ita.1', 'Serie A', 'league', 'IT'),
  c('I2', 'ita.2', 'Serie B', 'league', 'IT'),
  c('D1', 'ger.1', 'Bundesliga', 'league', 'DE'),
  c('D2', 'ger.2', '2. Bundesliga', 'league', 'DE'),
  c('F1', 'fra.1', 'Ligue 1', 'league', 'FR'),
  c('F2', 'fra.2', 'Ligue 2', 'league', 'FR'),
  c('N1', 'ned.1', 'Eredivisie', 'league', 'NL'),
  c('P1', 'por.1', 'Liga Portugal', 'league', 'PT'),
  c('B1', 'bel.1', 'Pro League', 'league', 'BE'),
  c('G1', 'gre.1', 'Super League Greece', 'league', 'GR'),
  c('SC0', 'sco.1', 'Scottish Premiership', 'league', 'GB-SCT'),
  c('SC1', 'sco.2', 'Scottish Championship', 'league', 'GB-SCT'),
  c('SC2', 'sco.3', 'Scottish League One', 'league', 'GB-SCT'),
  c('SC3', 'sco.4', 'Scottish League Two', 'league', 'GB-SCT'),
  c('AUT1', 'aut.1', 'Austrian Bundesliga', 'league', 'AT'),
  c('DEN1', 'den.1', 'Danish Superliga', 'league', 'DK'),
  c('NOR1', 'nor.1', 'Eliteserien', 'league', 'NO'),
  c('SWE1', 'swe.1', 'Allsvenskan', 'league', 'SE'),
  c('RUS1', 'rus.1', 'Russian Premier League', 'league', 'RU'),
  c('CYP1', 'cyp.1', 'Cypriot First Division', 'league', 'CY'),
  c('IRL1', 'irl.1', 'League of Ireland', 'league', 'IE'),

  // Avrupa kupaları
  c('FAC', 'eng.fa', 'FA Cup', 'cup', 'GB-ENG'),
  c('EFL', 'eng.league_cup', 'Carabao Cup', 'cup', 'GB-ENG'),
  c('CDR', 'esp.copa_del_rey', 'Copa del Rey', 'cup', 'ES'),
  c('CIT', 'ita.coppa_italia', 'Coppa Italia', 'cup', 'IT'),
  c('DFB', 'ger.dfb_pokal', 'DFB-Pokal', 'cup', 'DE'),
  c('CDF', 'fra.coupe_de_france', 'Coupe de France', 'cup', 'FR'),
  c('KNVB', 'ned.cup', 'KNVB Beker', 'cup', 'NL'),
  c('TPO', 'por.taca.portugal', 'Taça de Portugal', 'cup', 'PT'),
  c('SCUP', 'sco.tennents', 'Scottish Cup', 'cup', 'GB-SCT'),

  // Amerika
  c('BRA1', 'bra.1', 'Brasileirão', 'league', 'BR'),
  c('BRA2', 'bra.2', 'Brasileirão Série B', 'league', 'BR'),
  c('ARG1', 'arg.1', 'Liga Profesional', 'league', 'AR'),
  c('USA1', 'usa.1', 'MLS', 'league', 'US'),
  c('MEX1', 'mex.1', 'Liga MX', 'league', 'MX'),
  c('COL1', 'col.1', 'Primera A', 'league', 'CO'),
  c('CHI1', 'chi.1', 'Primera División Chile', 'league', 'CL'),
  c('URU1', 'uru.1', 'Liga AUF Uruguaya', 'league', 'UY'),
  c('PAR1', 'par.1', 'Primera División Paraguay', 'league', 'PY'),
  c('PER1', 'per.1', 'Liga 1 Perú', 'league', 'PE'),
  c('ECU1', 'ecu.1', 'LigaPro Ecuador', 'league', 'EC'),

  // Asya, Okyanusya, Afrika
  c('KSA1', 'ksa.1', 'Saudi Pro League', 'league', 'SA'),
  c('JPN1', 'jpn.1', 'J1 League', 'league', 'JP'),
  c('CHN1', 'chn.1', 'Chinese Super League', 'league', 'CN'),
  c('AUS1', 'aus.1', 'A-League Men', 'league', 'AU'),
  c('RSA1', 'rsa.1', 'South African Premiership', 'league', 'ZA'),
];

export const BY_CODE: Record<string, Competition> = Object.fromEntries(COMPETITIONS.map((x) => [x.code, x]));

/** Cihazın ülke kodu (TR, GB…) bu turnuvanın ülkesi mi? GB hem İngiltere hem İskoçya turnuvalarını kapsar. */
export const isInRegion = (c: Pick<Competition, 'kind' | 'region'>, regionCode: string) => c.kind !== 'continental' && (c.region === regionCode || c.region.startsWith(`${regionCode}-`));

/** Kullanıcının ülkesinin ana ligi (uygulama ilk açıldığında gösterilir); yoksa undefined */
export function homeCompetition(regionCode: string | null | undefined): Competition | undefined {
  return regionCode ? COMPETITIONS.find((x) => x.kind === 'league' && isInRegion(x, regionCode)) : undefined;
}

// Lig seçicideki kıta bölümleri. Yeni bir ülkenin turnuvası eklenince ülke buraya da eklenmeli (test denetler).
export type Continent = 'europe' | 'southAmerica' | 'northAmerica' | 'asia' | 'africa' | 'oceania';

export const CONTINENT_COUNTRIES: Record<Continent, string[]> = {
  europe: ['TR', 'GB-ENG', 'GB-SCT', 'ES', 'IT', 'DE', 'FR', 'NL', 'PT', 'BE', 'GR', 'AT', 'DK', 'NO', 'SE', 'RU', 'CY', 'IE'],
  southAmerica: ['BR', 'AR', 'CO', 'CL', 'UY', 'PY', 'PE', 'EC'],
  northAmerica: ['US', 'MX'],
  asia: ['SA', 'JP', 'CN'],
  africa: ['ZA'],
  oceania: ['AU'],
};
export const CONTINENTS = Object.keys(CONTINENT_COUNTRIES) as Continent[];

/** Turnuvanın kıtası; kıta ve dünya kupaları için international */
export function continentOf(c: Competition): Continent | 'international' {
  if (c.kind === 'continental') return 'international';
  return CONTINENTS.find((k) => CONTINENT_COUNTRIES[k].includes(c.region)) ?? 'europe';
}

/** Kıtanın kulüp turnuvası (ilk açılıştaki favoriler için) */
const CONTINENTAL_CUP: Partial<Record<Continent, string>> = {
  europe: 'UCL', southAmerica: 'LIB', northAmerica: 'CCC', asia: 'ACL', africa: 'CAFCL',
};

/** İlk açılıştaki favoriler: kullanıcının ülkesinin ligi, kıtasının kupası, Şampiyonlar Ligi ve beş büyük lig */
export function defaultFavorites(regionCode: string | null | undefined): string[] {
  const home = homeCompetition(regionCode);
  const continent = home && continentOf(home);
  const cup = continent && continent !== 'international' ? CONTINENTAL_CUP[continent] : undefined;
  return [...new Set([home?.code, cup, 'UCL', 'E0', 'SP1', 'I1', 'D1', 'F1'].filter((x): x is string => !!x))];
}
