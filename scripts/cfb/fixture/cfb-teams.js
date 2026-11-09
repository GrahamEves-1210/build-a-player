// TEST FIXTURE ONLY (scripts/cfb): stands in for src/data/cfb-teams.js until the data agent's file exists.
// Power numbers are rough 2026 expectations on an SP+-like scale (points better than an average FBS team);
// off/def are put on football's 1-10 scale (higher is better on both) so the engine sees the NFL shape.
const P = [
  // SEC
  ['TEX', 'Texas', 'sec', 24], ['UGA', 'Georgia', 'sec', 24], ['ALA', 'Alabama', 'sec', 21], ['TA&M', 'Texas A&M', 'sec', 20],
  ['OU', 'Oklahoma', 'sec', 19], ['MISS', 'Ole Miss', 'sec', 19], ['LSU', 'LSU', 'sec', 18], ['TENN', 'Tennessee', 'sec', 17],
  ['MIZ', 'Missouri', 'sec', 14], ['AUB', 'Auburn', 'sec', 13], ['FLA', 'Florida', 'sec', 12], ['VAN', 'Vanderbilt', 'sec', 12],
  ['SC', 'South Carolina', 'sec', 11], ['ARK', 'Arkansas', 'sec', 6], ['MSST', 'Mississippi State', 'sec', 5], ['UK', 'Kentucky', 'sec', 4],
  // Big Ten
  ['OSU', 'Ohio State', 'b1g', 27], ['ORE', 'Oregon', 'b1g', 24], ['IU', 'Indiana', 'b1g', 22], ['PSU', 'Penn State', 'b1g', 18],
  ['MICH', 'Michigan', 'b1g', 18], ['USC', 'USC', 'b1g', 16], ['WASH', 'Washington', 'b1g', 13], ['IOWA', 'Iowa', 'b1g', 13],
  ['ILL', 'Illinois', 'b1g', 11], ['NEB', 'Nebraska', 'b1g', 9], ['MINN', 'Minnesota', 'b1g', 8], ['WIS', 'Wisconsin', 'b1g', 6],
  ['UCLA', 'UCLA', 'b1g', 5], ['MSU', 'Michigan State', 'b1g', 4], ['MD', 'Maryland', 'b1g', 4], ['RUTG', 'Rutgers', 'b1g', 3],
  ['NU', 'Northwestern', 'b1g', 3], ['PUR', 'Purdue', 'b1g', -2],
  // Big 12
  ['TTU', 'Texas Tech', 'b12', 16], ['UTAH', 'Utah', 'b12', 15], ['BYU', 'BYU', 'b12', 13], ['ASU', 'Arizona State', 'b12', 10],
  ['TCU', 'TCU', 'b12', 10], ['KSU', 'Kansas State', 'b12', 9], ['ISU', 'Iowa State', 'b12', 9], ['BAY', 'Baylor', 'b12', 9],
  ['HOU', 'Houston', 'b12', 7], ['ARIZ', 'Arizona', 'b12', 7], ['CIN', 'Cincinnati', 'b12', 6], ['KU', 'Kansas', 'b12', 6],
  ['COLO', 'Colorado', 'b12', 4], ['UCF', 'UCF', 'b12', 4], ['WVU', 'West Virginia', 'b12', 2], ['OKST', 'Oklahoma State', 'b12', -1],
  // ACC
  ['MIA', 'Miami', 'acc', 20], ['CLEM', 'Clemson', 'acc', 14], ['SMU', 'SMU', 'acc', 12], ['LOU', 'Louisville', 'acc', 11],
  ['GT', 'Georgia Tech', 'acc', 10], ['FSU', 'Florida State', 'acc', 9], ['DUKE', 'Duke', 'acc', 7], ['PITT', 'Pittsburgh', 'acc', 7],
  ['UVA', 'Virginia', 'acc', 7], ['VT', 'Virginia Tech', 'acc', 5], ['NCST', 'NC State', 'acc', 5], ['UNC', 'North Carolina', 'acc', 4],
  ['CAL', 'California', 'acc', 1], ['WAKE', 'Wake Forest', 'acc', 0], ['SYR', 'Syracuse', 'acc', 0], ['BC', 'Boston College', 'acc', -1],
  ['STAN', 'Stanford', 'acc', -3],
  // Independents
  ['ND', 'Notre Dame', 'ind', 23], ['CONN', 'UConn', 'ind', -2],
  // Pac-12 (2026)
  ['BSU', 'Boise State', 'pac12', 6], ['FRES', 'Fresno State', 'pac12', 0], ['SDSU', 'San Diego State', 'pac12', 0], ['TXST', 'Texas State', 'pac12', 0],
  ['USU', 'Utah State', 'pac12', -4], ['WSU', 'Washington State', 'pac12', -4], ['ORST', 'Oregon State', 'pac12', -5], ['CSU', 'Colorado State', 'pac12', -8],
  // Mountain West (2026)
  ['UNLV', 'UNLV', 'mwc', 1], ['UNM', 'New Mexico', 'mwc', -5], ['NIU', 'Northern Illinois', 'mwc', -5], ['SJSU', 'San José State', 'mwc', -6],
  ['HAW', "Hawai'i", 'mwc', -6], ['AF', 'Air Force', 'mwc', -6], ['WYO', 'Wyoming', 'mwc', -10], ['NEV', 'Nevada', 'mwc', -11], ['UTEP', 'UTEP', 'mwc', -12],
  // American
  ['TULN', 'Tulane', 'aac', 6], ['MEM', 'Memphis', 'aac', 5], ['USF', 'South Florida', 'aac', 5], ['UNT', 'North Texas', 'aac', 3],
  ['NAVY', 'Navy', 'aac', 2], ['ARMY', 'Army', 'aac', 0], ['UTSA', 'UTSA', 'aac', 0], ['ECU', 'East Carolina', 'aac', 0],
  ['FAU', 'Florida Atlantic', 'aac', -6], ['TEM', 'Temple', 'aac', -8], ['RICE', 'Rice', 'aac', -9], ['TLSA', 'Tulsa', 'aac', -9],
  ['UAB', 'UAB', 'aac', -9], ['CLT', 'Charlotte', 'aac', -12],
  // Sun Belt
  ['JMU', 'James Madison', 'sbc', 5], ['ODU', 'Old Dominion', 'sbc', 0], ['APP', 'App State', 'sbc', -3], ['UL', 'Louisiana', 'sbc', -3],
  ['USA', 'South Alabama', 'sbc', -3], ['USM', 'Southern Miss', 'sbc', -4], ['ARST', 'Arkansas State', 'sbc', -5], ['TROY', 'Troy', 'sbc', -5],
  ['GASO', 'Georgia Southern', 'sbc', -6], ['MRSH', 'Marshall', 'sbc', -6], ['CCU', 'Coastal Carolina', 'sbc', -9], ['ULM', 'UL Monroe', 'sbc', -11],
  ['GAST', 'Georgia State', 'sbc', -14],
  // Conference USA
  ['LIB', 'Liberty', 'cusa', -2], ['WKU', 'Western Kentucky', 'cusa', -4], ['JVST', 'Jacksonville State', 'cusa', -5], ['LT', 'Louisiana Tech', 'cusa', -6],
  ['DEL', 'Delaware', 'cusa', -6], ['MOST', 'Missouri State', 'cusa', -7], ['KENN', 'Kennesaw State', 'cusa', -8], ['FIU', 'FIU', 'cusa', -10],
  ['MTSU', 'Middle Tennessee', 'cusa', -12], ['NMSU', 'New Mexico State', 'cusa', -14], ['SHSU', 'Sam Houston', 'cusa', -15],
  // MAC
  ['TOL', 'Toledo', 'mac', 0], ['OHIO', 'Ohio', 'mac', -4], ['M-OH', 'Miami (OH)', 'mac', -4], ['BUFF', 'Buffalo', 'mac', -6],
  ['WMU', 'Western Michigan', 'mac', -6], ['BGSU', 'Bowling Green', 'mac', -8], ['SAC', 'Sacramento State', 'mac', -8], ['CMU', 'Central Michigan', 'mac', -10],
  ['EMU', 'Eastern Michigan', 'mac', -11], ['BALL', 'Ball State', 'mac', -13], ['AKR', 'Akron', 'mac', -15], ['KENT', 'Kent State', 'mac', -17],
  ['MASS', 'UMass', 'mac', -19],
]
// a fixed per-team offense/defense lean, so the fixture isn't perfectly balanced
const lean = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return ((h >>> 0) % 7) - 3 }
export const CFB_TEAMS = P.map(([short, name, conf, p]) => {
  const s = lean(short)
  const off = Math.round((5.5 + (p / 2 + s) / 6) * 10) / 10
  const def = Math.round((5.5 + (p / 2 - s) / 6) * 10) / 10
  return { short, name, conf, color: '#1a5fd1', color2: '#ffffff', espn: null, ovr: Math.round(75 + p * 0.7), off, def }
})
