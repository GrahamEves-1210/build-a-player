import './skeleton.css'

// SKELETONS: grey shapes that hold a list's place while it loads, so the screen doesn't jump when the rows land.
// Flat blocks with one slow fade (no shimmer sweep), still under Reduce Motion. They only exist while something
// is loading, so the fade never runs on a resting screen.
//   <SkRows n={8} />            a board or a list: a rank, a face, a name, a number
//   <SkRows n={5} avatar={false} rank={false} />
//   <SkCards n={3} />           tall blocks: save slots, cards
//   <SkChips n={10} />          a strip of chips
const W = [62, 48, 71, 55, 66, 44, 58, 69, 51, 63]
export function SkRows({ n = 8, avatar = true, rank = true, value = true, label = 'Loading', className = '' }) {
  return (
    <div className={`sk sk-rows ${className}`} role="status" aria-label={label}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="sk-row" aria-hidden="true">
          {rank && <i className="sk-b sk-rank" />}
          {avatar && <i className="sk-b sk-av" />}
          <i className="sk-b sk-line" style={{ width: `${W[i % W.length]}%` }} />
          {value && <i className="sk-b sk-val" />}
        </div>
      ))}
    </div>
  )
}
export function SkCards({ n = 3, label = 'Loading', className = '' }) {
  return (
    <div className={`sk sk-cards ${className}`} role="status" aria-label={label}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="sk-card" aria-hidden="true"><i className="sk-b sk-av sk-av--lg" /><span><i className="sk-b sk-line" style={{ width: `${W[i % W.length]}%` }} /><i className="sk-b sk-line sk-line--sm" style={{ width: `${W[(i + 3) % W.length] - 18}%` }} /></span></div>
      ))}
    </div>
  )
}
export function SkChips({ n = 8, label = 'Loading', className = '' }) {
  return (
    <div className={`sk sk-chips ${className}`} role="status" aria-label={label}>
      {Array.from({ length: n }, (_, i) => <i key={i} className="sk-b sk-chip" aria-hidden="true" />)}
    </div>
  )
}
