// Achievements (app): long-term goals that pay XP and coins when claimed, and a
// few that unlock cosmetics you can't buy. Each reads one number from the
// player's lifetime stats (progress.js → achStats), so progress bars are free.

const A = (id, group, title, desc, glyph, metric, goal, xp, coins, item = null) => ({ id, group, title, desc, glyph, metric, goal, xp, coins, item })

export const ACHIEVEMENTS = [
  // Seasons
  A('season1',   'Seasons', 'Opening Day',         'Simulate your first season',             'football', 'seasons', 1,    30,   20),
  A('seasons10', 'Seasons', 'Ten Seasons Deep',    'Simulate 10 seasons',                    'clipboard','seasons', 10,   60,   40),
  A('seasons50', 'Seasons', 'Franchise Player',    'Simulate 50 seasons',                    'shield',   'seasons', 50,   180,  120),
  A('seasons200','Seasons', 'Ironman',             'Simulate 200 seasons',                   'medal',    'seasons', 200,  480,  320),
  A('wins100',   'Seasons', 'Century',             'Win 100 regular-season games',           'star',     'wins',    100,  120,  60),
  A('wins1000',  'Seasons', 'Thousand Wins',       'Win 1,000 regular-season games',         'star',     'wins',    1000, 480,  240),
  A('winning10', 'Seasons', 'Winning Culture',     'Post 10 winning seasons',                'podium',   'winning', 10,   120,  60),
  A('playoffs5', 'Seasons', 'January Football',    'Make the playoffs 5 times',              'target',   'playoffs',5,    90,   50),
  A('playoffs25','Seasons', 'Perennial Contender', 'Make the playoffs 25 times',             'target',   'playoffs',25,   240,  120),
  // Titles and awards
  A('ring1',     'Titles', 'Ring Bearer',          'Win a championship',                     'ring',     'rings',   1,    120,  80),
  A('rings5',    'Titles', 'Dynasty',              'Win 5 championships',                    'ring',     'rings',   5,    300,  160, 'av-dynasty'),
  A('rings20',   'Titles', 'Ring Collector',       'Win 20 championships',                   'trophy',   'rings',   20,   600,  400),
  A('award1',    'Titles', 'Hardware',             'Win a season award (MVP, OPOY, DPOY…)',   'medal',    'awards',  1,    90,   60),
  A('award10',   'Titles', 'Trophy Case',          'Win 10 season awards',                   'trophy',   'awards',  10,   300,  160),
  A('perfect',   'Titles', 'Perfection',           'Finish a regular season undefeated',     'shield',   'perfect', 1,    360,  200, 'pl-perfect'),
  // Builds
  A('ovr90',     'Builds', 'Elite Build',          'Play a season with a 90+ OVR build',     'bolt',     'ovr90',   1,    90,   60),
  A('ovr95',     'Builds', 'Generational Talent',  'Play a season with a 95+ OVR build',     'crown',    'ovr95',   1,    240,  160),
  A('fivetool',  'Builds', 'Five-Tool Star',       'Play a season at QB, RB, WR, TE and DB',  'helmet',   'positions', 5,  180,  120, 'nc-fivetool'),
  A('twosport',  'Builds', 'Two-Sport Star',       'Play a season in both sports',           'basketball','twoSport', 1,   90,   60),
  A('alltime10', 'Builds', 'History Buff',         'Play 10 All-Time seasons',               'crown',    'allTime', 10,   120,  60),
  // Cards
  A('cards50',   'Cards', 'Collector',             'Collect 50 player cards',                'clipboard','cards',   50,   60,   40),
  A('cards250',  'Cards', 'Binder Full',           'Collect 250 player cards',               'clipboard','cards',   250,  180,  100),
  A('cards1000', 'Cards', 'Archivist',             'Collect 1,000 player cards',             'trophy',   'cards',   1000, 480,  320),
  A('legend',    'Cards', 'Legend Pull',           'Pull a Legend card',                     'star',     'legends', 1,    90,   60),
  // Daily
  A('daily7',    'Daily', 'Daily Grind',           'Play 7 Daily Challenges',                'target',   'daily',   7,    150,  80),
  A('streak7',   'Daily', 'Locked In',             'Reach a 7-day login streak',             'flame',    'streak',  7,    120,  60),
  A('streak30',  'Daily', 'Every Single Day',      'Reach a 30-day login streak',            'flame',    'streak',  30,   480,  280),
  // Live modes
  A('bt1',       'Live', 'Blacktop Debut',         'Win a Blacktop game',                    'hoop',     'btWins',  1,    60,   40),
  A('bt25',      'Live', 'Blacktop King',          'Win 25 Blacktop games',                  'hoop',     'btWins',  25,   360,  200, 'pl-blacktop'),
  A('btmvp5',    'Live', 'Run MVP',                'Be the MVP of 5 Blacktop games',         'star',     'btMvp',   5,    180,  100),
  A('tkrun',     'Live', 'Road Warrior',           'Take every city on a Takeover road',     'versus',   'tkRuns',  1,    240,  160),
  A('tk25',      'Live', 'Frequent Flyer',         'Take 25 Takeover cities',                'versus',   'tkCities',25,   180,  100),
  A('dc10',      'Live', 'Depth Chart Pro',        'Hit a 10 streak in The Depth Chart',     'clipboard','dcBest',  10,   90,   50),
  A('dc25',      'Live', 'Depth Chart Savant',     'Hit a 25 streak in The Depth Chart',     'clipboard','dcBest',  25,   240,  120),
  // Online (Compete pools, Blacktop, 1v1 — see progress.js rateOnline)
  A('cp1',       'Online', 'Pool Party',           'Play a Compete pool',                    'podium',   'cpPlayed', 1,   50,   30),
  A('cp25',      'Online', 'Regular',              'Play 25 Compete pools',                  'podium',   'cpPlayed', 25,  180,  100),
  A('cpwin1',    'Online', 'Pool Shark',           'Win a Compete pool',                     'trophy',   'cpWins',   1,   90,   60),
  A('cpwin10',   'Online', 'Top of the Pool',      'Win 10 Compete pools',                   'trophy',   'cpWins',   10,  360,  200, 'nc-compete'),
  A('cppod10',   'Online', 'Podium Regular',       'Finish top 3 in 10 Compete pools',       'medal',    'cpPodiums',10,  180,  100),
  A('cpstreak3', 'Online', 'Hot Hand',             'Win 3 Compete pools in a row',           'flame',    'cpStreak', 3,   240,  140),
  A('cpbeat100', 'Online', 'Field Beater',         'Finish ahead of 100 Compete opponents',  'versus',   'cpBeaten', 100, 240,  120),
  A('h2h1',      'Online', 'First Blood',          'Win a Blacktop 1v1',                     'versus',   'h2hWins',  1,   60,   40),
  A('h2h25',     'Online', 'Duelist',              'Win 25 Blacktop 1v1s',                   'versus',   'h2hWins',  25,  360,  200),
  A('h2hstreak5','Online', 'Untouchable',          'Win 5 1v1s in a row',                    'flame',    'h2hStreak',5,   240,  140),
  A('btstreak5', 'Online', 'Court Royalty',        'Win 5 Blacktop games in a row',          'hoop',     'btStreak', 5,   240,  140),
  A('btpts100',  'Online', 'Bucket Getter',        'Score 100 career Blacktop points',       'hoop',     'btPts',    100, 150,  80),
  A('online10',  'Online', 'Regular on the Net',   'Play 10 online games',                   'podium',   'onlinePlayed', 10, 120, 60),
  A('allstar',   'Online', 'All-Star',             'Reach a 1,300 online rating',            'star',     'onlineBest', 1300, 300, 160, 'pl-allstar'),
  A('legendtier','Online', 'Legend',               'Reach a 1,750 online rating',            'crown',    'onlineBest', 1750, 900,  480, 'nfx-legend'),
  // Shop and level
  A('buy1',      'Locker', 'First Purchase',       'Buy your first item in the shop',        'coin',     'purchases', 1,  30,   20),
  A('own10',     'Locker', 'Closet Full',          'Own 10 shop items',                      'coin',     'owned',   10,   120,  80),
  A('own25',     'Locker', 'Collector\'s Edition', 'Own 25 shop items',                      'crown',    'owned',   25,   300,  160),
  A('fullfit',   'Locker', 'Fresh Fit',            'Wear a nameplate, name color and name effect at once', 'star', 'fullFit', 1, 60,  40),
  A('coins10k',  'Locker', 'Coin Hoarder',         'Earn 10,000 coins',                      'coin',     'coinsEarned', 10000, 300, 0),
  A('lvl10',     'Locker', 'Pro Bowler',           'Reach level 10',                         'medal',    'level',   10,   120,  80),
  A('lvl25',     'Locker', 'All-Pro Career',       'Reach level 25',                         'medal',    'level',   25,   300,  200),
  A('lvl50',     'Locker', 'Hall of Fame Career',  'Reach level 50',                         'trophy',   'level',   50,   900,  600),
]
export const ACH_GROUPS = ['Seasons', 'Titles', 'Builds', 'Cards', 'Daily', 'Live', 'Online', 'Locker']
export const achById = id => ACHIEVEMENTS.find(a => a.id === id) ?? null
