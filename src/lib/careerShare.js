// CAREER SHARE CARDS: a whole career, or one season of it, as a 9:16 image
// (1080×1920) for stories and the camera roll. Drawn on a canvas from the
// career itself (lib/career.js); shared through the phone's share sheet in the
// app (lib/platform.js shareNative), the browser's share sheet where it takes
// files, else downloaded. Screens: components/app/AppCareer.jsx (the legacy
// screen, the offseason recap).

import { IS_APP, shareNative } from './platform'
import { sportOf, careerTotals, legacyOf, LEGACY_TIERS, HEADLINE_STATS, STAT_LABEL, AWARD_NAME, POS_NAME, POS_LABEL, comebackYear } from './career'

const W = 1080, H = 1920, PAD = 84
const ANTON = "'BAP Anton', Anton, Impact, sans-serif"
const BEBAS = "'BAP Bebas', 'Bebas Neue', Impact, sans-serif"
const BODY = 'Outfit, system-ui, sans-serif'
const GOLD = '#f2d675', GOLD2 = '#d4af37'
const fmt = v => (typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(1) : (v ?? 0).toLocaleString('en-US'))
const lum = hex => { const n = parseInt((hex || '#000').slice(1), 16); return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255 }
// a team's color that reads on black (a near-black primary hands over to the second color)
const teamColor = (S, short) => { const t = S.teamOf(short); return lum(t.color) < 0.12 ? t.color2 : t.color }

// the game's icons (components/app/icons.jsx), on a 24 grid
const ICON = {
  ring: [['fill', 'M8.4 2.5h7.2l2 3.2-5.6 4.1-5.6-4.1z'], ['stroke', 'M12 9.6a6.2 6.2 0 1 0 .01 0z']],
  trophy: [['fill', 'M6.5 2.5h11c.6 0 1 .4 1 1v.9h2.1c.5 0 .9.4.9.9v1.6a4.6 4.6 0 0 1-4.3 4.6 6.1 6.1 0 0 1-3.9 3.3v2.3h2.4c.7 0 1.3.6 1.3 1.3v2.6H7v-2.6c0-.7.6-1.3 1.3-1.3h2.4v-2.3a6.1 6.1 0 0 1-3.9-3.3A4.6 4.6 0 0 1 2.5 6.9V5.3c0-.5.4-.9.9-.9h2.1v-.9c0-.6.4-1 1-1zM4.4 6.3v.6a2.7 2.7 0 0 0 1.8 2.6 6 6 0 0 1-.7-2.8v-.4zm15.2 0h-1.1v.4c0 1-.2 1.9-.7 2.8a2.7 2.7 0 0 0 1.8-2.6z']],
  star: [['fill', 'm12 2.6 2.7 5.6 6.1.9c.6.1.8.8.4 1.2l-4.4 4.3 1 6.1c.1.6-.5 1-1 .7L12 18.6l-5.5 2.8c-.5.3-1.1-.1-1-.7l1-6.1-4.4-4.3c-.4-.4-.2-1.1.4-1.2l6.1-.9z']],
  medal: [['fill', 'M7 2h4l2 6H9zM13 2h4l-2 6h-4z'], ['fill', 'M12 8.4a6.6 6.6 0 1 0 .01 0z']],
  crown: [['fill', 'M3.2 7.6c-.1-.7.7-1.1 1.2-.7l3.9 3.2 2.9-5.6c.3-.6 1.3-.6 1.6 0l2.9 5.6 3.9-3.2c.5-.4 1.3 0 1.2.7l-1.6 10.1c-.1.6-.6 1-1.2 1H6c-.6 0-1.1-.4-1.2-1zM6.6 19.6h10.8a1.1 1.1 0 0 1 0 2.2H6.6a1.1 1.1 0 0 1 0-2.2z']],
}
function icon(ctx, name, x, y, size, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(size / 24, size / 24)
  for (const [kind, d] of ICON[name]) {
    const p = new Path2D(d)
    if (kind === 'fill') { ctx.fillStyle = color; ctx.fill(p) } else { ctx.strokeStyle = color; ctx.lineWidth = 2.6; ctx.stroke(p) }
  }
  ctx.restore()
}

const loadImage = src => new Promise(res => { const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => res(img); img.onerror = () => res(null); img.src = src })
const fontsReady = () => Promise.all([`100px ${ANTON}`, `100px ${BEBAS}`, `600 30px ${BODY}`].map(f => document.fonts?.load?.(f).catch(() => null))).catch(() => null)

// text with letter spacing (where the canvas has it)
function text(ctx, s, x, y, { font, color, align = 'left', spacing = 0 }) {
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align
  const has = 'letterSpacing' in ctx
  if (has) ctx.letterSpacing = `${spacing}px`
  ctx.fillText(s, x, y)
  if (has) ctx.letterSpacing = '0px'
}
// the biggest size (to max) that keeps s inside maxW
function fit(ctx, s, family, max, maxW, spacing = 0) {
  let size = max
  for (; size > 20; size -= 2) { ctx.font = `${size}px ${family}`; if (ctx.measureText(s).width + spacing * s.length <= maxW) break }
  return size
}
function box(ctx, x, y, w, h, r) {
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r)
  else { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath() }
}
const goldGrad = (ctx, x0, x1) => { const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, GOLD); g.addColorStop(1, GOLD2); return g }

// the backdrop: near-black, the team's color glowing from the top, the game's teal at the foot
function backdrop(ctx, tc, accent) {
  ctx.fillStyle = '#050705'; ctx.fillRect(0, 0, W, H)
  let g = ctx.createRadialGradient(W / 2, -160, 40, W / 2, -160, 1250)
  g.addColorStop(0, `${tc}cc`); g.addColorStop(0.45, `${tc}38`); g.addColorStop(1, `${tc}00`)
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  g = ctx.createRadialGradient(W + 80, H + 120, 40, W + 80, H + 120, 980)
  g.addColorStop(0, `${accent}40`); g.addColorStop(1, `${accent}00`)
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  // a fine grid, like the other share cards
  ctx.strokeStyle = 'rgba(255,255,255,0.025)'; ctx.lineWidth = 1
  for (let x = 0; x <= W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = 0; y <= H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
}
// the top line: what the card is, and the tags (comeback, sandbox)
function topLine(ctx, label, tags, accent) {
  text(ctx, label, PAD, 132, { font: `44px ${BEBAS}`, color: accent, spacing: 9 })
  let x = W - PAD
  for (const t of [...tags].reverse()) {
    ctx.font = `30px ${BEBAS}`
    const w = ctx.measureText(t).width + t.length * 3 + 36
    box(ctx, x - w, 92, w, 52, 14); ctx.strokeStyle = t === 'SANDBOX' ? 'rgba(255,255,255,.4)' : 'rgba(242,214,117,.75)'; ctx.lineWidth = 3; ctx.stroke()
    text(ctx, t, x - w / 2, 129, { font: `30px ${BEBAS}`, color: t === 'SANDBOX' ? 'rgba(255,255,255,.75)' : GOLD, align: 'center', spacing: 3 })
    x -= w + 14
  }
}
// first name over a big last name; returns the baseline of the last name
// (maxW: the room the eyebrow and the first name have, beside a logo)
function nameBlock(ctx, name, eyebrow, accent, maxW = W - PAD * 2) {
  const words = String(name || 'Guest').trim().split(/\s+/)
  const first = words.length > 1 ? words.slice(0, -1).join(' ') : ''
  const last = words[words.length - 1]
  text(ctx, eyebrow, PAD, 236, { font: `${fit(ctx, eyebrow, BEBAS, 46, maxW, 5)}px ${BEBAS}`, color: accent, spacing: 5 })
  let y = 258
  if (first) { y += 84; text(ctx, first.toUpperCase(), PAD, y, { font: `${fit(ctx, first.toUpperCase(), BEBAS, 88, maxW, 3)}px ${BEBAS}`, color: 'rgba(255,255,255,.78)', spacing: 3 }) }
  const size = fit(ctx, last.toUpperCase(), ANTON, 200, first ? W - PAD * 2 : maxW)
  y += size
  text(ctx, last.toUpperCase(), PAD - 4, y, { font: `${size}px ${ANTON}`, color: '#fff' })
  return y
}
// a row of big numbers: [[value, label]], white display figures over spaced labels
function bigRow(ctx, cells, y, { max = 124, label = 34 } = {}) {
  const cw = (W - PAD * 2) / cells.length
  cells.forEach(([v, k], i) => {
    const cx = PAD + cw * i + cw / 2
    text(ctx, v, cx, y, { font: `${fit(ctx, v, ANTON, max, cw - 48)}px ${ANTON}`, color: '#fff', align: 'center' })
    text(ctx, k, cx, y + 52, { font: `${fit(ctx, k, BEBAS, label, cw - 24, 4)}px ${BEBAS}`, color: 'rgba(255,255,255,.62)', align: 'center', spacing: 4 })
    if (i) { ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PAD + cw * i, y - max * 0.74); ctx.lineTo(PAD + cw * i, y + 54); ctx.stroke() }
  })
}
// small boxes, an icon over a figure over a label: [{ v, k, icon, gold }]
const TILE_H = 196
function tiles(ctx, list, y) {
  const gap = 18, w = (W - PAD * 2 - gap * (list.length - 1)) / list.length
  list.forEach((t, i) => {
    const x = PAD + i * (w + gap)
    box(ctx, x, y, w, TILE_H, 26)
    ctx.fillStyle = t.gold ? 'rgba(242,214,117,.09)' : 'rgba(255,255,255,.045)'; ctx.fill()
    ctx.strokeStyle = t.gold ? 'rgba(242,214,117,.55)' : 'rgba(255,255,255,.1)'; ctx.lineWidth = 3; ctx.stroke()
    if (t.icon) icon(ctx, t.icon, x + w / 2 - 17, y + 20, 34, t.gold ? GOLD : 'rgba(255,255,255,.5)')
    const num = /^[\d/.,–-]+$/.test(t.v)
    text(ctx, t.v, x + w / 2, y + 138, { font: `${fit(ctx, t.v, ANTON, num ? 76 : 56, w - 34)}px ${ANTON}`, color: t.gold ? GOLD : '#fff', align: 'center' })
    text(ctx, t.k, x + w / 2, y + 174, { font: `${fit(ctx, t.k, BEBAS, 28, w - 20, 3)}px ${BEBAS}`, color: 'rgba(255,255,255,.6)', align: 'center', spacing: 3 })
  })
}
// the foot: who played it, and where
const FOOT = 1752
async function footer(ctx, username, site) {
  ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PAD, FOOT); ctx.lineTo(W - PAD, FOOT); ctx.stroke()
  text(ctx, 'PLAYED BY', PAD, FOOT + 56, { font: `28px ${BEBAS}`, color: 'rgba(255,255,255,.5)', spacing: 4 })
  const u = String(username || 'Guest').toUpperCase()
  text(ctx, u, PAD, FOOT + 104, { font: `${fit(ctx, u, BEBAS, 46, 440, 2)}px ${BEBAS}`, color: '#fff', spacing: 2 })
  ctx.font = `600 30px ${BODY}`
  const sw = ctx.measureText(site).width
  text(ctx, site, W - PAD, FOOT + 96, { font: `600 30px ${BODY}`, color: 'rgba(255,255,255,.72)', align: 'right' })
  const mark = await loadImage('/bap-mark.webp')
  if (mark) { const mh = 60, mw = mh * (mark.width / mark.height); ctx.drawImage(mark, W - PAD - sw - 18 - mw, FOOT + 96 - mh + 12, mw, mh) }
}

// ── A whole career ──────────────────────────────────────────────────────────
// Top to bottom: the name, the legacy (tier, points, the ladder), the Hall of
// Fame (else the all-time rank), the three big numbers, the hardware, the teams.
export async function careerShareCanvas(c, { username } = {}) {
  await fontsReady()
  const S = sportOf(c)
  const t = careerTotals(c), L = legacyOf(c)
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  const accent = S.isBucket ? '#fdba74' : '#5EDBD8'
  const team = c.seasons[c.seasons.length - 1]?.team ?? c.team
  backdrop(ctx, team ? teamColor(S, team) : accent, S.isBucket ? '#fb923c' : '#1fc98a')
  const cb = comebackYear(c)
  topLine(ctx, 'CAREER', [cb ? 'COMEBACK' : null, c.sandbox ? 'SANDBOX' : null].filter(Boolean), accent)
  const years = c.seasons.length ? `${c.seasons[0].season}–${c.seasons[c.seasons.length - 1].season}` : ''
  nameBlock(ctx, c.name, `${POS_NAME[c.pos].toUpperCase()} · ${years}`, accent)

  // the legacy: the tier, the points, the ladder
  const PY = 600, PH = 290
  box(ctx, PAD, PY, W - PAD * 2, PH, 36)
  ctx.fillStyle = 'rgba(8,12,10,.62)'; ctx.fill()
  ctx.strokeStyle = 'rgba(242,214,117,.6)'; ctx.lineWidth = 3; ctx.stroke()
  const IX = PAD + 46, IR = W - PAD - 46
  text(ctx, 'LEGACY TIER', IX, PY + 62, { font: `32px ${BEBAS}`, color: 'rgba(255,255,255,.6)', spacing: 5 })
  text(ctx, 'LEGACY PTS', IR, PY + 62, { font: `32px ${BEBAS}`, color: 'rgba(255,255,255,.6)', align: 'right', spacing: 5 })
  const tier = L.tier.toUpperCase()
  ctx.font = `116px ${ANTON}`
  const scoreW = ctx.measureText(String(L.score)).width
  text(ctx, String(L.score), IR, PY + 172, { font: `116px ${ANTON}`, color: '#fff', align: 'right' })
  const ts = fit(ctx, tier, ANTON, 108, IR - IX - scoreW - 40)
  ctx.font = `${ts}px ${ANTON}`; ctx.textAlign = 'left'; ctx.fillStyle = goldGrad(ctx, IX, IX + ctx.measureText(tier).width); ctx.fillText(tier, IX, PY + 172)
  // the ladder: every tier, lit up to this one
  const reached = LEGACY_TIERS.filter(([min]) => L.score >= min).length
  const gap = 12, segW = (IR - IX - gap * 3) / 4
  LEGACY_TIERS.forEach(([, name], i) => {
    const x = IX + i * (segW + gap)
    box(ctx, x, PY + 204, segW, 14, 7)
    ctx.fillStyle = i < reached ? goldGrad(ctx, x, x + segW) : 'rgba(255,255,255,.12)'; ctx.fill()
    const n = name.toUpperCase()
    text(ctx, n, x + segW / 2, PY + 256, { font: `${fit(ctx, n, BEBAS, 28, segW - 4, 2)}px ${BEBAS}`, color: i === reached - 1 ? GOLD : i < reached ? 'rgba(242,214,117,.6)' : 'rgba(255,255,255,.4)', align: 'center', spacing: 2 })
  })

  // the ribbon: the Hall of Fame, else where he ranks all-time
  const RY = PY + PH + 28
  const ranked = L.ranked ? `NO. ${L.rank} ${S.isBucket ? 'CAREER' : `${POS_LABEL[c.pos]} CAREER`} OF ALL TIME` : null
  if (c.hof?.in) {
    box(ctx, PAD, RY, W - PAD * 2, 96, 48); ctx.fillStyle = goldGrad(ctx, PAD, W - PAD); ctx.fill()
    const s = `HALL OF FAME · ${c.hof.ballot.toUpperCase()}`
    const fs = fit(ctx, s, BEBAS, 52, W - PAD * 2 - 160, 4)
    ctx.font = `${fs}px ${BEBAS}`; const sw = ctx.measureText(s).width + s.length * 4
    icon(ctx, 'crown', W / 2 - sw / 2 - 30, RY + 27, 42, '#1d1503')
    text(ctx, s, W / 2 + 22, RY + 66, { font: `${fs}px ${BEBAS}`, color: '#1d1503', align: 'center', spacing: 4 })
  } else {
    const s = ranked ?? `${t.seasons} ${t.seasons === 1 ? 'SEASON' : 'SEASONS'} IN THE ${S.league}`
    box(ctx, PAD, RY, W - PAD * 2, 96, 48); ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 3; ctx.stroke()
    text(ctx, s, W / 2, RY + 66, { font: `${fit(ctx, s, BEBAS, 50, W - PAD * 2 - 80, 4)}px ${BEBAS}`, color: '#fff', align: 'center', spacing: 4 })
  }

  // the career's big numbers
  const NY = RY + 96 + 150
  bigRow(ctx, HEADLINE_STATS[c.pos].map(k => [fmt(t.stats[k]), STAT_LABEL[k]]), NY)
  // the hardware: seasons, rings, the award, the honors
  const award = AWARD_NAME[c.pos]
  const TY = NY + 100
  tiles(ctx, [
    { v: String(t.seasons), k: t.seasons === 1 ? 'SEASON' : 'SEASONS' },
    { v: String(t.rings), k: t.rings === 1 ? 'RING' : 'RINGS', icon: 'ring', gold: t.rings > 0 },
    { v: String(t.awards), k: t.awards === 1 ? award : `${award}S`, icon: 'trophy', gold: t.awards > 0 },
    { v: String(t.proBowls), k: t.proBowls === 1 ? S.honor.toUpperCase() : S.honors, icon: 'star' },
  ], TY)

  // the teams he played for, and how long with each
  const LY = TY + TILE_H + 64
  const teams = t.teams.map(s => ({ s, n: c.seasons.filter(x => x.team === s).length })).slice(0, 7)
  text(ctx, teams.length === 1 ? 'ONE TEAM, START TO FINISH' : 'PLAYED FOR', W / 2, LY, { font: `30px ${BEBAS}`, color: 'rgba(255,255,255,.6)', align: 'center', spacing: 6 })
  const sz = teams.length <= 4 ? 96 : teams.length <= 5 ? 88 : 74
  const tg = teams.length <= 4 ? 60 : 34
  const rowW = teams.length * sz + (teams.length - 1) * tg
  const logos = await Promise.all(teams.map(x => loadImage(S.logo(x.s))))
  teams.forEach((x, i) => {
    const lx = W / 2 - rowW / 2 + i * (sz + tg), ly = LY + 22
    const img = logos[i]
    if (img) { const r = Math.min(sz / img.width, sz / img.height); const w = img.width * r, h = img.height * r; ctx.drawImage(img, lx + (sz - w) / 2, ly + (sz - h) / 2, w, h) }
    else text(ctx, x.s, lx + sz / 2, ly + sz * 0.66, { font: `44px ${BEBAS}`, color: '#fff', align: 'center' })
    text(ctx, `${x.n} ${x.n === 1 ? 'YR' : 'YRS'}`, lx + sz / 2, ly + sz + 34, { font: `26px ${BEBAS}`, color: 'rgba(255,255,255,.62)', align: 'center', spacing: 3 })
  })

  await footer(ctx, username, S.isBucket ? 'build-a-player.com/bucket' : 'build-a-player.com')
  return canvas
}

// ── One season (the offseason recap) ────────────────────────────────────────
// The name beside the team's logo, the record and how it ended, the three
// big numbers, then the honors won (else the overall, the goals, the role).
const lostIn = r => `LOST · ${r.toUpperCase()}${/round|final|championship|bowl|play-in/i.test(r) ? '' : ' ROUND'}`
export async function seasonShareCanvas(c, s, { username } = {}) {
  await fontsReady()
  const S = sportOf(c)
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  const accent = S.isBucket ? '#fdba74' : '#5EDBD8'
  backdrop(ctx, teamColor(S, s.team), S.isBucket ? '#fb923c' : '#1fc98a')
  const back = c.unretired && s.year >= c.unretired.year
  topLine(ctx, `SEASON ${s.season}`, [back ? 'COMEBACK' : null, c.sandbox ? 'SANDBOX' : null].filter(Boolean), accent)
  // the team's logo, top right, beside the name
  const logo = await loadImage(S.logo(s.team))
  if (logo) { const sz = 200, r = Math.min(sz / logo.width, sz / logo.height); ctx.drawImage(logo, W - PAD - logo.width * r, 196 + (sz - logo.height * r) / 2, logo.width * r, logo.height * r) }
  nameBlock(ctx, c.name, `${POS_NAME[c.pos].toUpperCase()} · AGE ${s.age}`, accent, W - PAD * 2 - 240)

  // the record, and how the season ended
  const PY = 600, PH = 420
  box(ctx, PAD, PY, W - PAD * 2, PH, 36)
  ctx.fillStyle = 'rgba(8,12,10,.62)'; ctx.fill()
  ctx.strokeStyle = s.champion ? 'rgba(242,214,117,.75)' : 'rgba(255,255,255,.16)'; ctx.lineWidth = 3; ctx.stroke()
  const tn = (s.teamName ?? S.teamOf(s.team).name).toUpperCase()
  text(ctx, tn, W / 2, PY + 70, { font: `${fit(ctx, tn, BEBAS, 38, W - PAD * 2 - 80, 5)}px ${BEBAS}`, color: 'rgba(255,255,255,.62)', align: 'center', spacing: 5 })
  const rec = `${s.wins}–${s.losses}`
  text(ctx, rec, W / 2, PY + 272, { font: `${fit(ctx, rec, ANTON, 200, W - PAD * 2 - 80)}px ${ANTON}`, color: '#fff', align: 'center' })
  const lost = (s.rounds ?? []).find(r => !r.won)
  const end = s.champion ? `${S.final.toUpperCase()} CHAMPIONS` : lost ? lostIn(lost.round) : s.playoffs ? 'PLAYOFFS' : 'NO PLAYOFFS'
  const ef = fit(ctx, end, BEBAS, 48, W - PAD * 2 - 140, 4)
  if (s.champion) { ctx.font = `${ef}px ${BEBAS}`; const ew = ctx.measureText(end).width + end.length * 4; icon(ctx, 'ring', W / 2 - ew / 2 - 36, PY + 334, 42, GOLD) }
  text(ctx, end, W / 2 + (s.champion ? 24 : 0), PY + 370, { font: `${ef}px ${BEBAS}`, color: s.champion ? GOLD : 'rgba(255,255,255,.72)', align: 'center', spacing: 4 })

  // the season's numbers
  const NY = PY + PH + 240
  bigRow(ctx, HEADLINE_STATS[c.pos].map(k => [fmt(s.stats[k]), STAT_LABEL[k]]), NY)
  // the honors (only the ones won), then the overall, the goals, the role
  const honors = [
    s.award && { v: s.awardName, k: 'WINNER', icon: 'trophy', gold: true },
    s.allPro && { v: S.first.toUpperCase(), k: 'FIRST TEAM', icon: 'medal', gold: true },
    s.proBowl && !s.allPro && { v: S.honor.toUpperCase(), k: 'SELECTED', icon: 'star' },
    (s.records?.length ?? 0) > 0 && { v: String(s.records.length), k: s.records.length === 1 ? 'RECORD SET' : 'RECORDS SET', icon: 'star', gold: true },
  ].filter(Boolean)
  const goals = s.goals?.length ? s.goals.filter(g => g.met).length : null
  const fill = [{ v: String(s.ovr), k: 'OVERALL' }, goals != null && { v: `${goals}/${s.goals.length}`, k: 'GOALS MET' }, { v: (s.role ?? 'Starter').toUpperCase(), k: 'ROLE' }].filter(Boolean)
  tiles(ctx, [...honors, ...fill].slice(0, Math.max(3, Math.min(4, honors.length + 2))), NY + 110)

  await footer(ctx, username, S.isBucket ? 'build-a-player.com/bucket' : 'build-a-player.com')
  return canvas
}

// The phone's share sheet in the app, the browser's where it takes files, else a download
export async function shareCanvas(canvas, { title, filename }) {
  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'))
  if (!blob) return 'error'
  if (IS_APP) return shareNative({ title, blob, filename })
  const file = new File([blob], filename, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return 'shared' } catch (e) { if (e?.name === 'AbortError') return 'aborted' }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return 'downloaded'
}
