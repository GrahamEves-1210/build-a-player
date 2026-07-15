// Targeted handles (guards) and rebounding (bigs) corrections based on real NBA knowledge.
// Does NOT touch jumpShot or any other attr.
import { readFileSync, writeFileSync } from 'fs'

let src = readFileSync('./src/data/nba-players.js', 'utf8')
let changeCount = 0

function patch(name, attrKey, newVal) {
  const nameIdx = src.indexOf(`name: "${name}"`)
  if (nameIdx === -1) { console.warn(`  NOT FOUND: ${name}`); return }
  const attrsIdx = src.indexOf('attrs: {', nameIdx)
  const attrsEnd = src.indexOf('}', attrsIdx)
  const attrBlock = src.slice(attrsIdx, attrsEnd + 1)
  const re = new RegExp(`\\b${attrKey}:(\\d+)`)
  const m = attrBlock.match(re)
  if (!m) { console.warn(`  ATTR NOT FOUND: ${name} ${attrKey}`); return }
  const oldVal = parseInt(m[1])
  if (oldVal === newVal) return
  const newAttrBlock = attrBlock.replace(re, `${attrKey}:${newVal}`)
  src = src.slice(0, attrsIdx) + newAttrBlock + src.slice(attrsEnd + 1)
  console.log(`  ${name}: ${attrKey} ${oldVal} → ${newVal}`)
  changeCount++
}

// ─── GUARD HANDLES ────────────────────────────────────────────────────────────
console.log('\n[GUARDS - handles]')

// Elite (9) — comparable to top ball-handlers in the league
patch('Anthony Edwards',     'handles', 9)   // one of the most exciting crossovers, elite creator
patch('Jalen Williams',      'handles', 9)   // underrated elite creator, smooth at high speed

// Very good (8)
patch('Tyler Herro',         'handles', 8)   // ball-dominant scorer, often plays lead guard
patch('Immanuel Quickley',   'handles', 8)   // very shifty, one of the best guard handlers
patch('Zach LaVine',         'handles', 8)   // extremely smooth, creates well off the dribble
patch('Kevin Durant',        'handles', 8)   // exceptional handles for 6'11", best big ball-handler ever

// Good (7)
patch('Josh Giddey',         'handles', 7)   // exceptional at 6'8", truly plays like a PG
patch('Jayson Tatum',        'handles', 7)   // primary BH for Celtics, handles well for a wing
patch('Jaylen Brown',        'handles', 7)   // improved significantly, can shake elite defenders
patch('Brandon Ingram',      'handles', 7)   // very long with smooth handles, creates off the dribble
patch('Scottie Barnes',      'handles', 7)   // point-forward, handles like a guard at 6'8"
patch('Khris Middleton',     'handles', 7)   // extremely smooth pull-up creator, maestro of the mid-range
patch('Braden Smith',        'handles', 7)   // lightning-quick PG, outstanding handles for his speed
patch('Franz Wagner',        'handles', 7)   // 6'9" who handles like a guard, constant creator
patch('Amen Thompson',       'handles', 7)   // exceptional for his size, guard-level handle skill
patch('Jordan Poole',        'handles', 7)   // good ball-handler, creates well off dribble

// Above average (6)
patch('Austin Reaves',       'handles', 6)   // constantly creates off the dribble, way underrated
patch('Dejounte Murray',     'handles', 6)   // lead PG at 6'5", handles solidly
patch('Jalen Johnson',       'handles', 6)   // wing playmaker with guard handles
patch('Caris LeVert',        'handles', 6)   // good ball-handler who creates off dribble
patch('Paul George',         'handles', 6)   // solid wing handler, can create off dribble
patch('RJ Barrett',          'handles', 6)   // improved handles, plays a lot of on-ball

// Downgrades
patch('Kawhi Leonard',       'handles', 6)   // controlled and deliberate, not flashy — was 7
patch('CJ McCollum',         'handles', 6)   // scorer with decent handles, was slightly overstated — was 7
patch('Marcus Smart',        'handles', 5)   // defensive-first, solid but not creative handler
patch('Alex Caruso',         'handles', 4)   // elite defender, minimal ball-handling ability
patch('Klay Thompson',       'handles', 3)   // pure off-ball shooter, rarely dribbles more than 2-3 times

// ─── BIG REBOUNDING ───────────────────────────────────────────────────────────
console.log('\n[BIGS - rebounding]')

// S-tier (11)
patch('Domantas Sabonis',    'rebounding', 11)  // led the league 2023-24 at 13.5 RPG, best rebounder in NBA

// Elite (10)
patch('Nikola Jokic',        'rebounding', 10)  // 12-13 RPG annually, elite rebounder for a center
patch('Andre Drummond',      'rebounding', 10)  // career 13.5 RPG, multiple-time league leader
patch('Rudy Gobert',         'rebounding', 10)  // 4x DPOY, multiple rebounding titles, still elite

// Very good (9)
patch('Clint Capela',        'rebounding',  9)  // multiple top-3 rebounder seasons, 13-14 RPG at peak
patch('Steven Adams',        'rebounding',  9)  // elite physical rebounder, 10+ RPG, dominant on glass
patch('Jalen Duren',         'rebounding',  9)  // elite rebounding rate, top-3 in the league when healthy

// Good (8)
patch('Karl-Anthony Towns',  'rebounding',  8)  // 10+ RPG stretch, strong for his position
patch('Julius Randle',       'rebounding',  8)  // 8-10 RPG consistently, good energy rebounder
patch('John Collins',        'rebounding',  8)  // 9-10 RPG in active seasons, great motor
patch('Alperen Sengun',      'rebounding',  8)  // 9+ RPG, very active on the glass
patch('Bobby Portis',        'rebounding',  8)  // great energy rebounder, 8-9 RPG
patch('Jakob Poeltl',        'rebounding',  8)  // consistent 9-10 RPG, underrated rebounder
patch('Trayce Jackson-Davis','rebounding',  8)  // very active, good rate for his size
patch('Isaiah Jackson',      'rebounding',  8)  // athletic rebounder, good shot-blocker glass presence
patch('Yves Missi',          'rebounding',  8)  // excellent rebounding rate for a young center
patch('Onyeka Okongwu',      'rebounding',  8)  // very active rebounder, 7-8 RPG in limited minutes
patch('Zach Edey',           'rebounding',  8)  // enormous center, dominant on glass, showing it in NBA

// Above average (7)
patch('Jarred Vanderbilt',   'rebounding',  7)  // exceptional rebounding rate for his size
patch('Isaiah Stewart',      'rebounding',  7)  // active crashes, solid rebounder
patch('Jaxson Hayes',        'rebounding',  7)  // athletic rim-runner, good rebounder

// Downgrades
patch('Victor Wembanyama',   'rebounding',  8)  // 7-8 RPG at 7'3" — impressive but not elite like Gobert
patch('Myles Turner',        'rebounding',  7)  // ~6 RPG, more shot-blocker than rebounder — was 8
patch('Brook Lopez',         'rebounding',  7)  // perimeter center, 5-6 RPG — was 8, overrated
patch('Aaron Gordon',        'rebounding',  6)  // ~5-6 RPG, not a strong rebounder for a PF
patch('Pascal Siakam',       'rebounding',  6)  // ~6-7 RPG for his size, decent not great
patch('Santi Aldama',        'rebounding',  6)  // not a great rebounder, ~5-6 RPG

writeFileSync('./src/data/nba-players.js', src, 'utf8')
console.log(`\nTotal changes: ${changeCount}`)
