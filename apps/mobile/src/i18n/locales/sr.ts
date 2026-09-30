import type { Messages } from './en';

// Srpski (latinica)
const sr: Messages = {
  tabs: { matches: 'Utakmice', coupons: 'Tiketi', games: 'Igre', savings: 'Kasica' },
  nav: { match: 'Utakmica', live: 'Uživo', coupon: 'Tiket', settings: 'Podešavanja', back: 'Utakmice' },
  common: { dataError: 'Podaci nisu mogli da se učitaju', dbError: 'Baza podataka nije mogla da se pripremi: %{message}', comingSoon: 'Faza %{n}' },
  matches: {
    title: 'Utakmice', subtitle: 'Prave utakmice, prave kvote. Novac je virtuelni.', preMatch: 'Pre utakmice', live: 'Uživo',
    none14: 'U ovom takmičenju nema utakmica u narednih 14 dana.',
    notSoon: '%{league} nema utakmica danas ni sutra; sledeće su %{date}.',
    soonLeagues: 'Takmičenja sa utakmicama danas i sutra:', allBets: 'Sve opklade ›', notFound: 'Utakmica nije pronađena',
  },
  live: {
    noneNow: 'Trenutno se ne igra nijedna utakmica.', next: 'Sledeća: %{home} – %{away}, %{time} (%{league}).',
    error: 'Rezultati uživo nisu mogli da se učitaju: %{message}', inPlay: 'U toku', soon: 'Uskoro počinje', finished: 'Završena',
    sourceCache: 'Izvor: ESPN (keš)', sourceDirect: 'Izvor: ESPN', updated: 'ažurirano u %{time}', allLiveBets: 'Sve opklade uživo ›',
    redCards: 'Crveni kartoni: %{home} %{homeCount}, %{away} %{awayCount}', computing: 'Računaju se kvote uživo…',
    onlyInPlay: 'Klađenje uživo je otvoreno samo tokom utakmice.', notInList: 'Ova utakmica nije na listi uživo',
    notStarted: 'Nije počela', finishedScore: 'Završena · %{score}', halfTime: 'Poluvreme', fullTime: 'Kraj',
  },
  slip: {
    title: 'Tvoj tiket', subtitle: 'Ovaj novac zapravo ne ulažeš. Iznos ide u tvoju kasicu.',
    empty: 'Tiket je prazan. Izaberi kvote u Utakmicama.', bar: 'Tiket · utakmica: %{count}', barOdds: 'Kvota %{odds}',
    remove: 'Ukloni sa tiketa', live: 'Uživo', stake: 'Ulog', totalOdds: 'Ukupna kvota', potential: 'Mogući dobitak',
    create: 'Napravi tiket · %{amount} u kasicu',
    errors: {
      invalidAmount: 'Unesi ispravan iznos (npr. %{example})', empty: 'Dodaj bar jednu utakmicu na tiket',
      tooMany: 'Tiket može imati najviše %{max} utakmica', sameMatch: 'Ne možeš dodati dva izbora iz iste utakmice',
      unknownBet: 'Nepoznata opklada', closed: 'Klađenje na %{match} je zatvoreno',
      started: '%{match} je počela; klađenje pre utakmice je zatvoreno', postponed: '%{match} je odložena ili otkazana',
      minStake: 'Minimalni ulog je %{min}', staleLive: 'Kvota uživo za %{match} je starija od minut; ukloni je i izaberi ponovo',
    },
  },
  coupons: {
    title: 'Tiketi', subtitle: 'Tvoji tiketi u senci: prave utakmice, virtuelni novac.', none: 'Još nemaš tikete. Počni biranjem kvota u Utakmicama.',
    open: 'Otvoren', won: 'Dobitan', lost: 'Gubitan', stakeOdds: 'Ulog %{stake} · Kvota %{odds}', potential: 'Moguće %{amount}',
  },
  savings: {
    title: 'Kasica', subtitle: 'Svaki novčić koji nisi uložio je ovde.', inBank: 'U tvojoj kasici',
    notToBookie: 'Ovaj novac nije otišao kladionici. Ako si ga zaista odvojio, tvoj je.',
    allTime: 'Od početka', coupons: 'Tiketi', couponsValue: '%{count} (otvoreno: %{open})', staked: 'Uložio bi',
    wonLost: 'Dobitni / gubitni', ifReal: 'Da si igrao pravim novcem',
    noSettled: 'Kada se tiket obračuna, ovde ćeš videti šta bi se desilo sa pravim novcem.',
    houseEdge: 'Kvote sadrže maržu, kao kod pravih kladionica: dugoročno kladionica dobija.',
    houseEdgeYours: 'Ovi brojevi to pokazuju na tvojim tiketima.', help: 'Želiš da razgovaraš sa nekim? %{name}: %{contact}',
    otherCurrencies: 'Tiketi u drugim valutama nisu uključeni.',
  },
  games: { title: 'Igre', subtitle: 'Samo virtuelni žetoni. Bez kupovine, bez isplate.', crash: 'Crash', roulette: 'Rulet', slot: 'Slot aparati' },
  settings: {
    title: 'Podešavanja', language: 'Jezik', deviceLanguage: 'Jezik uređaja', currency: 'Valuta', automatic: 'Automatski (%{value})',
    oddsFormat: 'Format kvota', decimal: 'Decimalni', fractional: 'Razlomački', american: 'Američki',
    restartForRtl: 'Ponovo pokreni aplikaciju da bi se promenio smer teksta.',
    translationNote: 'Prevodi osim engleskog i turskog urađeni su uz pomoć mašinskog prevođenja i čekaju proveru izvornih govornika.',
  },
  markets: { '1X2': 'Konačan ishod', DC: 'Dupla šansa', OU: 'Više/Manje od %{line}', BTTS: 'Oba tima daju gol', TG: 'Ukupno golova', HC: 'Hendikep (%{hc})', CS: 'Tačan rezultat' },
  outcomes: { under: 'Manje', over: 'Više', yes: 'Da', no: 'Ne', other: 'Ostalo' },
};
export default sr;
