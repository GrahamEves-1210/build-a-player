// The College Football DB hand-check (scripts/cfb/build-dbs.mjs reads it). Every entry carries its reason.
//   out:    a man dropped from his slot (season-ending injury, gone from the team), by ESPN id
//   subpos: a man's CB/S set by hand: [subpos, reason]
//   grades: { name, set: {trait: grade}, shift, traits, why }  (set replaces the formula grade; shift moves the
//           listed traits, or every trait but size, by that many steps)
export const HAND = {
  out: {
    'ASU|Rodney Bimage Jr.': 'Rodney Bimage Jr. (ASU CB): right leg, carted off against Colorado on Nov. 7; Dillingham said he is probably out for the year (Arizona Sports)',
  },
  subpos: {
    '5079698': ['cb', "Ellis Robinson IV (UGA, ESPN 'DB'): Georgia's boundary corner since 2025"],
    '5122447': ['cb', "Demello Jones (UGA, ESPN 'DB'): Georgia's STAR/nickel, a corner in this file"],
    '5079334': ['s', "KJ Bolden (UGA, ESPN 'DB'): Georgia's safety since 2024"],
    '5127726': ['cb', "Braylon Conley (UGA, ESPN 'DB'): corner"],
  },
  // prefer: two men start at the spot and the box score can't tell them apart (a corner nobody throws at, two
  // every-down safeties); the better-regarded one takes the slot
  prefer: {
    'NDAM|Leonard Moore': "Notre Dame's CB1: AP midseason first-team All-American, Thorpe finalist, PFF's top returning corner (91.8 in 2025); his box-score line is thin because QBs avoid him",
    'UGA|KJ Bolden': 'Georgia starts Bolden and Dinkins at safety; Bolden is a Thorpe semifinalist, AP midseason second team, PFF top returning safety (90.7)',
    'UKY|Jordan Castell': 'Kentucky starts Castell and Ty Bryant at safety; Castell is a Thorpe semifinalist with 4 INTs',
    'OSU|Jaylen McClain': 'Ohio State starts McClain and Earl Little Jr. at safety; McClain is the Thorpe semifinalist',
    'MIA|Bryce Fitzgerald': 'Miami starts Fitzgerald at safety (moved to corner for stretches when injuries hit); Thorpe semifinalist, 2025 freshman All-American with 6 INTs',
    'ORE|Brandon Finney Jr.': "Oregon starts Finney, Obidegwu and Offord; Finney is on PFF's top-10 returning corners (missed two games)",
    'ALA|Zabien Brown': { bonus: 5, why: "Alabama's CB2: the outside corner opposite Dijon Lee (Red Morgan, the STAR, has more tackles); AP preseason second team, Kiper's near-miss corner, Bleacher Report CB3" },
    'NEB|Andrew Marshall': 'Nebraska field corner, started every game through Week 10; On3 and SI midseason first-team All-American; out of the last two box scores, no injury news found',
  },
  back: {},
  grades: {
    'NDAM|Leonard Moore': { name: 'Leonard Moore (NDAM CB1)', set: { speed: 9, fluidity: 10, press: 9, hands: 9, zoneIQ: 10, manCoverage: 10, playRecognition: 9, runSupport: 7 },
      why: "The consensus best corner in the country: Thorpe finalist, AP midseason first team, PFF's nation-leading 91.8 grade in 2025, No. 4 on Brugler's top 50 and Kiper's top corner. His 2026 box line (0 INT, 7 PD in 9 games) is what a corner nobody throws at looks like" },
    'CLEM|Ashton Hampton': { name: 'Ashton Hampton (CLEM CB1)', set: {}, why: 'no change (checked): Thorpe finalist, AP and CBS midseason first team, Kiper CB2, Brugler No. 11; the formula already has him No. 2' },
    'UGA|Ellis Robinson IV': { name: 'Ellis Robinson IV (UGA CB1)', shift: 1, traits: ['manCoverage', 'press', 'fluidity'],
      why: "AP preseason first team and midseason second team, PFF's top tier of 2027 corners, Kiper CB4, Brugler No. 15" },
    'MSST|Kelley Jones': { name: 'Kelley Jones (MSST CB2)', set: { manCoverage: 9, press: 9, zoneIQ: 9, fluidity: 8 },
      why: 'Walter Camp preseason first team, On3 midseason All-American, Kiper CB3 and PFN CB3; PFF had him allowing 9 catches on 20 targets through six games (0 INT, so the box score undersells him)' },
    'UGA|KJ Bolden': { name: 'KJ Bolden (UGA S1)', shift: 2,
      why: "PFF's No. 1 returning safety (90.7 in 2025, 4.9% missed tackles), Thorpe semifinalist, AP midseason second team, Kiper S2, PFN S2, Walter Camp preseason first team; shares the box-score volume with Dinkins" },
    "UCLA|Ta'Shawn James": { name: "Ta'Shawn James (UCLA S1)", shift: 1, why: 'AP midseason first-team defensive back, CBS midseason first team, Thorpe semifinalist' },
    'MIA|Bryce Fitzgerald': { name: 'Bryce Fitzgerald (MIA S1)', shift: 1, traits: ['manCoverage', 'press', 'zoneIQ', 'hands', 'playRecognition'],
      why: 'Thorpe semifinalist; played corner as well as safety through Miami injuries; 6 INTs as a 2025 freshman All-American' },
    'OSU|Jaylen McClain': { name: 'Jaylen McClain (OSU S1)', shift: 1, why: 'Thorpe semifinalist (the box score splits the safety volume with Earl Little Jr.)' },
    'HOU|Jalen Mayo': { name: 'Jalen Mayo (HOU CB2)', shift: 2, traits: ['manCoverage', 'press', 'zoneIQ', 'hands', 'fluidity'],
      why: 'Thorpe semifinalist in his first FBS season (an SFA transfer, so the formula has one FBS year to go on and shrinks it)' },
    'NEB|Andrew Marshall': { name: 'Andrew Marshall (NEB CB1)', shift: 2, traits: ['manCoverage', 'press', 'zoneIQ', 'fluidity'],
      why: "On3 and SI midseason first-team All-American (On3: the Big Ten's best corner at the halfway point), PFN's top cornerback grade (95.5) through six games; an Idaho transfer with one FBS year" },
    'MSST|Jett Jefferson': { name: 'Jett Jefferson (MSST CB1)', shift: 1, why: 'AP midseason second-team cornerback' },
    'ORE|Brandon Finney Jr.': { name: 'Brandon Finney Jr. (ORE CB1)', shift: 1, why: "PFF's No. 3 returning corner, Walter Camp preseason first team, AP preseason second team" },
    'ALA|Dijon Lee Jr.': { name: 'Dijon Lee Jr. (ALA CB1)', shift: 1, traits: ['manCoverage', 'press', 'zoneIQ', 'fluidity'], why: "PFF's No. 2 returning corner (85.4 coverage grade in 2025)" },
    'PSU|Audavion Collins': { name: 'Audavion Collins (PSU CB1)', shift: 1, why: "Kiper's No. 5 corner for 2027; 11 PD this year (his thin 2025 drags the three-year average)" },
    'USC|Jontez Williams': { name: 'Jontez Williams (USC CB2)', shift: 1, traits: ['manCoverage', 'press', 'zoneIQ', 'fluidity'], why: "PFF's No. 4 returning corner" },
    'OKLA|Peyton Bowen': { name: 'Peyton Bowen (OKLA S1)', shift: 1, why: "Thorpe semifinalist; Bleacher Report's No. 3 safety for 2027" },
    'CAL|Kingston Lopa': { name: 'Kingston Lopa (CAL S1)', shift: 1, traits: ['manCoverage', 'zoneIQ'], why: "AP midseason first team and On3 midseason All-American, Thorpe semifinalist, Kiper's No. 3 safety; tied for the national INT lead" },
    'ULL|Brent Gordon Jr.': { name: 'Brent Gordon Jr. (ULL CB1)', shift: -1, traits: ['press', 'manCoverage'],
      why: "Thorpe semifinalist and the national PD leader, but a Sun Belt schedule and no top-five corner ranking on any 2027 board; eased so he sits just behind the Power 4 corners the boards rank first" },
    'WKU|Jaylen Lewis': { name: 'Jaylen Lewis (WKU S1)', set: { speed: 9 }, why: "named to Bruce Feldman's 2026 Freaks List" },
  },
  notes() {
    const L = []
    for (const [id, why] of Object.entries(this.out)) L.push(`//   out: ${why}`)
    for (const [id, [sp, why]] of Object.entries(this.subpos)) L.push(`//   position ${sp}: ${why}`)
    for (const [id, v] of Object.entries(this.prefer)) L.push(`//   slot: ${typeof v === 'object' ? v.why : v}`)
    for (const [id, g] of Object.entries(this.grades)) {
      const moves = [g.set && Object.keys(g.set).length && Object.entries(g.set).map(([k, v]) => `${k} ${v}`).join(', '), g.shift && `${g.shift > 0 ? '+' : ''}${g.shift} ${g.traits ? g.traits.join('/') : 'every trait but Size'}`].filter(Boolean).join('; ')
      L.push(`//   ${g.name}: ${moves ? moves + '. ' : ''}${g.why}`)
    }
    return L.join('\n')
  },
}
