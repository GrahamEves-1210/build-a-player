// One fast double tap never counts twice. The tap that opens a screen marks the moment, and any
// other click inside that screen is dropped for the next moments: too soon for anyone to have
// read it, so it can only be the second half of the double tap. The first tap isn't delayed.
import { useCallback, useRef } from 'react'

const QUIET_MS = 350

// { mark, onClickCapture }: put onClickCapture on the root, call mark() when the screen changes.
// A screen that just mounted is already marked.
export function useTapGuard() {
  const at = useRef(null)
  if (at.current == null) at.current = performance.now()
  const mark = useCallback(() => { at.current = performance.now() }, [])
  const onClickCapture = useCallback(e => {
    if (performance.now() - at.current < QUIET_MS) { e.stopPropagation(); e.preventDefault() }
  }, [])
  return { mark, onClickCapture }
}
