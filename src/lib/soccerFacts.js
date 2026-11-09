// Soccer's record book and milestones, registered into lib/seasonFacts.js (RECORDS.soccer, MILESTONES.soccer) when
// soccer loads (lib/careerSoccer.js imports this; the soccer season page can too). Its own file, so the football
// and basketball chunks never carry it.
import { RECORDS, MILESTONES } from './seasonFacts'

const sumOf = (games, k) => games.reduce((s, g) => s + (g[k] ?? 0), 0)
const steps = (id, label, k, marks, unit) => marks.map(m => ({ id: `${id}-${m}`, label: label.replace('{n}', m.toLocaleString()), test: c => sumOf(c.games, k) >= m, big: m >= marks[marks.length - 2], unit }))

// Soccer: a striker's records. The league ones (`lg`) are checked only in his own league; a record is broken by
// going past it. Sources: the leagues' own record books (premierleague.com, LaLiga, Lega Serie A, DFL, LFP),
// UEFA for the Champions League, Guinness World Records for Messi's calendar year.
//   Premier League: 36, Erling Haaland 2022-23 (a 38-game season; Andy Cole 1993-94 and Alan Shearer 1994-95 scored 34 in 42).
//   La Liga: 50, Lionel Messi 2011-12. Serie A: 36, Gonzalo Higuaín 2015-16 and Ciro Immobile 2019-20.
//   Bundesliga: 41, Robert Lewandowski 2020-21 (past Gerd Müller's 40, 1971-72). Ligue 1: 44, Josip Skoblar 1970-71.
//   Goals in a game: Premier League 5 (Cole, Shearer, Berbatov, Defoe, Agüero), La Liga 7 (László Kubala, 1952),
//   Serie A 6 (Silvio Piola 1933, Omar Sívori 1961), Bundesliga 6 (Dieter Müller, 1977).
//   Assists: Premier League 20 (Thierry Henry 2002-03, Kevin De Bruyne 2019-20); La Liga 21 (Lionel Messi 2019-20).
//   A season in all competitions: 73, Lionel Messi 2011-12 (Barcelona). A calendar year: 91, Messi 2012 (club and
//   country). The Champions League in one season: 17, Cristiano Ronaldo 2013-14.
//   A career: 8 Ballon d'Ors and 6 European Golden Shoes (Messi); 6 European Cups (Paco Gento 1956-66, then Dani
//   Carvajal, Luka Modrić, Toni Kroos and Nacho, 2014-24).
RECORDS.soccer = {
  st: [
    { id: 'pl-goals', lg: 'eng.1', label: 'Premier League goals in a season', stat: 'seasonGoals', value: 36, holder: 'Erling Haaland, 2022-23' },
    { id: 'liga-goals', lg: 'esp.1', label: 'La Liga goals in a season', stat: 'seasonGoals', value: 50, holder: 'Lionel Messi, 2011-12' },
    { id: 'sa-goals', lg: 'ita.1', label: 'Serie A goals in a season', stat: 'seasonGoals', value: 36, holder: 'Gonzalo Higuaín (2015-16) & Ciro Immobile (2019-20)' },
    { id: 'bl-goals', lg: 'ger.1', label: 'Bundesliga goals in a season', stat: 'seasonGoals', value: 41, holder: 'Robert Lewandowski, 2020-21' },
    { id: 'l1-goals', lg: 'fra.1', label: 'Ligue 1 goals in a season', stat: 'seasonGoals', value: 44, holder: 'Josip Skoblar, 1970-71' },
    { id: 'pl-assists', lg: 'eng.1', label: 'Premier League assists in a season', stat: 'seasonAssists', value: 20, holder: 'Thierry Henry (2002-03) & Kevin De Bruyne (2019-20)' },
    { id: 'liga-assists', lg: 'esp.1', label: 'La Liga assists in a season', stat: 'seasonAssists', value: 21, holder: 'Lionel Messi, 2019-20' },
    { id: 'g-pl', lg: 'eng.1', label: 'Premier League goals in a match', game: 'goals', value: 5, holder: 'Cole, Shearer, Berbatov, Defoe & Agüero' },
    { id: 'g-liga', lg: 'esp.1', label: 'La Liga goals in a match', game: 'goals', value: 7, holder: 'László Kubala, 1952' },
    { id: 'g-sa', lg: 'ita.1', label: 'Serie A goals in a match', game: 'goals', value: 6, holder: 'Silvio Piola (1933) & Omar Sívori (1961)' },
    { id: 'g-bl', lg: 'ger.1', label: 'Bundesliga goals in a match', game: 'goals', value: 6, holder: 'Dieter Müller, 1977' },
    // (booked: lib/career.js checks these when the season is booked, from the whole year)
    { id: 'all-goals', label: 'Goals in a season, all competitions', booked: 'allGoals', value: 73, holder: 'Lionel Messi, 2011-12', end: true },
    { id: 'ucl-goals', label: 'Champions League goals in a season', booked: 'uclGoals', value: 17, holder: 'Cristiano Ronaldo, 2013-14', end: true },
    { id: 'year-goals', label: 'Goals in a calendar year', booked: 'calendar', value: 91, holder: 'Lionel Messi, 2012', end: true },
    // (career: the season he passes the mark; career.js careerTotals has them)
    { id: 'bdos', label: "Ballon d'Ors", career: t => t.bdo, value: 8, holder: 'Lionel Messi', end: true },
    { id: 'shoes', label: 'European Golden Shoes', career: t => t.shoes, value: 6, holder: 'Lionel Messi', end: true },
    { id: 'ucls', label: 'European Cups', career: t => t.ucl, value: 6, holder: 'Paco Gento, Carvajal, Modrić, Kroos & Nacho', end: true },
  ],
  team: [{ id: 'unbeaten', label: 'An unbeaten league season', statFn: r => r.sport === 'soccer' && r.losses === 0 && (r.games?.length ?? 0) >= 34, holder: 'Arsenal\u2019s Invincibles, 2003-04' }],
}

MILESTONES.soccer = {
  common: [
    { id: 'streak-5', label: 'Five straight wins', test: c => c.streak >= 5 },
    { id: 'streak-10', label: 'Ten straight wins', test: c => c.streak >= 10, big: true },
    { id: 'unbeaten-10', label: 'Ten unbeaten from the start', test: c => c.games.length === 10 && c.losses === 0, big: true },
  ],
  st: [...steps('gls', '{n} league goals', 'goals', [10, 20, 30, 40]), ...steps('ast', '{n} assists', 'assists', [5, 10, 15]),
    { id: 'g-brace', label: 'A brace', test: c => c.last?.goals === 2 }, { id: 'g-hat', label: 'Hat-trick', test: c => c.last?.goals >= 3, big: true },
    { id: 'g-four', label: 'Four goals in a match', test: c => c.last?.goals >= 4, big: true }],
}
