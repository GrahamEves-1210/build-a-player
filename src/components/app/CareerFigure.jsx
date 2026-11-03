import { useMemo } from 'react'
import Silhouette from '../Silhouette'
import { POS_ATTR, inTeamColors } from '../../lib/career'

// Home's Career card: the career's own player, the same model as in Career.
// Its own file, so home loads this (and the career code) only once there is a career.
export default function CareerFigure({ c }) {
  const shown = useMemo(() => inTeamColors(c.build, c.fit), [c.build, c.fit])
  return (
    <span className="ag-career-fig" aria-hidden="true">
      <Silhouette build={shown} types={c.types} attrMap={POS_ATTR[c.pos]} isRB={c.pos === 'rb'} isWR={c.pos === 'wr'} isTE={c.pos === 'te'} isDB={c.pos === 'db'} modelOnly />
    </span>
  )
}
