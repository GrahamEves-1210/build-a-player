// FotMob studio photos for every soccer player with no ESPN photo (the owner, 2026-11-25).
// node scripts/soccer/fetch-fotmob-headshots.mjs [cacheDir]        (cacheDir default /tmp/fotmob-cache)
//
// Pools: every club player (SOCCER_ALL_STRIKERS: the wheel's 36 Champions League clubs and Career's leagues),
// the World Cup legends (WC_STRIKERS) and the 2026 squads (WC2026_STRIKERS).
// Ids: scripts/soccer/fotmob-ids.json ("Name|TEAM" -> id, from FotMob's leaderboards), then
// scripts/soccer/fotmob-face-ids.json (found here by FotMob's search, kept so a rerun doesn't search again).
// A search hit only counts when FotMob's player page agrees on the name, the country and the birth year (within a
// year of the one his age gives); anything else stays faceless. No stand-in photos, no other source.
// Image: images.fotmob.com/image_resources/playerimages/<id>.png (192x192). A missing photo is a 403; any image
// two different players share is FotMob's placeholder and is skipped too.
// Frame: a 600x436 transparent canvas (ESPN's), the photo at 300x300, centred, bottom-aligned, webp q90:
// public/headshots/soccer/fmr-<id>.webp. At 300 the head is ESPN's size (365 made it a third bigger than the ESPN
// faces beside it); there are no shoulders, so it sits lower. Home's pool cards keep their own fm-<id>.webp files
// (SoccerApp FACE_PICKS), never written here. Output map: src/data/soccer-fotmob-headshots.json ("Name|TEAM" -> id),
// read by lib/soccerFace.js.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import sharp from 'sharp'
import { SOCCER_ALL_STRIKERS, WC_STRIKERS, WC2026_STRIKERS } from '../../src/data/soccer-strikers.js'
import { WC_ALL_NATIONS, CAREER_NATIONS } from '../../src/data/soccer-nations.js'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const CACHE = process.argv[2] ?? '/tmp/fotmob-cache'
const SIZE = 300
const OUT_DIR = path.join(ROOT, 'public/headshots/soccer')
const MAP_FILE = path.join(ROOT, 'src/data/soccer-fotmob-headshots.json')
const FOUND_FILE = path.join(ROOT, 'scripts/soccer/fotmob-face-ids.json')
const ESPN = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/soccer-headshots.json'), 'utf8'))
const IDS = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/soccer/fotmob-ids.json'), 'utf8'))
const FOUND = fs.existsSync(FOUND_FILE) ? JSON.parse(fs.readFileSync(FOUND_FILE, 'utf8')) : {}
fs.mkdirSync(path.join(CACHE, 'api'), { recursive: true }); fs.mkdirSync(path.join(CACHE, 'img'), { recursive: true })

const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36' }
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function get(url, file, binary) {
  if (fs.existsSync(file)) { const b = fs.readFileSync(file); return b.length ? (binary ? b : JSON.parse(b)) : null }
  await sleep(350)
  const r = await fetch(url, { headers: UA })
  if (!r.ok) { if (r.status === 403 || r.status === 404) fs.writeFileSync(file, ''); return null }
  const b = Buffer.from(await r.arrayBuffer()); fs.writeFileSync(file, b)
  return binary ? b : JSON.parse(b)
}
const search = term => get(`https://www.fotmob.com/api/data/search/suggest?term=${encodeURIComponent(term)}&lang=en`, path.join(CACHE, 'api', `s-${crypto.createHash('md5').update(term).digest('hex')}.json`))
const playerData = id => get(`https://www.fotmob.com/api/data/playerData?id=${id}`, path.join(CACHE, 'api', `p-${id}.json`))
const photo = id => get(`https://images.fotmob.com/image_resources/playerimages/${id}.png`, path.join(CACHE, 'img', `${id}.png`), true)

const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ø/g, 'o').replace(/ß/g, 'ss').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
const NATION_NAME = Object.fromEntries([...WC_ALL_NATIONS, ...CAREER_NATIONS].map(n => [n.short, n.name]))
// FotMob's country names that differ from ours
const ALIAS = { 'turkey': 'turkiye', 'czech republic': 'czechia', 'korea republic': 'south korea', 'ireland': 'republic of ireland', 'usa': 'united states', "cote d ivoire": 'ivory coast', 'congo dr': 'dr congo' }
const country = n => { const k = norm(n); return ALIAS[k] ?? k }
const nameOk = (ours, theirs) => {
  const a = norm(ours), b = norm(theirs)
  if (a === b) return true
  const ta = a.split(' '), tb = b.split(' ')
  if (ta.every(t => tb.includes(t)) || tb.every(t => ta.includes(t))) return true
  // a transliteration (Andrei / Andrey, Marawan / Marwan): two letters apart at most, the country and the birth
  // year still have to agree
  return a.length > 8 && lev(a, b) <= 2
}
function lev(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[b.length]
}
// his birth year: a legend's peak year less his age then; a current player's 2026 less his age
const birthYear = p => p.peak ? p.peak - p.age : 2026 - p.age

async function verify(p, id) {
  const d = await playerData(id)
  if (!d) return false
  const info = Object.fromEntries((d.playerInformation ?? []).map(x => [x.title, x]))
  const c = info.Country
  const cOk = c && (c.countryCode === p.nation || country(c.value?.fallback) === country(NATION_NAME[p.nation]))
  const by = d.birthDate?.utcTime ? Number(d.birthDate.utcTime.slice(0, 4)) : null
  const yOk = by != null && Math.abs(by - birthYear(p)) <= (p.peak ? 2 : 1)
  return !!(cOk && yOk && nameOk(p.name, d.name))
}

async function findId(p) {
  const key = `${p.name}|${p.team}`
  if (IDS[key]) return IDS[key]
  if (key in FOUND) return FOUND[key]
  // the same man under another code (club and nation) in the leaderboard ids
  for (const [k, v] of Object.entries(IDS)) if (k.split('|')[0] === p.name && await verify(p, v)) { FOUND[key] = v; return v }
  let hit = null
  for (const term of [...new Set([p.name, p.short])]) {
    const res = await search(term)
    const cands = (res ?? []).flatMap(g => g.suggestions ?? []).filter(s => s.type === 'player' && nameOk(p.name, s.name))
    for (const s of [...new Map(cands.map(s => [s.id, s])).values()].slice(0, 6)) if (await verify(p, s.id)) { hit = String(s.id); break }
    if (hit) break
  }
  FOUND[key] = hit
  return hit
}

const people = []
const seen = new Set()
for (const [pool, list] of [['club', SOCCER_ALL_STRIKERS], ['wc', WC_STRIKERS], ['wc2026', WC2026_STRIKERS]]) for (const p of list) {
  const key = `${p.name}|${p.team}`
  if (seen.has(key)) continue; seen.add(key)
  if (p.espn != null && ESPN[String(p.espn)]) continue
  people.push({ p, pool, key })
}
console.log(`${people.length} players with no ESPN photo`)

const got = {}, hashes = new Map(), noId = [], noPhoto = []
let i = 0
for (const { p, key } of people) {
  if (++i % 50 === 0) console.log(i, '/', people.length)
  const id = await findId(p)
  if (!id) { noId.push(key); continue }
  const png = await photo(id)
  if (!png) { noPhoto.push(key); continue }
  const h = crypto.createHash('sha1').update(png).digest('hex')
  if (!hashes.has(h)) hashes.set(h, new Set())
  hashes.get(h).add(id)
  got[key] = { id, h, png }
}
fs.writeFileSync(FOUND_FILE, JSON.stringify(Object.fromEntries(Object.entries(FOUND).sort()), null, 1) + '\n')

const map = {}
for (const [key, { id, h, png }] of Object.entries(got)) {
  if (hashes.get(h).size > 1) { noPhoto.push(key); continue } // FotMob's placeholder
  const file = path.join(OUT_DIR, `fmr-${id}.webp`)
  if (!fs.existsSync(file)) {
    const face = await sharp(png).resize(SIZE, SIZE).png().toBuffer()
    await sharp({ create: { width: 600, height: 436, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: face, left: (600 - SIZE) >> 1, top: 436 - SIZE }]).webp({ quality: 90 }).toFile(file)
  }
  map[key] = Number(id)
}
fs.writeFileSync(MAP_FILE, JSON.stringify(Object.fromEntries(Object.entries(map).sort()), null, 1) + '\n')
console.log(`faces ${Object.keys(map).length}; no FotMob id ${noId.length}; no photo ${noPhoto.length}`)
fs.writeFileSync(path.join(CACHE, 'missing.json'), JSON.stringify({ noId, noPhoto }, null, 1))
