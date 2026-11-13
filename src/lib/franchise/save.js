// FRANCHISE: saves. Three local slots (bap_franchise_v1_<slot>), versioned, compact.
//
// A save is the league as JSON, slimmed (compact.js: real players as a name plus what changed, stat lines as
// arrays) and then compressed (LZW packed into 15-bit characters, safe for localStorage). The first line of a
// save says what it is: "FZ<version>:<length>:". Loading never throws: a save this engine cannot read comes
// back as { broken: true, reason }.
import { SAVE_VERSION } from './consts'
import { slim, fatten, migrate } from './compact'

// ── LZW ──────────────────────────────────────────────────────────────────────
const MAX_CODES = 1 << 18
const widthFor = n => { let b = 9; while ((1 << b) < n) b++; return b }   // bits to write any code below n
export function lzPack(text) {
  // (every character below 256: JSON, with anything else written as a \u escape)
  const s = text.replace(/[\u0080-￿]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
  const dict = new Map(), out = []
  let next = 256, prefix = -1, buf = 0, nb = 0, k = 0
  const emit = code => {
    const w = widthFor(Math.min(256 + k, MAX_CODES))
    buf += code * 2 ** nb; nb += w; k++
    while (nb >= 15) { out.push(String.fromCharCode((buf % 32768) + 32)); buf = Math.floor(buf / 32768); nb -= 15 }
  }
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (prefix < 0) { prefix = c; continue }
    const key = prefix * 256 + c, code = dict.get(key)
    if (code !== undefined) { prefix = code; continue }
    emit(prefix)
    if (next < MAX_CODES) dict.set(key, next++)
    prefix = c
  }
  if (prefix >= 0) emit(prefix)
  if (nb > 0) out.push(String.fromCharCode((buf % 32768) + 32))
  return `${s.length}:${out.join('')}`
}
export function lzUnpack(packed) {
  const cut = packed.indexOf(':'), len = parseInt(packed.slice(0, cut), 10)
  if (!(len >= 0)) throw new Error('bad length')
  const data = packed.slice(cut + 1)
  const pre = new Int32Array(MAX_CODES), chr = new Uint8Array(MAX_CODES), out = new Uint8Array(len), tmp = []
  let size = 256, prev = -1, pos = 0, at = 0, buf = 0, nb = 0, k = 0
  const first = code => { while (code >= 256) code = pre[code]; return code }
  const write = code => { let n = 0; while (code >= 256) { tmp[n++] = chr[code]; code = pre[code] } out[pos++] = code; while (n > 0) out[pos++] = tmp[--n] }
  while (pos < len) {
    const w = widthFor(Math.min(256 + k, MAX_CODES))
    while (nb < w) { if (at >= data.length) throw new Error('truncated'); buf += (data.charCodeAt(at++) - 32) * 2 ** nb; nb += 15 }
    const code = buf % 2 ** w
    buf = Math.floor(buf / 2 ** w); nb -= w; k++
    if (prev < 0) { if (code > 255) throw new Error('bad start'); out[pos++] = code; prev = code; continue }
    if (code < size) {
      if (size < MAX_CODES) { pre[size] = prev; chr[size] = first(code); size++ }
      write(code)
    } else if (code === size && size < MAX_CODES) {
      pre[size] = prev; chr[size] = first(prev); size++
      write(code)
    } else throw new Error('bad code')
    prev = code
  }
  let s = ''
  for (let i = 0; i < len; i += 8192) s += String.fromCharCode.apply(null, out.subarray(i, Math.min(len, i + 8192)))
  return s
}

// ── A save ───────────────────────────────────────────────────────────────────
export function packFranchise(F) {
  return `FZ${SAVE_VERSION}:${lzPack(JSON.stringify(slim(F)))}`
}
export function unpackFranchise(text) {
  try {
    if (typeof text !== 'string' || !text) return null
    let v, body
    if (text.startsWith('FZ')) {
      const cut = text.indexOf(':')
      v = parseInt(text.slice(2, cut), 10)
      if (!(v >= 1)) return { broken: true, reason: 'This save is not a Franchise save.' }
      if (v > SAVE_VERSION) return { broken: true, reason: 'This save was made by a newer version of the game. Update to open it.' }
      body = JSON.parse(lzUnpack(text.slice(cut + 1)))
    } else if (text[0] === '{') { body = JSON.parse(text); v = body.v ?? 1 } else return { broken: true, reason: 'This save is not a Franchise save.' }
    const F = migrate(fatten(body), v)
    return F && F.teams && F.players ? F : { broken: true, reason: 'This save is damaged and could not be opened.' }
  } catch (e) {
    return { broken: true, reason: 'This save is damaged and could not be opened.' }
  }
}

// ── Slots ────────────────────────────────────────────────────────────────────
export const SLOTS_N = 3
const key = slot => `bap_franchise_v1_${slot}`
const metaKey = slot => `bap_franchise_v1_${slot}_meta`
const store = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null } }
const metaOf = (F, bytes, at) => ({ team: F.team, gm: F.gm.name, year: F.year, week: F.week, phase: F.phase, record: F.teams[F.team]?.rec ? `${F.teams[F.team].rec.w}-${F.teams[F.team].rec.l}${F.teams[F.team].rec.t ? `-${F.teams[F.team].rec.t}` : ''}` : '0-0', rings: F.gm.rings ?? 0, updatedAt: at, bytes })

export function saveFranchise(F, slot = 0) {
  const ls = store()
  if (!ls) return { ok: false, bytes: 0, error: 'Saving is not available here.' }
  try {
    const text = packFranchise(F)
    ls.setItem(key(slot), text)
    ls.setItem(metaKey(slot), JSON.stringify(metaOf(F, text.length * 2, Date.now())))
    return { ok: true, bytes: text.length * 2 }
  } catch (e) {
    return { ok: false, bytes: 0, error: 'The device is out of storage for saves.' }
  }
}
export function loadFranchise(slot = 0) {
  const ls = store()
  if (!ls) return null
  let text = null
  try { text = ls.getItem(key(slot)) } catch { return null }
  return text ? unpackFranchise(text) : null
}
export function listSlots() {
  const ls = store(), out = []
  for (let slot = 0; slot < SLOTS_N; slot++) {
    let meta = null, text = null
    try { text = ls ? ls.getItem(key(slot)) : null; if (text) meta = JSON.parse(ls.getItem(metaKey(slot)) || 'null') ?? {} } catch { meta = {} }
    if (!text) { out.push({ slot, empty: true }); continue }
    // (the header is enough to know whether this engine can open it; the whole save is only read on load)
    const v = text.startsWith('FZ') ? parseInt(text.slice(2, text.indexOf(':')), 10) : text[0] === '{' ? 1 : NaN
    const reason = !(v >= 1) ? 'This save is damaged and could not be opened.' : v > SAVE_VERSION ? 'This save was made by a newer version of the game. Update to open it.' : !meta.team ? 'This save is damaged and could not be opened.' : null
    out.push(reason ? { slot, empty: false, broken: true, reason, ...meta } : { slot, empty: false, broken: false, ...meta })
  }
  return out
}
export function deleteSlot(slot = 0) {
  const ls = store()
  try { ls?.removeItem(key(slot)); ls?.removeItem(metaKey(slot)) } catch {}
}
