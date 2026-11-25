// College Football: the rosters, schools, conferences and the season sim, loaded only when the
// mode opens (components/cfb/CFBMode.jsx). Home never imports this file: its card reads lib/cfbLive.js.
import { collegeOVR } from '../utils/cfbOvr'
// (every college player's stored overall goes through the same curve the build's does: utils/cfbOvr.js)
const up = list => (list ?? []).map(p => ({ ...p, ovr: collegeOVR(p.ovr) }))
// (a defender's overall is worked out here from his traits, on the build's own formula and curve (cfbSimulation
// calcCFBOVR), so the board, the offers and the build never read two scales whatever the data file stores)
const toChips = attrs => Object.fromEntries(Object.entries(attrs ?? {}).map(([t, v]) => [t, { type: t, val: v }]))
const upDef = (list, pos, s) => (list ?? []).map(p => ({ ...p, ovr: s.calcCFBOVR(toChips(p.attrs), null, pos) ?? collegeOVR(p.ovr) }))
let loading = null
export function loadCFB() {
  if (loading) return loading
  loading = Promise.all([
    import('../data/cfb-conferences.js'),
    import('../data/cfb-teams.js'),
    import('../data/cfb-players.js'),
    import('../utils/cfbSimulation.js'),
    import('../data/cfb-tes.js'),
    import('../data/cfb-dls.js'),
    import('../data/cfb-dbs.js'),
  ]).then(([c, t, p, s, te, dl, db]) => ({
    conferences: c.CFB_CONFERENCES,
    teams: t.CFB_TEAMS,
    pools: { qb: up(p.CFB_QBS), wr: up(p.CFB_WRS), rb: up(p.CFB_RBS), te: up(te.CFB_TES), dl: upDef(dl.CFB_DLS, 'dl', s), db: upDef(db.CFB_DBS, 'db', s) },
    sim: s,
  })).catch(e => { loading = null; throw e })
  return loading
}

// All-Time: each school's legends at QB, RB and WR (data/cfb-legends.js), the tight end greats (data/cfb-te-legends.js)
// and the defensive linemen and backs (data/cfb-dl-legends.js, data/cfb-db-legends.js), in the same row shape as the
// current rosters. Loaded only when an All-Time build asks for them: a current build never pays for the files
let legends = null
export function loadCFBLegends() {
  if (legends) return legends
  legends = Promise.all([import('../data/cfb-legends.js'), import('../data/cfb-te-legends.js'), import('../data/cfb-dl-legends.js'), import('../data/cfb-db-legends.js'), import('../utils/cfbSimulation.js')])
    .then(([m, te, dl, db, s]) => ({ qb: up(m.CFB_LEGEND_QBS), wr: up(m.CFB_LEGEND_WRS), rb: up(m.CFB_LEGEND_RBS), te: up(te.CFB_LEGEND_TES), dl: upDef(dl.CFB_LEGEND_DLS, 'dl', s), db: upDef(db.CFB_LEGEND_DBS, 'db', s) }))
    .catch(e => { legends = null; throw e })
  return legends
}
