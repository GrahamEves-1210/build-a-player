// TEST FIXTURE ONLY (scripts/soccer/sim-test.mjs uses it when src/data/soccer-strikers.js isn't there yet).
// A handful of named strikers at the big clubs and nations; everyone else is generated from the team's rating.
import { SOCCER_CLUBS } from './soccer-clubs.js'
import { WC_NATIONS } from './soccer-nations.js'

export const ST_TYPES = ['finishing', 'shotPower', 'heading', 'dribbling', 'firstTouch', 'linkUp', 'pace', 'strength', 'offBall', 'composure']
export const ST_CATEGORIES = [
  { id: 'skills', label: 'Skills', types: ['finishing', 'shotPower', 'heading', 'dribbling', 'firstTouch', 'linkUp'] },
  { id: 'physical', label: 'Physical', types: ['pace', 'strength'] },
  { id: 'mental', label: 'Mental', types: ['offBall', 'composure'] },
]
const A = arr => Object.fromEntries(ST_TYPES.map((t, i) => [t, arr[i]]))
//                     fin sp hd dr ft lu pa st ob co
const NAMED = [
  ['Erling Haaland', 'MCI', 'NOR', 26, [11, 10, 9, 7, 8, 6, 10, 11, 11, 10]],
  ['Harry Kane', 'BAY', 'ENG', 33, [11, 10, 9, 7, 10, 11, 6, 9, 10, 11]],
  ['Kylian Mbappé', 'RMA', 'FRA', 27, [11, 10, 6, 10, 9, 8, 11, 7, 10, 10]],
  ['Robert Lewandowski', 'BAR', 'POL', 38, [10, 8, 8, 6, 9, 8, 4, 7, 10, 10]],
  ['Lautaro Martínez', 'INT', 'ARG', 29, [9, 8, 7, 8, 8, 8, 7, 7, 9, 8]],
  ['Alexander Isak', 'LIV', 'SWE', 27, [9, 8, 6, 9, 9, 7, 9, 6, 9, 8]],
  ['Viktor Gyökeres', 'ARS', 'SWE', 28, [9, 9, 6, 6, 7, 5, 9, 10, 8, 7]],
  ['Rasmus Højlund', 'NAP', 'DEN', 23, [7, 8, 7, 6, 6, 6, 9, 9, 8, 7]],
  ['Julián Álvarez', 'ATM', 'ARG', 26, [9, 9, 6, 8, 8, 8, 8, 6, 9, 9]],
  ['Serhou Guirassy', 'BVB', 'GUI', 30, [9, 8, 9, 6, 7, 6, 7, 9, 9, 8]],
  ['Ousmane Dembélé', 'PSG', 'FRA', 29, [9, 9, 4, 11, 9, 9, 10, 5, 9, 8]],
  ['Mason Greenwood', 'OM', 'ENG', 25, [9, 10, 5, 9, 8, 7, 7, 6, 8, 8]],
  ['Dušan Vlahović', 'JUV', 'SRB', 26, [8, 9, 8, 6, 7, 5, 7, 9, 8, 7]],
  ['Ollie Watkins', 'AVL', 'ENG', 30, [8, 7, 7, 6, 7, 7, 8, 7, 9, 7]],
  ['Benjamin Šeško', 'MUN', 'SLO', 23, [7, 9, 8, 6, 6, 5, 9, 9, 7, 6]],
  ['Nick Woltemade', 'NEW', 'GER', 24, [7, 7, 9, 7, 8, 7, 5, 8, 7, 7]],
  ['João Pedro', 'CHE', 'BRA', 25, [8, 7, 6, 8, 8, 8, 7, 6, 8, 7]],
  ['Igor Thiago', 'BRE', 'BRA', 25, [8, 8, 8, 5, 6, 5, 7, 9, 8, 7]],
  ['Deniz Undav', 'VFB', 'GER', 30, [8, 8, 6, 7, 8, 8, 6, 7, 8, 8]],
  ['Patrik Schick', 'B04', 'CZE', 30, [8, 9, 8, 6, 7, 6, 5, 8, 8, 7]],
  ['Moise Kean', 'FIO', 'ITA', 26, [8, 8, 7, 7, 7, 5, 8, 8, 8, 6]],
  ['Esteban Lepaul', 'REN', 'FRA', 26, [8, 7, 7, 6, 7, 6, 7, 7, 8, 7]],
]
const NATION_NAMED = [
  ['Erling Haaland', 'NOR', 26, [11, 10, 9, 7, 8, 6, 10, 11, 11, 10]],
  ['Harry Kane', 'ENG', 32, [11, 10, 9, 7, 10, 11, 6, 9, 10, 11]],
  ['Kylian Mbappé', 'FRA', 27, [11, 10, 6, 10, 9, 8, 11, 7, 10, 10]],
  ['Lautaro Martínez', 'ARG', 28, [9, 8, 7, 8, 8, 8, 7, 7, 9, 8]],
  ['Lionel Messi', 'ARG', 38, [10, 8, 4, 11, 11, 11, 5, 4, 9, 11]],
  ['Mikel Oyarzabal', 'ESP', 29, [8, 7, 7, 7, 8, 8, 7, 6, 8, 8]],
  ['Cristiano Ronaldo', 'POR', 41, [9, 10, 9, 6, 8, 6, 5, 8, 9, 9]],
  ['Kai Havertz', 'GER', 27, [8, 7, 8, 7, 8, 8, 7, 7, 8, 7]],
  ['Vinícius Júnior', 'BRA', 25, [8, 8, 4, 11, 9, 7, 11, 5, 8, 7]],
  ['Cody Gakpo', 'NED', 27, [8, 8, 6, 8, 8, 7, 8, 7, 7, 7]],
  ['Romelu Lukaku', 'BEL', 33, [8, 8, 8, 5, 7, 7, 6, 10, 8, 7]],
  ['Son Heung-min', 'KOR', 33, [9, 9, 5, 8, 8, 7, 8, 5, 8, 8]],
  ['Youssef En-Nesyri', 'MAR', 28, [7, 7, 10, 5, 6, 5, 6, 8, 8, 6]],
  ['Luis Díaz', 'COL', 29, [8, 7, 5, 10, 8, 7, 9, 5, 8, 7]],
  ['Darwin Núñez', 'URU', 26, [6, 9, 7, 6, 6, 5, 10, 9, 8, 5]],
  ['Mohamed Salah', 'EGY', 33, [10, 8, 5, 9, 9, 8, 9, 6, 10, 9]],
  ['Arda Güler', 'TUR', 21, [7, 9, 4, 8, 8, 9, 6, 4, 7, 8]],
]
// a stable pseudo-random from a string (fixture generation only)
const h = s => { let x = 2166136261; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619); return () => { x = Math.imul(x ^ (x >>> 15), 2246822507); x = Math.imul(x ^ (x >>> 13), 3266489909); x ^= x >>> 16; return (x >>> 0) / 4294967296 } }
function gen(name, team, nation, rating, age, starter, role = 'ST') {
  const r = h(name + team)
  const base = Math.max(2, Math.min(9.5, rating))
  const attrs = Object.fromEntries(ST_TYPES.map(t => [t, Math.max(0, Math.min(11, Math.round(base + (r() - 0.5) * 4.2)))]))
  return { name, short: name.split(' ').slice(-1)[0], team, nation, number: 9, height: 72 + Math.floor(r() * 8), weight: 165 + Math.floor(r() * 35), age, foot: r() < 0.75 ? 'R' : 'L', skin: '#b87b60', espn: null, starter, position: 'ST', role, attrs }
}
const named = new Map(NAMED.map(([n, team, nation, age, a]) => [team, { name: n, short: n.split(' ').slice(-1)[0], team, nation, number: 9, height: 74, weight: 180, age, foot: 'R', skin: '#b87b60', espn: null, starter: true, position: 'ST', attrs: A(a) }]))
export const SOCCER_STRIKERS = SOCCER_CLUBS.flatMap(c => {
  // a club's No. 9 lands about 76-90 overall (club rating 64-94)
  const lvl = ((76 + (c.ovr - 66) * 0.55) - 57) * 9 / 44 + 1
  const first = named.get(c.short) ?? gen(`${c.name} Nine`, c.short, 'ENG', lvl, 27, true)
  return [{ ...first, role: 'ST' }, gen(`${c.name} Backup`, c.short, 'ENG', lvl - 1.4, 24, false), gen(`${c.name} Winger`, c.short, 'ENG', lvl - 0.6, 25, false, 'LW'), gen(`${c.name} Ten`, c.short, 'ENG', lvl - 0.8, 23, false, 'AM'), gen(`${c.name} Eight`, c.short, 'ENG', lvl - 1, 26, false, 'CM')]
})
const nNamed = new Map()
for (const [n, nation, age, a] of NATION_NAMED) if (!nNamed.has(nation)) nNamed.set(nation, { name: n, short: n.split(' ').slice(-1)[0], team: nation, nation, number: 9, height: 74, weight: 180, age, foot: 'R', skin: '#b87b60', espn: null, starter: true, position: 'ST', attrs: A(a) })
export const WC_STRIKERS = WC_NATIONS.flatMap(n => {
  const lvl = ((72 + (n.ovr - 58) * 0.6) - 57) * 9 / 44 + 1
  const first = nNamed.get(n.short) ?? gen(`${n.name} Nine`, n.short, n.short, lvl, 27, true)
  const extra = NATION_NAMED.filter(([nm, nat]) => nat === n.short && nm !== first.name).map(([nm, nat, age, a]) => ({ name: nm, short: nm.split(' ').slice(-1)[0], team: nat, nation: nat, number: 10, height: 70, weight: 160, age, foot: 'L', skin: '#b87b60', espn: null, starter: true, position: 'ST', attrs: A(a) }))
  return [{ ...first, role: 'ST' }, ...extra.map(x => ({ ...x, role: 'RW' })), gen(`${n.name} Backup`, n.short, n.short, lvl - 1.2, 20, false), gen(`${n.name} Eight`, n.short, n.short, lvl - 0.8, 24, false, 'CM')]
})
