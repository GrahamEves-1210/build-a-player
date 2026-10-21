import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IS_APP } from '../../lib/platform'
import { sfx, haptic } from '../../lib/juice'
import { IconClose } from './icons'
import { drawSeasonCard, shareCardImage, canShareFiles, seasonShareText, seasonFileName } from '../../utils/seasonCard'

// Share Season: the button on a finished season's final report, and the sheet it
// opens. The sheet makes the poster (utils/seasonCard.js) as a Story or a
// square, then hands it to the phone's share sheet or saves it.

const ShareIco = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M12 2.6c.4 0 .7.1 1 .4l3.6 3.5a1.3 1.3 0 0 1-1.9 1.9l-1.4-1.4v7.3a1.3 1.3 0 0 1-2.6 0V7l-1.4 1.4a1.3 1.3 0 0 1-1.9-1.9L11 3c.3-.3.6-.4 1-.4z"/>
    <path fill="currentColor" d="M5.5 10.5h1.8a1.3 1.3 0 0 1 0 2.6h-.9v6.1h11.2v-6.1h-.9a1.3 1.3 0 0 1 0-2.6h1.8c1 0 1.8.8 1.8 1.8v7.8c0 1-.8 1.8-1.8 1.8H5.5c-1 0-1.8-.8-1.8-1.8v-7.8c0-1 .8-1.8 1.8-1.8z"/>
  </svg>
)

const FORMATS = [['story', 'STORY'], ['square', 'SQUARE']]

export function ShareSeasonButton({ card, className = '' }) {
  const [open, setOpen] = useState(false)
  if (!card) return null
  return (
    <>
      <button type="button" className={`ag-btn ss-btn ${className}`} onClick={() => { sfx('tap'); haptic('light'); setOpen(true) }}>
        <ShareIco /> SHARE SEASON
      </button>
      {open && <SeasonShareSheet card={card} onClose={() => setOpen(false)} />}
    </>
  )
}

export function SeasonShareSheet({ card, onClose }) {
  const [format, setFormat] = useState('story')
  const [imgs, setImgs] = useState({})       // format → { blob, url }
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const urls = useRef([])
  const canShare = useRef(canShareFiles()).current

  // each format is drawn the first time it's picked, then kept
  useEffect(() => {
    if (imgs[format]) return
    let live = true
    ;(async () => {
      const canvas = await drawSeasonCard(card, { format })
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'))
      if (!live || !blob) return
      const url = URL.createObjectURL(blob)
      urls.current.push(url)
      setImgs(m => ({ ...m, [format]: { blob, url } }))
    })().catch(err => { console.error('[season card]', err); if (live) setNote('The card couldn\'t be made. Try again.') })
    return () => { live = false }
  }, [format]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => urls.current.forEach(u => URL.revokeObjectURL(u)), [])

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const img = imgs[format]
  const go = async save => {
    if (!img || busy) return
    sfx('tap')
    setBusy(true); setNote('')
    const r = await shareCardImage(img.blob, { title: `${card.name}'s season`, text: seasonShareText(card), filename: seasonFileName(card, format), save }).catch(() => 'error')
    setBusy(false)
    if (r === 'downloaded') setNote('Saved to downloads')
    else if (r === 'error') setNote('Couldn\'t share the card. Try Save Image.')
  }
  const pick = f => { if (f !== format) { sfx('tap'); setNote(''); setFormat(f) } }

  return createPortal(
    <div className="ss-overlay" onClick={onClose}>
      <div className="ss-sheet" role="dialog" aria-modal="true" aria-label="Share season" onClick={e => e.stopPropagation()}>
        <div className="ss-head">
          <h2 className="ss-title">SHARE SEASON</h2>
          <button type="button" className="ss-close" onClick={onClose} aria-label="Close"><IconClose size={16} /></button>
        </div>
        <div className="ss-seg" role="tablist" aria-label="Card size">
          {FORMATS.map(([f, label]) => (
            <button key={f} type="button" role="tab" aria-selected={format === f} className={format === f ? 'is-on' : ''} onClick={() => pick(f)}>
              <span className={`ss-seg-shape ss-seg-shape--${f}`} aria-hidden="true" />{label}
            </button>
          ))}
        </div>
        <div className={`ss-preview ss-preview--${format}`}>
          {img
            ? <img key={img.url} src={img.url} alt={`${card.name}'s season card`} className="ss-img" draggable={false} />
            : <div className="ss-skel" aria-label="Making the card" />}
        </div>
        <div className="ss-actions">
          {canShare && (
            <button type="button" className="ag-btn ss-go" onClick={() => go(false)} disabled={!img || busy}>
              <ShareIco /> {busy ? 'OPENING…' : 'SHARE'}
            </button>
          )}
          {/* the app's share sheet has Save Image; the website downloads it */}
          {!IS_APP && (
            <button type="button" className={`ag-btn ${canShare ? 'ag-btn--ghost' : ''} ss-go`} onClick={() => go(true)} disabled={!img || busy}>
              SAVE IMAGE
            </button>
          )}
        </div>
        <p className="ss-note" aria-live="polite">{note}</p>
      </div>
    </div>,
    document.body,
  )
}
