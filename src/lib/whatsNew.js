// The patch notes (components/app/AppWhatsNew.jsx), newest first. A new update: add one at the top, with a new
// `id`, and it opens once for every returning player; the date menu goes back through the older ones.
// Only what's new against the live site. ratings: the Ratings tab (data/ratings-patch.js) belongs to that one
const NOV_10 = {
  id: '2026-11-10',
  date: 'NOV 10',
  fullDate: 'NOV 10, 2026',
  sections: [
    {
      name: 'New Mode: College Football',
      items: [
        'The first school is now a scholarship decision: your stars, national rank and the 10 schools offering you, by talent',
        'Transfer opens the portal: the schools that want you now, and a big season (record, a title run, the Heisman) can move your stock up a level',
        'Return to school up to twice; transfer as often as you like',
        'A new season moves the rosters on: juniors and seniors are gone, and the best sophomores and freshmen take over a class older',
        'Player classes checked against real rosters',
        'The Playoff bracket fills in below the live games as you play',
        'Draft stock reads your rating and your season against the other players at your position, weighed by the defenses you faced',
        'Stats reflect the schedule: an SEC slate is tougher to throw on than a MAC one',
        'The Heisman race goes to the best players on the best teams, receivers included',
        'Bowl, playoff and Super Bowl names are bigger on the live game card',
        'Added College Football: spin a conference, then one of its starters',
        'QB, RB and WR, with every FBS team and its real 2026 players',
        'A full season with the AP Top 25, conference title games and the 12-team Playoff',
        'The season plays out live, game by game, like a football season',
        'Title games, Playoff games and bowls play out live on the scoreboard',
        'Heisman ceremony with the finalists and the vote count, position awards and All-Americans',
        'Draft stock after every season: a scouting report with the projected round and picks, what scouts like and question, and the board at the position',
        'After a season: enter the NFL Draft, return to school for another year, or transfer',
        'Enter the NFL Draft turns a college build into a Career, and the college draft stock sets where he goes in the draft',
        'Every trait drops a full letter grade on the jump to the NFL, except Size',
        'Sandbox works in College Football too',
      ],
    },
    {
      name: 'New Position: Linebacker',
      items: [
        'Added LB in Current and All-Time pools',
        'Nine ratings: Range, Size, Power, Tackling, Block Shed, Zone Instincts, Pass Rush, Play Recognition and Leadership',
        'Added LB to Squad Builder and Career',
        'All-Time LB legends now have their ESPN headshots',
        'New key moment: Zone Drop',
        'A season tracks tackles, TFLs, sacks, QB hits, passes defended and interceptions, with a DPOY race',
      ],
    },
    {
      name: 'New Position: Offensive Line',
      items: [
        'Added OL in Current and All-Time pools: tackles, guards and centers',
        'Nine ratings: Size, Length, Anchor, Pass Pro, Run Block, Mobility, Blitz Pickup, Discipline and Pancake',
        'Added OL to Squad Builder and Career',
        'OL has its own lineman figure on Home, the build screen and the season page',
        'New key moments: Pass Pro and Seal the Edge',
        'A season tracks sacks, pressures and QB hits allowed, penalties and pancakes, with an All-Pro team in place of an award',
      ],
    },
    {
      name: 'Career',
      items: [
        'Added Start in College for QB, RB and WR: pick from school offers, play a season or two, then enter the draft',
        'In college the build plays a full letter grade higher on every trait except Size',
        'Teams now rise and fall more over the years',
        'Team ratings now come from the roster, so a team\'s offense and defense match its unit grades, and every team has a coaching grade',
        'Contender, In the mix and Rebuilding now follow those ratings',
        'Hot streaks and cold stretches now always show in the stats, and they last 4 games (8 in basketball)',
        'RBs, WRs and TEs land on teams with a good quarterback and line more often',
        'New starters entering the league are now rated like today\'s starters, so the league no longer fills up with bad quarterbacks',
        'Football players can now sign record contracts when their play earns it',
        'Traits now close with age: physical traits first, then skills, and mental traits never',
        'A trait costs double in its last year or two before it closes',
        'Starting durability now comes from the player\'s frame, his weight for his height',
        'Height and weight now show in Career',
        'Durability no longer drops every season: most knocks heal over the offseason',
        'Change the jersey number after the draft or in any offseason',
        'The win chance shown in the playoffs is now the real chance',
        'Every basketball playoff series and every football playoff game now has a key moment',
        'A last-shot moment in a series now decides that game, not the whole series',
        'Football\'s last-play moments now only come up when the game is close at the end',
      ],
    },
    {
      name: 'Key Moments',
      items: [
        'Every football mini game now shows all 22 real players with their names and numbers',
        'Combine and training camp drills now play in an empty stadium',
        'Throwing Velocity has a new look: a radar board, a real net and target, and a QB who reacts to each throw',
        'Throwing games: receivers with strong hands and body control come down with more contested catches',
        'Linemen keep their feet and hands moving through the play',
        'After a touchdown, defenders no longer all strike the same pose at the same moment',
        'Player names on the field are drawn in the same retro pixels as the players',
        'Moment cards and mini game text now use the player\'s name',
      ],
    },
    {
      name: 'Home',
      items: [
        'Football positions are split into offense and defense: tap DEFENSE at the end of the bar',
        'Kicker is coming soon: it has a locked tab at the end of the defense',
        'Offense and defense: every position now has one player respin a spin (OL had two)',
        'Home on phones is less zoomed in: everything is a size down with more room between sections, and the logo fits on screen',
      ],
    },
    {
      name: 'Stats',
      items: [
        'WRs and TEs now have drops: in the season stat line, Career\'s season-by-season table and Career analytics, with drop rate',
        'Hands decides it: the surest hands drop one or two balls a year, the worst six or more',
        'Elite pass rushers are steadier: fewer games without a sack and more multi-sack games',
        'Elite WRs and TEs have far fewer near-empty games',
      ],
    },
    {
      name: 'Squad Builder',
      items: [
        'Added a Current / All-Time switch for football and basketball',
        'All-Time puts the builds on a franchise\'s legends',
      ],
    },
    {
      name: 'Profile and Shop',
      items: [
        'Four new avatars: No. 1 Fan, Underdog, Ankle Breaker and Play Caller',
        'Career and Squad Builder titles now count toward Rings on the profile',
      ],
    },
    {
      name: 'Rosters',
      items: [
        'Added Damar Hamlin to the Bills in place of C.J. Gardner-Johnson',
        'Added Mitchell Evans to the Panthers in place of Ja\'Tavion Sanders',
        'Moved Jessie Bates III to the Jaguars, and DeMarcco Hellams starts for the Falcons',
        'Moved Nique Clifford to the Thunder and Walter Clayton Jr. to the Mavericks',
        'Moved Jordan Davis and Davon Godchaux to the Jaguars, with DaVon Hamilton out on injured reserve',
        'Added Ty Robinson to the Eagles\' starting DTs and Christen Miller to the Saints\'',
        'Updated Ja\'Kobi Lane height and weight',
        'Rating updates for Amon-Ra St. Brown, Darren Waller, Tommy Tremble, Chuba Hubbard, Kyle Monangai, Nik Bonitto, Jonathon Cooper, Christian Watson and Foyesade Oluokun',
      ],
    },
    {
      name: 'Fixes',
      items: [
        'Fixed playoff games ending in a tie with no overtime',
        'Fixed the QB Super Bowl Performance box not matching the Super Bowl line in the game log',
        'The Super Bowl now reads "vs" in the game log, not "@"',
        'Fixed the highlight on the Season, Player, Team and Career tabs in Career sliding in from the bottom of the screen',
        'Fixed impossible football scores like 4 points',
        'Fixed teams scoring fewer points than the player\'s touchdowns',
        'Fixed the NBA Finals bracket showing the result before the games were played',
        'Fixed the playoff bracket showing the wrong opponent',
        'Fixed basketball standings sometimes being one win off',
        'Fixed the menu on the first season screen opening the final report',
        'Fixed signing out on the profile page opening an old screen',
        'Fixed the DB jersey number sitting too low on the final report',
        'Fixed DL trait names getting cut off on Home',
        'Fixed crossed lines on the build screen on smaller laptop screens',
        'Interception leaders now change from year to year like the real NFL',
      ],
    },
  ],
}
const NOV_7 = {
  id: '2026-11-07',
  date: 'NOV 7',
  fullDate: 'NOV 7, 2026',
  sections: [
    {
      name: 'New Key Moment: Get a Bucket',
      image: { src: '/patch/get-a-bucket.webp', alt: 'Get a Bucket: five on five in a packed arena, the ball handler at the top of the key with the stick and shoot buttons', w: 240, h: 520 },
      items: [
        'Added Get a Bucket for guards: five on five, one possession, score before the shot clock',
        'Move with the stick or the arrows',
        'Change sides to cross over, roll the stick to spin',
        'Same meter as Clutch Shot, and layups use it too',
        'The green gets smaller the deeper you shoot and bigger the more open you are',
        'Pass to an open teammate and he shoots it',
      ],
    },
    {
      name: 'Key Moments',
      items: [
        'Added Lockdown, Fast Break and Alley-Oop for basketball',
        'New retro pixel look for every Advanced mini game',
        'Turn it off with Retro mini games in settings',
        'Every Advanced mini game now shows a how to play clip',
        'First-person 40, 3/4 sprint and bench',
        'New look for the juke and tackle moments',
        'Playoff snow and rain now show up in football mini games',
        'Every combine drill now gets one redo, and the better run counts',
        'Alley-Oop is now two taps: jump, then throw it down',
        'Throwing moments: tap for a lob, hold for a bullet',
      ],
    },
    {
      name: 'Career',
      image: { src: '/patch/durability.webp', alt: 'The new Durability row under the traits, raised with development points', w: 320, h: 185 },
      items: [
        'Spend development points on Durability for fewer injuries and a longer career',
        'Durability now decides how often injuries happen',
        'Playing through an injury now costs durability',
        'More realistic injuries: concussions and most injuries never end a season',
        'Making the last play of a playoff game now always wins it',
        'Final scores now match what happened in the mini game',
        'DB careers now track targets, catches and passer rating allowed',
        'Added a passes defended record',
      ],
    },
    {
      name: 'Squad Builder',
      items: [
        'The season is now played as your team: your players on a real roster',
        'New season screen built around your team',
        'Picking your team now opens over the build page',
      ],
    },
    {
      name: 'Spin',
      items: [
        'On a team with two QBs, a respin now always gives you the other one',
        'The idle wheel spin is back on phones',
      ],
    },
    {
      name: 'Fixes',
      items: [
        'iPad now uses the phone layout and scrolls',
        'Fixed black boxes around some bottom ads',
        'Fixed bottom ads covering buttons',
        'Fixed cones shaking in the 3-cone drill',
        'Fixed Jump the Route calling a loss a big gain',
        'Fixed defenders celebrating plays they gave up',
        'Fixed two players wearing the same number',
        'Guest stats now carry over when you sign in',
      ],
    },
  ],
}
const NOV_5 = {
  id: '2026-11-05',
  date: 'NOV 5',
  fullDate: 'NOV 5, 2026',
  ratings: true,
  sections: [
    {
      name: 'New Position: Defensive Line',
      items: [
        'Added DL in Current and All-Time pools',
        'Added DL to Squad Builder and Career',
        'New key moments: Pass Rush and Stuff the Run',
      ],
    },
    {
      name: 'Combine',
      items: [
        'Rebuilt every combine drill',
        '40 and 3/4 sprint: alternate left and right as fast as you can',
        '40, sprint and bench results now depend on your position',
        'Your combine card now shows the time on the clock',
        'Added a skip combine button',
      ],
    },
    {
      name: 'Key Moments',
      image: { src: '/patch/bomb-it.webp', alt: 'Bomb It, rebuilt: a deep ball in the air over a real stadium field' },
      items: [
        'Rebuilt every key moment and camp drill',
        'Real players on both teams, with their numbers and names',
        'Two-Minute Drill is now a full drive',
        'New key moment: Fourth & Goal for QB, RB, WR and TE',
        'Added Practice in settings and on the key moments switch',
        'More positions can now get the same moments',
        'Moments now only show up in close playoff games and every Super Bowl and NBA Finals',
        'Landing a moment now usually wins the game',
      ],
    },
    {
      name: 'Ranks',
      items: [
        'Ranks replaces Hall in the dock',
        'Added online rating, Blacktop, top 20 Players of the Day and records for both sports',
        'Achievements and cards moved to your profile',
      ],
    },
    {
      name: 'Career',
      items: [
        'Added season by season stats',
        'New careers pick their mini games: Advanced, Simple or None',
        'Simple brings back the classic mini games',
        'Advanced is the new full-screen games, None simulates them from your grades',
        'Change it any time on the career screen',
        'Added position picker on new career',
        'Draft picks now follow team needs',
        'Career card now shows your player',
        'Share card now shows your all-time rank',
        'Team-colored confetti for winning a title',
        'Awards and Rookie of the Year now give a dev point, on top of All-Pro',
        'RBs no longer get an extra dev point',
      ],
    },
    {
      name: 'Profile and Cards',
      items: [
        'New card look with team colors, logo and jersey number',
        'New Cards panel on your profile with recent pulls and your closest set',
        'Completing a set now notifies you',
        'Fixed the set complete button',
        'Best Builds now split into Current and All-Time',
        'Removed spotlights',
      ],
    },
    {
      name: 'Sandbox',
      items: [
        'Added Starters Only: one wheel, starters only, no respins',
      ],
    },
    {
      name: 'Home',
      items: [
        'Home UI redesign',
        'New mode cards',
        'Coming back from a mode now keeps your spot',
        'Faster first load',
      ],
    },
    {
      name: 'Salary Cap and Depth Chart',
      items: [
        'New look for both',
        'Salary Cap seasons now use the full season screen',
      ],
    },
    {
      name: 'Coins',
      items: [
        'Players of the Day now pays 1,000 / 750 / 500 / 350 / 200 coins',
        'Weekly Cup now pays 5,000 / 2,000 / 1,000, then 500 for 4th to 10th',
        'Fixed a bug that could change your coins when a save didn\'t go through',
        'Boosts now cost 100 / 75 / 50 coins',
      ],
    },
    {
      name: 'XP',
      items: [
        'Seasons past 50 of the same mode in a day now give half XP',
      ],
    },
    {
      name: 'Rosters',
      items: [
        'Added Dillon Gabriel, Drew Allar, George Holani, Laquon Treadwell and Jalen Farmer',
        'Removed Joe Mixon, Darius Slayton, Kevin Porter Jr., Andy Dalton, Deshaun Watson, J.J. McCarthy, Mason Rudolph, Kayshon Boutte, Christian Haynes and Jake Haener',
        'Moved Joe Milton III to the Eagles and Jacoby Brissett to the Ravens',
        'Updated Onyeka Okongwu and Nate Ament height and weight',
      ],
    },
    {
      name: 'Fixes',
      items: [
        'Fixed Salary Cap and Depth Chart getting covered by the bottom ad',
        'Fixed Home button graying out',
        'Injuries now show up far less often in regular seasons',
      ],
    },
  ],
}
export const PATCH_NOTES = [NOV_10, NOV_7, NOV_5]
export const WHATS_NEW = PATCH_NOTES[0]
const KEY = 'bap_whatsnew'
export const whatsNewSeen = () => { try { return localStorage.getItem(KEY) === WHATS_NEW.id } catch { return true } }
export const markWhatsNewSeen = () => { try { localStorage.setItem(KEY, WHATS_NEW.id) } catch {} }
