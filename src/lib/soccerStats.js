// A striker's analytics (lib/careerStats.js), registered when soccer loads. Its own file so football and basketball
// never download it.
const f2 = v => v.toFixed(2)
const pct = v => `${v.toFixed(1)}%`
const int = v => Math.round(v).toLocaleString()
// A striker, league matches only (FBref, the top five leagues 2022-25): an average starting No. 9 scores about
// 0.45 a 90 from 0.40 xG, an elite one 0.85 from 0.75 (Haaland, Kane, Lewandowski); shot conversion about 13%
// for a starter and 21% for the best; 38-48% of a striker's shots on target; a match rating (the sim's 0-10,
// the scale of WhoScored and FotMob) about 6.9 for a regular starter, 7.6 for the best in the league.
const per90 = (n, s) => (s.adv.mins ? (n / s.adv.mins) * 90 : 0)
export const SOCCER_DEFS = [
  { key: 'g90', label: 'GOALS / 90', get: s => per90(s.stats.lgGoals ?? s.stats.goals, s), fmt: f2, avg: 0.45, elite: 0.85, says: 'League goals for every full match he plays. The fairest way to compare a starter with a sub.' },
  { key: 'xg90', label: 'xG / 90', get: s => per90(s.stats.xg, s), fmt: f2, avg: 0.4, elite: 0.75, says: 'Expected goals a match: how good his chances were, before he shot. It says most about his movement.' },
  { key: 'gxg', label: 'GOALS − xG', get: s => (s.stats.lgGoals ?? s.stats.goals) - (s.stats.xg ?? 0), fmt: v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`, avg: 0, elite: 6, says: 'Goals against the chances he had. Above zero is finishing better than an average player would.' },
  { key: 'conv', label: 'SHOT CONVERSION', get: s => ((s.stats.lgGoals ?? s.stats.goals) / Math.max(1, s.stats.shots)) * 100, fmt: pct, avg: 13, elite: 21, says: 'Share of his shots that go in.' },
  { key: 'sot', label: 'SHOTS ON TARGET', get: s => (s.stats.sot / Math.max(1, s.stats.shots)) * 100, fmt: pct, avg: 40, elite: 50, says: 'Share of his shots that make the keeper work.' },
  { key: 'gi90', label: 'GOAL INVOLVEMENTS / 90', get: s => per90((s.stats.lgGoals ?? s.stats.goals) + (s.stats.lgAssists ?? s.stats.assists), s), fmt: f2, avg: 0.6, elite: 1.1, says: 'Goals and assists for every full match.' },
  { key: 'rating', label: 'MATCH RATING', get: s => s.stats.avgRating, fmt: f2, avg: 6.9, elite: 7.6, says: 'His average match rating out of 10, the way the stats sites score a game.' },
  { key: 'mins', label: 'MINUTES', get: s => s.adv.mins, fmt: int, says: 'League minutes. A regular No. 9 plays about 2,600.' },
  { key: 'hat', label: 'HAT-TRICKS', get: s => s.stats.hatTricks ?? 0, fmt: int, says: 'Three goals or more in a league match.' },
  { key: 'motm', label: 'PLAYER OF THE MATCH', get: s => s.stats.motm ?? 0, fmt: int, says: 'League matches he was the best player on the pitch.' },
  { key: 'bcm', label: 'BIG CHANCES MISSED', get: s => s.stats.bcm ?? 0, fmt: int, says: 'Chances a striker is expected to score, that he didn\'t. The best ones miss plenty too: they get the most.' },
]
