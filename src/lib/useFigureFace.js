// The basketball figure's head in the app: a drawn face in place of his photo (lib/appFace.js). The website gets
// null and keeps the photo; the face code is fetched only in the app.
import { useEffect, useState } from 'react'
import { APP_ART } from './platform'

const GENERIC = /\/generic(dark|light)\.webp$/
export const usesDrawnHead = photo => APP_ART && !!photo && !GENERIC.test(photo)

export function useFigureFace(chip) {
  const on = usesDrawnHead(chip?.photo)
  const key = on ? `${chip.qbFull ?? chip.qb}|${chip.skinColor}|${chip.teamColor}` : ''
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!on) { setUrl(null); return }
    let live = true
    import('./appFace').then(m => { if (live) setUrl(m.figureFaceUrl(chip)) }).catch(() => {})
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return on ? url : null
}
