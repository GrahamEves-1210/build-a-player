// Where a Blacktop Live room (the referee: btlive.js) is made: near the people who'll play in it.
//
// A Durable Object lives where it was first made, for good, and is made near the first call to it unless that call
// names a locationHint. A King of the Hill room is first called by the queue (koth.js /init), so without a hint every
// room would sit next to the one queue, wherever that is, and everyone far from it would play on a long line. So the
// queue names the hint: the region whose worst-off player is closest (the least of the most), from where each
// player's line came in (the worker's request.cf: the city's latitude and longitude; the continent if that's
// missing). A hint only counts when the room is made, which is the queue's /init call (a room code is new every
// time); the players' own calls after it (index.js /btlive/room/<CODE>) find it where it is, whatever they'd hint. A
// dev room is made by its first player's call, and that call names his own region.
// (Jurisdictions, newUniqueId({ jurisdiction }), are for keeping data inside the EU or FedRAMP, not for speed: a
// room's code finds it by name, so they aren't used.)

// Cloudflare's hint regions, each at a point near its data centres (lat, lon)
export const HINTS = {
  wnam: [37.4, -121.9],   // west North America (San Jose)
  enam: [39.0, -77.5],    // east North America (Ashburn)
  sam: [-23.5, -46.6],    // South America (São Paulo)
  weur: [50.1, 8.7],      // west Europe (Frankfurt)
  eeur: [52.2, 21.0],     // east Europe (Warsaw)
  apac: [1.35, 103.8],    // Asia-Pacific (Singapore)
  oc: [-33.9, 151.2],     // Oceania (Sydney)
  afr: [-26.2, 28.0],     // Africa (Johannesburg)
  me: [25.2, 55.3],       // the Middle East (Dubai)
}
// a line with no city on it: its continent (cf.continent), and the region that stands for it
const CONTINENT = { NA: 'enam', SA: 'sam', EU: 'weur', AS: 'apac', OC: 'oc', AF: 'afr', AN: 'oc' }
// (Asia's Middle East is its own region)
const ME = new Set(['AE', 'SA', 'QA', 'BH', 'KW', 'OM', 'IL', 'JO', 'LB', 'IQ', 'IR', 'TR', 'YE', 'SY', 'PS'])

const rad = d => (d * Math.PI) / 180
// km between two [lat, lon]
export function km(a, b) {
  const dl = rad(b[0] - a[0]), dn = rad(b[1] - a[1])
  const h = Math.sin(dl / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dn / 2) ** 2
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)))
}

// where a line came in from, small enough to pass along: { lat, lon, cont, cc } (any of them null)
// (inside a Durable Object: the header the worker put on it; at the worker: its own cf, never a header a device sent)
export function geoOf(req, passed = true) {
  const h = passed ? req.headers.get('x-bap-geo') : null
  if (h) { try { const g = JSON.parse(h); if (g && typeof g === 'object') return clean(g) } catch {} }
  const cf = req.cf || {}
  return clean({ lat: cf.latitude, lon: cf.longitude, cont: cf.continent, cc: cf.country })
}
function clean(g) {
  const lat = Number.parseFloat(g.lat), lon = Number.parseFloat(g.lon)
  const ok = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
  const s = (v, n) => (typeof v === 'string' && /^[A-Z]{2}$/.test(v) ? v : null)
  return { lat: ok ? lat : null, lon: ok ? lon : null, cont: s(g.cont), cc: s(g.cc) }
}
// a line's spot on the map: its city, else its continent's region
function spot(g) {
  if (!g) return null
  if (g.lat != null && g.lon != null) return [g.lat, g.lon]
  const r = g.cont === 'AS' && ME.has(g.cc) ? 'me' : CONTINENT[g.cont]
  return r ? HINTS[r] : null
}
// the hint for a room these lines will play in: the least of the most (the farthest player as near as he can be),
// ties to the least in all. null: nothing known about any of them (no hint: made where it's first called)
export function hintFor(geos) {
  const spots = (geos || []).map(spot).filter(Boolean)
  if (!spots.length) return null
  let best = null, bw = Infinity, bs = Infinity
  for (const [h, at] of Object.entries(HINTS)) {
    let worst = 0, sum = 0
    for (const p of spots) { const d = km(p, at); worst = Math.max(worst, d); sum += d }
    if (worst < bw - 1 || (Math.abs(worst - bw) <= 1 && sum < bs)) { best = h; bw = worst; bs = sum }
  }
  return best
}
// the request passed on to a queue with the line's spot on it (a Durable Object's own request may not carry cf)
export function withGeo(req) {
  const h = new Headers(req.headers)
  h.set('x-bap-geo', JSON.stringify(geoOf(req, false)))
  return new Request(req, { headers: h })
}
