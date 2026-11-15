// Screenshot fixtures for the UX pass: a franchise saved into slot 0 at a point in its life.
//   In the page (the dev server): import('/scripts/franchise2/fixture-ux.js').then(m => m.make('wk1', 'DET'))
//   wk1 · wk8 · event · post · po · champ · coaches · awards · resign · fa · draft · night · y4
// (sandbox: true puts the SANDBOX tag on the header; the team is any short name)
import * as FR from '../../src/lib/franchise2/index'
import { QBS } from '../../src/data/qbs'
import { WRS } from '../../src/data/wrs'

const asBuild = p => Object.fromEntries(Object.entries(p.attrs).map(([k, v]) => [k, { val: v }]))
function season(F, upTo = null) {
  while (F.phase === 'season' && (upTo == null || F.wk < upTo)) { FR.playWeek(F, { moments: false }); if (F.ev) FR.chooseEvent(F, 0) }
  if (upTo != null && F.phase === 'season') return
  FR.intoPlayoffs(F)
  while (F.phase === 'playoffs') { if (FR.userAlive(F)) FR.playWeek(F, { moments: false }); else FR.simPlayoffs(F) }
}
function offseason(F, stop = null) {
  FR.closeSeason(F)
  if (stop === 'coaches') return
  FR.closeCarousel(F)
  if (stop === 'awards') return
  FR.ageLeague(F); FR.openResign(F)
  if (stop === 'resign') return
  for (const id of [...F.rs]) { const p = F.teams[F.team].r.find(x => x.i === id); FR.resignOne(F, id, FR.optionDue(p) ? (p.o >= 80 ? 'option' : 'decline') : p.b != null || p.o >= 76) }
  FR.openFA(F)
  if (stop === 'fa') return
  while (F.fad) FR.nextFADay(F)
  FR.openDraft(F)
  if (stop === 'draft') return
  if (stop === 'night') { FR.startNight(F); return }
  while (!FR.draftDone(F)) { FR.cpuPicks(F); if (!FR.draftDone(F)) FR.autoPick(F) }
  FR.closeDraft?.(F)
  FR.newSeason(F)
}
export function make(stage = 'wk8', team = 'DEN', { sandbox = false } = {}) {
  const qb = QBS.find(p => p.name === 'Josh Allen'), wr = WRS.find(p => p.attrs && p.name === 'Puka Nacua')
  const F = FR.createFranchise({ seed: `ux-${stage}-${team}`, team, slot: 0, owner: 'Graham', sandbox, builds: [{ pos: 'qb', build: asBuild(qb), name: 'Marcus Hale', num: 7 }, { pos: 'wr', build: asBuild(wr), name: 'Dre Collins', num: 11 }], coach: { name: 'Coach Reyes', style: 'developer', r: { talentDev: 8, offPlaycalling: 8, defPlaycalling: 6, culture: 7, situational: 7 }, ovr: 84 } })
  F.games = 'off'
  if (sandbox) F.sandbox = true
  if (stage === 'wk8') season(F, 8)
  else if (stage === 'event') { season(F, 5); F.ev = null; F.nextEv = 6; FR.playWeek(F, { moments: false }) }
  else if (stage === 'post') { while (F.phase === 'season') { FR.playWeek(F, { moments: false }); if (F.ev) FR.chooseEvent(F, 0) } }
  else if (stage === 'po') { season(F, 99); while (F.phase === 'season') { FR.playWeek(F, { moments: false }); if (F.ev) FR.chooseEvent(F, 0) } FR.intoPlayoffs(F) }
  else if (stage === 'champ') { season(F); if (F.po.champ !== F.team) { F.po.runner = F.po.champ === F.team ? F.po.runner : F.po.champ; F.po.champ = F.team } }
  else if (['coaches', 'awards', 'resign', 'fa', 'draft', 'night'].includes(stage)) { season(F); offseason(F, stage) }
  else if (stage === 'y4') { for (let y = 0; y < 4; y++) { season(F); offseason(F) } season(F, 8) }
  F.games = 'advanced'
  FR.saveFranchise(F)
  localStorage.setItem('bap_fr2_last', '0')
  sessionStorage.setItem('bap_fr2_trip', '1')
  return `${F.team} ${F.year} ${F.phase} ${F.stage ?? ''} wk ${F.wk} ev ${F.ev?.id ?? '-'}`
}
