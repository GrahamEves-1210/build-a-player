// The patch notes (components/app/AppWhatsNew.jsx), newest first. A new update: add one at the top, with a new
// `id`, and it opens once for every returning player; the date menu goes back through the older ones.
// Only what's new against the live site. ratings: the Ratings tab (data/ratings-patch.js) belongs to that one
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
export const PATCH_NOTES = [NOV_7, NOV_5]
export const WHATS_NEW = PATCH_NOTES[0]
const KEY = 'bap_whatsnew'
export const whatsNewSeen = () => { try { return localStorage.getItem(KEY) === WHATS_NEW.id } catch { return true } }
export const markWhatsNewSeen = () => { try { localStorage.setItem(KEY, WHATS_NEW.id) } catch {} }
