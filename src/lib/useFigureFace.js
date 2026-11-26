// The basketball figure's head in the app: a drawn face in place of his photo (lib/appFace.js). The website gets
// null and keeps the photo; the face code is fetched only in the app.
import { useEffect, useState } from 'react'
import { APP_ART, CLEAN } from './platform'

const GENERIC = /\/generic(dark|light)\.webp$/
export const usesDrawnHead = photo => APP_ART && !!photo && !GENERIC.test(photo)

// the clean build: the old white or black placeholder head the legends without a photo wear, by his skin (owner 11-25)
const genericOf = skin => {
  const n = parseInt(String(skin ?? '').slice(1, 7), 16)
  if (!skin || Number.isNaN(n)) return '/genericdark.webp'
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 155 ? '/genericlight.webp' : '/genericdark.webp'
}

export function useFigureFace(chip) {
  const on = usesDrawnHead(chip?.photo) && !CLEAN
  const key = on ? `${chip.qbFull ?? chip.qb}|${chip.skinColor}|${chip.teamColor}` : ''
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!on) { setUrl(null); return }
    let live = true
    import('./appFace').then(m => { if (live) setUrl(m.figureFaceUrl(chip)) }).catch(() => {})
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  if (CLEAN && usesDrawnHead(chip?.photo)) return genericOf(chip.skinColor)
  return on ? url : null
}
