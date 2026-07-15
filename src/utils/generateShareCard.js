import { getBucketSVGMarkup } from '../components/BucketFigureOverlay'

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

export async function generateBucketShareCard({ build, types, ovr, arch, position, attrMap }) {
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
  ctx.fillText('BUILD-A-BUCKET', W / 2, 116)
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'

  const posLabel = position === 'big' ? 'BIG' : 'GUARD'
  ctx.font = '700 18px Outfit, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.22)'
  ctx.textAlign = 'right'
  ctx.fillText(posLabel, W - PAD, 82)
  ctx.textAlign = 'left'

  // ── Player figure: SVG body + headshot ───────────────────────────────────
  const FIGURE_TOP = 134
  const FIGURE_H   = 520
  const FIGURE_BOT = FIGURE_TOP + FIGURE_H

  // SVG aspect ratio from viewBox
  const svgAR   = VB_W / VB_H   // ≈ 1.043
  const maxFigW = W - PAD * 2
  const byH     = { h: FIGURE_H, w: FIGURE_H * svgAR }
  const { fw, fh } = byH.w <= maxFigW
    ? { fw: byH.w, fh: byH.h }
    : { fw: maxFigW, fh: maxFigW / svgAR }
  const figX = (W - fw) / 2
  const figY = FIGURE_TOP

  // Draw body SVG
  const svgMarkup = getBucketSVGMarkup(build)
  const svgBlob   = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' })
  const svgUrl    = URL.createObjectURL(svgBlob)
  const svgImg    = await loadImage(svgUrl)
  URL.revokeObjectURL(svgUrl)
  if (svgImg) ctx.drawImage(svgImg, figX, figY, fw, fh)



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
