import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchTeam } from '../src/index.ts';

// Gerçek takım listeleri (football-data.co.uk adları)
const TEAMS: Record<string, string[]> = {
  T1: ['Gaziantep', 'Galatasaray', 'Samsunspor', 'Genclerbirligi', 'Antalyaspor', 'Kasimpasa', 'Rizespor', 'Goztep', 'Eyupspor', 'Konyaspor', 'Trabzonspor', 'Kocaelispor', 'Karagumruk', 'Alanyaspor', 'Fenerbahce', 'Besiktas', 'Buyuksehyr', 'Kayserispor', 'Corum', 'Amedspor', 'Erzurumspor'],
  E0: ['Liverpool', 'Bournemouth', 'Aston Villa', 'Newcastle', 'Brighton', 'Fulham', 'Sunderland', 'West Ham', 'Tottenham', 'Burnley', 'Wolves', 'Man City', 'Chelsea', 'Crystal Palace', "Nott'm Forest", 'Brentford', 'Man United', 'Arsenal', 'Leeds', 'Everton', 'Coventry', 'Hull', 'Ipswich'],
  SP1: ['Girona', 'Vallecano', 'Villarreal', 'Oviedo', 'Mallorca', 'Barcelona', 'Alaves', 'Levante', 'Valencia', 'Sociedad', 'Celta', 'Getafe', 'Ath Bilbao', 'Sevilla', 'Espanol', 'Ath Madrid', 'Elche', 'Betis', 'Real Madrid', 'Osasuna', 'Santander', 'La Coruna', 'Malaga'],
  I1: ['Genoa', 'Lecce', 'Sassuolo', 'Napoli', 'Milan', 'Cremonese', 'Roma', 'Bologna', 'Cagliari', 'Fiorentina', 'Como', 'Lazio', 'Atalanta', 'Pisa', 'Juventus', 'Parma', 'Udinese', 'Verona', 'Inter', 'Torino', 'Monza', 'Frosinone', 'Venezia'],
  D1: ['Bayern Munich', 'RB Leipzig', 'Ein Frankfurt', 'Werder Bremen', 'Freiburg', 'Augsburg', 'Heidenheim', 'Wolfsburg', 'Leverkusen', 'Hoffenheim', 'Union Berlin', 'Stuttgart', 'St Pauli', 'Dortmund', 'Mainz', 'FC Koln', "M'gladbach", 'Hamburg', 'Elversberg', 'Paderborn', 'Schalke 04'],
  F1: ['Rennes', 'Marseille', 'Lens', 'Lyon', 'Monaco', 'Le Havre', 'Nice', 'Toulouse', 'Brest', 'Lille', 'Angers', 'Paris FC', 'Auxerre', 'Lorient', 'Metz', 'Strasbourg', 'Nantes', 'Paris SG', 'Le Mans', 'Troyes'],
  P1: ['Casa Pia', 'Sp Lisbon', 'Nacional', 'Gil Vicente', 'Arouca', 'AVS', 'Famalicao', 'Santa Clara', 'Moreirense', 'Alverca', 'Sp Braga', 'Tondela', 'Estoril', 'Estrela', 'Porto', 'Guimaraes', 'Benfica', 'Rio Ave', 'Maritimo', 'Academico Viseu'],
};

// API-Football'un kullandığı adlar → beklenen eşleşme
const CASES: Record<string, Record<string, string>> = {
  T1: { 'Fenerbahçe': 'Fenerbahce', 'Beşiktaş': 'Besiktas', 'İstanbul Başakşehir': 'Buyuksehyr', 'Kasımpaşa': 'Kasimpasa', 'Çaykur Rizespor': 'Rizespor', 'Göztepe': 'Goztep', 'Gaziantep FK': 'Gaziantep', 'Gençlerbirliği': 'Genclerbirligi', 'Fatih Karagümrük': 'Karagumruk', 'Eyüpspor': 'Eyupspor', 'Galatasaray': 'Galatasaray', 'Çorum FK': 'Corum' },
  E0: { 'Manchester United': 'Man United', 'Manchester City': 'Man City', 'Nottingham Forest': "Nott'm Forest", 'Wolves': 'Wolves', 'West Ham': 'West Ham', 'Tottenham': 'Tottenham', 'Newcastle': 'Newcastle', 'Brighton': 'Brighton', 'Leeds': 'Leeds' },
  SP1: { 'Athletic Club': 'Ath Bilbao', 'Atletico Madrid': 'Ath Madrid', 'Real Sociedad': 'Sociedad', 'Celta Vigo': 'Celta', 'Rayo Vallecano': 'Vallecano', 'Espanyol': 'Espanol', 'Real Betis': 'Betis', 'Real Madrid': 'Real Madrid', 'Alavés': 'Alaves' },
  I1: { 'Inter': 'Inter', 'AC Milan': 'Milan', 'AS Roma': 'Roma', 'Hellas Verona': 'Verona', 'Juventus': 'Juventus', 'Napoli': 'Napoli' },
  D1: { 'Bayern München': 'Bayern Munich', 'Borussia Dortmund': 'Dortmund', 'Borussia Mönchengladbach': "M'gladbach", '1. FC Köln': 'FC Koln', 'Eintracht Frankfurt': 'Ein Frankfurt', 'Bayer Leverkusen': 'Leverkusen', 'VfB Stuttgart': 'Stuttgart', 'FC St. Pauli': 'St Pauli', '1899 Hoffenheim': 'Hoffenheim', 'FSV Mainz 05': 'Mainz', 'Hamburger SV': 'Hamburg', 'Union Berlin': 'Union Berlin' },
  F1: { 'Paris Saint Germain': 'Paris SG', 'Paris FC': 'Paris FC', 'Stade Brestois 29': 'Brest', 'Lyon': 'Lyon', 'Marseille': 'Marseille', 'Rennes': 'Rennes', 'LE Havre': 'Le Havre' },
  P1: { 'Sporting CP': 'Sp Lisbon', 'SC Braga': 'Sp Braga', 'FC Porto': 'Porto', 'Benfica': 'Benfica', 'Guimaraes': 'Guimaraes', 'Famalicao': 'Famalicao' },
};

// ESPN adları (fikstür kaynağı)
Object.assign(TEAMS, {
  E1: ['West Brom', 'QPR', 'West Ham', 'Birmingham'], E2: ['Peterboro', 'Leicester'], E3: ['Bristol Rvs', 'Barnet'],
  EC: ['Boston Utd', 'Southend', 'Halifax'], F2: ['St Etienne', 'Rodez'], SC0: ['Hearts', 'St Mirren'],
  SC1: ['Raith Rvs', 'Inverness C', 'Queens Park', 'Morton'], SP2: ['Sociedad B', 'Celta B', 'Sp Gijon', 'Granada', 'Cadiz'],
  B1: ['Oud-Heverlee Leuven', 'St Truiden', 'St. Gilloise', 'Mechelen'],
});
Object.assign(CASES, {
  E1: { 'West Bromwich Albion': 'West Brom', 'Queens Park Rangers': 'QPR', 'West Ham United': 'West Ham', 'Birmingham City': 'Birmingham' },
  E2: { 'Peterborough United': 'Peterboro', 'Leicester City': 'Leicester' },
  E3: { 'Bristol Rovers': 'Bristol Rvs' },
  EC: { 'Boston United': 'Boston Utd', 'Southend United': 'Southend', 'FC Halifax Town': 'Halifax' },
  F2: { 'Saint-Étienne': 'St Etienne', 'Rodez Aveyron': 'Rodez' },
  SC0: { 'Heart of Midlothian': 'Hearts', 'St Mirren': 'St Mirren' },
  SC1: { 'Raith Rovers': 'Raith Rvs', 'Inverness Caledonian Thistle': 'Inverness C', "Queen's Park": 'Queens Park', 'Greenock Morton': 'Morton' },
  SP2: { 'Real Sociedad II': 'Sociedad B', 'RC Celta Fortuna': 'Celta B', 'Sporting Gijón': 'Sp Gijon', 'Cádiz': 'Cadiz' },
  B1: { 'OH Leuven': 'Oud-Heverlee Leuven', 'Sint-Truidense': 'St Truiden', 'Union St.-Gilloise': 'St. Gilloise', 'KV Mechelen': 'Mechelen' },
});
Object.assign(CASES.D1, { 'FC Cologne': 'FC Koln' });
Object.assign(CASES.SP1, { 'Deportivo': 'La Coruna' });
Object.assign(CASES.T1, { 'Amed SFK': 'Amedspor', 'Erzurum BB': 'Erzurumspor', 'Caykur Rizespor': 'Rizespor', 'Istanbul Basaksehir': 'Buyuksehyr' });

for (const [league, cases] of Object.entries(CASES)) {
  test(`takım adı eşleştirme: ${league}`, () => {
    for (const [api, expected] of Object.entries(cases)) assert.equal(matchTeam(api, TEAMS[league]), expected, api);
  });
}

test('bilinmeyen takım yanlış eşleşmez', () => {
  assert.equal(matchTeam('Real Oviedo B', TEAMS.T1), null);
  assert.equal(matchTeam('Manchester', TEAMS.E0), null); // Man United mı Man City mi belli değil
});
