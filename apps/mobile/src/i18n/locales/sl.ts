import type { Messages } from './en';

const sl: Messages = {
  tabs: { matches: 'Tekme', coupons: 'Listki', games: 'Igre', savings: 'Hranilnik' },
  nav: { match: 'Tekma', live: 'V živo', coupon: 'Listek', settings: 'Nastavitve', back: 'Tekme' },
  common: { dataError: 'Podatkov ni bilo mogoče naložiti', dbError: 'Podatkovne zbirke ni bilo mogoče pripraviti: %{message}', comingSoon: 'Faza %{n}' },
  matches: {
    title: 'Tekme', subtitle: 'Prave tekme, pravi koeficienti. Navidezni denar.', preMatch: 'Pred tekmo', live: 'V živo',
    none14: 'V tem tekmovanju v naslednjih 14 dneh ni tekem.',
    notSoon: '%{league} danes in jutri nima tekem; naslednje so %{date}.',
    soonLeagues: 'Tekmovanja s tekmami danes in jutri:', allBets: 'Vse stave ›', notFound: 'Tekme ni mogoče najti',
  },
  live: {
    noneNow: 'Trenutno ne poteka nobena tekma.', next: 'Naslednja: %{home} – %{away}, %{time} (%{league}).',
    error: 'Rezultatov v živo ni bilo mogoče naložiti: %{message}', inPlay: 'Poteka', soon: 'Kmalu se začne', finished: 'Končana',
    sourceCache: 'Vir: ESPN (predpomnilnik)', sourceDirect: 'Vir: ESPN', updated: 'posodobljeno ob %{time}', allLiveBets: 'Vse stave v živo ›',
    redCards: 'Rdeči kartoni: %{home} %{homeCount}, %{away} %{awayCount}', computing: 'Računanje koeficientov v živo…',
    onlyInPlay: 'Stave v živo so odprte samo med tekmo.', notInList: 'Te tekme ni na seznamu v živo',
    notStarted: 'Ni se začela', finishedScore: 'Končana · %{score}', halfTime: 'Polčas', fullTime: 'Konec',
  },
  slip: {
    title: 'Tvoj listek', subtitle: 'Tega denarja v resnici ne staviš. Znesek gre v tvoj hranilnik.',
    empty: 'Listek je prazen. Izberi koeficiente pri Tekmah.', bar: 'Listek · tekme: %{count}', barOdds: 'Koef. %{odds}',
    remove: 'Odstrani z listka', live: 'V živo', stake: 'Vložek', totalOdds: 'Skupni koeficient', potential: 'Možni dobitek',
    create: 'Ustvari listek · %{amount} v hranilnik',
    errors: {
      invalidAmount: 'Vnesi veljaven znesek (npr. %{example})', empty: 'Na listek dodaj vsaj eno tekmo',
      tooMany: 'Listek ima lahko največ %{max} tekem', sameMatch: 'Ne moreš dodati dveh izbir iz iste tekme',
      unknownBet: 'Neznana stava', closed: 'Stave na %{match} so zaprte',
      started: '%{match} se je začela; stave pred tekmo so zaprte', postponed: '%{match} je bila prestavljena ali odpovedana',
      minStake: 'Najmanjši vložek je %{min}', staleLive: 'Koeficient v živo za %{match} je starejši od minute; odstrani ga in izberi znova',
    },
  },
  coupons: {
    title: 'Listki', subtitle: 'Tvoji listki v senci: prave tekme, navidezni denar.', none: 'Še nimaš listkov. Začni z izbiro koeficientov pri Tekmah.',
    open: 'Odprt', won: 'Dobitni', lost: 'Izgubljen', stakeOdds: 'Vložek %{stake} · Koef. %{odds}', potential: 'Možno %{amount}',
  },
  savings: {
    title: 'Hranilnik', subtitle: 'Vsak kovanec, ki ga nisi stavil, je tukaj.', inBank: 'V tvojem hranilniku',
    notToBookie: 'Ta denar ni šel stavnici. Če si ga res dal na stran, je tvoj.',
    allTime: 'Od začetka', coupons: 'Listki', couponsValue: '%{count} (odprtih: %{open})', staked: 'Stavil bi',
    wonLost: 'Dobitni / izgubljeni', ifReal: 'Če bi igral s pravim denarjem',
    noSettled: 'Ko bo listek obračunan, boš tukaj videl, kaj bi se zgodilo s pravim denarjem.',
    houseEdge: 'Koeficienti vsebujejo maržo, kot pri pravih stavnicah: dolgoročno zmaga stavnica.',
    houseEdgeYours: 'Te številke to pokažejo na tvojih listkih.', help: 'Bi se rad s kom pogovoril? %{name}: %{contact}',
    otherCurrencies: 'Listki v drugih valutah niso vključeni.',
  },
  games: { title: 'Igre', subtitle: 'Samo navidezni žetoni. Brez nakupov, brez izplačil.', crash: 'Crash', roulette: 'Ruleta', slot: 'Igralni avtomati' },
  settings: {
    title: 'Nastavitve', language: 'Jezik', deviceLanguage: 'Jezik naprave', currency: 'Valuta', automatic: 'Samodejno (%{value})',
    oddsFormat: 'Oblika koeficientov', decimal: 'Decimalna', fractional: 'Ulomek', american: 'Ameriška',
    restartForRtl: 'Znova zaženi aplikacijo, da se spremeni smer besedila.',
    translationNote: 'Prevodi razen angleškega in turškega so nastali s pomočjo strojnega prevajanja in čakajo na pregled naravnih govorcev.',
  },
  markets: { '1X2': 'Končni izid', DC: 'Dvojna možnost', OU: 'Več/Manj kot %{line}', BTTS: 'Obe ekipi zadeneta', TG: 'Skupaj golov', HC: 'Hendikep (%{hc})', CS: 'Točen izid' },
  outcomes: { under: 'Manj', over: 'Več', yes: 'Da', no: 'Ne', other: 'Drugo' },
};
export default sl;
