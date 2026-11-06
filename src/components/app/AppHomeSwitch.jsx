import { lazy, Suspense } from 'react'
import AppHome from './AppHome'
import { classicHome, useClassicHome } from '../../lib/homeLook'

// Home: today's (AppHome), or the classic one from before the Nov 5 update when
// Settings → Classic Home is on (lib/homeLook.js). Same props for both. The classic
// one is its own chunk, so it costs nothing until someone turns it on.
const load = () => import('./AppHomeClassic')
const AppHomeClassic = lazy(load)
if (classicHome()) load()

export default function AppHomeSwitch(props) {
  const classic = useClassicHome()
  if (!classic) return <AppHome {...props} />
  return (
    <Suspense fallback={<div className={`ag-home ag-home--${props.sport ?? 'nfl'}`} />}>
      <AppHomeClassic {...props} />
    </Suspense>
  )
}
