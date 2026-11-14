// College Football: the rosters, schools, conferences and the season sim, loaded only when the
// mode opens (components/cfb/CFBMode.jsx). Home never imports this file: its card reads lib/cfbLive.js.
import { collegeOVR } from '../utils/cfbOvr'
// (every college player's stored overall goes through the same curve the build's does: utils/cfbOvr.js)
const up = list => (list ?? []).map(p => ({ ...p, ovr: collegeOVR(p.ovr) }))
let loading = null
export function loadCFB() {
  if (loading) return loading
  loading = Promise.all([
    import('../data/cfb-conferences.js'),
    import('../data/cfb-teams.js'),
    import('../data/cfb-players.js'),
    import('../utils/cfbSimulation.js'),
  ]).then(([c, t, p, s]) => ({
    conferences: c.CFB_CONFERENCES,
    teams: t.CFB_TEAMS,
    pools: { qb: up(p.CFB_QBS), wr: up(p.CFB_WRS), rb: up(p.CFB_RBS) },
    sim: s,
  })).catch(e => { loading = null; throw e })
  return loading
}

// All-Time: each school's legends at QB, RB and WR (data/cfb-legends.js), in the same row shape as the
// current rosters. Loaded only when an All-Time build asks for them: a current build never pays for the file
let legends = null
export function loadCFBLegends() {
  if (legends) return legends
  legends = import('../data/cfb-legends.js')
    .then(m => ({ qb: up(m.CFB_LEGEND_QBS), wr: up(m.CFB_LEGEND_WRS), rb: up(m.CFB_LEGEND_RBS) }))
    .catch(e => { legends = null; throw e })
  return legends
}
