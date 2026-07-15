// Targeted passing/playmaking corrections based on real NBA knowledge
// Does NOT touch jumpShot. Guards: passing only. Bigs: playmaking only.
import { readFileSync, writeFileSync } from 'fs'

let src = readFileSync('./src/data/nba-players.js', 'utf8')
let changeCount = 0

// Update a single attr for a named player
function patch(name, attrKey, newVal) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Find the player block: name appears, then attrs block on next line
  const nameIdx = src.indexOf(`name: "${name}"`)
  if (nameIdx === -1) { console.warn(`  NOT FOUND: ${name}`); return }
  // Find the closing } of this player's attrs block (the line with the attrs)
  const attrsIdx = src.indexOf('attrs: {', nameIdx)
  const attrsEnd = src.indexOf('}', attrsIdx)
  const attrBlock = src.slice(attrsIdx, attrsEnd + 1)
  const re = new RegExp(`\\b${attrKey}:(\\d+)`)
  const m = attrBlock.match(re)
  if (!m) { console.warn(`  ATTR NOT FOUND: ${name} ${attrKey}`); return }
  const oldVal = parseInt(m[1])
  if (oldVal === newVal) return  // no-op
  const newAttrBlock = attrBlock.replace(re, `${attrKey}:${newVal}`)
  src = src.slice(0, attrsIdx) + newAttrBlock + src.slice(attrsEnd + 1)
  console.log(`  ${name}: ${attrKey} ${oldVal} → ${newVal}`)
  changeCount++
}

// ─── GUARD PASSING ─────────────────────────────────────────────────────────
console.log('\n[GUARDS - passing]')

// Elite passers (10)
patch('Trae Young',          'passing', 10)  // leads league in APG routinely

// Very good passers (8-9) - already at 9: Haliburton, Luka, Curry, SGA, Harden, Cade, Lillard, LaMelo
// adjusting ones that are off
patch('Tyus Jones',          'passing',  9)  // historically elite efficiency passer, lowest TO rate
patch('Marcus Smart',        'passing',  7)  // classic connector, 7 APG stretches

// Good passers (7)
patch('Dejounte Murray',     'passing',  7)  // was lead PG for SA + ATL, 6+ APG
patch('Jrue Holiday',        'passing',  7)  // solid connector, 5-7 APG, underrated
patch('Jalen Williams',      'passing',  7)  // developing lead ball-handler for OKC
patch('Kyle Anderson',       'passing',  7)  // famous for slow + smart passing vision
patch('Fred VanVleet',       'passing',  7)  // reliable PG passer, 6+ APG in HOU
patch('Braden Smith',        'passing',  7)  // underrated elite passer for IND, very low TOs
patch('Jamal Murray',        'passing',  7)  // solid creator, underrated as passer

// Above average (6)
patch('Dennis Schroder',     'passing',  6)  // veteran PG, 5+ APG
patch('Austin Reaves',       'passing',  6)  // smart cutter/passer, 5-6 APG in LA
patch('Deni Avdija',         'passing',  6)  // wing playmaker, solid connector
patch('Alex Caruso',         'passing',  6)  // smart passer, above-average connector

// Downgrades
patch('Donovan Mitchell',    'passing',  6)  // scorer first, 5-6 APG, TOs are high
patch('Collin Sexton',       'passing',  3)  // pure ISO scorer, 1-2 APG
patch('Tyler Kolek',         'passing',  6)  // college elite passer, developing in NBA
patch('Killian Hayes',       'passing',  5)  // was drafted for playmaking upside

// ─── BIG PLAYMAKING ────────────────────────────────────────────────────────
console.log('\n[BIGS - playmaking]')

// Transcendent (11)
patch('Nikola Jokic',            'playmaking', 11)  // best passing big in NBA history

// Elite (9)
patch('Domantas Sabonis',        'playmaking',  9)  // annually leads centers in APG, ~7 APG
patch('Draymond Green',          'playmaking',  9)  // system hub playmaker, orchestrates Warriors

// Very good (8)
patch('Alperen Sengun',          'playmaking',  8)  // leads centers in APG, top passing C in league
patch('Paolo Banchero',          'playmaking',  8)  // elite big-man playmaker, 5-6 APG at PF

// Good (7)
patch('Bam Adebayo',             'playmaking',  7)  // orchestrates Miami offense, good passing C
patch('Giannis Antetokounmpo',   'playmaking',  7)  // improved significantly, 6+ APG
patch('Julius Randle',           'playmaking',  7)  // good playmaker for NY, 5-6 APG
patch('Victor Wembanyama',       'playmaking',  7)  // great vision and passing instincts

// Above average (6)
patch('Karl-Anthony Towns',      'playmaking',  6)  // stretch C with decent passing

// Minor upgrades for passing veterans
patch('Al Horford',              'playmaking',  5)  // solid veteran passer, 4 APG
patch('Kristaps Porzingis',      'playmaking',  4)  // skilled big with some passing
patch('Naz Reid',                'playmaking',  4)  // decent bench big passer
patch('Aaron Gordon',            'playmaking',  4)  // contributes some playmaking
patch('Kelly Olynyk',            'playmaking',  4)  // historically a good passing big

writeFileSync('./src/data/nba-players.js', src, 'utf8')
console.log(`\nTotal changes: ${changeCount}`)
