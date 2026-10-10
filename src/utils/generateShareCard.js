import { getBucketSVGMarkup } from '../components/BucketFigureOverlay'
import { IS_APP, shareNative } from '../lib/platform'

// val 0–11 → F D C- C C+ B- B B+ A- A A+ S
const GRADES = ['F','D','C-','C','C+','B-','B','B+','A-','A','A+','S']

function gradeColor(val) {
  if (val >= 11) return '#a855f7'
  if (val >= 8)  return '#3b82f6'
  if (val >= 5)  return '#22c55e'
  if (val >= 2)  return '#eab308'
  if (val >= 1)  return '#f97316'
  return '#ef4444'
}

function ovrAccent(ovr) {
  if (ovr >= 90) return '#a855f7'
  if (ovr >= 80) return '#3b82f6'
  if (ovr >= 70) return '#22c55e'
  if (ovr >= 60) return '#eab308'
  return '#f97316'
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload  = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

// SVG viewBox aspect ratio (matches PROCESSED_SVG in BucketFigureOverlay)
const VB_W = 850.9, VB_H = 815.5

// Football: the build's silhouette as it's drawn on the game page (figure,
// colors, numbers), without the drop zones and their lines
export async function captureSilhouette(sel = '.game-layout .sil-wrap') {
  const el = [...document.querySelectorAll(sel)].find(e => e.offsetParent !== null && e.getBoundingClientRect().width > 40)
  if (!el) return null
  try {
    const html2canvas = (await import('html2canvas')).default
    return await html2canvas(el, {
      backgroundColor: null, scale: 2, useCORS: true, allowTaint: true, logging: false,
      ignoreElements: e => !!e.classList && (e.classList.contains('cz-lines-svg') || e.classList.contains('cz-layer') || e.classList.contains('sil-sandbox-outer')),
    })
  } catch { return null }
}

// The share card, both sports. Basketball draws its figure from the build;
// football hands in `figure` (captureSilhouette). brand + posLabel head the card.
export async function generateBucketShareCard({ build, types, ovr, arch, position, attrMap, figure = null, brand = 'BUILD-A-BUCKET', posLabel: posLabelIn = null }) {
  await document.fonts.ready

  const W = 1080, H = 1350
  const PAD = 64
  const canvas = document.createElement('canvas')
  canvas.width  = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  const accent = ovrAccent(ovr)

  // ── Background ──────────────────────────────────────────────────────────────
  ctx.fillStyle = '#07120a'
  ctx.fillRect(0, 0, W, H)

  ctx.strokeStyle = 'rgba(255,255,255,0.022)'
  ctx.lineWidth = 1
  for (let x = 0; x <= W; x += 54) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = 0; y <= H; y += 54) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

  ctx.fillStyle = accent
  ctx.fillRect(0, 0, W, 6)

  // ── Brand ───────────────────────────────────────────────────────────────────
  ctx.font = '800 52px Outfit, sans-serif'
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.fillText('build-a-player.com', W / 2, 82)

  ctx.font = '500 22px Outfit, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.38)'
  if ('letterSpacing' in ctx) ctx.letterSpacing = '3px'
  ctx.fillText(brand, W / 2, 116)
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'

  const posLabel = posLabelIn ?? (position === 'big' ? 'BIG' : 'GUARD')
  ctx.font = '700 18px Outfit, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.22)'
  ctx.textAlign = 'right'
  ctx.fillText(posLabel, W - PAD, 82)
  ctx.textAlign = 'left'

  // ── Player figure: SVG body + headshot ───────────────────────────────────
  const FIGURE_TOP = 134
  const FIGURE_H   = 520
  const FIGURE_BOT = FIGURE_TOP + FIGURE_H

  // aspect ratio: the bucket SVG's viewBox, or the captured football figure
  const svgAR   = figure ? figure.width / figure.height : VB_W / VB_H   // bucket ≈ 1.043
  const maxFigW = W - PAD * 2
  const byH     = { h: FIGURE_H, w: FIGURE_H * svgAR }
  const { fw, fh } = byH.w <= maxFigW
    ? { fw: byH.w, fh: byH.h }
    : { fw: maxFigW, fh: maxFigW / svgAR }
  const figX = (W - fw) / 2
  const figY = FIGURE_TOP

  // Draw the figure: football's capture, or basketball's body SVG
  if (figure) {
    ctx.drawImage(figure, figX, figY, fw, fh)
  } else if (position === 'guard' || position === 'big') {
    const svgMarkup = getBucketSVGMarkup(build)
    const svgBlob   = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl    = URL.createObjectURL(svgBlob)
    const svgImg    = await loadImage(svgUrl)
    URL.revokeObjectURL(svgUrl)
    if (svgImg) ctx.drawImage(svgImg, figX, figY, fw, fh)
  }



  // OVR badge overlaid at bottom-left of figure zone
  const OVR_Y = FIGURE_BOT

  ctx.font = '900 136px Outfit, sans-serif'
  ctx.fillStyle = accent
  ctx.shadowColor = 'rgba(0,0,0,0.75)'
  ctx.shadowBlur  = 16
  ctx.textBaseline = 'bottom'
  ctx.fillText(String(ovr), PAD, OVR_Y)
  ctx.shadowBlur  = 0
  ctx.textBaseline = 'alphabetic'

  ctx.font = '600 15px Outfit, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.30)'
  if ('letterSpacing' in ctx) ctx.letterSpacing = '3px'
  ctx.fillText('OVERALL', PAD + 4, OVR_Y + 20)
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'

  ctx.font = '600 26px Outfit, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.textAlign = 'right'
  ctx.fillText(arch, W - PAD, OVR_Y)
  ctx.textAlign = 'left'

  // ── Divider ─────────────────────────────────────────────────────────────────
  const DIV_Y = FIGURE_BOT + 44
  ctx.strokeStyle = accent + '55'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(PAD, DIV_Y); ctx.lineTo(W - PAD, DIV_Y); ctx.stroke()

  // ── Attribute rows ──────────────────────────────────────────────────────────
  const filled  = types.filter(t => build[t])
  const ROW_H   = Math.min(70, Math.floor((H - DIV_Y - 76) / Math.max(filled.length, 1)))
  const START_Y = DIV_Y + 8

  filled.forEach((t, i) => {
    const meta  = attrMap[t] ?? { label: t }
    const slot  = build[t]
    const val   = slot?.val ?? 0
    const grade = GRADES[Math.max(0, Math.min(11, Math.round(val)))]
    const col   = gradeColor(val)
    const y     = START_Y + i * ROW_H

    if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.018)'
      ctx.fillRect(0, y, W, ROW_H)
    }

    ctx.fillStyle = col
    ctx.fillRect(PAD, y + 10, 3, ROW_H - 20)

    ctx.font = '600 15px Outfit, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.36)'
    if ('letterSpacing' in ctx) ctx.letterSpacing = '1px'
    ctx.fillText(meta.label.toUpperCase(), PAD + 16, y + 25)
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'

    ctx.font = '600 21px Outfit, sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(slot?.qbFull || slot?.qb || '', PAD + 16, y + 50)

    const CX = W - PAD - 28
    const CY  = y + ROW_H / 2
    ctx.beginPath()
    ctx.arc(CX, CY, 26, 0, Math.PI * 2)
    ctx.fillStyle = col
    ctx.fill()

    ctx.font = `900 ${grade.length >= 2 ? 17 : 21}px Outfit, sans-serif`
    ctx.fillStyle = '#07120a'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(grade, CX, CY + 1)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
  })

  // ── Footer ──────────────────────────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(PAD, H - 48); ctx.lineTo(W - PAD, H - 48); ctx.stroke()

  ctx.font = '500 15px Outfit, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.14)'
  ctx.textAlign = 'center'
  ctx.fillText('build-a-player.com', W / 2, H - 20)
  ctx.textAlign = 'left'

  return canvas
}

export async function shareOrDownloadCard(canvas, ovr, arch) {
  const filename = `bucket-build-${ovr}-${arch.toLowerCase().replace(/\s+/g, '-')}.png`
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) { resolve('error'); return }
      if (IS_APP) { resolve(await shareNative({ title: `${ovr} OVR · ${arch}`, blob, filename })); return }
      const file = new File([blob], filename, { type: 'image/png' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `${ovr} OVR · ${arch}` })
          resolve('shared'); return
        } catch (e) {
          if (e.name === 'AbortError') { resolve('aborted'); return }
        }
      }
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      resolve('downloaded')
    }, 'image/png')
  })
}

// ── Career card: a whole career on one image (lib/career.js careerCard) ──────
export async function generateCareerCard(card, figure = null) {
  await document.fonts.ready
  const W = 1080, H = 1350, PAD = 64
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  const gold = '#f5dc8a'
  ctx.fillStyle = '#07120a'; ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(255,255,255,0.022)'; ctx.lineWidth = 1
  for (let x = 0; x <= W; x += 54) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = 0; y <= H; y += 54) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
  const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#d4af37'); g.addColorStop(1, gold)
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 6)
  const sp = (px, s) => { if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`; ctx.fillText(s.text, s.x, s.y); if ('letterSpacing' in ctx) ctx.letterSpacing = '0px' }
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '800 52px Outfit, sans-serif'; ctx.fillText('build-a-player.com', W / 2, 82)
  ctx.font = '500 22px Outfit, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.38)'; sp(3, { text: 'CAREER', x: W / 2, y: 116 })
  ctx.textAlign = 'right'; ctx.font = '700 18px Outfit, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillText(card.pos, W - PAD, 82)
  // the player
  const FT = 140, FH = 430
  if (figure) { const ar = figure.width / figure.height; const fh = FH, fw = Math.min(W - PAD * 2, fh * ar); ctx.drawImage(figure, (W - fw) / 2, FT, fw, fh) }
  ctx.textAlign = 'left'
  ctx.font = '900 64px Outfit, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(card.name, PAD, FT + FH + 60)
  ctx.font = '600 22px Outfit, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.fillText(`${card.pos} · ${card.years}${card.teams.length ? ` · ${card.teams.join(', ')}` : ''}`, PAD, FT + FH + 96)
  // legacy
  ctx.textAlign = 'right'; ctx.font = '900 70px Outfit, sans-serif'; ctx.fillStyle = gold; ctx.fillText(String(card.legacy.score), W - PAD, FT + FH + 60)
  ctx.font = '600 18px Outfit, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.45)'; sp(2, { text: `LEGACY · ${card.legacy.tier.toUpperCase()}`, x: W - PAD, y: FT + FH + 92 })
  ctx.textAlign = 'left'
  // divider + the big numbers
  const DY = FT + FH + 130
  ctx.strokeStyle = 'rgba(245,220,138,.35)'; ctx.beginPath(); ctx.moveTo(PAD, DY); ctx.lineTo(W - PAD, DY); ctx.stroke()
  const cells = [...card.head, ['RINGS', String(card.rings)], [card.awardName, String(card.awards)], ['PRO BOWLS', String(card.proBowls)]].slice(0, 6)
  const cw = (W - PAD * 2) / cells.length
  cells.forEach(([k, v], i) => {
    const x = PAD + cw * i + cw / 2
    ctx.textAlign = 'center'; ctx.font = '900 54px Outfit, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(v, x, DY + 86)
    ctx.font = '600 15px Outfit, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.4)'; sp(2, { text: k, x, y: DY + 116 })
  })
  // ranking + hall of fame
  const RY = DY + 190
  ctx.textAlign = 'left'; ctx.font = '600 20px Outfit, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.fillText(`No. ${card.legacy.rank} ${card.pos} of all time${card.legacy.above ? ` · behind ${card.legacy.above.name}` : ''}`, PAD, RY)
  if (card.hof) { ctx.fillStyle = card.hof.in ? gold : 'rgba(255,255,255,0.5)'; ctx.fillText(card.hof.in ? `HALL OF FAME · ${card.hof.ballot.toUpperCase()} · ${card.hof.pct}%` : `Hall of Fame: ${card.hof.ballot.toLowerCase()} (${card.hof.pct}%)`, PAD, RY + 36) }
  if (card.draft) { ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = '500 18px Outfit, sans-serif'; ctx.fillText(`Drafted round ${card.draft.round}, pick ${card.draft.o} · Career earnings $${Math.round(card.earnings)}M`, PAD, RY + 72) }
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.beginPath(); ctx.moveTo(PAD, H - 48); ctx.lineTo(W - PAD, H - 48); ctx.stroke()
  ctx.textAlign = 'center'; ctx.font = '500 15px Outfit, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillText('build-a-player.com', W / 2, H - 20)
  return canvas
}
