// Screenshot fixtures for D's screens: a franchise saved into slot 0 at a point in its life, so a headless page
// opens straight onto it.   In the page (the dev server): import('/scripts/franchise2/fixture-d.js').then(m => m.make('wk8'))
//   'wk8'     the first season, eight weeks in
//   'awards'  the first season over, the offseason's first stop
//   'resign' / 'fa'   the offseason at re-signing / free agency's first day
//   'y4'      four seasons played, the fifth eight weeks in (a wall with banners, careers with seasons)
import * as FR from '../../src/lib/franchise2/index'
import { QBS } from '../../src/data/qbs'
import { WRS } from '../../src/data/wrs'

const asBuild = p => Object.fromEntries(Object.entries(p.attrs).map(([k, v]) => [k, { val: v }]))
function season(F, upTo = null) {
  while (F.phase === 'season' && (upTo == null || F.wk < upTo)) { FR.playWeek(F, { moments: false }); if (F.ev) FR.chooseEvent(F, 0) }
  if (upTo != null && F.phase === 'season') return
  FR.intoPlayoffs(F); FR.simPlayoffs(F)
  while (F.phase === 'playoffs') FR.playWeek(F, { moments: false })
  FR.closeSeason(F)
}
function offseason(F, stop = null) {
  FR.ageLeague(F); FR.openResign(F)
  if (stop === 'resign') return
  for (const id of [...F.rs]) { const p = F.teams[F.team].r.find(x => x.i === id); FR.resignOne(F, id, FR.optionDue(p) ? (p.o >= 80 ? 'option' : 'decline') : p.b != null || p.o >= 76) }
  FR.openFA(F)
  if (stop === 'fa') return
  while (F.fad) FR.nextFADay(F)
  FR.openDraft(F)
  while (!FR.draftDone(F)) { FR.cpuPicks(F); if (!FR.draftDone(F)) FR.autoPick(F) }
  FR.closeDraft?.(F)
  FR.newSeason(F)
}
export function make(stage = 'wk8', team = 'DEN') {
  const qb = QBS.find(p => p.name === 'Josh Allen'), wr = WRS.find(p => p.attrs && p.name === 'Puka Nacua')
  const F = FR.createFranchise({ seed: `fx-${stage}`, team, slot: 0, owner: 'Graham', builds: [{ pos: 'qb', build: asBuild(qb), name: 'Marcus Hale', num: 7 }, { pos: 'wr', build: asBuild(wr), name: 'Dre Collins', num: 11 }], coach: { name: 'Coach Reyes', style: 'developer', r: { talentDev: 8, offPlaycalling: 8, defPlaycalling: 6, culture: 7, situational: 7 }, ovr: 84 } })
  F.games = 'off'
  if (stage === 'wk8') season(F, 8)
  else if (stage === 'awards') season(F)
  else if (stage === 'resign') { season(F); offseason(F, 'resign') }
  else if (stage === 'fa') { season(F); offseason(F, 'fa') }
  else if (stage === 'y4') { for (let y = 0; y < 4; y++) { season(F); offseason(F) } season(F, 8) }
  FR.saveFranchise(F)
  localStorage.setItem('bap_fr2_last', '0')
  return `${F.team} ${F.year} ${F.phase} ${F.stage ?? ''} wk ${F.wk} save ${FR.saveSize(F)}`
}
