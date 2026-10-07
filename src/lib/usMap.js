// The map for TAKEOVER: the lower 48 as a dotted silhouette, with every league
// city placed by latitude/longitude through the Albers projection atlases use
// for the US (standard parallels 29.5° and 45.5°). `project` returns percent
// coordinates of the map box, so pins can be plain positioned elements.

const rad = d => d * Math.PI / 180
const P1 = rad(29.5), P2 = rad(45.5), P0 = rad(23), L0 = rad(-96)
const N = (Math.sin(P1) + Math.sin(P2)) / 2
const C = Math.cos(P1) ** 2 + 2 * N * Math.sin(P1)
const R0 = Math.sqrt(C - 2 * N * Math.sin(P0)) / N
const albers = (lon, lat) => {
  const rho = Math.sqrt(C - 2 * N * Math.sin(rad(lat))) / N, th = N * (rad(lon) - L0)
  return { x: rho * Math.sin(th), y: R0 - rho * Math.cos(th) }
}

// Coastline and borders, clockwise from Cape Flattery. Rough on purpose: the
// dots do the drawing.
export const OUTLINE = [
  [-124.7, 48.4], [-122.8, 49.0], [-117.0, 49.0], [-110.0, 49.0], [-104.0, 49.0], [-97.2, 49.0], [-95.2, 49.4], [-94.7, 48.8], [-92.5, 48.4], [-90.0, 48.1],
  [-92.1, 46.8], [-90.9, 46.6], [-88.5, 47.4], [-87.0, 46.5], [-84.8, 46.5], [-84.4, 46.5], [-84.0, 46.0], [-83.5, 45.4], [-83.3, 44.3], [-82.5, 43.0],
  [-82.4, 42.6], [-83.1, 42.1], [-83.5, 41.7], [-82.5, 41.4], [-81.7, 41.5], [-80.5, 42.0], [-79.0, 42.9], [-78.8, 43.3], [-77.5, 43.3], [-76.2, 43.6],
  [-76.3, 44.2], [-75.0, 45.0], [-71.5, 45.0], [-71.0, 45.3], [-70.0, 46.7], [-69.2, 47.46], [-68.3, 47.35], [-67.8, 47.1], [-67.8, 45.7], [-67.0, 44.8],
  [-67.2, 44.6], [-68.2, 44.4], [-69.0, 44.0], [-70.2, 43.6], [-70.7, 42.9], [-70.9, 42.4], [-70.0, 41.8], [-70.6, 41.6], [-71.4, 41.5], [-72.9, 41.2],
  [-73.7, 40.9], [-74.0, 40.6], [-74.1, 39.9], [-74.9, 38.9], [-75.1, 38.4], [-75.6, 37.3], [-76.0, 36.9], [-75.8, 36.0], [-75.5, 35.2], [-76.5, 34.7],
  [-77.9, 33.9], [-78.9, 33.6], [-79.9, 32.7], [-81.1, 31.9], [-81.5, 30.7], [-81.3, 29.9], [-80.8, 28.6], [-80.5, 28.0], [-80.1, 26.9], [-80.1, 25.9],
  [-80.4, 25.2], [-81.1, 25.1], [-81.7, 25.9], [-82.2, 26.7], [-82.7, 27.7], [-82.8, 28.8], [-83.4, 29.5], [-84.0, 30.1], [-85.0, 29.7], [-85.7, 30.1],
  [-86.5, 30.4], [-87.5, 30.3], [-88.1, 30.3], [-89.1, 30.3], [-89.7, 30.2], [-89.5, 29.4], [-90.2, 29.1], [-91.3, 29.3], [-92.3, 29.6], [-93.8, 29.7],
  [-94.7, 29.4], [-96.0, 28.6], [-97.0, 27.9], [-97.4, 27.0], [-97.2, 26.0], [-98.3, 26.1], [-99.1, 26.4], [-99.5, 27.5], [-100.3, 28.3], [-101.0, 29.4],
  [-101.4, 29.8], [-102.4, 29.8], [-103.0, 29.0], [-103.8, 29.3], [-104.5, 29.6], [-105.0, 30.6], [-106.4, 31.8], [-108.2, 31.8], [-108.2, 31.3], [-111.1, 31.3],
  [-114.8, 32.5], [-117.1, 32.5], [-117.3, 33.0], [-118.4, 33.8], [-119.0, 34.2], [-120.5, 34.5], [-120.6, 35.2], [-121.9, 36.6], [-122.5, 37.5], [-122.5, 37.8],
  [-123.0, 38.3], [-123.7, 39.0], [-124.4, 40.4], [-124.1, 41.5], [-124.5, 42.8], [-124.1, 43.5], [-124.0, 44.6], [-123.9, 45.5], [-124.0, 46.3], [-124.1, 47.0],
  [-124.6, 47.9],
]
// The one Great Lake inside the border — cut out of the dots
export const LAKE_MICHIGAN = [
  [-87.6, 41.7], [-86.3, 42.4], [-86.3, 43.9], [-85.6, 45.1], [-84.9, 45.8], [-86.5, 45.9], [-87.4, 45.5], [-87.9, 44.5], [-87.8, 43.4], [-87.7, 42.4],
]

const pts = OUTLINE.map(([lon, lat]) => albers(lon, lat))
const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x))
const minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y))
export const W = 1000
export const H = Math.round(W * (maxY - minY) / (maxX - minX))

/** lon/lat → { x, y } in percent of the map box */
export function project(lon, lat) {
  const p = albers(lon, lat)
  return { x: (p.x - minX) / (maxX - minX) * 100, y: (maxY - p.y) / (maxY - minY) * 100 }
}
const ring = r => r.map(([lon, lat], i) => { const p = project(lon, lat); return `${i ? 'L' : 'M'}${(p.x / 100 * W).toFixed(1)} ${(p.y / 100 * H).toFixed(1)}` }).join('') + 'Z'
export const OUTLINE_PATH = ring(OUTLINE) + ring(LAKE_MICHIGAN)

/** great-circle miles between two cities */
export function miles(a, b) {
  const R = 3958.8
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(h)))
}
/** compass direction from a to b */
export function heading(a, b) {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat))
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon))
  const deg = ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8]
}

// Arenas and stadiums. Shared-market teams are nudged apart so both pins read.
export const GEO = {
  nba: {
    ATL: { city: 'Atlanta', lat: 33.757, lon: -84.396 }, BOS: { city: 'Boston', lat: 42.366, lon: -71.062 }, BKN: { city: 'Brooklyn', lat: 40.2, lon: -73.3 },
    CHA: { city: 'Charlotte', lat: 35.225, lon: -80.839 }, CHI: { city: 'Chicago', lat: 41.881, lon: -87.674 }, CLE: { city: 'Cleveland', lat: 41.496, lon: -81.688 },
    DAL: { city: 'Dallas', lat: 32.790, lon: -96.810 }, DEN: { city: 'Denver', lat: 39.749, lon: -105.008 }, DET: { city: 'Detroit', lat: 42.341, lon: -83.055 },
    GSW: { city: 'San Francisco', lat: 37.768, lon: -122.388 }, HOU: { city: 'Houston', lat: 29.751, lon: -95.362 }, IND: { city: 'Indianapolis', lat: 39.764, lon: -86.156 },
    LAC: { city: 'Los Angeles', lat: 33.2, lon: -117.8 }, LAL: { city: 'Los Angeles', lat: 34.5, lon: -118.6 }, MEM: { city: 'Memphis', lat: 35.138, lon: -90.051 },
    MIA: { city: 'Miami', lat: 25.781, lon: -80.187 }, MIL: { city: 'Milwaukee', lat: 43.045, lon: -87.917 }, MIN: { city: 'Minneapolis', lat: 44.979, lon: -93.276 },
    NOP: { city: 'New Orleans', lat: 29.949, lon: -90.082 }, NYK: { city: 'New York', lat: 41.1, lon: -74.5 }, OKC: { city: 'Oklahoma City', lat: 35.463, lon: -97.515 },
    ORL: { city: 'Orlando', lat: 28.539, lon: -81.384 }, PHI: { city: 'Philadelphia', lat: 39.901, lon: -75.172 }, PHX: { city: 'Phoenix', lat: 33.446, lon: -112.071 },
    POR: { city: 'Portland', lat: 45.532, lon: -122.667 }, SAC: { city: 'Sacramento', lat: 38.580, lon: -121.500 }, SAS: { city: 'San Antonio', lat: 29.427, lon: -98.437 },
    TOR: { city: 'Toronto', lat: 43.643, lon: -79.379 }, UTA: { city: 'Salt Lake City', lat: 40.768, lon: -111.901 }, WAS: { city: 'Washington', lat: 38.898, lon: -77.021 },
  },
  nfl: {
    ARI: { city: 'Phoenix', lat: 33.528, lon: -112.263 }, ATL: { city: 'Atlanta', lat: 33.755, lon: -84.401 }, BAL: { city: 'Baltimore', lat: 39.278, lon: -76.623 },
    BUF: { city: 'Buffalo', lat: 42.774, lon: -78.787 }, CAR: { city: 'Charlotte', lat: 35.226, lon: -80.853 }, CHI: { city: 'Chicago', lat: 41.862, lon: -87.617 },
    CIN: { city: 'Cincinnati', lat: 39.095, lon: -84.516 }, CLE: { city: 'Cleveland', lat: 41.506, lon: -81.700 }, DAL: { city: 'Dallas', lat: 32.748, lon: -97.093 },
    DEN: { city: 'Denver', lat: 39.744, lon: -105.020 }, DET: { city: 'Detroit', lat: 42.340, lon: -83.046 }, GB: { city: 'Green Bay', lat: 44.501, lon: -88.062 },
    HOU: { city: 'Houston', lat: 29.685, lon: -95.411 }, IND: { city: 'Indianapolis', lat: 39.760, lon: -86.164 }, JAX: { city: 'Jacksonville', lat: 30.324, lon: -81.637 },
    KC: { city: 'Kansas City', lat: 39.049, lon: -94.484 }, LV: { city: 'Las Vegas', lat: 36.091, lon: -115.183 }, LAC: { city: 'Los Angeles', lat: 33.2, lon: -117.8 },
    LAR: { city: 'Los Angeles', lat: 34.5, lon: -118.6 }, MIA: { city: 'Miami', lat: 25.958, lon: -80.239 }, MIN: { city: 'Minneapolis', lat: 44.974, lon: -93.258 },
    NE: { city: 'Boston', lat: 42.3, lon: -71.3 }, NO: { city: 'New Orleans', lat: 29.951, lon: -90.081 }, NYG: { city: 'New York', lat: 41.1, lon: -74.6 },
    NYJ: { city: 'New York', lat: 40.1, lon: -73.5 }, PHI: { city: 'Philadelphia', lat: 39.901, lon: -75.168 }, PIT: { city: 'Pittsburgh', lat: 40.447, lon: -80.016 },
    SF: { city: 'San Francisco', lat: 37.5, lon: -122.2 }, SEA: { city: 'Seattle', lat: 47.595, lon: -122.332 }, TB: { city: 'Tampa', lat: 27.976, lon: -82.503 },
    TEN: { city: 'Nashville', lat: 36.166, lon: -86.771 }, WAS: { city: 'Washington', lat: 38.908, lon: -76.864 },
  },
}
