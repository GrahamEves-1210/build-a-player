// A batter's and a pitcher's analytics (lib/careerStats.js), registered when baseball loads. Its own file so the
// other sports never download it. Each one against the 2025 league (Baseball-Reference / FanGraphs league pages:
// .245/.315/.404, K 22.2% and BB 8.4% of plate appearances, BABIP .291, a 4.10 ERA and FIP, a 1.28 WHIP, 8.6 K
// and 3.2 BB a nine, 1.15 HR a nine) and the level of a top-ten player at the stat.
const r3 = v => (v >= 1 ? v.toFixed(3) : v.toFixed(3).replace(/^0/, ''))
const f2 = v => v.toFixed(2)
const f1 = v => v.toFixed(1)
const pct = v => `${v.toFixed(1)}%`
const int = v => Math.round(v).toLocaleString()
const ip = outs => `${Math.floor(outs / 3)}.${outs % 3}`
const per = (n, d, m = 100) => (d ? (n / d) * m : 0)
export const BAT_DEFS = [
  { key: 'war', label: 'WAR', get: s => s.stats.war, fmt: f1, avg: 2, elite: 7, says: 'Wins above a replacement player: his bat, his legs, his glove and his position, in wins. An everyday regular is about 2; an MVP 8 or more.' },
  { key: 'opsPlus', label: 'OPS+', get: s => s.stats.opsPlus, fmt: int, avg: 100, elite: 160, says: 'His on-base plus slugging against the league’s, where 100 is average. 150 is 50% better than the league.' },
  { key: 'obp', label: 'ON-BASE %', get: s => s.stats.obp, fmt: r3, avg: 0.315, elite: 0.4, says: 'How often he doesn’t make an out: hits, walks and hit by pitches over his plate appearances.' },
  { key: 'slg', label: 'SLUGGING', get: s => s.stats.slg, fmt: r3, avg: 0.404, elite: 0.56, says: 'Total bases an at-bat. A home run counts four, a double two.' },
  { key: 'iso', label: 'ISOLATED POWER', get: s => (s.stats.slg ?? 0) - (s.stats.avg ?? 0), fmt: r3, avg: 0.159, elite: 0.26, says: 'Slugging minus average: the extra bases, his raw power on its own.' },
  { key: 'kp', label: 'STRIKEOUT %', get: s => per(s.stats.so ?? s.stats.k ?? 0, s.stats.pa), fmt: pct, avg: 22.2, elite: 14, low: true, says: 'Share of his plate appearances that end in a strikeout. Lower is better.' },
  { key: 'bbp', label: 'WALK %', get: s => per(s.stats.bb, s.stats.pa), fmt: pct, avg: 8.4, elite: 14, says: 'Share of his plate appearances that end in a walk: the eye at the plate.' },
  { key: 'babip', label: 'BABIP', get: s => { const st = s.stats; const d = (st.ab ?? 0) - (st.k ?? 0) - (st.hr ?? 0) + (st.sf ?? 0); return d > 0 ? ((st.h ?? 0) - (st.hr ?? 0)) / d : 0 }, fmt: r3, avg: 0.291, elite: 0.33, says: 'His average on balls in play. Speed and hard contact raise it; so does luck, over a short stretch.' },
  { key: 'pa', label: 'PLATE APPEARANCES', get: s => s.stats.pa, fmt: int, says: 'Trips to the plate. An everyday player gets about 650; 502 qualifies for the batting title.' },
  { key: 'xbh', label: 'EXTRA-BASE HITS', get: s => (s.stats.d2 ?? 0) + (s.stats.t3 ?? 0) + (s.stats.hr ?? 0), fmt: int, says: 'Doubles, triples and home runs.' },
]
export const PIT_DEFS = [
  { key: 'war', label: 'WAR', get: s => s.stats.war, fmt: f1, avg: 2, elite: 6, says: 'Wins above a replacement pitcher, from what he controls: strikeouts, walks and home runs. A good starter is about 3; a Cy Young 6 or more.' },
  { key: 'fip', label: 'FIP', get: s => s.stats.fip, fmt: f2, avg: 4.1, elite: 2.9, low: true, says: 'Fielding independent pitching: an ERA from the strikeouts, walks and home runs alone, with the defense behind him taken out.' },
  { key: 'whip', label: 'WHIP', get: s => s.stats.whip, fmt: f2, avg: 1.28, elite: 1, low: true, says: 'Walks and hits an inning. Under 1.00 is the best in baseball.' },
  { key: 'k9', label: 'STRIKEOUTS / 9', get: s => s.stats.k9, fmt: f1, avg: 8.6, elite: 11, says: 'Strikeouts every nine innings.' },
  { key: 'bb9', label: 'WALKS / 9', get: s => s.stats.bb9, fmt: f1, avg: 3.2, elite: 2, low: true, says: 'Walks every nine innings: his control.' },
  { key: 'kbb', label: 'K-BB %', get: s => { const st = s.stats, bf = (st.outs ?? 0) + (st.ha ?? 0) + (st.bb ?? 0) + (st.hbp ?? 0); return bf ? ((st.k ?? 0) - (st.bb ?? 0)) / bf * 100 : 0 }, fmt: pct, avg: 13.8, elite: 22, says: 'Strikeouts minus walks, over the batters he faced. The best quick read of a pitcher there is.' },
  { key: 'hr9', label: 'HOME RUNS / 9', get: s => { const st = s.stats; return st.outs ? (st.hra ?? 0) * 27 / st.outs : 0 }, fmt: f2, avg: 1.15, elite: 0.75, low: true, says: 'Home runs he gives up every nine innings.' },
  { key: 'ip', label: 'INNINGS', get: s => s.stats.outs ?? 0, fmt: ip, says: 'Innings pitched. A full season for a starter is about 180; 162 qualifies for the ERA title.' },
  { key: 'qs', label: 'QUALITY STARTS', get: s => s.stats.qs ?? 0, fmt: int, says: 'Starts of six innings or more with three earned runs or fewer.' },
]
