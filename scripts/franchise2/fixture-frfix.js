// Screenshot fixtures for the franchise fixes (2026-11-19): a franchise saved into slot 0.
//   In the page (the dev server): import('/scripts/franchise2/fixture-frfix.js').then(m => m.make('cuts', 'MIA'))
//   cuts   the draft done and the class shown, the roster over the limit after a free agency that signed four
//   hub    week 1 of the next season (the hub's side column: Key moments, the league rules)
//   setup  a new franchise's last setup screen (the coach hired, the league rules, Start the season)
import * as FR from '../../src/lib/franchise2/index'

function setupAt(team) {
  const lines = { talentDev: { v: 8, from: 'Andy Reid', t: 'KC' }, offPlaycalling: { v: 8, from: 'Sean McVay', t: 'LAR' }, defPlaycalling: { v: 6, from: 'Mike Macdonald', t: 'SEA' }, culture: { v: 7, from: 'Dan Campbell', t: 'DET' }, situational: { v: 7, from: 'Sean Payton', t: 'DEN' } }
  const S = { slot: 0, seed: 'frfix-setup', owner: 'Graham', step: 'hire', pace: 'full', team, picks: [], builds: {}, cb: { team, lines, cur: null }, coach: { first: 'Marcus', last: 'Reyes', style: 'developer' } }
  FR.saveSetup(0, S)
  localStorage.setItem('bap_fr2_last', '0')
  sessionStorage.setItem('bap_fr2_trip', '1')
  return 'setup'
}

export function make(stage = 'cuts', team = 'MIA', { light = false } = {}) {
  if (stage === 'setup') return setupAt(team)
  const F = FR.createFranchise({ seed: `frfix-${stage}-${team}`, team, slot: 0, owner: 'Graham', builds: [], coach: { name: 'Coach Reyes', style: 'developer', r: { talentDev: 8, offPlaycalling: 8, defPlaycalling: 6, culture: 7, situational: 7 }, ovr: 84 } })
  F.games = 'off'
  F.pace = light ? 'light' : 'full'
  while (F.phase === 'season') { FR.playWeek(F, { moments: false }); if (F.ev) FR.chooseEvent(F, 0) }
  FR.intoPlayoffs(F)
  while (F.phase === 'playoffs') { if (FR.userAlive(F)) FR.playWeek(F, { moments: false }); else FR.simPlayoffs(F) }
  FR.closeSeason(F); FR.closeCarousel(F); FR.ageLeague(F); FR.openResign(F)
  for (const id of [...F.rs]) { const p = F.teams[F.team].r.find(x => x.i === id); FR.resignOne(F, id, FR.optionDue(p) ? (p.o >= 80 ? 'option' : 'decline') : p.o >= 74) }
  FR.openFA(F)
  while (F.fad) { for (const p of FR.faBoard(F, 40).filter(x => FR.canSign(F, x.$) && x.o >= 70).slice(0, 2)) FR.placeBid(F, p.i, p.$ * 1.15); FR.nextFADay(F) }
  FR.openDraft(F); FR.startNight(F)
  while (!FR.draftDone(F)) { FR.cpuPicks(F); if (!FR.draftDone(F)) FR.autoPick(F) }
  F.dr.over = 1; F.dr.seen = F.dr.picks.length
  if (stage === 'hub') { FR.closeDraft(F); FR.autoCamp(F); FR.newSeason(F) }
  F.games = 'advanced'
  FR.saveFranchise(F)
  localStorage.setItem('bap_fr2_last', '0')
  sessionStorage.setItem('bap_fr2_trip', '1')
  FR.closeDraft(F)
  return `${F.team} ${F.year} ${F.phase} ${F.stage ?? ''} cuts ${FR.campCuts(F).map(r => `${r.pos} ${r.have}/${r.max}`).join(' ')}`
}
