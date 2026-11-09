import { useLayoutEffect, useState } from 'react'
import './soccer-soon.css'

// Soccer while it's coming soon (SOCCER_SOON, lib/soccerLive.js): its Home shows as it is, and over it the
// fourth official holds up his board. Everything under the sport switch is covered, the dock included, so
// nothing on it can be played; the switch stays live to go back to football or basketball.
export default function SoccerComingSoon() {
  const [top, setTop] = useState(null)
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
    document.documentElement.classList.add('soccer-soon')
    // the cover starts under the sport switch (it's drawn by Home, a moment after this mounts)
    let raf = 0, tries = 0
    const measure = () => {
      const el = document.querySelector('.ag-sport')
      if (el) setTop(Math.round(el.getBoundingClientRect().bottom + 10))
      else if (tries++ < 120) raf = requestAnimationFrame(measure)
      else setTop(0)
    }
    measure()
    const onResize = () => { tries = 0; measure() }
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); document.documentElement.classList.remove('soccer-soon') }
  }, [])
  if (top == null) return null
  return (
    <div className="ss-cover" style={{ top }} role="dialog" aria-modal="true" aria-label="Soccer is coming soon">
      <div className="ss-board-wrap">
        <div className="ss-board" aria-hidden="true">
          <div className="ss-row is-on"><span className="ss-arrow">▲</span><span className="ss-led">COMING</span></div>
          <div className="ss-row is-on"><span className="ss-arrow is-blank">▲</span><span className="ss-led">SOON</span></div>
        </div>
        <div className="ss-handle" aria-hidden="true" />
      </div>
      <h2 className="ss-title">SOCCER IS WARMING UP</h2>
      <p className="ss-line">Strikers, the top five leagues and the World Cup. Coming on in a future update.</p>
    </div>
  )
}
