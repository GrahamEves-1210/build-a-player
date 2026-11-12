// College Basketball: the rosters, schools, conferences and the season sim, loaded only when the mode opens
// (components/cbb/CBBMode.jsx, or a basketball Career that starts in college). Home never imports this file:
// its card reads lib/cbbLive.js. (A college player's stored overall is already on the college curve:
// utils/cfbOvr.js collegeOVR, through utils/cbbSimulation.js calcCBBOVR.)
let loading = null
export function loadCBB() {
  if (loading) return loading
  loading = Promise.all([
    import('../data/cbb-conferences.js'),
    import('../data/cbb-teams.js'),
    import('../data/cbb-players.js'),
    import('../utils/cbbSimulation.js'),
  ]).then(([c, t, p, s]) => ({
    conferences: c.CBB_CONFERENCES,
    teams: t.CBB_TEAMS,
    others: t.CBB_OTHER_TEAMS,
    pools: { guard: p.CBB_GUARDS, big: p.CBB_BIGS },
    sim: s,
  })).catch(e => { loading = null; throw e })
  return loading
}

// All-Time: each school's legends among its guards and its bigs (data/cbb-legends.js), in the same row shape as
// the current rosters. Loaded only when an All-Time build asks for them
let legends = null
export function loadCBBLegends() {
  if (legends) return legends
  legends = import('../data/cbb-legends.js')
    .then(m => ({ guard: m.CBB_LEGEND_GUARDS, big: m.CBB_LEGEND_BIGS }))
    .catch(e => { legends = null; throw e })
  return legends
}
