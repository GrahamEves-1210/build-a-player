// CAREER: what a beat writer knows about each NBA franchise (lib/careerPress.js writes the questions from it).
// The same rules as data/team-lore-nfl.js: real history, past tense, true however a career goes, nothing negative
// about a living person.
//
// A team:
//   town     how a writer says where: "in Boston", "in Golden State"
//   t        the years it won the championship (the year the Finals were played), the franchise's whole history:
//            a team keeps its titles when it moves (Seattle's 1979 title is Oklahoma City's, memory: OKC/MEM history)
//   mark     one sentence: what the franchise is known for
//   ache     one sentence: the loss its fans still bring up
//   rivals   { SHORT: one sentence about the rivalry }
//   g        the greats: guard (point guards and shooting guards), wing (small forwards), big (power forwards and
//            centers). A build is asked about the men who played his spot. L(name, did, x) as in the NFL file:
//              n / ret  his number, and whether it hangs in the rafters      on   said while he is on the roster
//              dr       how he got here                                     rings  titles won with this team
//   rec      the franchise's career scoring leader, [name, points], only where he is retired or long gone and nobody
//            now on the team is within reach (basketball-reference.com franchise pages, through 2025-26)
const L = (name, did, x = {}) => ({ name, did, ...x })

export const NBA_LORE = {
  ATL: {
    town: 'Atlanta', t: [1958],
    mark: 'The Hawks won the 1958 championship in St. Louis, with Bob Pettit scoring 50 points in the clinching game.',
    ache: 'The 2015 Hawks won 60 games and were swept in the conference finals.',
    rivals: { BOS: 'Dominique Wilkins and Larry Bird traded baskets through the fourth quarter of Game 7 in 1988, and the Celtics won by two.' },
    g: {
      guard: [L('Pete Maravich', 'averaged 27.7 points a game for the Hawks in 1973-74', { n: 44, ret: true }), L('Lou Hudson', 'made six straight All-Star teams as a Hawk', { n: 23, ret: true })],
      wing: [L('Dominique Wilkins', 'won a scoring title and two Slam Dunk Contests here', { n: 21, ret: true })],
      big: [L('Bob Pettit', 'was the league\'s first MVP', { n: 9, ret: true, rings: 1 }), L('Dikembe Mutombo', 'was the Defensive Player of the Year twice in Atlanta', { n: 55, ret: true })],
    },
    rec: { pts: ['Dominique Wilkins', 23292] },
  },
  BOS: {
    town: 'Boston', t: [1957, 1959, 1960, 1961, 1962, 1963, 1964, 1965, 1966, 1968, 1969, 1974, 1976, 1981, 1984, 1986, 2008, 2024],
    mark: 'The Celtics won 11 championships in 13 seasons with Bill Russell at center.',
    ache: 'The Celtics led the 2010 Finals three games to two and lost Game 7 in Los Angeles.',
    rivals: {
      LAL: 'Celtics and Lakers met in the Finals 12 times between 1959 and 2010.',
      PHI: 'Celtics and 76ers have played more playoff series against each other than any two teams in the league.',
      NYK: 'Celtics and Knicks are the two franchises that have played in the same city since the league\'s first season in 1946.',
    },
    g: {
      guard: [L('Bob Cousy', 'led the league in assists eight years in a row', { n: 14, ret: true, rings: 6 }), L('Sam Jones', 'won ten championships', { n: 24, ret: true, rings: 10 })],
      wing: [L('Larry Bird', 'won three straight MVP awards', { n: 33, ret: true, rings: 3 }), L('Paul Pierce', 'was the MVP of the 2008 Finals', { n: 34, ret: true, rings: 1 }), L('John Havlicek', 'won eight championships', { n: 17, ret: true, rings: 8 })],
      big: [L('Bill Russell', 'won 11 championships in 13 seasons', { n: 6, ret: true, rings: 11 }), L('Kevin Garnett', 'was the Defensive Player of the Year in 2008', { n: 5, ret: true, rings: 1 }), L('Dave Cowens', 'was the league MVP in 1973', { n: 18, ret: true, rings: 2 })],
    },
    rec: { pts: ['John Havlicek', 26395] },
  },
  BKN: {
    town: 'Brooklyn', t: [],
    mark: 'The Nets won two ABA championships with Julius Erving before they joined the NBA in 1976.',
    ache: 'The Nets reached the Finals in 2002 and 2003 and lost both.',
    rivals: { NYK: 'Nets and Knicks share a city, and have since the Nets moved to Brooklyn in 2012.' },
    g: {
      guard: [L('Jason Kidd', 'took the Nets to back-to-back Finals', { n: 5, ret: true }), L('Vince Carter', 'averaged more than 23 points a game in five seasons with the Nets', { n: 15, ret: true })],
      wing: [L('Julius Erving', 'won two ABA championships and three ABA MVP awards with the Nets', { n: 32, ret: true })],
      big: [L('Buck Williams', 'pulled down more than 7,500 rebounds for the Nets', { n: 52, ret: true })],
    },
    rec: { pts: ['Brook Lopez', 10444] },
  },
  CHA: {
    town: 'Charlotte', t: [],
    mark: 'The original Hornets led the league in attendance in 1988-89, their first season.',
    ache: 'Charlotte won seven of 66 games in 2011-12.',
    rivals: {},
    g: {
      guard: [L('Kemba Walker', 'made three All-Star teams here'), L('Muggsy Bogues', 'ran the point here for ten seasons at 5-foot-3'), L('Dell Curry', 'was the Sixth Man of the Year in 1994')],
      wing: [L('Glen Rice', 'was the MVP of the 1997 All-Star Game'), L('Gerald Wallace', 'made the All-Star team in 2010')],
      big: [L('Larry Johnson', 'was the Rookie of the Year in 1992', { dr: 'with the first pick in 1991' }), L('Alonzo Mourning', 'hit the shot that won Charlotte its first playoff series, in 1993')],
    },
    rec: { pts: ['Kemba Walker', 12009] },
  },
  CHI: {
    town: 'Chicago', t: [1991, 1992, 1993, 1996, 1997, 1998],
    mark: 'The Bulls reached the Finals six times in the 1990s and won all six.',
    ache: 'The 2011 Bulls had the league\'s best record and its MVP, and lost the conference finals in five games.',
    rivals: {
      DET: 'The Pistons knocked the Bulls out of the playoffs three years in a row before Chicago swept them in 1991.',
      NYK: 'Bulls and Knicks met in the playoffs six times between 1989 and 1996.',
    },
    g: {
      guard: [L('Michael Jordan', 'won six championships and six Finals MVP awards', { n: 23, ret: true, rings: 6 }), L('Derrick Rose', 'was the league MVP in 2011 at age 22', { n: 1, dr: 'with the first pick in 2008' })],
      wing: [L('Scottie Pippen', 'won six championships and made eight All-Defensive first teams', { n: 33, ret: true, rings: 6 })],
      big: [L('Dennis Rodman', 'led the league in rebounding in all three of his seasons here', { rings: 3 }), L('Joakim Noah', 'was the Defensive Player of the Year in 2014'), L('Artis Gilmore', 'made four All-Star teams as a Bull')],
    },
    rec: { pts: ['Michael Jordan', 29277] },
  },
  CLE: {
    town: 'Cleveland', t: [2016],
    mark: 'The 2016 Cavaliers came back from three games to one down in the Finals. No team had done that before.',
    ache: 'The Cavaliers lost a 1989 playoff series on a jumper at the buzzer by Michael Jordan.',
    rivals: {
      GSW: 'Cavaliers and Warriors met in the Finals four years in a row, from 2015 through 2018.',
      BOS: 'Cavaliers and Celtics met in the conference finals in 2017 and 2018.',
    },
    g: {
      guard: [L('Mark Price', 'shot better than 90 percent from the line for his career', { n: 25, ret: true }), L('Kyrie Irving', 'hit the three that won Game 7 of the 2016 Finals', { rings: 1, dr: 'with the first pick in 2011' }), L('Donovan Mitchell', 'scored 71 points in a game in 2023', { n: 45, on: 'scored 71 points in a game here in 2023' })],
      wing: [L('LeBron James', 'won the 2016 championship and was the Finals MVP', { n: 23, rings: 1, dr: 'with the first pick in 2003' })],
      big: [L('Brad Daugherty', 'made five All-Star teams', { n: 43, ret: true, dr: 'with the first pick in 1986' }), L('Zydrunas Ilgauskas', 'played 12 seasons at center for the Cavaliers', { n: 11, ret: true })],
    },
    rec: { pts: ['LeBron James', 23119] },
  },
  DAL: {
    town: 'Dallas', t: [2011],
    mark: 'The Mavericks won the 2011 championship over a Miami team that had beaten them in the Finals five years earlier.',
    ache: 'The Mavericks won 67 games in 2007 and lost in the first round to the eighth seed.',
    rivals: {
      SAS: 'Mavericks and Spurs met in the playoffs six times while Dirk Nowitzki and Tim Duncan were playing.',
      HOU: 'Mavericks and Rockets have shared Texas since Dallas came into the league in 1980.',
    },
    g: {
      guard: [L('Rolando Blackman', 'made four All-Star teams', { n: 22, ret: true }), L('Jason Kidd', 'ran the point for the 2011 champions', { rings: 1 }), L('Luka Doncic', 'took the Mavericks to the 2024 Finals')],
      wing: [L('Mark Aguirre', 'averaged 29.5 points a game in 1983-84', { dr: 'with the first pick in 1981' }), L('Michael Finley', 'made two All-Star teams as a Maverick')],
      big: [L('Dirk Nowitzki', 'played 21 seasons, every one for the Mavericks, and was the MVP of the 2011 Finals', { n: 41, ret: true, rings: 1 })],
    },
    rec: { pts: ['Dirk Nowitzki', 31560] },
  },
  DEN: {
    town: 'Denver', t: [2023],
    mark: 'The Nuggets won their first championship in 2023, their 47th season in the NBA.',
    ache: 'The Nuggets led Minnesota by 20 points at home in Game 7 in 2024 and lost.',
    rivals: {
      LAL: 'The Lakers ended Denver\'s season in the conference finals in 1985, 2009 and 2020 before the Nuggets swept them in 2023.',
      MIN: 'Nuggets and Timberwolves went seven games in the 2024 playoffs, and the road team won Game 7.',
    },
    g: {
      guard: [L('David Thompson', 'scored 73 points on the last day of the 1977-78 season', { n: 33, ret: true }), L('Jamal Murray', 'averaged 26 points a game in the 2023 title run', { n: 27, rings: 1, on: 'averaged 26 points a game in the 2023 title run here' })],
      wing: [L('Alex English', 'scored more points in the 1980s than any player in the league', { n: 2, ret: true }), L('Carmelo Anthony', 'took the Nuggets to the 2009 conference finals', { n: 15 })],
      big: [L('Nikola Jokic', 'won three MVP awards and the 2023 Finals MVP', { n: 15, rings: 1, on: 'has won three MVP awards and a championship here' }), L('Dikembe Mutombo', 'was the Defensive Player of the Year in 1995', { n: 55, ret: true }), L('Dan Issel', 'scored more than 16,000 points for the Nuggets', { n: 44, ret: true })],
    },
    rec: {},
  },
  DET: {
    town: 'Detroit', t: [1989, 1990, 2004],
    mark: 'The Pistons won back-to-back titles in 1989 and 1990 as the Bad Boys, and another in 2004 with five starters and no superstar.',
    ache: 'The Pistons were one inbounds pass from a three-games-to-two lead in the 1987 conference finals when Larry Bird stole it.',
    rivals: {
      CHI: 'The Pistons knocked the Bulls out of the playoffs three years in a row before Chicago swept them in 1991.',
      BOS: 'Pistons and Celtics met in the conference finals in 1987 and 1988, and each won one.',
    },
    g: {
      guard: [L('Isiah Thomas', 'won two championships and was the MVP of the 1990 Finals', { n: 11, ret: true, rings: 2 }), L('Joe Dumars', 'was the MVP of the 1989 Finals', { n: 4, ret: true, rings: 2 }), L('Dave Bing', 'won the scoring title in 1968', { n: 21, ret: true })],
      wing: [L('Grant Hill', 'shared the Rookie of the Year award in 1995'), L('Tayshaun Prince', 'made the chase-down block in the 2004 conference finals', { rings: 1 })],
      big: [L('Ben Wallace', 'was the Defensive Player of the Year four times', { n: 3, ret: true, rings: 1 }), L('Bob Lanier', 'made seven All-Star teams as a Piston', { n: 16, ret: true }), L('Dennis Rodman', 'was the Defensive Player of the Year twice here', { n: 10, ret: true, rings: 2 })],
    },
    rec: { pts: ['Isiah Thomas', 18822] },
  },
  GSW: {
    town: 'Golden State', t: [1947, 1956, 1975, 2015, 2017, 2018, 2022],
    mark: 'The Warriors won four championships in eight seasons, from 2015 through 2022.',
    ache: 'The 2016 Warriors won a record 73 games and lost the Finals after leading three games to one.',
    rivals: {
      CLE: 'Warriors and Cavaliers met in the Finals four years in a row, from 2015 through 2018.',
      LAL: 'Warriors and Lakers have shared California since the Warriors moved west in 1962.',
    },
    g: {
      guard: [L('Stephen Curry', 'won four championships and two MVP awards here', { n: 30, rings: 4, on: 'has won four championships and two MVP awards here' }), L('Klay Thompson', 'scored 37 points in one quarter in 2015', { n: 11, rings: 4 })],
      wing: [L('Rick Barry', 'was the MVP of the 1975 Finals', { n: 24, ret: true, rings: 1 }), L('Chris Mullin', 'made five straight All-Star teams', { n: 17, ret: true }), L('Kevin Durant', 'was the Finals MVP in 2017 and 2018', { rings: 2 })],
      big: [L('Wilt Chamberlain', 'scored 100 points in a game in 1962', { n: 13, ret: true }), L('Nate Thurmond', 'made seven All-Star teams as a Warrior', { n: 42, ret: true }), L('Draymond Green', 'was the Defensive Player of the Year in 2017 and won four championships', { n: 23, rings: 4, on: 'has won four championships here' })],
    },
    rec: {},
  },
  HOU: {
    town: 'Houston', t: [1994, 1995],
    mark: 'The Rockets won back-to-back titles in 1994 and 1995, the second one as a sixth seed.',
    ache: 'The 2018 Rockets won 65 games and missed 27 straight threes in Game 7 of the conference finals.',
    rivals: {
      SAS: 'Rockets and Spurs have shared Texas since the 1970s.',
      UTA: 'The Jazz ended Houston\'s season in the conference finals in 1997 on a three at the buzzer.',
      DAL: 'Rockets and Mavericks have shared Texas since 1980.',
    },
    g: {
      guard: [L('James Harden', 'was the league MVP in 2018', { n: 13 }), L('Calvin Murphy', 'stood 5-foot-9 and is in the Hall of Fame', { n: 23, ret: true }), L('Clyde Drexler', 'came home to Houston and won the 1995 title', { n: 22, ret: true, rings: 1 })],
      wing: [L('Rudy Tomjanovich', 'made five All-Star teams as a player and coached both championship teams', { n: 45, ret: true }), L('Tracy McGrady', 'scored 13 points in 33 seconds to beat the Spurs in 2004')],
      big: [L('Hakeem Olajuwon', 'was the MVP of both Finals and the league MVP in 1994', { n: 34, ret: true, rings: 2, dr: 'with the first pick in 1984' }), L('Moses Malone', 'won two MVP awards as a Rocket', { n: 24, ret: true }), L('Yao Ming', 'made eight All-Star teams', { n: 11, ret: true, dr: 'with the first pick in 2002' })],
    },
    rec: { pts: ['Hakeem Olajuwon', 26511] },
  },
  IND: {
    town: 'Indiana', t: [],
    mark: 'The Pacers won three ABA championships before they joined the NBA in 1976.',
    ache: 'The Pacers lost Game 7 of the 2025 Finals in Oklahoma City.',
    rivals: {
      NYK: 'Pacers and Knicks met in the playoffs six times in eight years in the 1990s.',
      DET: 'Pacers and Pistons met in the conference finals in 2004 and the second round in 2005.',
    },
    g: {
      guard: [L('Reggie Miller', 'scored eight points in 8.9 seconds to beat the Knicks in 1995', { n: 31, ret: true }), L('Tyrese Haliburton', 'took the Pacers to the 2025 Finals', { n: 0, on: 'took this team to the 2025 Finals' })],
      wing: [L('Paul George', 'made four All-Star teams here'), L('Roger Brown', 'was the MVP of the 1970 ABA playoffs', { n: 35, ret: true })],
      big: [L('Jermaine O\'Neal', 'made six straight All-Star teams'), L('Rik Smits', 'played all 12 of his seasons for the Pacers'), L('Mel Daniels', 'won two ABA MVP awards', { n: 34, ret: true })],
    },
    rec: { pts: ['Reggie Miller', 25279] },
  },
  LAC: {
    town: 'Los Angeles', t: [],
    mark: 'The Clippers began as the Buffalo Braves in 1970 and moved twice before they reached Los Angeles in 1984.',
    ache: 'The Clippers led Houston three games to one in 2015 and Denver three games to one in 2020, and lost both series.',
    rivals: { LAL: 'Clippers and Lakers shared an arena for 25 seasons.' },
    g: {
      guard: [L('Chris Paul', 'led the league in assists twice as a Clipper', { n: 3 }), L('Randy Smith', 'played 906 games in a row, most of them for this franchise')],
      wing: [L('Danny Manning', 'made two All-Star teams here', { dr: 'with the first pick in 1988' })],
      big: [L('Blake Griffin', 'was the Rookie of the Year in 2011 and made five All-Star teams here', { n: 32, dr: 'with the first pick in 2009' }), L('Bob McAdoo', 'won three straight scoring titles and the 1975 MVP award in Buffalo'), L('DeAndre Jordan', 'led the league in rebounding twice')],
    },
    rec: { pts: ['Randy Smith', 12735] },
  },
  LAL: {
    town: 'Los Angeles', t: [1949, 1950, 1952, 1953, 1954, 1972, 1980, 1982, 1985, 1987, 1988, 2000, 2001, 2002, 2009, 2010, 2020],
    mark: 'The Lakers won five championships in the 1980s and five more between 2000 and 2010.',
    ache: 'The Lakers lost the Finals to Boston eight times before they beat the Celtics in 1985.',
    rivals: {
      BOS: 'Lakers and Celtics met in the Finals 12 times between 1959 and 2010.',
      LAC: 'Lakers and Clippers shared an arena for 25 seasons.',
      SAC: 'Lakers and Kings went seven games in the 2002 conference finals, and Game 7 went to overtime.',
      SAS: 'Lakers and Spurs won nine of the 12 championships between 1999 and 2010.',
    },
    g: {
      guard: [L('Magic Johnson', 'won five championships and three MVP awards', { n: 32, ret: true, rings: 5, dr: 'with the first pick in 1979' }), L('Kobe Bryant', 'won five championships and scored 81 points in a game', { n: 24, ret: true, rings: 5 }), L('Jerry West', 'was the Finals MVP in 1969 on the losing team', { n: 44, ret: true, rings: 1 })],
      wing: [L('Elgin Baylor', 'scored 61 points in a Finals game in 1962', { n: 22, ret: true }), L('James Worthy', 'was the MVP of the 1988 Finals', { n: 42, ret: true, rings: 3, dr: 'with the first pick in 1982' }), L('LeBron James', 'won the 2020 championship and became the league\'s all-time leading scorer in a Lakers uniform', { n: 23, rings: 1, on: 'has won a championship and become the league\'s all-time leading scorer here' })],
      big: [L('Kareem Abdul-Jabbar', 'won five championships and three MVP awards as a Laker', { n: 33, ret: true, rings: 5 }), L('Shaquille O\'Neal', 'was the Finals MVP three years in a row', { n: 34, ret: true, rings: 3 }), L('George Mikan', 'won five championships in Minneapolis', { n: 99, ret: true, rings: 5 }), L('Pau Gasol', 'won two championships here', { n: 16, ret: true, rings: 2 })],
    },
    rec: { pts: ['Kobe Bryant', 33643] },
  },
  MEM: {
    town: 'Memphis', t: [],
    mark: 'The Grizzlies started in Vancouver in 1995 and moved to Memphis in 2001.',
    ache: 'The Grizzlies reached the 2013 conference finals and were swept by San Antonio.',
    rivals: { SAS: 'The Grizzlies beat the top-seeded Spurs as an eighth seed in 2011, the first playoff series win in franchise history.' },
    g: {
      guard: [L('Mike Conley', 'played his first 12 seasons here', { n: 11 }), L('Tony Allen', 'made six All-Defensive teams as a Grizzly', { n: 9, ret: true }), L('Ja Morant', 'was the Rookie of the Year in 2020', { n: 12, on: 'was the Rookie of the Year here in 2020' })],
      wing: [L('Mike Miller', 'was the Sixth Man of the Year in 2006'), L('Shane Battier', 'was the sixth pick of the 2001 draft, the first of the Memphis years')],
      big: [L('Marc Gasol', 'was the Defensive Player of the Year in 2013', { n: 33, ret: true }), L('Zach Randolph', 'made two All-Star teams here', { n: 50, ret: true }), L('Pau Gasol', 'was the Rookie of the Year in 2002')],
    },
    rec: {},
  },
  MIA: {
    town: 'Miami', t: [2006, 2012, 2013],
    mark: 'The Heat reached the Finals four years in a row, from 2011 through 2014, and won two of them.',
    ache: 'The Heat lost the 2011 Finals to Dallas after leading two games to one.',
    rivals: {
      NYK: 'Heat and Knicks met in the playoffs four years in a row, from 1997 through 2000, and every series went the distance.',
      BOS: 'Heat and Celtics met in the conference finals in 2012, 2020, 2022 and 2023.',
      ORL: 'Heat and Magic have shared Florida since Orlando came into the league in 1989.',
    },
    g: {
      guard: [L('Dwyane Wade', 'won three championships and was the MVP of the 2006 Finals', { n: 3, ret: true, rings: 3 }), L('Tim Hardaway', 'made the All-NBA first team in 1997', { n: 10, ret: true })],
      wing: [L('LeBron James', 'won two championships and two MVP awards in four seasons here', { n: 6, rings: 2 }), L('Jimmy Butler', 'took the Heat to the Finals in 2020 and 2023')],
      big: [L('Alonzo Mourning', 'was the Defensive Player of the Year twice', { n: 33, ret: true, rings: 1 }), L('Chris Bosh', 'won two championships here', { n: 1, ret: true, rings: 2 }), L('Udonis Haslem', 'played 20 seasons, every one for the Heat', { n: 40, ret: true, rings: 3 }), L('Shaquille O\'Neal', 'won the 2006 championship here', { n: 32, ret: true, rings: 1 })],
    },
    rec: { pts: ['Dwyane Wade', 21556] },
  },
  MIL: {
    town: 'Milwaukee', t: [1971, 2021],
    mark: 'The Bucks won a championship in 1971, their third season, with Kareem Abdul-Jabbar and Oscar Robertson.',
    ache: 'The Bucks lost Game 7 of the 1974 Finals at home to Boston.',
    rivals: {
      BOS: 'Bucks and Celtics went seven games in the 1974 Finals.',
      CHI: 'Bucks and Bulls play 90 miles apart, up and down Interstate 94.',
    },
    g: {
      guard: [L('Oscar Robertson', 'won a championship here in 1971', { n: 1, ret: true, rings: 1 }), L('Sidney Moncrief', 'was the league\'s first Defensive Player of the Year, and won it twice', { n: 4, ret: true }), L('Ray Allen', 'made three All-Star teams as a Buck')],
      wing: [L('Marques Johnson', 'made four All-Star teams as a Buck', { n: 8, ret: true }), L('Khris Middleton', 'made three All-Star teams and won the 2021 title', { rings: 1 })],
      big: [L('Kareem Abdul-Jabbar', 'won three MVP awards in six seasons as a Buck', { n: 33, ret: true, rings: 1, dr: 'with the first pick in 1969' }), L('Giannis Antetokounmpo', 'won two MVP awards and scored 50 points in the game that clinched the 2021 title', { n: 34, rings: 1, on: 'has won two MVP awards and a championship here' })],
    },
    rec: {},
  },
  MIN: {
    town: 'Minnesota', t: [],
    mark: 'Kevin Garnett went from high school to the Timberwolves in 1995 and was the league MVP nine years later.',
    ache: 'The Timberwolves lost in the first round seven years in a row, from 1997 through 2003.',
    rivals: { DEN: 'Timberwolves and Nuggets went seven games in the 2024 playoffs, and Minnesota won Game 7 on the road after trailing by 20.' },
    g: {
      guard: [L('Anthony Edwards', 'took the Timberwolves to back-to-back conference finals in 2024 and 2025', { n: 5, on: 'took this team to back-to-back conference finals in 2024 and 2025', dr: 'with the first pick in 2020' }), L('Sam Cassell', 'made the All-Star team in 2004, the year Minnesota reached the conference finals')],
      wing: [L('Wally Szczerbiak', 'made the All-Star team in 2002')],
      big: [L('Kevin Garnett', 'was the league MVP in 2004', { n: 21 }), L('Karl-Anthony Towns', 'was the Rookie of the Year in 2016', { dr: 'with the first pick in 2015' }), L('Kevin Love', 'had 31 points and 31 rebounds in one game in 2010')],
    },
    rec: {},
  },
  NOP: {
    town: 'New Orleans', t: [],
    mark: 'This franchise came to New Orleans in 2002 and has been the Pelicans since 2013.',
    ache: 'New Orleans took the defending champion Spurs to seven games in 2008 and lost Game 7 at home.',
    rivals: {},
    g: {
      guard: [L('Chris Paul', 'led the league in assists and steals in back-to-back seasons here'), L('Pete Maravich', 'won the 1977 scoring title playing in New Orleans', { n: 7, ret: true }), L('Jrue Holiday', 'made two All-Defensive teams as a Pelican')],
      wing: [L('Brandon Ingram', 'was the Most Improved Player in 2020')],
      big: [L('Anthony Davis', 'led the league in blocks three times as a Pelican', { dr: 'with the first pick in 2012' }), L('David West', 'made two All-Star teams here')],
    },
    rec: {},
  },
  NYK: {
    town: 'New York', t: [1970, 1973, 2026],
    mark: 'Willis Reed walked out of the tunnel before Game 7 of the 1970 Finals, and the Knicks won their first championship that night.',
    ache: 'The Knicks lost Game 7 of the 1994 Finals in Houston.',
    rivals: {
      BKN: 'Knicks and Nets share a city, and have since the Nets moved to Brooklyn in 2012.',
      MIA: 'Knicks and Heat met in the playoffs four years in a row, from 1997 through 2000, and every series went the distance.',
      IND: 'Knicks and Pacers met in the playoffs six times in eight years in the 1990s.',
      BOS: 'Knicks and Celtics are the two franchises that have played in the same city since the league\'s first season in 1946.',
      CHI: 'Knicks and Bulls met in the playoffs six times between 1989 and 1996.',
    },
    g: {
      guard: [L('Walt Frazier', 'had 36 points and 19 assists in Game 7 of the 1970 Finals', { n: 10, ret: true, rings: 2 }), L('Jalen Brunson', 'scored 45 points in the game that clinched the 2026 title and was the Finals MVP', { n: 11, rings: 1, on: 'has been a Finals MVP here' }), L('Earl Monroe', 'won the 1973 title in the Knicks backcourt', { n: 15, ret: true, rings: 1 })],
      wing: [L('Bill Bradley', 'won two championships here and later served in the United States Senate', { n: 24, ret: true, rings: 2 }), L('Bernard King', 'won the 1985 scoring title'), L('Carmelo Anthony', 'won the 2013 scoring title', { n: 7 })],
      big: [L('Willis Reed', 'was the Finals MVP in 1970 and 1973', { n: 19, ret: true, rings: 2 }), L('Patrick Ewing', 'made 11 All-Star teams as a Knick', { n: 33, ret: true, dr: 'with the first pick in 1985' })],
    },
    rec: { pts: ['Patrick Ewing', 23665] },
  },
  OKC: {
    town: 'Oklahoma City', t: [1979, 2025],
    mark: 'The Thunder won 68 games and the 2025 championship with one of the youngest teams ever to win it.',
    ache: 'The Thunder led Golden State three games to one in the 2016 conference finals and lost.',
    rivals: {
      GSW: 'Kevin Durant left Oklahoma City for Golden State in 2016, weeks after the Warriors beat the Thunder in the conference finals.',
      SAS: 'Thunder and Spurs met in the conference finals in 2012 and 2014, and each won one.',
    },
    g: {
      guard: [L('Russell Westbrook', 'averaged a triple-double and was the league MVP in 2017', { n: 0 }), L('Shai Gilgeous-Alexander', 'was the league MVP and the Finals MVP in 2025', { n: 2, rings: 1, on: 'has won an MVP award and a championship here' }), L('Gary Payton', 'was the Defensive Player of the Year in 1996, when this franchise played in Seattle')],
      wing: [L('Kevin Durant', 'won four scoring titles and the 2014 MVP award here', { n: 35 })],
      big: [L('Shawn Kemp', 'made five straight All-Star teams when this franchise played in Seattle'), L('Jack Sikma', 'made seven straight All-Star teams and won the 1979 title in Seattle', { rings: 1 }), L('Nick Collison', 'spent his whole 15-year career with this franchise', { n: 4, ret: true }), L('Serge Ibaka', 'led the league in blocks twice')],
    },
    rec: {},
  },
  ORL: {
    town: 'Orlando', t: [],
    mark: 'The Magic reached the Finals in 1995, their sixth season, with Shaquille O\'Neal and Penny Hardaway.',
    ache: 'The Magic missed four free throws in the final seconds of Game 1 of the 1995 Finals and were swept.',
    rivals: { MIA: 'Magic and Heat have shared Florida since Orlando came into the league in 1989.' },
    g: {
      guard: [L('Penny Hardaway', 'made the All-NBA first team twice by age 24', { n: 1 }), L('Tracy McGrady', 'won back-to-back scoring titles here', { n: 1 })],
      wing: [L('Hedo Turkoglu', 'was the Most Improved Player in 2008'), L('Grant Hill', 'made the All-Star team here in 2005')],
      big: [L('Shaquille O\'Neal', 'was the Rookie of the Year in 1993', { n: 32, ret: true, dr: 'with the first pick in 1992' }), L('Dwight Howard', 'was the Defensive Player of the Year three years in a row', { n: 12, dr: 'with the first pick in 2004' })],
    },
    rec: {},
  },
  PHI: {
    town: 'Philadelphia', t: [1955, 1967, 1983],
    mark: 'The 1967 76ers won 68 games and ended Boston\'s run of eight straight titles.',
    ache: 'The 76ers lost Game 7 in Toronto in 2019 on a shot at the buzzer that bounced on the rim four times.',
    rivals: {
      BOS: '76ers and Celtics have played more playoff series against each other than any two teams in the league.',
      NYK: '76ers and Knicks play 95 miles apart, and met in the first round in 2024.',
    },
    g: {
      guard: [L('Allen Iverson', 'was the league MVP in 2001 and won four scoring titles', { n: 3, ret: true, dr: 'with the first pick in 1996' }), L('Hal Greer', 'made ten straight All-Star teams', { n: 15, ret: true, rings: 1 }), L('Maurice Cheeks', 'ran the point for the 1983 champions', { n: 10, ret: true, rings: 1 })],
      wing: [L('Julius Erving', 'was the league MVP in 1981 and won the 1983 title', { n: 6, ret: true, rings: 1 }), L('Andre Iguodala', 'made the All-Star team here in 2012')],
      big: [L('Wilt Chamberlain', 'was the league MVP three years in a row here', { n: 13, ret: true, rings: 1 }), L('Moses Malone', 'was the MVP of the league and of the Finals in 1983', { n: 2, ret: true, rings: 1 }), L('Charles Barkley', 'led the league in rebounding in 1987 at 6-foot-6', { n: 34, ret: true }), L('Joel Embiid', 'was the league MVP in 2023 and won two scoring titles', { n: 21, on: 'has won an MVP award and two scoring titles here' })],
    },
    rec: {},
  },
  PHX: {
    town: 'Phoenix', t: [],
    mark: 'The Suns reached the Finals in 1976, 1993 and 2021, and each one went six games.',
    ache: 'The Suns lost a coin flip for the first pick of the 1969 draft, and with it the chance to draft Kareem Abdul-Jabbar.',
    rivals: {
      SAS: 'The Spurs ended Phoenix\'s season in 2003, 2005, 2007 and 2008.',
      LAL: 'The Suns beat the Lakers in the first round in 2006 and 2007, and the Lakers beat them in the 2010 conference finals.',
    },
    g: {
      guard: [L('Steve Nash', 'won back-to-back MVP awards', { n: 13, ret: true }), L('Kevin Johnson', 'made three All-Star teams as a Sun', { n: 7, ret: true }), L('Devin Booker', 'scored 70 points in a game in 2017', { n: 1, on: 'scored 70 points in a game here in 2017' })],
      wing: [L('Shawn Marion', 'made four All-Star teams', { n: 31, ret: true }), L('Walter Davis', 'was the Rookie of the Year in 1978', { n: 6, ret: true })],
      big: [L('Charles Barkley', 'was the league MVP in 1993', { n: 34, ret: true }), L('Amar\'e Stoudemire', 'was the Rookie of the Year in 2003', { n: 32, ret: true }), L('Alvan Adams', 'was the Rookie of the Year in 1976', { n: 33, ret: true })],
    },
    rec: {},
  },
  POR: {
    town: 'Portland', t: [1977],
    mark: 'The Trail Blazers won the 1977 championship in their first trip to the playoffs.',
    ache: 'The Trail Blazers led the Lakers by 15 points in the fourth quarter of Game 7 of the 2000 conference finals and lost.',
    rivals: { LAL: 'The Lakers ended Portland\'s season in 1991, 1998, 2000, 2001 and 2002.' },
    g: {
      guard: [L('Clyde Drexler', 'took the Trail Blazers to the Finals in 1990 and 1992', { n: 22, ret: true }), L('Damian Lillard', 'ended two playoff series with shots at the buzzer', { n: 0 }), L('Brandon Roy', 'was the Rookie of the Year in 2007')],
      wing: [L('Jerome Kersey', 'played 11 seasons at forward for the Trail Blazers')],
      big: [L('Bill Walton', 'was the Finals MVP in 1977 and the league MVP in 1978', { n: 32, ret: true, rings: 1, dr: 'with the first pick in 1974' }), L('LaMarcus Aldridge', 'made four All-Star teams here'), L('Maurice Lucas', 'led the 1977 champions in scoring', { n: 20, ret: true, rings: 1 })],
    },
    rec: {},
  },
  SAC: {
    town: 'Sacramento', t: [1951],
    mark: 'The Kings won the 1951 championship as the Rochester Royals and arrived in Sacramento in 1985.',
    ache: 'The 2002 Kings had the league\'s best record and lost Game 7 of the conference finals at home in overtime.',
    rivals: {
      LAL: 'Kings and Lakers went seven games in the 2002 conference finals, and Game 7 went to overtime.',
      GSW: 'Kings and Warriors play 90 miles apart, and went seven games in the first round in 2023.',
    },
    g: {
      guard: [L('Oscar Robertson', 'averaged a triple-double for this franchise in 1961-62, when it played in Cincinnati', { n: 14, ret: true }), L('Mitch Richmond', 'made six straight All-Star teams', { n: 2, ret: true }), L('Nate Archibald', 'led the league in scoring and assists in the same season', { n: 1, ret: true })],
      wing: [L('Peja Stojakovic', 'won two Three-Point Contests', { n: 16, ret: true })],
      big: [L('Chris Webber', 'made the All-NBA first team in 2001', { n: 4, ret: true }), L('Vlade Divac', 'started at center on the 2002 team that won 61 games', { n: 21, ret: true }), L('Domantas Sabonis', 'led the league in rebounding three years in a row', { on: 'has led the league in rebounding here' })],
    },
    rec: { pts: ['Oscar Robertson', 22009] },
  },
  SAS: {
    town: 'San Antonio', t: [1999, 2003, 2005, 2007, 2014],
    mark: 'The Spurs won five championships with Tim Duncan and made the playoffs 22 years in a row.',
    ache: 'The Spurs led by five points with 28 seconds left in Game 6 of the 2013 Finals and lost the series.',
    rivals: {
      DAL: 'Spurs and Mavericks met in the playoffs six times while Tim Duncan and Dirk Nowitzki were playing.',
      LAL: 'Spurs and Lakers won nine of the 12 championships between 1999 and 2010.',
      PHX: 'The Spurs ended Phoenix\'s season in 2003, 2005, 2007 and 2008.',
      HOU: 'Spurs and Rockets have shared Texas since the 1970s.',
    },
    g: {
      guard: [L('Tony Parker', 'was the MVP of the 2007 Finals', { n: 9, ret: true, rings: 4 }), L('Manu Ginobili', 'won four championships, most of them coming off the bench', { n: 20, ret: true, rings: 4 }), L('George Gervin', 'won four scoring titles', { n: 44, ret: true })],
      wing: [L('Kawhi Leonard', 'was the MVP of the 2014 Finals', { rings: 1 }), L('Sean Elliott', 'hit the shot they call the Memorial Day Miracle in 1999', { n: 32, ret: true, rings: 1 })],
      big: [L('Tim Duncan', 'won five championships and three Finals MVP awards', { n: 21, ret: true, rings: 5, dr: 'with the first pick in 1997' }), L('David Robinson', 'was the league MVP in 1995 and scored 71 points in a game', { n: 50, ret: true, rings: 2, dr: 'with the first pick in 1987' }), L('Victor Wembanyama', 'was the Rookie of the Year in 2024', { n: 1, on: 'was the Rookie of the Year here in 2024', dr: 'with the first pick in 2023' })],
    },
    rec: { pts: ['Tim Duncan', 26496] },
  },
  TOR: {
    town: 'Toronto', t: [2019],
    mark: 'The Raptors won the 2019 championship, the first by a team from outside the United States.',
    ache: 'Cleveland ended Toronto\'s season three years in a row, from 2016 through 2018.',
    rivals: {
      BOS: 'Raptors and Celtics went seven games in the second round in 2020.',
      PHI: 'The Raptors beat the 76ers in Game 7 in 2019 on a shot at the buzzer that bounced on the rim four times.',
    },
    g: {
      guard: [L('Kyle Lowry', 'made six straight All-Star teams and won the 2019 title', { n: 7, rings: 1 }), L('DeMar DeRozan', 'made four All-Star teams here', { n: 10 }), L('Vince Carter', 'was the Rookie of the Year in 1999 and won the 2000 Slam Dunk Contest', { n: 15, ret: true })],
      wing: [L('Kawhi Leonard', 'was the MVP of the 2019 Finals in his one season here', { rings: 1 }), L('Tracy McGrady', 'was drafted here out of high school in 1997')],
      big: [L('Chris Bosh', 'made five All-Star teams as a Raptor', { n: 4 }), L('Pascal Siakam', 'was the Most Improved Player in 2019', { rings: 1 })],
    },
    rec: { pts: ['DeMar DeRozan', 13296] },
  },
  UTA: {
    town: 'Utah', t: [],
    mark: 'John Stockton and Karl Malone played 18 seasons together in Utah and made the playoffs in every one.',
    ache: 'The Jazz lost the 1997 and 1998 Finals to Chicago, the second on a Michael Jordan jumper with five seconds left.',
    rivals: {
      HOU: 'The Jazz beat the Rockets in the 1997 conference finals on a three at the buzzer.',
      DEN: 'Jazz and Nuggets went seven games in 2020, and Game 7 was decided by two points.',
    },
    g: {
      guard: [L('John Stockton', 'retired as the league\'s all-time leader in assists and steals', { n: 12, ret: true }), L('Pete Maravich', 'made the All-NBA first team twice with the Jazz', { n: 7, ret: true }), L('Darrell Griffith', 'was the Rookie of the Year in 1981', { n: 35, ret: true })],
      wing: [L('Adrian Dantley', 'won two scoring titles', { n: 4, ret: true }), L('Andrei Kirilenko', 'led the league in blocks in 2005')],
      big: [L('Karl Malone', 'won two MVP awards', { n: 32, ret: true }), L('Mark Eaton', 'was the Defensive Player of the Year twice', { n: 53, ret: true }), L('Rudy Gobert', 'was the Defensive Player of the Year three times here')],
    },
    rec: { pts: ['Karl Malone', 36374] },
  },
  WAS: {
    town: 'Washington', t: [1978],
    mark: 'This franchise won the 1978 championship as the Washington Bullets, taking Game 7 on the road in Seattle.',
    ache: 'The Bullets reached the Finals four times in the 1970s and won once.',
    rivals: { CLE: 'Washington and Cleveland met in the playoffs three years in a row, from 2006 through 2008.' },
    g: {
      guard: [L('John Wall', 'made five straight All-Star teams', { dr: 'with the first pick in 2010' }), L('Earl Monroe', 'was the Rookie of the Year in 1968', { n: 10, ret: true }), L('Bradley Beal', 'averaged more than 30 points a game in back-to-back seasons')],
      wing: [L('Gus Johnson', 'made five All-Star teams for the Bullets', { n: 25, ret: true }), L('Caron Butler', 'made two All-Star teams here')],
      big: [L('Wes Unseld', 'was the Rookie of the Year and the MVP in the same season, 1969', { n: 41, ret: true, rings: 1 }), L('Elvin Hayes', 'made eight All-Star teams as a Bullet', { n: 11, ret: true, rings: 1 })],
    },
    rec: { pts: ['Elvin Hayes', 15551] },
  },
}
