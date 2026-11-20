// FRANCHISE: the league rules a player can set (2026-11-19, a player: "no salary cap, injuries off, like in Madden").
// Picked when the franchise is made (Setup's last screen) and changed any time after (the hub, beside Key moments).
//   F.noCap  NO SALARY CAP: the player's team signs and keeps whoever it likes; its cap room reads as none to worry
//            about (contracts.js capSheet). The league's teams still run their books under the cap.
//   F.noInj  INJURIES OFF: nobody in the league gets hurt in a game (injury.js rollInjuries); turned off mid-season,
//            the men out now are back.
// A save without them plays with the cap and injuries on, as every save did before.
import { SHORTS } from './league'

export const rulesOf = F => ({ cap: !F?.noCap, inj: !F?.noInj })
export function setRules(F, { cap, inj } = {}) {
  if (cap != null) { if (cap) delete F.noCap; else F.noCap = 1 }
  if (inj != null) {
    if (inj) delete F.noInj
    else {
      F.noInj = 1
      for (const s of SHORTS) for (const p of F.teams?.[s]?.r ?? []) { delete p.in; delete p.ij }
    }
  }
  return rulesOf(F)
}
