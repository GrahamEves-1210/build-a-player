import React, { useState, useMemo, useEffect } from 'react'
import { NBA_GUARD_PLAYERS, NBA_BIG_PLAYERS, NBA_TEAMS } from '../data/nba-players'
import NBA_HEADSHOTS from '../data/nba-headshots.json'
import NBA_POSITIONS from '../data/nba-positions.json'
import { NBA_JERSEY_NUMBERS } from '../data/nba-jersey-numbers'
import { supabase } from '../lib/supabase'
import { valToGrade } from '../utils/simulation'

/*
  Supabase tables required:

  CREATE TABLE salary_cap_plays (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    date_str      text NOT NULL,
    user_id       uuid REFERENCES auth.users(id),
    username      text,
    picks         jsonb NOT NULL,
    overall_score int  NOT NULL,
    ppg           numeric(4,1),
    apg           numeric(3,1),
    rpg           numeric(3,1),
    budget_used   int,
    created_at    timestamptz DEFAULT now()
  );

  CREATE TABLE salary_infinite_plays (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid REFERENCES auth.users(id),
    username      text,
    picks         jsonb NOT NULL,
    overall_score int  NOT NULL,
    ppg           numeric(4,1),
    apg           numeric(3,1),
    rpg           numeric(3,1),
    budget_used   int,
    created_at    timestamptz DEFAULT now()
  );
*/

// ─── All-time legends (only players with headshots) ──────────────────────────
const GOAT_SALARY_PLAYERS = [
  {
    name: 'Michael Jordan', team: 'CHI', legend: true, posGroup: 'guard',
    attrs: { jumpShot:7, finishing:11, perimeterDefense:11, interiorDefense:7, passing:8, handles:9, playmaking:8, size:9, speed:10, bounce:11 },
  },
  {
    name: 'Kobe Bryant', team: 'LAL', legend: true, posGroup: 'guard',
    attrs: { jumpShot:9, finishing:10, perimeterDefense:8, interiorDefense:6, passing:6, handles:9, playmaking:8, size:7, speed:9, bounce:9 },
  },
  {
    name: 'Larry Bird', team: 'BOS', legend: true, posGroup: 'guard',
    attrs: { jumpShot:10, finishing:9, perimeterDefense:6, interiorDefense:6, passing:10, handles:7, playmaking:10, size:8, speed:3, bounce:3 },
  },
  {
    name: 'Allen Iverson', team: 'PHI', legend: true, posGroup: 'guard',
    attrs: { jumpShot:8, finishing:9, perimeterDefense:6, interiorDefense:3, passing:9, handles:11, playmaking:10, size:2, speed:11, bounce:9 },
  },
  {
    name: 'Dwyane Wade', team: 'MIA', legend: true, posGroup: 'guard',
    attrs: { jumpShot:7, finishing:10, perimeterDefense:9, interiorDefense:5, passing:8, handles:9, playmaking:8, size:7, speed:10, bounce:10 },
  },
  {
    name: 'Chris Paul', team: 'PHX', legend: true, posGroup: 'guard',
    attrs: { jumpShot:7, finishing:7, perimeterDefense:10, interiorDefense:4, passing:11, handles:10, playmaking:11, size:3, speed:8, bounce:7 },
  },
  {
    name: 'Kareem Abdul-Jabbar', team: 'LAL', legend: true, posGroup: 'big',
    attrs: { jumpShot:2, finishing:11, perimeterDefense:6, interiorDefense:10, passing:5, handles:3, playmaking:6, size:10, speed:5, bounce:10 },
  },
  {
    name: "Shaquille O'Neal", team: 'LAL', legend: true, posGroup: 'big',
    attrs: { jumpShot:0, finishing:11, perimeterDefense:4, interiorDefense:10, passing:5, handles:3, playmaking:6, size:11, speed:8, bounce:11 },
  },
  {
    name: 'Tim Duncan', team: 'SAS', legend: true, posGroup: 'big',
    attrs: { jumpShot:7, finishing:10, perimeterDefense:7, interiorDefense:11, passing:8, handles:5, playmaking:8, size:9, speed:5, bounce:6 },
  },
  {
    name: 'Wilt Chamberlain', team: 'PHI', legend: true, posGroup: 'big',
    attrs: { jumpShot:0, finishing:11, perimeterDefense:5, interiorDefense:11, passing:6, handles:4, playmaking:6, size:11, speed:9, bounce:11 },
  },
  {
    name: 'Charles Barkley', team: 'PHX', legend: true, posGroup: 'big',
    attrs: { jumpShot:6, finishing:9, perimeterDefense:7, interiorDefense:9, passing:6, handles:6, playmaking:6, size:9, speed:8, bounce:8 },
  },
  {
    name: 'Dirk Nowitzki', team: 'DAL', legend: true, posGroup: 'big',
    attrs: { jumpShot:10, finishing:8, perimeterDefense:6, interiorDefense:6, passing:7, handles:5, playmaking:7, size:10, speed:4, bounce:5 },
  },
  {
    name: 'Bill Russell', team: 'BOS', legend: true, posGroup: 'big',
    attrs: { jumpShot:0, finishing:9, perimeterDefense:6, interiorDefense:11, passing:6, handles:3, playmaking:6, size:9, speed:8, bounce:9 },
  },
  {
    name: 'Tracy McGrady', team: 'ORL', legend: true, posGroup: 'guard',
    attrs: { jumpShot:9, finishing:9, perimeterDefense:7, interiorDefense:5, passing:7, handles:9, playmaking:8, size:8, speed:8, bounce:9 },
  },
  {
    name: 'Carmelo Anthony', team: 'NYK', legend: true, posGroup: 'guard',
    attrs: { jumpShot:9, finishing:9, perimeterDefense:5, interiorDefense:5, passing:6, handles:9, playmaking:9, size:8, speed:6, bounce:7 },
  },
  {
    name: 'Paul Pierce', team: 'BOS', legend: true, posGroup: 'guard',
    attrs: { jumpShot:9, finishing:8, perimeterDefense:7, interiorDefense:6, passing:7, handles:7, playmaking:7, size:7, speed:5, bounce:6 },
  },
  {
    name: 'Ray Allen', team: 'BOS', legend: true, posGroup: 'guard',
    attrs: { jumpShot:11, finishing:6, perimeterDefense:8, interiorDefense:5, passing:6, handles:6, playmaking:6, size:6, speed:8, bounce:6 },
  },
  {
    name: 'Steve Nash', team: 'PHX', legend: true, posGroup: 'guard',
    attrs: { jumpShot:10, finishing:7, perimeterDefense:4, interiorDefense:3, passing:11, handles:11, playmaking:11, size:4, speed:8, bounce:6 },
  },
]

// ─── Player pool (Jul 18+ and infinite) ──────────────────────────────────────
const ALL_PLAYERS = [...NBA_GUARD_PLAYERS, ...NBA_BIG_PLAYERS, ...GOAT_SALARY_PLAYERS]
  .filter(p => {
    if (!p.attrs) return false
    const vals = Object.values(p.attrs)
    return vals.reduce((s, v) => s + v, 0) / vals.length >= 4.0
  })
  .filter((p, i, a) => a.findIndex(q => q.name === p.name) === i)

// ─── Seeded RNG (mulberry32 variant) ──────────────────────────────────────────
function seededRandom(seed) {
  let h = seed | 0
  return () => {
    h ^= h >>> 16
    h = Math.imul(h, 0x45d9f3b) | 0
    h ^= h >>> 16
    h = Math.imul(h, 0x119de1f3) | 0
    h ^= h >>> 16
    return (h >>> 0) / 0x100000000
  }
}

// ─── EST date helpers ──────────────────────────────────────────────────────────
function getESTDate(daysOffset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + daysOffset)
  const ed  = new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const y   = ed.getFullYear()
  const m   = ed.getMonth() + 1
  const day = ed.getDate()
  return {
    str:   `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    seed:  y * 10000 + m * 100 + day,
    label: ed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    day, m, y,
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────
const BUDGET_OPTIONS = [130, 140, 150, 160, 170]

function budgetForDateStr(dateStr) {
  if (dateStr === '2026-07-15') return 140
  if (dateStr === '2026-07-16') return 150
  if (dateStr === '2026-07-17') return 140
  const [y, m, d] = dateStr.split('-').map(Number)
  const seed = y * 10000 + m * 100 + d
  const r = seededRandom(seed ^ 0xB0B0B0)
  return BUDGET_OPTIONS[Math.floor(r() * BUDGET_OPTIONS.length)]
}
const TIERS  = [50, 40, 30, 20, 10]

const TIER_BANDS = [
  [0.00, 0.48],
  [0.22, 0.58],
  [0.40, 0.70],
  [0.55, 0.82],
  [0.68, 1.00],
]

export const SAL_COLS = [
  { key: 'finishing',  label: 'FINISHING',          guardTypes: ['finishing'],                          bigTypes: ['finishing'] },
  { key: 'shooting',   label: 'SHOOTING',           guardTypes: ['jumpShot'],                           bigTypes: ['jumpShot'] },
  { key: 'defense',    label: 'DEFENSE',            guardTypes: ['perimeterDefense'],                   bigTypes: ['interiorDefense'] },
  { key: 'playmaking', label: 'PLAYMAKING',         guardTypes: ['handles', 'passing'],                 bigTypes: ['playmaking'] },
  { key: 'size',       label: 'SIZE & ATHLETICISM', guardTypes: ['speed', 'bounce', 'size'],             bigTypes: ['size', 'bounce'] },
]

function playerPosGroup(player) {
  if (player.posGroup) return player.posGroup
  const pos = NBA_POSITIONS[player.name]?.pos
  return (pos === 'C' || pos === 'PF') ? 'big' : 'guard'
}

function typesFor(player, col) {
  return playerPosGroup(player) === 'big' ? col.bigTypes : col.guardTypes
}

// One representative type per category (for ReportCard / SimPage display)
export const SAL_REP_TYPES = ['finishing', 'jumpShot', 'perimeterDefense', 'passing', 'size']

export const SAL_ATTR_MAP = {
  finishing:        { label: 'FINISHING',          col: '#fb923c', hex: '#fb923c' },
  jumpShot:         { label: 'SHOOTING',           col: '#34d399', hex: '#34d399' },
  perimeterDefense: { label: 'DEFENSE',            col: '#38bdf8', hex: '#38bdf8' },
  passing:          { label: 'PLAYMAKING',         col: '#60a5fa', hex: '#60a5fa' },
  size:             { label: 'SIZE & ATHLETICISM', col: '#a78bfa', hex: '#a78bfa' },
}

const TEAM_META = Object.fromEntries(NBA_TEAMS.map(t => [t.short, t]))

// ─── Hardcoded grids for Jul 15-17 (locked forever) ──────────────────────────
const _playerMap = new Map(
  [...NBA_GUARD_PLAYERS, ...NBA_BIG_PLAYERS, ...GOAT_SALARY_PLAYERS]
    .filter((p, i, a) => a.findIndex(q => q.name === p.name) === i)
    .map(p => [p.name, p])
)
function buildHardcodedGrid(nameGrid) {
  return SAL_COLS.map((col, ci) =>
    TIERS.map((price, ti) => {
      const p = _playerMap.get(nameGrid[ci][ti]) ?? { name: nameGrid[ci][ti], team: 'NBA', attrs: {} }
      const attrs = {}
      typesFor(p, col).forEach(t => { attrs[t] = p.attrs?.[t] ?? 5 })
      const hsId = NBA_HEADSHOTS[p.name]
      return {
        ...p, price, attrs,
        teamColor:  TEAM_META[p.team]?.color  ?? '#444',
        teamColor2: TEAM_META[p.team]?.color2 ?? '#222',
        photo:  hsId ? `/headshots/nba/${hsId}.webp` : null,
        number: NBA_JERSEY_NUMBERS[p.name] ?? null,
        id:     `${col.key}-${price}-${p.name}`,
      }
    })
  )
}
const HARDCODED_GRIDS = {
  20260715: buildHardcodedGrid([
    ['Aaron Gordon','Chris Paul','Donovan Mitchell','Dyson Daniels','Amen Thompson'],
    ['Devin Vassell','Michael Porter Jr.','Immanuel Quickley','Paul George','Josh Giddey'],
    ['Alex Caruso','Kyle Kuzma','Pascal Siakam','Miles Bridges','Tyrese Haliburton'],
    ['Jrue Holiday','Paolo Banchero','Ausar Thompson','Wilt Chamberlain','Julius Randle'],
    ['LeBron James','Andrew Nembhard','Luguentz Dort','LaMelo Ball','Josh Hart'],
  ]),
  20260716: buildHardcodedGrid([
    ['Franz Wagner','Steve Nash','LeBron James','Amen Thompson','Dylan Harper'],
    ['Tyrese Maxey','Cade Cunningham','Donovan Mitchell','Aaron Gordon','Paolo Banchero'],
    ['Charles Barkley','Paul George','Kyrie Irving','Kyle Kuzma','Tyler Herro'],
    ['Desmond Bane','Matas Buzelis','Luguentz Dort','Shai Gilgeous-Alexander','Jayson Tatum'],
    ['Jaylen Brown','Cooper Flagg','Tyrese Haliburton',"De'Aaron Fox",'Keyonte George'],
  ]),
  20260717: buildHardcodedGrid([
    ['Kareem Abdul-Jabbar','Andrew Nembhard','Shai Gilgeous-Alexander','Jimmy Butler III','Jaren Jackson Jr.'],
    ['Austin Reaves','Alex Caruso','Cooper Flagg','Deni Avdija','LeBron James'],
    ['Bill Russell','Mikal Bridges',"De'Aaron Fox",'Paolo Banchero','Tyrese Maxey'],
    ['Jalen Brunson','Miles Bridges','Kawhi Leonard','Shaedon Sharpe','Josh Hart'],
    ['John Collins','Pascal Siakam','Jaden McDaniels','Josh Giddey','RJ Barrett'],
  ]),
  20260718: buildHardcodedGrid([
    ['Michael Jordan','Michael Porter Jr.','Nickeil Alexander-Walker','Terance Mann','Toumani Camara'],
    ['Dirk Nowitzki','Tristan da Silva','Jase Richardson','Sion James','Julius Randle'],
    ['Walker Kessler','Peyton Watson','Aaron Gordon','Jamal Murray','Ace Bailey'],
    ['Nikola Jokic','AJ Dybantsa','OG Anunoby','Jaden McDaniels','Koa Peat'],
    ['Russell Westbrook','Tyrese Maxey','Luke Kornet','Kingston Flemings','Jabari Smith Jr.'],
  ]),
}

// Category accent colors — one per column key
const COL_COLORS = {
  finishing:  '#fb923c',
  shooting:   '#34d399',
  defense:    '#38bdf8',
  playmaking: '#60a5fa',
  size:       '#a78bfa',
}

// ─── Score calculation ─────────────────────────────────────────────────────────
// Uses peak attr per column — gives fair credit to specialists and matches intuition
function calcStats(sel) {
  const scoreFor = (ci) => {
    const p = sel[ci]
    if (!p?.attrs) return 5
    const vals = Object.values(p.attrs)
    return vals.length ? Math.max(...vals) : 5
  }
  const fScore  = scoreFor(0)
  const sScore  = scoreFor(1)
  const dScore  = scoreFor(2)
  const pScore  = scoreFor(3)
  const szScore = scoreFor(4)
  const overall = Math.round(fScore + sScore + dScore + pScore + szScore)
  const ppg     = +((fScore + sScore) / 2 * 2.6 + 1.8).toFixed(1)
  const apg     = +(pScore * 0.8 + 0.5).toFixed(1)
  const rpg     = +(szScore * 1.0 + 1.2).toFixed(1)
  return { overall, ppg, apg, rpg }
}

const PLAYED_KEY     = (str, uid) => uid ? `sal_play_${uid}_${str}`     : `sal_play_${str}`
const SHUFFLED_KEY   = (str, uid) => uid ? `sal_shuffled_${uid}_${str}` : `sal_shuffled_${str}`
const SCOUTED_KEY    = (str, uid) => uid ? `sal_scouted_${uid}_${str}`  : `sal_scouted_${str}`
const POWER_SEEN_KEY = 'sal_power_seen'

// ─── Grid generation ──────────────────────────────────────────────────────────
// Returns the set of player names that would be picked for a given seed (used to
// detect back-to-back appearances and apply a penalty the following day).
// Compute the correct salary tier for a legend in a given column by ranking
// their catScore against the regular player pool (no rand needed — deterministic).
function legendTierFor(legend, col, regulars) {
  const legTypes  = typesFor(legend, col)
  const legScore  = legTypes.reduce((s, t) => s + (legend.attrs?.[t] ?? 5), 0) / legTypes.length
  const sorted    = regulars
    .map(p => { const ts = typesFor(p, col); return ts.reduce((s, t) => s + (p.attrs?.[t] ?? 5), 0) / ts.length })
    .sort((a, b) => b - a)
  const rank = sorted.findIndex(s => s <= legScore)
  // rank === -1 means no player scored as low as the legend → legend is the worst → pct = 1.0
  const pct  = rank === -1 ? 1.0 : rank / sorted.length
  if (pct < 0.22) return 0  // $50
  if (pct < 0.40) return 1  // $40
  if (pct < 0.55) return 2  // $30
  if (pct < 0.68) return 3  // $20
  return 4                   // $10
}

// Pick 2 deterministic legend slots — cycles through all legends before repeating.
// rand() still used for column and tier nudge so placement varies day-to-day.
function pickLegendSlots(rand, cols, legends, regulars, seed) {
  // Compute sequential day index from seed (yyyymmdd format)
  const y   = Math.floor(seed / 10000)
  const m   = Math.floor((seed % 10000) / 100)
  const day = seed % 100
  const epochMs = new Date(2026, 0, 1).getTime()
  const dayIdx  = Math.round((new Date(y, m - 1, day).getTime() - epochMs) / 86400000)

  // Fixed shuffle of legend list so pair order isn't biased toward list order
  const fixedR = seededRandom(0xBADC0FFE)
  const shuffled = [...legends]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(fixedR() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  // Pick pair based on day index — all legends appear before any repeats
  const n = shuffled.length
  const leg0 = shuffled[((dayIdx * 2)     % n + n) % n]
  const leg1 = shuffled[((dayIdx * 2 + 1) % n + n) % n]

  const usedLegends = new Set()
  if (leg0) usedLegends.add(leg0.name)
  if (leg1) usedLegends.add(leg1.name)

  // Column placement and tier nudge still use daily rand() for variation
  const li0c = Math.floor(rand() * cols.length)
  const li1c = Math.floor(rand() * cols.length)

  // Tier = correct rank ± 1 (seeded) so salary is close but not perfectly sorted
  const nudge = ti => Math.min(TIERS.length - 1, Math.max(0, ti + Math.floor(rand() * 3) - 1))
  const li0t = leg0 ? nudge(legendTierFor(leg0, cols[li0c], regulars)) : 0
  let   li1t = leg1 ? nudge(legendTierFor(leg1, cols[li1c], regulars)) : 1
  // If both land in the same (col, tier) slot, shift the second one down
  if (li1c === li0c && li1t === li0t) li1t = (li1t + 1) % TIERS.length

  const map = new Map()
  if (leg0) map.set(`${li0c}-${li0t}`, leg0)
  if (leg1) map.set(`${li1c}-${li1t}`, leg1)
  return { map, usedLegends }
}

function getPickedNamesForSeed(seed, cols, players) {
  const rand     = seededRandom(seed)
  const legends  = players.filter(p => p.legend)
  const regulars = players.filter(p => !p.legend)
  const { map: legendMap, usedLegends } = pickLegendSlots(rand, cols, legends, regulars, seed)

  const playerNoise = new Map(regulars.map(p => [p.name, (rand() - 0.5) * 1.8]))
  const used = new Set([...usedLegends])

  for (const [key] of legendMap) used.add(legendMap.get(key).name)

  cols.forEach((col, ci) => {
    const scored = regulars
      .map(p => ({
        name: p.name,
        catScore: (() => { const ts = typesFor(p, col); return ts.reduce((s, t) => s + (p.attrs?.[t] ?? 5), 0) / ts.length })()
                  + (playerNoise.get(p.name) ?? 0),
      }))
      .sort((a, b) => b.catScore - a.catScore)
    const n = scored.length
    for (let ti = 0; ti < TIERS.length; ti++) {
      if (legendMap.has(`${ci}-${ti}`)) continue
      const [lo, hi] = TIER_BANDS[ti]
      let pool = scored
        .slice(Math.floor(lo * n), Math.max(Math.floor(lo * n) + 1, Math.floor(hi * n)))
        .filter(p => !used.has(p.name))
      if (!pool.length) pool = scored.filter(p => !used.has(p.name))
      if (!pool.length) pool = scored
      const player = pool[Math.floor(rand() * pool.length)]
      used.add(player.name)
    }
  })
  return used
}

function generateGrid(cols, players, rand, recentlyUsed = new Set(), seed = 0) {
  const RECENT_PENALTY = 3.5
  const legends  = players.filter(p => p.legend)
  const regulars = players.filter(p => !p.legend)

  // 2 rand() calls to place exactly 2 legends — same for all users on the same day
  const { map: legendMap, usedLegends } = pickLegendSlots(rand, cols, legends, regulars, seed)

  function buildCard(p, col, price) {
    const attrs = {}
    const pts = typesFor(p, col)
    pts.forEach(t => { attrs[t] = p.attrs?.[t] ?? 5 })
    const hsId = NBA_HEADSHOTS[p.name]
    return {
      ...p,
      price, attrs,
      catScore: pts.reduce((s, t) => s + (p.attrs?.[t] ?? 5), 0) / pts.length,
      teamColor:  TEAM_META[p.team]?.color  ?? '#444',
      teamColor2: TEAM_META[p.team]?.color2 ?? '#222',
      photo:  hsId ? `/headshots/nba/${hsId}.webp` : null,
      number: NBA_JERSEY_NUMBERS[p.name] ?? null,
      id:     `${col.key}-${price}-${p.name}`,
    }
  }

  const playerNoise = new Map(regulars.map(p => [p.name, (rand() - 0.5) * 1.8]))
  const used = new Set([...usedLegends])

  return cols.map((col, ci) => {
    const scored = regulars
      .map(p => ({
        ...p,
        teamColor:  TEAM_META[p.team]?.color  ?? '#444',
        teamColor2: TEAM_META[p.team]?.color2 ?? '#222',
        catScore: (() => { const ts = typesFor(p, col); return ts.reduce((s, t) => s + (p.attrs?.[t] ?? 5), 0) / ts.length })()
                  + (playerNoise.get(p.name) ?? 0)
                  - (recentlyUsed.has(p.name) ? RECENT_PENALTY : 0),
      }))
      .sort((a, b) => b.catScore - a.catScore)
    const n = scored.length
    return TIERS.map((price, ti) => {
      const legKey = `${ci}-${ti}`
      if (legendMap.has(legKey)) return buildCard(legendMap.get(legKey), col, price)

      const [lo, hi] = TIER_BANDS[ti]
      let pool = scored
        .slice(Math.floor(lo * n), Math.max(Math.floor(lo * n) + 1, Math.floor(hi * n)))
        .filter(p => !used.has(p.name))
      if (!pool.length) pool = scored.filter(p => !used.has(p.name))
      if (!pool.length) pool = scored
      const player = pool[Math.floor(rand() * pool.length)]
      used.add(player.name)
      const attrs = {}
      typesFor(player, col).forEach(t => { attrs[t] = player.attrs?.[t] ?? 5 })
      const hsId = NBA_HEADSHOTS[player.name]
      return {
        ...player,
        price, attrs,
        catScore: player.catScore,
        photo:  hsId ? `/headshots/nba/${hsId}.webp` : null,
        number: NBA_JERSEY_NUMBERS[player.name] ?? null,
        id:     `${col.key}-${price}-${player.name}`,
      }
    })
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isNearBlack(hex) {
  if (!hex) return false
  const c = hex.replace('#', '')
  if (c.length < 6) return false
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return (r + g + b) / 3 < 50
}

// ─── Grade helpers ────────────────────────────────────────────────────────────
function calcGrade(player) {
  const vals = Object.values(player.attrs ?? {})
  if (!vals.length) return 'C'
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length
  return valToGrade(avg)
}

function gradeColor(g) {
  if (g === 'S')          return '#a855f7'
  if (g.startsWith('A')) return '#22c55e'
  if (g.startsWith('B')) return '#60a5fa'
  if (g.startsWith('C')) return '#f59e0b'
  if (g.startsWith('D')) return '#f97316'
  return '#ef4444'
}

// ─── PlayerCard ───────────────────────────────────────────────────────────────
function PlayerCard({ player, isSelected, colHasSelection, onClick, viewOnly, shufflePhase, shuffleDelay = 0, scoutGrade = null, scoutMode = false, shuffleHighlight = null }) {
  const dimmed = colHasSelection && !isSelected
  const [first, ...rest] = player.name.split(' ')
  const last = rest.join(' ')
  const animClass = shufflePhase === 'out' ? ' sc-card--flip-out' : shufflePhase === 'in' ? ' sc-card--flip-in' : ''
  const hlClass = shuffleHighlight === 'col' ? ' sc-card--hl-col' : shuffleHighlight === 'row' ? ' sc-card--hl-row' : ''
  return (
    <button
      onClick={viewOnly ? undefined : onClick}
      className={`sc-card${isSelected ? ' sc-card--sel' : ''}${dimmed ? ' sc-card--dim' : ''}${viewOnly ? ' sc-card--view' : ''}${animClass}${hlClass}`}
      style={{ '--tc': player.teamColor, '--sel': isNearBlack(player.teamColor) ? '#888' : player.teamColor, '--sd': `${shuffleDelay}ms` }}
    >
      <div className="sc-card-visual" data-team={player.team}>
        <img src={`/logos/nba/${player.team}.png`} alt="" aria-hidden="true" className="sc-card-logo-bg"
          onError={e => { e.currentTarget.style.display = 'none' }} />
        {player.photo
          ? <img src={player.photo} alt={player.name} className="sc-card-headshot" />
          : <div className="sc-card-no-photo">
              <img src={`/logos/nba/${player.team}.png`} alt={player.team} style={{ width: '55%', opacity: 0.7 }} />
            </div>
        }
      </div>
      <div className="sc-card-name-wrap">
        <span className="sc-card-first">{first}</span>
        <span className="sc-card-last">{last}</span>
      </div>
      {scoutGrade && (
        <div className="sc-grade-overlay" style={{ '--gc': gradeColor(scoutGrade) }}>
          <span className="sc-grade-letter">{scoutGrade}</span>
        </div>
      )}
    </button>
  )
}

// ─── BudgetBar ────────────────────────────────────────────────────────────────
function BudgetBar({ spent, total, pickedAll }) {
  const pct   = Math.min(1, spent / total) * 100
  const over  = spent > total
  const exact = spent === total && pickedAll
  const col   = over ? '#ef4444' : exact ? '#a855f7' : spent >= total - 10 ? '#f59e0b' : '#34d399'
  return (
    <div className="sc-budget">
      <div className="sc-budget-label">
        <span style={{ color: over ? '#ef4444' : exact ? '#a855f7' : '#fff', fontWeight: 900 }}>${spent}M</span>
        <span style={{ color: 'rgba(255,255,255,0.4)' }}> / ${total}M</span>
      </div>
      <div className="sc-budget-track">
        <div className="sc-budget-fill" style={{ width: `${pct}%`, background: col }} />
      </div>
    </div>
  )
}

// ─── DatePicker ───────────────────────────────────────────────────────────────
function DatePicker({ activeDate, dates, onSelect, mode, onInfinite }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="sc-date-wrap">
      <button className="sc-date-btn" onClick={() => setOpen(v => !v)}>
        {mode === 'infinite'
          ? <>
              <span className="sc-date-day sc-date-day--inf">∞</span>
              <span className="sc-date-month">INF</span>
            </>
          : <>
              <span className="sc-date-day">{activeDate.day}</span>
              <span className="sc-date-month">{activeDate.label.split(' ')[0].toUpperCase()}</span>
            </>
        }
      </button>
      {open && (
        <>
          <div className="sc-date-backdrop" onClick={() => setOpen(false)} />
          <div className="sc-date-dropdown">
            <button
              className={`sc-date-item sc-date-item--inf${mode === 'infinite' ? ' sc-date-item--active' : ''}`}
              onClick={() => { onInfinite(); setOpen(false) }}
            >
              <span className="sc-date-item-label">∞ Infinite</span>
              {mode === 'infinite' && <span className="sc-date-item-reset">tap to reset</span>}
            </button>
            {dates.map(date => (
              <button
                key={date.str}
                className={`sc-date-item${mode === 'daily' && activeDate.str === date.str ? ' sc-date-item--active' : ''}`}
                onClick={() => { onSelect(date); setOpen(false) }}
              >
                <span className="sc-date-item-label">{date.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── InfiniteLeaderboard ─────────────────────────────────────────────────────
function InfiniteLeaderboard({ onClose }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    if (!supabase) { setRows([]); return }
    supabase
      .from('salary_infinite_plays')
      .select('username, picks, overall_score, ppg, apg, rpg')
      .order('overall_score', { ascending: false })
      .limit(10)
      .then(({ data }) => setRows((data || []).slice(0, 10)))
      .catch(() => setRows([]))
  }, [])
  return (
    <>
      <div className="sc-lb-backdrop" onClick={onClose} />
      <div className="sc-lb-dropdown">
        <div className="sc-lb-header">
          <span className="sc-lb-title">ALL-TIME TOP BUILDS</span>
        </div>
        {rows === null && <div className="sc-lb-empty">Loading…</div>}
        {rows !== null && rows.length === 0 && <div className="sc-lb-empty">No builds yet — be the first!</div>}
        {rows !== null && rows.map((r, i) => (
          <div key={i} className={`sc-lb-row${i === 0 ? ' sc-lb-row--top' : ''}`} style={{ animationDelay: `${i * 0.04}s` }}>
            <div className="sc-lb-row-main">
              <span className="sc-lb-rank">{i + 1}</span>
              <span className="sc-lb-name">{r.username || 'Anonymous'}</span>
              <span className="sc-lb-ovr">{r.overall_score} OVR</span>
            </div>
            {r.picks && (
              <div className="sc-lb-picks">
                {r.picks.map((p, pi) => (
                  <div key={pi} className="sc-lb-pick" title={p.name} style={{ '--tc': p.teamColor || '#444' }}>
                    {p.photo
                      ? <img src={p.photo} alt={p.name} />
                      : <img src={`/logos/nba/${p.team}.png`} alt={p.team} style={{ padding: '4px', opacity: 0.7 }} />
                    }
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

// ─── SalaryLeaderboard ────────────────────────────────────────────────────────
function SalaryLeaderboard({ dateStr, dateLabel, onClose }) {
  const [rows, setRows] = useState(null)
  const budget = budgetForDateStr(dateStr)

  useEffect(() => {
    if (!supabase) { setRows([]); return }
    supabase
      .from('salary_cap_plays')
      .select('username, picks, overall_score, ppg, apg, rpg, budget_used')
      .eq('date_str', dateStr)
      .order('overall_score', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        const sorted = (data || []).sort((a, b) => {
          if (b.overall_score !== a.overall_score) return b.overall_score - a.overall_score
          return (b.ppg + b.apg + b.rpg) - (a.ppg + a.apg + a.rpg)
        })
        setRows(sorted.slice(0, 10))
      })
      .catch(() => setRows([]))
  }, [dateStr])

  return (
    <>
      <div className="sc-lb-backdrop" onClick={onClose} />
      <div className="sc-lb-dropdown">
        <div className="sc-lb-header">
          <span className="sc-lb-title">{dateLabel?.toUpperCase() ?? 'TODAY'}'S TOP BUILDS</span>
        </div>
        {rows === null && <div className="sc-lb-empty">Loading…</div>}
        {rows !== null && rows.length === 0 && (
          <div className="sc-lb-empty">No builds yet — be the first!</div>
        )}
        {rows !== null && rows.map((r, i) => (
          <div
            key={i}
            className={`sc-lb-row${i === 0 ? ' sc-lb-row--top' : ''}`}
            style={{ animationDelay: `${i * 0.04}s` }}
          >
            <div className="sc-lb-row-main">
              <span className="sc-lb-rank">{i + 1}</span>
              <span className="sc-lb-name">{r.username || 'Anonymous'}</span>
              <span className="sc-lb-ovr">{r.overall_score} OVR</span>
              {r.budget_used != null && budget - r.budget_used > 0 && (
                <span className="sc-lb-spare">+${budget - r.budget_used}M</span>
              )}
            </div>
            {r.picks && (
              <div className="sc-lb-picks">
                {r.picks.map((p, pi) => (
                  <div
                    key={pi}
                    className="sc-lb-pick"
                    title={p.name}
                    style={{ '--tc': p.teamColor || '#444' }}
                  >
                    {p.photo
                      ? <img src={p.photo} alt={p.name} />
                      : <img src={`/logos/nba/${p.team}.png`} alt={p.team} style={{ padding: '4px', opacity: 0.7 }} />
                    }
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

// ─── BucketSalaryCap ──────────────────────────────────────────────────────────
export default function BucketSalaryCap({ onConfirm, onBack, user, initialDateStr, position = 'guard' }) {
  const dates      = useMemo(() => Array.from({ length: 10 }, (_, i) => getESTDate(-i)), [])
  const [activeDate,    setActiveDate]    = useState(() => {
    if (initialDateStr) {
      const allDates = Array.from({ length: 10 }, (_, i) => getESTDate(-i))
      const match = allDates.find(d => d.str === initialDateStr)
      if (match) return match
    }
    return getESTDate(0)
  })
  const [sel,           setSel]           = useState({})
  const [alreadyPlayed, setAlreadyPlayed] = useState(null)
  const [showLB,        setShowLB]        = useState(false)
  const [showLBPrompt,  setShowLBPrompt]  = useState(false)
  const [shufflesLeft,    setShufflesLeft]    = useState(() => localStorage.getItem(SHUFFLED_KEY(getESTDate(0).str, user?.id)) ? 0 : 1)
  const [shuffleOverride, setShuffleOverride] = useState(() => {
    const saved = localStorage.getItem(SHUFFLED_KEY(getESTDate(0).str, user?.id))
    if (!saved) return {}
    try { const { ci, players } = JSON.parse(saved); return { [ci]: players } } catch { return {} }
  })
  const [shufflingCol,    setShufflingCol]    = useState(null)
  const [shufflingRow,    setShufflingRow]    = useState(null)
  const [rowOverrides,    setRowOverrides]    = useState({})
  const [shufflePhase,    setShufflePhase]    = useState(null)
  const [shuffleMode,     setShuffleMode]     = useState(false)
  const [hoveredShuffle,  setHoveredShuffle]  = useState(null)
  const [scoutsLeft,      setScoutsLeft]      = useState(() => localStorage.getItem(SCOUTED_KEY(getESTDate(0).str, user?.id)) ? 0 : 1)
  const [scoutMode,       setScoutMode]       = useState(false)
  const [scoutedGrades,   setScoutedGrades]   = useState({})
  const [powerMenuOpen,   setPowerMenuOpen]   = useState(false)
  const [powerSeen,       setPowerSeen]       = useState(() => !!localStorage.getItem(POWER_SEEN_KEY))
  const [mode,            setMode]            = useState('daily')
  const [infiniteSeed,    setInfiniteSeed]    = useState(() => Math.random() * 0x7FFFFFFF | 0)
  const [infShufflesLeft, setInfShufflesLeft] = useState(1)
  const [infScoutsLeft,   setInfScoutsLeft]   = useState(1)

  const grid = useMemo(() => {
    if (mode === 'infinite') {
      const rand = seededRandom(infiniteSeed)
      return generateGrid(SAL_COLS, ALL_PLAYERS, rand, new Set(), infiniteSeed)
    }
    if (HARDCODED_GRIDS[activeDate.seed]) return HARDCODED_GRIDS[activeDate.seed]
    const rand = seededRandom(activeDate.seed)
    const yesterday = new Date(activeDate.y, activeDate.m - 1, activeDate.day - 1)
    const yy = yesterday.getFullYear(), ym = yesterday.getMonth() + 1, yd = yesterday.getDate()
    const recentlyUsed = getPickedNamesForSeed(yy * 10000 + ym * 100 + yd, SAL_COLS, ALL_PLAYERS)
    return generateGrid(SAL_COLS, ALL_PLAYERS, rand, recentlyUsed, activeDate.seed)
  }, [mode, infiniteSeed, activeDate.seed, activeDate.y, activeDate.m, activeDate.day])

  // Preload all headshots for the current day's grid so cards render instantly
  useEffect(() => {
    const urls = grid.flat().map(p => p.photo).filter(Boolean)
    const imgs = urls.map(url => { const i = new Image(); i.src = url; return i })
    return () => imgs.forEach(i => { i.src = '' })
  }, [grid])

  useEffect(() => { if (!shuffleMode) setHoveredShuffle(null) }, [shuffleMode])

  const effectiveGrid = useMemo(
    () => grid.map((col, ci) => {
      const base = shuffleOverride[ci] ?? col
      return base.map((player, ti) => rowOverrides[ti]?.[ci] ?? player)
    }),
    [grid, shuffleOverride, rowOverrides]
  )

  // Daily budget varies ±20 from 150 in steps of 10, seeded by date
  const dailyBudget = useMemo(() => {
    if (mode === 'infinite') {
      const r = seededRandom(infiniteSeed ^ 0xB0B0B0)
      return BUDGET_OPTIONS[Math.floor(r() * BUDGET_OPTIONS.length)]
    }
    if (activeDate.str === '2026-07-15') return 140
    if (activeDate.str === '2026-07-16') return 150
    if (activeDate.str === '2026-07-17') return 140
    const r = seededRandom(activeDate.seed ^ 0xB0B0B0)
    return BUDGET_OPTIONS[Math.floor(r() * BUDGET_OPTIONS.length)]
  }, [mode, infiniteSeed, activeDate.seed, activeDate.str])

  const executeShuffleCol = (ci) => {
    const effectiveShuffle = mode === 'infinite' ? infShufflesLeft : shufflesLeft
    if (effectiveShuffle === 0 || shufflingCol !== null || (mode === 'daily' && alreadyPlayed)) return
    setShuffleMode(false)
    setShufflingCol(ci)
    setShufflePhase('out')
    setTimeout(() => {
      // Derangement: shuffle until no player stays in their original position
      const original = effectiveGrid[ci]
      let current
      do {
        current = [...original]
        for (let i = current.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [current[i], current[j]] = [current[j], current[i]]
        }
      } while (current.some((p, i) => p.name === original[i].name))
      const newPlayers = current.map((p, ti) => ({ ...p, price: TIERS[ti], id: `${p.name}-s-${ti}` }))
      setShuffleOverride(prev => ({ ...prev, [ci]: newPlayers }))
      setSel(prev => {
        const { [ci]: _, ...rest } = prev
        return rest
      })
      if (mode === 'infinite') {
        setInfShufflesLeft(0)
      } else {
        localStorage.setItem(SHUFFLED_KEY(activeDate.str, user?.id), JSON.stringify({ ci, players: newPlayers }))
        setShufflesLeft(0)
      }
      setShufflePhase('in')
      setTimeout(() => { setShufflingCol(null); setShufflePhase(null) }, 500)
    }, 380)
  }

  const executeShuffleRow = (ti) => {
    const effectiveShuffle = mode === 'infinite' ? infShufflesLeft : shufflesLeft
    if (effectiveShuffle === 0 || shufflingCol !== null || shufflingRow !== null || (mode === 'daily' && alreadyPlayed)) return
    setShuffleMode(false)
    setShufflingRow(ti)
    setShufflePhase('out')
    setTimeout(() => {
      const original = effectiveGrid.map(col => col[ti])
      let current
      do {
        current = [...original]
        for (let i = current.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[current[i], current[j]] = [current[j], current[i]]
        }
      } while (current.some((p, i) => p.name === original[i].name))
      const price = TIERS[ti]
      const newMap = {}
      current.forEach((p, ci) => {
        const col = SAL_COLS[ci]
        const srcAttrs = _playerMap.get(p.name)?.attrs ?? p.attrs ?? {}
        const attrs = {}
        typesFor({ ...p, attrs: srcAttrs }, col).forEach(t => { attrs[t] = srcAttrs[t] ?? 5 })
        newMap[ci] = { ...p, price, attrs, id: `${col.key}-${price}-${p.name}-r` }
      })
      setRowOverrides(prev => ({ ...prev, [ti]: newMap }))
      setSel(prev => {
        const next = { ...prev }
        SAL_COLS.forEach((_, ci) => {
          if (next[ci] && original[ci]?.name === next[ci]?.name) delete next[ci]
        })
        return next
      })
      if (mode === 'infinite') { setInfShufflesLeft(0) }
      else { setShufflesLeft(0) }
      setShufflePhase('in')
      setTimeout(() => { setShufflingRow(null); setShufflePhase(null) }, 500)
    }, 380)
  }

  const executeScout = (player) => {
    const effectiveScout = mode === 'infinite' ? infScoutsLeft : scoutsLeft
    if (effectiveScout === 0 || (mode === 'daily' && alreadyPlayed)) return
    const grade = calcGrade(player)
    const newGrades = { ...scoutedGrades, [player.name]: grade }
    setScoutedGrades(newGrades)
    if (mode === 'infinite') {
      setInfScoutsLeft(0)
    } else {
      localStorage.setItem(SCOUTED_KEY(activeDate.str, user?.id), JSON.stringify(newGrades))
      setScoutsLeft(0)
    }
    setScoutMode(false)
  }

  // Check localStorage on date/account change; clear sel for unplayed dates
  useEffect(() => {
    const uid = user?.id
    const savedShuffle = localStorage.getItem(SHUFFLED_KEY(activeDate.str, uid))
    setShufflesLeft(savedShuffle ? 0 : 1)
    if (savedShuffle) {
      try {
        const { ci, players } = JSON.parse(savedShuffle)
        setShuffleOverride({ [ci]: players })
      } catch { setShuffleOverride({}) }
    } else {
      setShuffleOverride({})
    }
    setShuffleMode(false)
    const savedScouted = localStorage.getItem(SCOUTED_KEY(activeDate.str, uid))
    setScoutsLeft(savedScouted ? 0 : 1)
    setScoutedGrades(savedScouted ? JSON.parse(savedScouted) : {})
    setScoutMode(false)
    setPowerMenuOpen(false)
    try {
      const s = localStorage.getItem(PLAYED_KEY(activeDate.str, uid))
      if (s) {
        setAlreadyPlayed(JSON.parse(s))
        return
      }
    } catch {}
    setAlreadyPlayed(null)
    setSel({})
  }, [activeDate.str, user?.id])

  // For logged-in users: cross-device check via Supabase
  useEffect(() => {
    if (!user || !supabase) return
    if (localStorage.getItem(PLAYED_KEY(activeDate.str, user.id))) return
    supabase
      .from('salary_cap_plays')
      .select('picks, overall_score, ppg, apg, rpg')
      .eq('user_id', user.id)
      .eq('date_str', activeDate.str)
      .limit(1)
      .single()
      .then(({ data }) => {
        if (!data) return
        const play = {
          picks:   data.picks,
          overall: data.overall_score,
          ppg:     data.ppg,
          apg:     data.apg,
          rpg:     data.rpg,
        }
        setAlreadyPlayed(play)
        localStorage.setItem(PLAYED_KEY(activeDate.str, user.id), JSON.stringify(play))
      })
      .catch(() => {})
  }, [user, activeDate.str])

  // Re-populate sel from saved picks so the grid shows their previous selections
  useEffect(() => {
    if (!alreadyPlayed?.picks) return
    const newSel = {}
    alreadyPlayed.picks.forEach((savedPlayer, ci) => {
      if (!savedPlayer) return
      // Search effectiveGrid (includes shuffle overrides) first, fall back to base grid
      const found = effectiveGrid[ci]?.find(p => p.name === savedPlayer.name)
               ?? grid[ci]?.find(p => p.name === savedPlayer.name)
      if (found) newSel[ci] = found
    })
    setSel(newSel)
  }, [alreadyPlayed, effectiveGrid])

  const totalCost       = Object.values(sel).reduce((s, p) => s + p.price, 0)
  const pickedAll       = Object.keys(sel).length === SAL_COLS.length
  const overBudget      = totalCost > dailyBudget
  const effectivePosition = sel[4] ? (playerPosGroup(sel[4]) === 'big' ? 'big' : 'guard') : position

  const pick = (ci, player) => {
    if (alreadyPlayed) return
    if (scoutMode) { executeScout(player); return }
    setSel(prev =>
      prev[ci]?.id === player.id
        ? (({ [ci]: _, ...rest }) => rest)(prev)
        : { ...prev, [ci]: player }
    )
  }

  const handleSelectDate = date => {
    if (date.str === activeDate.str) return
    setActiveDate(date)
    setAlreadyPlayed(null)
    setSel({})
    setShowLB(false)
    setShufflingCol(null)
    setShufflingRow(null)
    setRowOverrides({})
    setShufflePhase(null)
  }

  const handleInfinite = () => {
    setMode('infinite')
    setAlreadyPlayed(null)
    setInfiniteSeed(Math.random() * 0x7FFFFFFF | 0)
    setSel({})
    setShuffleOverride({})
    setRowOverrides({})
    setInfShufflesLeft(1)
    setInfScoutsLeft(1)
    setShufflingCol(null)
    setShufflingRow(null)
    setShufflePhase(null)
    setScoutedGrades({})
    setShuffleMode(false)
    setScoutMode(false)
    setPowerMenuOpen(false)
    setShowLB(false)
    setShowLBPrompt(false)
  }

  const buildFromSel = () => {
    const build = {}
    SAL_COLS.forEach((col, ci) => {
      const p = sel[ci]
      // Always use guard-key names as canonical keys so the build is consistent
      // regardless of which position mode the user started in. Values fall back
      // to the big-type attr when a player doesn't have the guard-type attr.
      col.guardTypes.forEach(type => {
        const val = p.attrs[type] ?? col.bigTypes.map(t => p.attrs[t]).find(v => v != null) ?? 5
        build[type] = {
          type, val,
          qb: p.short ?? p.name, qbFull: p.name,
          teamColor: p.teamColor, teamColor2: p.teamColor2,
          team: p.team, captain: p.captain ?? false,
          photo: p.photo, skinColor: p.skin ?? null,
          number: p.number ?? null, height: p.height ?? null, weight: p.weight ?? null,
        }
      })
    })
    return build
  }

  const confirm = () => {
    if (!pickedAll) return

    if (mode === 'infinite') {
      if (overBudget) return
      const build = buildFromSel()
      const stats = calcStats(sel)
      const picks = SAL_COLS.map((col, ci) => {
        const p = sel[ci]
        return { name: p.name, team: p.team, price: p.price, photo: p.photo, teamColor: p.teamColor, number: p.number }
      })
      const saveData = {
        picks, ppg: stats.ppg, apg: stats.apg, rpg: stats.rpg,
        userId: user?.id ?? null, username: user?.email?.split('@')[0] ?? null,
        totalCost, infinite: true,
      }
      onConfirm(build, false, null, saveData, effectivePosition)
      return
    }

    if (alreadyPlayed) {
      onConfirm(buildFromSel(), true, activeDate.str, null, effectivePosition)
      return
    }

    if (overBudget) return

    const build = buildFromSel()
    const stats = calcStats(sel)
    const picks = SAL_COLS.map((col, ci) => {
      const p = sel[ci]
      return {
        name:      p.name,
        team:      p.team,
        price:     p.price,
        photo:     p.photo,
        teamColor: p.teamColor,
        number:    p.number,
      }
    })
    const playData = { picks, overall: stats.overall, ppg: stats.ppg, apg: stats.apg, rpg: stats.rpg }

    localStorage.setItem(PLAYED_KEY(activeDate.str, user?.id), JSON.stringify(playData))
    setAlreadyPlayed(playData)

    // Pass save data to BucketApp so it can insert after the sim with the real OVR
    const saveData = {
      picks,
      ppg:      stats.ppg,
      apg:      stats.apg,
      rpg:      stats.rpg,
      userId:   user?.id ?? null,
      username: user?.email?.split('@')[0] ?? null,
      totalCost,
    }

    onConfirm(build, false, activeDate.str, saveData, effectivePosition)
  }

  const effectiveShufflesLeft = mode === 'infinite' ? infShufflesLeft : shufflesLeft
  const effectiveScoutsLeft   = mode === 'infinite' ? infScoutsLeft   : scoutsLeft
  const missing   = SAL_COLS.length - Object.keys(sel).length
  const viewReady = mode === 'daily' && alreadyPlayed && pickedAll
  const disabled  = viewReady ? false : (!pickedAll || overBudget)
  const ctaLabel  = mode === 'daily' && alreadyPlayed
    ? (pickedAll ? 'View Results →' : '…')
    : !pickedAll
    ? `Pick ${missing} more`
    : overBudget
    ? `$${totalCost - dailyBudget}M over budget`
    : 'Lock In Build →'

  return (
    <div className="sc-screen">
      <div className="sc-header">
        <div className="sc-title">BUILD<span style={{ color: '#a855f7' }}>-A-</span>PLAYER <span style={{ color: '#a855f7' }}>SALARY</span></div>
        <div className="sc-footer-icons">
          {(effectiveShufflesLeft > 0 || effectiveScoutsLeft > 0) && (mode === 'infinite' || !alreadyPlayed) && (
            <div className="sc-power-wrap">
              <button
                className={`sc-lb-btn${powerMenuOpen ? ' sc-lb-btn--open' : ''}${!powerSeen && !powerMenuOpen ? ' sc-lb-btn--pulse' : ''}`}
                onClick={() => {
                  if (!powerSeen) { setPowerSeen(true); localStorage.setItem(POWER_SEEN_KEY, '1') }
                  setPowerMenuOpen(v => !v)
                  setShuffleMode(false)
                  setScoutMode(false)
                }}
                title="Power-ups"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="4"/>
                  <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none"/>
                  <circle cx="16" cy="8" r="1.4" fill="currentColor" stroke="none"/>
                  <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>
                  <circle cx="8" cy="16" r="1.4" fill="currentColor" stroke="none"/>
                  <circle cx="16" cy="16" r="1.4" fill="currentColor" stroke="none"/>
                </svg>
              </button>
              {powerMenuOpen && (
                <>
                  <div className="sc-power-backdrop" onClick={() => setPowerMenuOpen(false)} />
                  <div className="sc-power-menu">
                    <div className="sc-power-item">
                      <button
                        className={`sc-power-circle${shuffleMode ? ' sc-power-circle--active' : ''}${effectiveShufflesLeft === 0 ? ' sc-power-circle--used' : ''}`}
                        disabled={effectiveShufflesLeft === 0}
                        onClick={() => {
                          if (effectiveShufflesLeft === 0) return
                          setPowerMenuOpen(false)
                          setShuffleMode(v => !v)
                          setScoutMode(false)
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>
                        </svg>
                        <span className="sc-power-badge">{effectiveShufflesLeft}</span>
                      </button>
                      <span className="sc-power-label">SHUFFLE</span>
                    </div>
                    <div className="sc-power-item">
                      <button
                        className={`sc-power-circle${scoutMode ? ' sc-power-circle--active' : ''}${effectiveScoutsLeft === 0 ? ' sc-power-circle--used' : ''}`}
                        disabled={effectiveScoutsLeft === 0}
                        onClick={() => {
                          if (effectiveScoutsLeft === 0) return
                          setPowerMenuOpen(false)
                          setScoutMode(v => !v)
                          setShuffleMode(false)
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8"/>
                          <path d="m21 21-4.35-4.35"/>
                        </svg>
                        <span className="sc-power-badge">{effectiveScoutsLeft}</span>
                      </button>
                      <span className="sc-power-label">SCOUT</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <div className="sc-lb-wrap">
            <button
              className={`sc-lb-btn${showLB ? ' sc-lb-btn--open' : ''}`}
              onClick={e => {
                e.currentTarget.blur()
                if (mode === 'infinite' || alreadyPlayed) {
                  setShowLB(v => !v)
                } else {
                  setShowLBPrompt(true)
                  setTimeout(() => setShowLBPrompt(false), 2800)
                }
              }}
              aria-label="Today's top builds"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                <path d="M4 22h16"/>
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
              </svg>
            </button>
            {showLBPrompt && (
              <div className="sc-lb-prompt">Play today's game to unlock</div>
            )}
            {showLB && mode === 'infinite' && <InfiniteLeaderboard onClose={() => setShowLB(false)} />}
            {showLB && mode === 'daily' && <SalaryLeaderboard dateStr={activeDate.str} dateLabel={activeDate.label} onClose={() => setShowLB(false)} />}
          </div>
        </div>
        <DatePicker
          activeDate={activeDate}
          dates={dates}
          onSelect={date => { setMode('daily'); setSel({}); handleSelectDate(date) }}
          mode={mode}
          onInfinite={handleInfinite}
        />
      </div>

      {mode === 'daily' && alreadyPlayed && (
        <div className="sc-played-banner">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          Today's build is locked — come back tomorrow for a new lineup or play a previous date
        </div>
      )}

      <div className="sc-grid-wrap">
        <div className={`sc-grid${shuffleMode ? ' sc-grid--shuffle-mode' : ''}${scoutMode ? ' sc-grid--scout-mode' : ''}`} style={{ gridTemplateColumns: `var(--price-col, 40px) repeat(${SAL_COLS.length}, 1fr)` }}>
          <div />
          {SAL_COLS.map((col, ci) => (
            <div key={col.key} className="sc-col-header">
              <span className="sc-col-label">{col.label}</span>
              {shuffleMode && (
                <button className="sc-shuffle-col-target"
                  onClick={() => executeShuffleCol(ci)}
                  onMouseEnter={() => setHoveredShuffle({ type: 'col', idx: ci })}
                  onMouseLeave={() => setHoveredShuffle(null)}>
                  <span className="sc-shuffle-dir-arrow">⇅</span>
                </button>
              )}
            </div>
          ))}
          {TIERS.map((tier, ti) => (
            <React.Fragment key={tier}>
              <div className="sc-price-label">
                <span className="sc-price-text">${tier}M</span>
                {shuffleMode && (
                  <button className="sc-shuffle-row-target"
                    onClick={() => executeShuffleRow(ti)}
                    onMouseEnter={() => setHoveredShuffle({ type: 'row', idx: ti })}
                    onMouseLeave={() => setHoveredShuffle(null)}>
                    <span className="sc-shuffle-dir-arrow">⇄</span>
                  </button>
                )}
              </div>
              {SAL_COLS.map((col, ci) => (
                <PlayerCard
                  key={effectiveGrid[ci][ti].id}
                  player={effectiveGrid[ci][ti]}
                  isSelected={sel[ci]?.id === effectiveGrid[ci][ti].id}
                  colHasSelection={!!sel[ci]}
                  onClick={() => pick(ci, effectiveGrid[ci][ti])}
                  viewOnly={!!alreadyPlayed}
                  shufflePhase={(shufflingCol === ci || shufflingRow === ti) ? shufflePhase : null}
                  shuffleDelay={shufflingRow === ti ? ci * 45 : ti * 45}
                  scoutGrade={scoutedGrades[effectiveGrid[ci][ti].name] ?? null}
                  scoutMode={scoutMode}
                  shuffleHighlight={
                    hoveredShuffle?.type === 'col' && hoveredShuffle.idx === ci ? 'col' :
                    hoveredShuffle?.type === 'row' && hoveredShuffle.idx === ti ? 'row' :
                    null
                  }
                />
              ))}
            </React.Fragment>
          ))}
        </div>
        {shuffleMode && (
          <>
            <div className="sc-shuffle-backdrop" onClick={() => setShuffleMode(false)} />
            <div className="sc-shuffle-hint">⇅ column &nbsp;·&nbsp; ⇄ row</div>
          </>
        )}
        {scoutMode && (
          <div className="sc-shuffle-hint sc-scout-hint">Choose a player to scout</div>
        )}
      </div>

      <div className="sc-footer">
        <div className="sc-footer-btns">
          <button className="sc-back-btn" onClick={onBack}>← Back</button>
          <button
            className={`sc-confirm-btn${disabled ? ' sc-confirm-btn--disabled' : ''}${viewReady ? ' sc-confirm-btn--view' : ''}`}
            onClick={confirm}
            disabled={disabled}
          >
            {ctaLabel}
          </button>
        </div>
        <BudgetBar spent={totalCost} total={dailyBudget} pickedAll={pickedAll} />
      </div>
    </div>
  )
}
