import type { Messages } from './en';

const hr: Messages = {
  tabs: { matches: 'Utakmice', coupons: 'Listići', games: 'Igre', savings: 'Kasica' },
  nav: { match: 'Utakmica', live: 'Uživo', coupon: 'Listić', settings: 'Postavke', back: 'Utakmice' },
  common: { dataError: 'Podaci se nisu mogli učitati', dbError: 'Baza podataka nije se mogla pripremiti: %{message}', comingSoon: 'Faza %{n}' },
  matches: {
    title: 'Utakmice', subtitle: 'Prave utakmice, prave koeficijenti. Virtualni novac.', preMatch: 'Prije utakmice', live: 'Uživo',
    none14: 'U ovom natjecanju nema utakmica u sljedećih 14 dana.',
    notSoon: '%{league} nema utakmica danas ni sutra; sljedeće su %{date}.',
    soonLeagues: 'Natjecanja s utakmicama danas i sutra:', allBets: 'Sve oklade ›', notFound: 'Utakmica nije pronađena',
  },
  live: {
    noneNow: 'Trenutačno se ne igra nijedna utakmica.', next: 'Sljedeća: %{home} – %{away}, %{time} (%{league}).',
    error: 'Rezultati uživo nisu se mogli učitati: %{message}', inPlay: 'U tijeku', soon: 'Uskoro počinje', finished: 'Završena',
    sourceCache: 'Izvor: ESPN (predmemorija)', sourceDirect: 'Izvor: ESPN', updated: 'ažurirano u %{time}', allLiveBets: 'Sve oklade uživo ›',
    redCards: 'Crveni kartoni: %{home} %{homeCount}, %{away} %{awayCount}', computing: 'Računaju se koeficijenti uživo…',
    onlyInPlay: 'Klađenje uživo otvoreno je samo tijekom utakmice.', notInList: 'Ova utakmica nije na popisu uživo',
    notStarted: 'Nije počela', finishedScore: 'Završena · %{score}', halfTime: 'Poluvrijeme', fullTime: 'Kraj',
  },
  slip: {
    title: 'Tvoj listić', subtitle: 'Ovaj novac zapravo ne ulažeš. Iznos ide u tvoju kasicu.',
    empty: 'Listić je prazan. Odaberi koeficijente u Utakmicama.', bar: 'Listić · utakmica: %{count}', barOdds: 'Koef. %{odds}',
    remove: 'Ukloni s listića', live: 'Uživo', stake: 'Ulog', totalOdds: 'Ukupni koeficijent', potential: 'Mogući dobitak',
    create: 'Izradi listić · %{amount} u kasicu',
    errors: {
      invalidAmount: 'Unesi ispravan iznos (npr. %{example})', empty: 'Dodaj barem jednu utakmicu na listić',
      tooMany: 'Listić može imati najviše %{max} utakmica', sameMatch: 'Ne možeš dodati dva odabira iz iste utakmice',
      unknownBet: 'Nepoznata oklada', closed: 'Klađenje na %{match} je zatvoreno',
      started: '%{match} je počela; klađenje prije utakmice je zatvoreno', postponed: '%{match} je odgođena ili otkazana',
      minStake: 'Najmanji ulog je %{min}', staleLive: 'Koeficijent uživo za %{match} stariji je od minute; ukloni ga i odaberi ponovno',
    },
  },
  coupons: {
    title: 'Listići', subtitle: 'Tvoji listići u sjeni: prave utakmice, virtualni novac.', none: 'Još nemaš listića. Počni odabirom koeficijenata u Utakmicama.',
    open: 'Otvoren', won: 'Dobitan', lost: 'Gubitan', stakeOdds: 'Ulog %{stake} · Koef. %{odds}', potential: 'Moguće %{amount}',
  },
  savings: {
    title: 'Kasica', subtitle: 'Svaki novčić koji nisi uložio je ovdje.', inBank: 'U tvojoj kasici',
    notToBookie: 'Ovaj novac nije otišao kladionici. Ako si ga stvarno odvojio, tvoj je.',
    allTime: 'Od početka', coupons: 'Listići', couponsValue: '%{count} (otvoreno: %{open})', staked: 'Uložio bi',
    wonLost: 'Dobitni / gubitni', ifReal: 'Da si igrao pravim novcem',
    noSettled: 'Kad se listić obračuna, ovdje ćeš vidjeti što bi se dogodilo s pravim novcem.',
    houseEdge: 'Koeficijenti sadrže maržu, kao kod pravih kladionica: dugoročno kladionica dobiva.',
    houseEdgeYours: 'Ovi brojevi to pokazuju na tvojim listićima.', help: 'Želiš li razgovarati s nekim? %{name}: %{contact}',
    otherCurrencies: 'Listići u drugim valutama nisu uključeni.',
  },
  games: { title: 'Igre', subtitle: 'Samo virtualni žetoni. Bez kupnje, bez isplate.', crash: 'Crash', roulette: 'Rulet', slot: 'Automati' },
  settings: {
    title: 'Postavke', language: 'Jezik', deviceLanguage: 'Jezik uređaja', currency: 'Valuta', automatic: 'Automatski (%{value})',
    oddsFormat: 'Format koeficijenata', decimal: 'Decimalni', fractional: 'Razlomački', american: 'Američki',
    restartForRtl: 'Ponovno pokreni aplikaciju kako bi se promijenio smjer teksta.',
    translationNote: 'Prijevodi osim engleskog i turskog izrađeni su uz pomoć strojnog prevođenja i čekaju provjeru izvornih govornika.',
  },
  markets: { '1X2': 'Konačan ishod', DC: 'Dvostruka šansa', OU: 'Više/Manje od %{line}', BTTS: 'Oba tima zabijaju', TG: 'Ukupno golova', HC: 'Hendikep (%{hc})', CS: 'Točan rezultat' },
  outcomes: { under: 'Manje', over: 'Više', yes: 'Da', no: 'Ne', other: 'Ostalo' },
};
export default hr;
