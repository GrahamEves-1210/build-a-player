// College Football mode assets, ESPN only (the owner's rule: no Wikipedia; a player ESPN has no photo for shows initials).
//   school logos       -> public/logos/cfb/{short}.png       (ESPN's college logo, 250px, ESPN's own PNG, not re-encoded)
//   dark-background     -> public/logos/cfb/dark/{short}.png  (ESPN's 500-dark version, 250px)
//   conference logos    -> public/logos/cfb/conf-{id}.png
//   player headshots    -> public/headshots/cfb_{espnId}.webp (ESPN college-football headshot, 350x254 crop, webp q75 like the espn_ NFL files;
//                          the cfb_ prefix can't collide with the NFL's {id} / espn_{id} files)
//   map                 -> src/data/cfb-headshots.json
// Re-runnable: a file that already exists is never fetched again, overwritten or re-encoded.
// node scripts/fetch-cfb-assets.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import sharp from 'sharp'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const LOGOS = path.join(ROOT, 'public', 'logos', 'cfb')
const HEADSHOTS = path.join(ROOT, 'public', 'headshots')
const MAP = path.join(ROOT, 'src', 'data', 'cfb-headshots.json')
fs.mkdirSync(path.join(LOGOS, 'dark'), { recursive: true })

const load = f => import(pathToFileURL(path.join(ROOT, 'src', 'data', f)).href)
const { CFB_TEAMS } = await load('cfb-teams.js')
const { CFB_CONFERENCES } = await load('cfb-conferences.js')
const { CFB_QBS, CFB_WRS, CFB_RBS } = await load('cfb-players.js')

const CONF_SLUG = { sec: 'sec', bigten: 'big_ten', big12: 'big_12', acc: 'acc', pac12: 'pac_12', mwc: 'mountain_west', american: 'american', sunbelt: 'sun_belt', cusa: 'conference_usa', mac: 'mid_american', ind: 'fbs_independents' }
const UA = { 'User-Agent': 'build-a-player-data-check' }

async function get(url) {
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(url, { headers: UA })
      if (res.status === 404) return null
      if (res.ok) return Buffer.from(await res.arrayBuffer())
    } catch {}
    await new Promise(r => setTimeout(r, 800 * (i + 1)))
  }
  return null
}
async function pool(items, n, fn) {
  let i = 0
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]) }))
}
const combiner = (img, w, h, crop = false) => `https://a.espncdn.com/combiner/i?img=${img}&w=${w}&h=${h}${crop ? '&scale=crop' : ''}`

const missing = { logos: [], darkLogos: [], confLogos: [], headshots: [] }

// school logos (light + dark)
await pool(CFB_TEAMS, 8, async t => {
  for (const [dir, variant, list] of [['', '500', missing.logos], ['dark', '500-dark', missing.darkLogos]]) {
    const file = path.join(LOGOS, dir, `${t.short}.png`)
    if (fs.existsSync(file)) continue
    const buf = await get(combiner(`/i/teamlogos/ncaa/${variant}/${t.espn}.png`, 250, 250))
    if (!buf || buf.length < 500) { list.push(t.short); continue }
    fs.writeFileSync(file, buf)
  }
})

// conference logos
for (const c of CFB_CONFERENCES) {
  const file = path.join(LOGOS, `conf-${c.id}.png`)
  if (fs.existsSync(file)) continue
  const buf = await get(combiner(`/i/teamlogos/ncaa_conf/500/${CONF_SLUG[c.id]}.png`, 250, 250))
  if (!buf || buf.length < 500) { missing.confLogos.push(c.id); continue }
  fs.writeFileSync(file, buf)
}

// headshots
const players = [...CFB_QBS, ...CFB_WRS, ...CFB_RBS]
const headshots = {}
await pool(players, 8, async p => {
  const key = `cfb_${p.espn}`
  const file = path.join(HEADSHOTS, `${key}.webp`)
  if (!fs.existsSync(file)) {
    const buf = await get(combiner(`/i/headshots/college-football/players/full/${p.espn}.png`, 350, 254, true))
    if (!buf || buf.length < 6000) { missing.headshots.push(`${p.name} (${p.team}, espn ${p.espn})`); return }
    await sharp(buf).webp({ quality: 75 }).toFile(file)
  }
  headshots[p.espn] = key
})

const sorted = o => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)))
const map = {
  // ESPN athlete id -> headshot key (use with hsUrl / `${HEADSHOT_BASE}/${key}.webp`); no entry = no ESPN photo, show initials
  headshots: sorted(headshots),
  logos: Object.fromEntries(CFB_TEAMS.filter(t => fs.existsSync(path.join(LOGOS, `${t.short}.png`))).map(t => [t.short, `/logos/cfb/${t.short}.png`])),
  logosDark: Object.fromEntries(CFB_TEAMS.filter(t => fs.existsSync(path.join(LOGOS, 'dark', `${t.short}.png`))).map(t => [t.short, `/logos/cfb/dark/${t.short}.png`])),
  confLogos: Object.fromEntries(CFB_CONFERENCES.filter(c => fs.existsSync(path.join(LOGOS, `conf-${c.id}.png`))).map(c => [c.id, `/logos/cfb/conf-${c.id}.png`])),
}
fs.writeFileSync(MAP, JSON.stringify(map, null, 1) + '\n')
console.log(`headshots ${Object.keys(map.headshots).length}/${players.length}, logos ${Object.keys(map.logos).length}/${CFB_TEAMS.length}, dark ${Object.keys(map.logosDark).length}, conference ${Object.keys(map.confLogos).length}/${CFB_CONFERENCES.length}`)
for (const [k, v] of Object.entries(missing)) if (v.length) console.log(`no ESPN ${k}: ${v.join(', ')}`)
