import { useEffect, useMemo, useState } from 'react'
import Silhouette from '../Silhouette'
import { POS_ATTR, inTeamColors, ensureSport, sportReady, jerseyOf } from '../../lib/career'

// Home's Career card: the career's own player, the same model as in Career.
// Its own file, so home loads this (and the career code) only once there is a career.
// (soccer: the basketball figure for now, lib/soccerUi.js SOCCER_SILHOUETTE, until the striker's own art lands;
// its traits' labels arrive with lib/careerSoccer.js, which this asks for)
export default function CareerFigure({ c }) {
  const [, bump] = useState(0)
  const ready = sportReady(c.sport ?? 'nfl')
  const shown = useMemo(() => inTeamColors(c.build, c.fit, ready ? jerseyOf(c) : null), [c.build, c.fit, ready, c.number, c.team]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!ready) ensureSport(c.sport).then(() => bump(n => n + 1)) }, [c.sport, ready])
  if (!ready) return <span className="ag-career-fig" aria-hidden="true" />
  return (
    <span className="ag-career-fig" aria-hidden="true">
      <Silhouette build={shown} types={c.types} attrMap={POS_ATTR[c.pos]} isSoccer={c.sport === 'soccer'} isRB={c.pos === 'rb'} isWR={c.pos === 'wr'} isTE={c.pos === 'te'} isDB={c.pos === 'db'} isDL={c.pos === 'dl'} isLB={c.pos === 'lb'} isOL={c.pos === 'ol'} isK={c.pos === 'k'} modelOnly />
    </span>
  )
}
