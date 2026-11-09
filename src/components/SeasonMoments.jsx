// The season's moments for the soccer and baseball season pages: basketball's directed reveal (the moment cards, the
// milestone chips, the record overlay) on the season director. Loaded only when the moments are on (SoccerSimPage,
// BaseballSimPage import it with their sport's director module), so the default page stays light.
import { useDirectedReveal, MomentCard, Milestones, RecordOverlay } from './app/AppSeasonPlus'

// render prop: children(dr) draws the season screen from the director's reveal
export function DirectedReveal({ director, pace, onFinal, children }) {
  const dr = useDirectedReveal({ director, pace, onFinal })
  return children(dr)
}
// what the season screen draws while the director drives: the decision, the chips, the record
export function MomentsLayer({ dr, userName }) {
  return (
    <>
      {dr.moment && <MomentCard moment={dr.moment} onPick={dr.choose} onTurnOff={dr.turnOff} />}
      <Milestones items={dr.fresh} />
      {dr.record && <RecordOverlay record={dr.record} name={userName} onClose={dr.clearRecord} />}
    </>
  )
}
