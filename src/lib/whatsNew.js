// The patch notes (components/app/AppWhatsNew.jsx). A new update: change `id` and it opens once for
// every returning player. Only what's new against the live site. The Ratings tab: data/ratings-patch.js
export const WHATS_NEW = {
  id: '2026-11-05',
  date: 'NOV 5',
  fullDate: 'NOV 5, 2026',
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
const KEY = 'bap_whatsnew'
export const whatsNewSeen = () => { try { return localStorage.getItem(KEY) === WHATS_NEW.id } catch { return true } }
export const markWhatsNewSeen = () => { try { localStorage.setItem(KEY, WHATS_NEW.id) } catch {} }
