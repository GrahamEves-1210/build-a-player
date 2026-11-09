// Soccer's all-time greats (lib/careerSoccer.js registers them as RESUMES.st), its own file so the football and
// basketball chunks never carry it.
const RS = (name, seasons, tots, boots, poty, bdo, bdoPod, shoe, leagues, cups, ucl, uel, wc, cont, goals, assists) => ({ name, seasons, tots, boots, poty, bdo, bdoPod, shoe, leagues, cups, ucl, uel, wc, cont, stats: { goals, assists } })

// Soccer: the greatest attackers ever (strikers first, and the forwards and No. 10s a striker's career is measured
// against). Scored by career.js soccerLegacy, the same formula a played career gets.
// RS(name, seasons, tots, boots, poty, bdo, bdoPod, shoe, leagues, cups, ucl, uel, wc, cont, goals, assists)
//   seasons  senior seasons as a professional
//   tots     a league's Team of the Season (the PFA team, La Liga's, Serie A's...), where it was kept
//   boots    a league's top scorer (the Golden Boot, Pichichi, Capocannoniere, Torjägerkanone; Pelé's Paulista,
//            Romário's Eredivisie and Brasileirão count: the top league he played in)
//   poty     a league's player of the season (the PFA award, La Liga's best player, Serie A's, Ligue 1's, the MLS MVP)
//   bdo      Ballon d'Ors (Romário: FIFA World Player 1994, when the Ballon d'Or was closed to South Americans);
//   bdoPod   second or third without winning it
//   shoe     the European Golden Shoe
//   leagues  league titles; cups, the domestic cups (league cups count); ucl, the European Cup / Champions League
//            (Pelé's Copa Libertadores counts: the continent's top club title); uel, the UEFA Cup / Europa League
//            and the Cup Winners' Cup
//   wc       World Cups won; cont, a continental title with his country (the Euros, the Copa América, the AFCON,
//            Olympic gold before the World Cup was open to everyone)
//   goals    official goals for club and country; assists, where counted (older careers: estimates)
// From Transfermarkt, RSSSF, UEFA and FIFA, through the 2025-26 season. Old careers' assists and some
// Team of the Season counts are estimates (nobody kept them); the rest is the record.
export const SOCCER_RESUMES = [
  RS('Lionel Messi', 22, 15, 8, 8, 8, 7, 6, 12, 8, 4, 0, 1, 2, 890, 400),
  RS('Cristiano Ronaldo', 24, 14, 6, 3, 5, 7, 4, 7, 6, 5, 0, 0, 1, 950, 260),
  RS('Pelé', 21, 0, 11, 0, 0, 0, 0, 10, 0, 2, 0, 3, 0, 757, 300),
  RS('Alfredo Di Stéfano', 22, 0, 8, 0, 2, 1, 0, 13, 1, 5, 0, 0, 1, 530, 150),
  RS('Ferenc Puskás', 22, 0, 8, 0, 0, 1, 0, 10, 1, 3, 0, 0, 1, 700, 150),
  RS('Gerd Müller', 16, 0, 7, 2, 1, 2, 2, 4, 4, 3, 1, 1, 1, 600, 120),
  RS('Eusébio', 22, 0, 7, 0, 1, 2, 2, 11, 5, 1, 0, 0, 0, 520, 120),
  RS('Diego Maradona', 21, 0, 1, 0, 0, 0, 0, 2, 3, 0, 1, 1, 0, 345, 200),
  RS('Johan Cruyff', 19, 0, 2, 0, 3, 1, 0, 10, 6, 3, 0, 0, 0, 400, 200),
  RS('Ronaldo Nazário', 18, 4, 3, 2, 2, 2, 1, 2, 2, 0, 2, 2, 2, 414, 120),
  RS('Marco van Basten', 11, 4, 6, 1, 3, 0, 1, 6, 3, 2, 1, 0, 1, 301, 70),
  RS('Romário', 22, 0, 7, 1, 1, 0, 0, 5, 2, 0, 0, 1, 2, 680, 150),
  RS('Thierry Henry', 20, 6, 4, 2, 0, 2, 2, 5, 4, 1, 0, 1, 1, 411, 210),
  RS('Ronaldinho', 18, 4, 0, 1, 1, 1, 0, 3, 1, 1, 0, 1, 1, 300, 200),
  RS('Kaká', 17, 3, 0, 1, 1, 0, 0, 2, 1, 1, 0, 1, 0, 270, 160),
  RS('Zinedine Zidane', 17, 5, 0, 3, 1, 2, 0, 3, 1, 1, 0, 1, 1, 156, 120),
  RS('Robert Lewandowski', 18, 10, 9, 3, 0, 1, 2, 13, 6, 1, 0, 0, 0, 680, 160),
  RS('Karim Benzema', 21, 8, 2, 2, 1, 0, 0, 9, 5, 5, 0, 0, 0, 470, 190),
  RS('Luis Suárez', 20, 6, 3, 2, 0, 0, 2, 7, 6, 1, 0, 0, 1, 560, 270),
  RS('Zlatan Ibrahimović', 24, 10, 5, 4, 0, 0, 0, 11, 6, 0, 1, 0, 0, 570, 200),
  RS('Raúl', 20, 6, 2, 0, 0, 1, 0, 6, 2, 3, 0, 0, 0, 440, 130),
  RS('Alan Shearer', 18, 7, 3, 2, 0, 1, 0, 1, 0, 0, 0, 0, 0, 409, 100),
  RS('Miroslav Klose', 19, 3, 1, 0, 0, 0, 0, 2, 3, 0, 0, 1, 0, 350, 100),
  RS('Gabriel Batistuta', 17, 5, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 2, 355, 60),
  RS('Samuel Eto\'o', 22, 4, 1, 0, 0, 1, 0, 4, 4, 3, 0, 0, 2, 470, 120),
  RS('Didier Drogba', 20, 3, 2, 0, 0, 0, 0, 4, 7, 1, 0, 0, 0, 380, 120),
  RS('Sergio Agüero', 18, 5, 1, 0, 0, 0, 0, 5, 7, 0, 1, 0, 1, 427, 120),
  RS('Harry Kane', 13, 9, 5, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 470, 120),
  RS('Erling Haaland', 9, 4, 3, 1, 0, 1, 1, 4, 4, 1, 0, 0, 0, 370, 70),
  RS('Kylian Mbappé', 10, 9, 7, 5, 0, 1, 1, 7, 4, 0, 0, 1, 0, 430, 160),
]
