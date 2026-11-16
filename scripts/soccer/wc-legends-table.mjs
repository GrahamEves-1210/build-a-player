// WORLD CUP mode's legends: the table scripts/soccer/wc-legends.mjs turns into src/data/soccer-legends.js (2026-11-16).
// Edit here, then: node scripts/soccer/wc-legends.mjs (and node scripts/soccer/wc-legends-check.mjs).
// [name, short, nation, number, role, years with the national team, peak year, born, height cm, weight kg, foot, skin, starter,
//  [pace, finishing, shotPower, dribbling, passing, positioning, heading, composure] at his peak (0-11, F..S; Size comes
//  from height and weight), from]
// from: the name of his row in soccer-strikers.js (active players: ESPN bio, ESPN id and sampled skin come from it)
// skin (no photo to sample): one of the pool's swatches, by hand
const L1 = '#dfac9c', L2 = '#c58f83', L3 = '#b88a7a', AS = '#c89477', M2 = '#a67f6b', M3 = '#a2735e', T1 = '#946c58', B2 = '#765144', D1 = '#644536'
export const LEGENDS = [
  // ─── BRA ───
  ['Pelé', 'Pelé', 'BRA', 10, 'SS', '1957–1971', 1970, 1940, 173, 73, 'right', D1, false, [9, 11, 10, 11, 10, 10, 9, 11]],
  ['Ronaldo', 'Ronaldo', 'BRA', 9, 'ST', '1994–2006', 1997, 1976, 183, 82, 'right', M3, true, [11, 11, 9, 11, 7, 10, 7, 11]],
  ['Ronaldinho', 'Ronaldinho', 'BRA', 10, 'AM', '1999–2013', 2005, 1980, 182, 80, 'right', B2, false, [8, 9, 10, 11, 10, 8, 4, 10]],
  ['Romário', 'Romário', 'BRA', 11, 'ST', '1987–2005', 1994, 1966, 167, 70, 'right', T1, false, [9, 11, 7, 10, 6, 11, 3, 10]],
  ['Rivaldo', 'Rivaldo', 'BRA', 10, 'LW', '1993–2003', 1999, 1972, 187, 75, 'left', M3, false, [7, 10, 11, 10, 9, 9, 6, 10]],
  ['Neymar', 'Neymar', 'BRA', 10, 'LW', '2010–2023', 2015, 1992, 175, 68, 'right', M2, false, [10, 9, 8, 11, 10, 9, 3, 10]],
  // ─── GER ───
  ['Gerd Müller', 'G. Müller', 'GER', 13, 'ST', '1966–1974', 1972, 1945, 176, 75, 'right', L2, true, [7, 11, 7, 7, 5, 11, 9, 10]],
  ['Miroslav Klose', 'Klose', 'GER', 11, 'ST', '2001–2014', 2006, 1978, 184, 84, 'right', L2, false, [7, 9, 6, 5, 6, 10, 11, 9]],
  ['Thomas Müller', 'T. Müller', 'GER', 13, 'SS', '2010–2024', 2014, 1989, 185, 75, 'right', L1, false, [6, 9, 6, 6, 9, 11, 7, 9]],
  ['Lothar Matthäus', 'Matthäus', 'GER', 10, 'CM', '1980–2000', 1990, 1961, 174, 72, 'right', L2, false, [7, 7, 10, 8, 9, 6, 5, 10]],
  ['Jürgen Klinsmann', 'Klinsmann', 'GER', 18, 'ST', '1987–1998', 1990, 1964, 181, 77, 'right', L1, false, [9, 9, 7, 6, 6, 9, 9, 8]],
  ['Toni Kroos', 'Kroos', 'GER', 8, 'CM', '2010–2024', 2014, 1990, 183, 76, 'right', L1, false, [3, 6, 9, 7, 10, 5, 4, 10]],
  // ─── ARG ───
  ['Lionel Messi', 'Messi', 'ARG', 10, 'SS', '2005–2026', 2012, 1987, null, null, null, null, false, [10, 11, 10, 11, 11, 10, 3, 11], 'Lionel Messi'],
  ['Diego Maradona', 'Maradona', 'ARG', 10, 'AM', '1977–1994', 1986, 1960, 165, 70, 'left', M3, false, [9, 10, 10, 11, 11, 9, 3, 11]],
  ['Gabriel Batistuta', 'Batistuta', 'ARG', 9, 'ST', '1991–2002', 1998, 1969, 185, 83, 'right', L2, true, [8, 10, 11, 6, 5, 10, 9, 9]],
  ['Ángel Di María', 'Di María', 'ARG', 11, 'RW', '2008–2024', 2014, 1988, 178, 75, 'left', L3, false, [9, 7, 8, 9, 10, 7, 3, 9]],
  ['Julián Álvarez', 'Álvarez', 'ARG', 9, 'ST', '2021–2026', 2026, 2000, null, null, null, null, false, [7, 9, 8, 8, 8, 9, 4, 9], 'Julián Álvarez'],
  ['Sergio Agüero', 'Agüero', 'ARG', 19, 'ST', '2006–2021', 2012, 1988, 173, 74, 'right', L3, false, [8, 10, 9, 9, 6, 10, 4, 10]],
  // ─── ITA ───
  ['Roberto Baggio', 'Baggio', 'ITA', 10, 'SS', '1988–2004', 1994, 1967, 174, 73, 'right', L2, false, [8, 10, 9, 10, 10, 9, 5, 10]],
  ['Paolo Rossi', 'Rossi', 'ITA', 20, 'ST', '1977–1986', 1982, 1956, 174, 66, 'right', L2, true, [7, 10, 6, 7, 6, 10, 7, 10]],
  ['Francesco Totti', 'Totti', 'ITA', 10, 'AM', '1998–2006', 2006, 1976, 180, 82, 'right', L2, false, [6, 9, 10, 9, 10, 8, 6, 10]],
  ['Alessandro Del Piero', 'Del Piero', 'ITA', 10, 'SS', '1995–2008', 1998, 1974, 174, 73, 'right', L2, false, [7, 9, 10, 9, 9, 9, 4, 10]],
  ['Andrea Pirlo', 'Pirlo', 'ITA', 21, 'CM', '2002–2015', 2006, 1979, 177, 68, 'right', L2, false, [3, 6, 10, 8, 11, 5, 3, 10]],
  ['Christian Vieri', 'Vieri', 'ITA', 32, 'ST', '1997–2005', 1999, 1973, 185, 82, 'left', L2, false, [8, 10, 10, 6, 5, 10, 10, 9]],
  // ─── FRA ───
  ['Zinedine Zidane', 'Zidane', 'FRA', 10, 'AM', '1994–2006', 1998, 1972, 185, 80, 'right', '#ae8071', false, [6, 8, 9, 11, 10, 8, 9, 11]],
  ['Kylian Mbappé', 'Mbappé', 'FRA', 10, 'ST', '2017–2026', 2026, 1998, null, null, null, null, true, [11, 11, 10, 11, 9, 11, 4, 11], 'Kylian Mbappé'],
  ['Thierry Henry', 'Henry', 'FRA', 12, 'ST', '1997–2010', 2004, 1977, 188, 83, 'right', B2, false, [11, 10, 9, 10, 9, 10, 6, 10]],
  ['Michel Platini', 'Platini', 'FRA', 10, 'AM', '1976–1987', 1984, 1955, 179, 73, 'right', L1, false, [5, 10, 10, 9, 10, 9, 6, 10]],
  ['Antoine Griezmann', 'Griezmann', 'FRA', 7, 'SS', '2014–2024', 2018, 1991, 176, 73, 'left', L1, false, [7, 9, 8, 9, 9, 9, 6, 10]],
  ['Olivier Giroud', 'Giroud', 'FRA', 9, 'ST', '2011–2024', 2018, 1986, null, null, null, null, false, [3, 8, 8, 5, 7, 8, 10, 9], 'Olivier Giroud'],
  // ─── ENG ───
  ['Harry Kane', 'Kane', 'ENG', 9, 'ST', '2015–2026', 2023, 1993, null, null, null, null, true, [4, 11, 10, 7, 10, 11, 9, 11], 'Harry Kane'],
  ['David Beckham', 'Beckham', 'ENG', 7, 'RW', '1996–2009', 1999, 1975, 183, 75, 'right', L1, false, [6, 7, 10, 6, 10, 6, 5, 9]],
  ['Wayne Rooney', 'Rooney', 'ENG', 10, 'ST', '2003–2018', 2010, 1985, 176, 83, 'right', L1, false, [7, 9, 10, 8, 9, 9, 7, 9]],
  ['Gary Lineker', 'Lineker', 'ENG', 10, 'ST', '1984–1992', 1986, 1960, 177, 70, 'right', L1, false, [9, 10, 6, 6, 6, 10, 7, 9]],
  ['Michael Owen', 'Owen', 'ENG', 10, 'ST', '1998–2008', 2001, 1979, 173, 70, 'right', L1, false, [10, 10, 7, 8, 5, 10, 6, 9]],
  ['Jude Bellingham', 'Bellingham', 'ENG', 10, 'AM', '2020–2026', 2024, 2003, null, null, null, null, false, [7, 9, 8, 10, 9, 9, 8, 10], 'Jude Bellingham'],
  // ─── ESP ───
  ['Andrés Iniesta', 'Iniesta', 'ESP', 6, 'CM', '2006–2018', 2010, 1984, 171, 68, 'right', L1, false, [6, 7, 7, 10, 10, 7, 2, 10]],
  ['Xavi', 'Xavi', 'ESP', 8, 'CM', '2000–2014', 2010, 1980, 170, 68, 'right', L2, false, [4, 6, 6, 9, 11, 6, 3, 10]],
  ['David Villa', 'Villa', 'ESP', 7, 'ST', '2005–2017', 2010, 1981, 175, 69, 'right', L2, true, [8, 10, 9, 8, 7, 10, 5, 10]],
  ['Fernando Torres', 'Torres', 'ESP', 9, 'ST', '2003–2014', 2008, 1984, 186, 78, 'right', L1, false, [10, 9, 7, 8, 6, 9, 7, 8]],
  ['Lamine Yamal', 'Yamal', 'ESP', 19, 'RW', '2023–2026', 2026, 2007, null, null, null, null, false, [10, 9, 9, 11, 11, 9, 3, 10], 'Lamine Yamal'],
  ['Pedri', 'Pedri', 'ESP', 20, 'CM', '2021–2026', 2026, 2002, null, null, null, null, false, [6, 6, 5, 10, 10, 5, 3, 9], 'Pedri'],
  // ─── NED ───
  ['Johan Cruyff', 'Cruyff', 'NED', 14, 'SS', '1966–1977', 1974, 1947, 178, 68, 'right', L1, false, [9, 10, 8, 11, 10, 10, 6, 11]],
  ['Marco van Basten', 'Van Basten', 'NED', 9, 'ST', '1983–1992', 1988, 1964, 188, 80, 'right', L1, true, [7, 10, 10, 9, 7, 10, 10, 10]],
  ['Dennis Bergkamp', 'Bergkamp', 'NED', 10, 'SS', '1990–2000', 1998, 1969, 183, 78, 'right', L1, false, [6, 10, 8, 10, 10, 9, 6, 10]],
  ['Arjen Robben', 'Robben', 'NED', 11, 'RW', '2003–2017', 2014, 1984, 180, 80, 'left', L1, false, [10, 9, 10, 10, 8, 8, 4, 9]],
  ['Robin van Persie', 'Van Persie', 'NED', 9, 'ST', '2005–2017', 2012, 1983, 186, 78, 'left', L1, false, [7, 10, 10, 8, 8, 10, 8, 10]],
  ['Wesley Sneijder', 'Sneijder', 'NED', 10, 'AM', '2003–2018', 2010, 1984, 170, 67, 'right', L1, false, [5, 8, 10, 8, 10, 8, 5, 10]],
  // ─── URU ───
  ['Luis Suárez', 'Suárez', 'URU', 9, 'ST', '2007–2024', 2016, 1987, 182, 86, 'right', L2, true, [8, 10, 9, 9, 9, 10, 8, 10]],
  ['Edinson Cavani', 'Cavani', 'URU', 21, 'ST', '2008–2022', 2017, 1987, 185, 77, 'right', L2, false, [8, 9, 8, 6, 6, 10, 9, 9]],
  ['Diego Forlán', 'Forlán', 'URU', 10, 'SS', '2002–2015', 2010, 1979, 180, 75, 'right', L1, false, [7, 9, 11, 7, 8, 8, 6, 10]],
  ['Enzo Francescoli', 'Francescoli', 'URU', 10, 'AM', '1982–1997', 1986, 1961, 181, 70, 'right', L2, false, [6, 8, 8, 10, 10, 8, 6, 10]],
  ['Federico Valverde', 'Valverde', 'URU', 15, 'CM', '2017–2026', 2025, 1998, null, null, null, null, false, [9, 7, 9, 8, 8, 6, 6, 8], 'Federico Valverde'],
  // ─── SWE ───
  ['Zlatan Ibrahimović', 'Ibrahimović', 'SWE', 10, 'ST', '2001–2023', 2013, 1981, 195, 95, 'right', '#ae8071', true, [6, 10, 11, 9, 9, 9, 9, 9]],
  ['Henrik Larsson', 'Larsson', 'SWE', 7, 'ST', '1993–2009', 2001, 1971, 177, 73, 'right', M3, false, [7, 10, 7, 7, 8, 10, 8, 10]],
  ['Tomas Brolin', 'Brolin', 'SWE', 11, 'SS', '1990–1995', 1994, 1969, 178, 76, 'right', L1, false, [7, 8, 8, 8, 8, 8, 5, 8]],
  ['Alexander Isak', 'Isak', 'SWE', 9, 'ST', '2017–2026', 2025, 1999, null, null, null, null, false, [9, 10, 7, 9, 6, 9, 7, 9], 'Alexander Isak'],
  ['Viktor Gyökeres', 'Gyökeres', 'SWE', 17, 'ST', '2019–2026', 2025, 1998, null, null, null, null, false, [9, 9, 9, 6, 5, 9, 8, 9], 'Viktor Gyökeres'],
  // ─── BEL ───
  ['Eden Hazard', 'Hazard', 'BEL', 10, 'LW', '2008–2022', 2015, 1991, 175, 74, 'right', L1, false, [9, 8, 7, 10, 10, 8, 3, 10]],
  ['Kevin De Bruyne', 'De Bruyne', 'BEL', 7, 'AM', '2010–2026', 2020, 1991, null, null, null, null, false, [7, 8, 10, 8, 11, 7, 5, 10], 'Kevin De Bruyne'],
  ['Romelu Lukaku', 'Lukaku', 'BEL', 9, 'ST', '2010–2026', 2021, 1993, null, null, null, null, true, [9, 9, 9, 6, 6, 9, 8, 7], 'Romelu Lukaku'],
  ['Enzo Scifo', 'Scifo', 'BEL', 10, 'AM', '1984–1998', 1990, 1966, 178, 73, 'right', L2, false, [6, 7, 9, 9, 9, 7, 5, 8]],
  ['Dries Mertens', 'Mertens', 'BEL', 14, 'SS', '2011–2022', 2017, 1987, 169, 61, 'right', L1, false, [8, 9, 8, 9, 8, 8, 2, 8]],
  // ─── SRB (Yugoslavia's record) ───
  ['Dragan Stojković', 'Stojković', 'SRB', 10, 'AM', '1983–2001', 1990, 1965, 174, 73, 'right', L1, false, [6, 8, 8, 10, 10, 7, 4, 9]],
  ['Aleksandar Mitrović', 'Mitrović', 'SRB', 9, 'ST', '2013–2026', 2022, 1994, 189, 82, 'right', L2, true, [5, 9, 8, 5, 5, 9, 10, 8]],
  ['Dušan Vlahović', 'Vlahović', 'SRB', 7, 'ST', '2020–2026', 2022, 2000, 190, 88, 'left', L1, false, [7, 9, 9, 6, 5, 9, 8, 7]],
  ['Sergej Milinković-Savić', 'Milinković-Savić', 'SRB', 20, 'CM', '2017–2026', 2018, 1995, 192, 82, 'right', L1, false, [5, 8, 8, 8, 9, 7, 10, 8]],
  // ─── MEX ───
  ['Hugo Sánchez', 'H. Sánchez', 'MEX', 9, 'ST', '1977–1998', 1990, 1958, 174, 72, 'right', M3, true, [7, 10, 8, 7, 6, 10, 7, 9]],
  ['Javier Hernández', 'Chicharito', 'MEX', 14, 'ST', '2009–2019', 2011, 1988, 175, 72, 'right', L3, false, [8, 9, 6, 5, 5, 10, 8, 8]],
  ['Cuauhtémoc Blanco', 'Blanco', 'MEX', 10, 'AM', '1995–2014', 1998, 1973, 178, 77, 'right', M3, false, [5, 8, 8, 9, 9, 7, 5, 9]],
  ['Hirving Lozano', 'Lozano', 'MEX', 22, 'LW', '2016–2026', 2019, 1995, 175, 70, 'right', M3, false, [10, 7, 7, 8, 6, 7, 3, 7]],
  // ─── RUS (the USSR's record) ───
  ['Andrei Arshavin', 'Arshavin', 'RUS', 10, 'AM', '2002–2012', 2008, 1981, 172, 67, 'right', L1, false, [8, 8, 8, 9, 9, 8, 3, 9]],
  ['Aleksandr Golovin', 'Golovin', 'RUS', 17, 'AM', '2015–2026', 2018, 1996, null, null, null, null, false, [7, 7, 8, 8, 8, 6, 3, 7], 'Aleksandr Golovin'],
  ['Denis Cheryshev', 'Cheryshev', 'RUS', 6, 'LW', '2012–2021', 2018, 1990, 173, 69, 'left', L1, false, [8, 8, 8, 7, 6, 7, 4, 7]],
  ['Artem Dzyuba', 'Dzyuba', 'RUS', 22, 'ST', '2011–2021', 2018, 1988, 197, 91, 'right', L1, true, [4, 8, 7, 5, 7, 8, 10, 8]],
  // ─── SUI ───
  ['Xherdan Shaqiri', 'Shaqiri', 'SUI', 23, 'RW', '2010–2024', 2014, 1991, 169, 72, 'left', L2, false, [8, 8, 10, 8, 9, 7, 4, 9]],
  ['Granit Xhaka', 'Xhaka', 'SUI', 10, 'CM', '2011–2026', 2024, 1992, null, null, null, null, false, [4, 6, 9, 7, 9, 5, 6, 9], 'Granit Xhaka'],
  ['Breel Embolo', 'Embolo', 'SUI', 7, 'ST', '2015–2026', 2022, 1997, null, null, null, null, true, [9, 7, 7, 6, 5, 8, 8, 7], 'Breel Embolo'],
  // ─── HUN ───
  ['Ferenc Puskás', 'Puskás', 'HUN', 10, 'SS', '1945–1956', 1954, 1927, 172, 76, 'left', L2, true, [7, 10, 11, 9, 9, 10, 6, 10]],
  ['Dominik Szoboszlai', 'Szoboszlai', 'HUN', 10, 'AM', '2019–2026', 2025, 2000, null, null, null, null, false, [8, 8, 10, 8, 10, 7, 6, 9], 'Dominik Szoboszlai'],
  // ─── CRO ───
  ['Luka Modrić', 'Modrić', 'CRO', 10, 'CM', '2006–2026', 2018, 1985, null, null, null, null, false, [6, 7, 9, 10, 11, 6, 4, 10], 'Luka Modric'],
  ['Davor Šuker', 'Šuker', 'CRO', 9, 'ST', '1990–2002', 1998, 1968, 183, 76, 'left', L1, true, [7, 10, 9, 8, 6, 10, 6, 10]],
  ['Mario Mandžukić', 'Mandžukić', 'CRO', 17, 'ST', '2007–2018', 2013, 1986, 190, 85, 'right', L1, false, [6, 8, 7, 5, 6, 9, 10, 9]],
  ['Ivan Perišić', 'Perišić', 'CRO', 4, 'LW', '2011–2026', 2018, 1989, null, null, null, null, false, [8, 8, 9, 7, 8, 7, 8, 9], 'Ivan Perisic'],
  // ─── CZE (Czechoslovakia's record) ───
  ['Pavel Nedvěd', 'Nedvěd', 'CZE', 11, 'AM', '1994–2006', 2003, 1972, 177, 70, 'right', L1, false, [8, 8, 10, 9, 9, 7, 5, 9]],
  ['Tomáš Rosický', 'Rosický', 'CZE', 10, 'AM', '2000–2016', 2006, 1980, 179, 65, 'right', L1, false, [7, 7, 8, 9, 10, 6, 3, 8]],
  ['Jan Koller', 'Koller', 'CZE', 9, 'ST', '1999–2009', 2003, 1973, 202, 100, 'right', L1, false, [3, 8, 7, 4, 7, 9, 11, 8]],
  ['Patrik Schick', 'Schick', 'CZE', 10, 'ST', '2016–2026', 2021, 1996, null, null, null, null, true, [6, 9, 10, 6, 5, 9, 8, 9], 'Patrik Schick'],
  // ─── POR ───
  ['Cristiano Ronaldo', 'Ronaldo', 'POR', 7, 'ST', '2003–2026', 2013, 1985, null, null, null, null, true, [10, 11, 11, 10, 8, 11, 11, 11], 'Cristiano Ronaldo'],
  ['Eusébio', 'Eusébio', 'POR', 13, 'ST', '1961–1973', 1966, 1942, 175, 73, 'right', D1, false, [10, 10, 11, 9, 7, 10, 7, 10]],
  ['Luís Figo', 'Figo', 'POR', 7, 'RW', '1991–2006', 2000, 1972, 180, 75, 'right', L2, false, [8, 8, 8, 10, 10, 7, 5, 10]],
  ['Bruno Fernandes', 'B. Fernandes', 'POR', 8, 'AM', '2017–2026', 2021, 1994, null, null, null, null, false, [6, 8, 9, 7, 10, 8, 5, 10], 'Bruno Fernandes'],
  // ─── POL ───
  ['Robert Lewandowski', 'Lewandowski', 'POL', 9, 'ST', '2008–2026', 2020, 1988, 186, 81, 'right', L1, true, [7, 11, 9, 8, 8, 11, 9, 10]],
  ['Zbigniew Boniek', 'Boniek', 'POL', 20, 'SS', '1976–1988', 1982, 1956, 182, 74, 'right', L1, false, [9, 8, 8, 9, 8, 8, 5, 9]],
  ['Piotr Zieliński', 'Zieliński', 'POL', 10, 'CM', '2013–2026', 2020, 1994, 180, 75, 'right', L1, false, [6, 7, 9, 8, 9, 6, 4, 8]],
  // ─── USA ───
  ['Landon Donovan', 'Donovan', 'USA', 10, 'RW', '2000–2014', 2010, 1982, 173, 68, 'right', L1, false, [9, 8, 7, 8, 8, 8, 4, 9]],
  ['Clint Dempsey', 'Dempsey', 'USA', 8, 'SS', '2004–2017', 2012, 1983, 185, 77, 'right', L1, true, [6, 8, 8, 7, 7, 8, 7, 9]],
  ['Christian Pulisic', 'Pulisic', 'USA', 10, 'LW', '2016–2026', 2024, 1998, null, null, null, null, false, [9, 8, 7, 9, 8, 8, 4, 8], 'Christian Pulisic'],
  ['Weston McKennie', 'McKennie', 'USA', 8, 'CM', '2017–2026', 2025, 1998, null, null, null, null, false, [6, 6, 7, 6, 7, 7, 8, 7], 'Weston McKennie'],
  // ─── AUT ───
  ['Toni Polster', 'Polster', 'AUT', 9, 'ST', '1982–2000', 1990, 1964, 188, 82, 'right', L1, false, [5, 9, 8, 6, 6, 9, 8, 8]],
  ['Marko Arnautović', 'Arnautović', 'AUT', 7, 'ST', '2008–2026', 2018, 1989, 192, 84, 'right', L2, true, [7, 8, 8, 7, 8, 8, 8, 8]],
  ['Marcel Sabitzer', 'Sabitzer', 'AUT', 9, 'CM', '2012–2026', 2021, 1994, null, null, null, null, false, [6, 7, 9, 7, 8, 6, 5, 8], 'Marcel Sabitzer'],
  // ─── KOR ───
  ['Son Heung-min', 'Son', 'KOR', 7, 'ST', '2010–2026', 2022, 1992, null, null, null, null, true, [10, 10, 9, 8, 8, 9, 5, 9], 'Son Heung-Min'],
  ['Park Ji-sung', 'Park', 'KOR', 7, 'CM', '2000–2011', 2008, 1981, 175, 72, 'right', AS, false, [8, 6, 6, 7, 7, 7, 5, 8]],
  ['Ahn Jung-hwan', 'Ahn', 'KOR', 19, 'SS', '1997–2009', 2002, 1976, 177, 70, 'right', AS, false, [7, 8, 6, 7, 6, 8, 7, 8]],
  // ─── CHI ───
  ['Alexis Sánchez', 'Alexis', 'CHI', 7, 'SS', '2006–2026', 2017, 1988, 169, 67, 'right', M3, false, [9, 8, 8, 9, 8, 8, 5, 8]],
  ['Arturo Vidal', 'Vidal', 'CHI', 8, 'CM', '2007–2023', 2015, 1987, 180, 75, 'right', M3, false, [7, 7, 8, 7, 8, 7, 8, 9]],
  ['Marcelo Salas', 'Salas', 'CHI', 11, 'ST', '1994–2007', 1998, 1974, 174, 76, 'left', L3, true, [8, 9, 8, 7, 6, 9, 8, 9]],
  // ─── MAR ───
  ['Hakim Ziyech', 'Ziyech', 'MAR', 7, 'RW', '2015–2026', 2022, 1993, 180, 70, 'left', L3, false, [6, 7, 9, 8, 10, 6, 3, 8]],
  ['Youssef En-Nesyri', 'En-Nesyri', 'MAR', 19, 'ST', '2016–2026', 2022, 1997, 188, 78, 'right', T1, true, [8, 8, 7, 5, 4, 8, 10, 7]],
  ['Sofyan Amrabat', 'Amrabat', 'MAR', 4, 'DM', '2017–2026', 2022, 1996, 185, 70, 'right', L3, false, [7, 4, 6, 7, 7, 4, 6, 8]],
  // ─── PAR ───
  ['Roque Santa Cruz', 'Santa Cruz', 'PAR', 9, 'ST', '1999–2016', 2008, 1981, 193, 79, 'right', L2, true, [6, 8, 7, 6, 7, 8, 9, 7]],
  ['Miguel Almirón', 'Almirón', 'PAR', 10, 'AM', '2016–2026', 2023, 1994, null, null, null, null, false, [9, 7, 7, 8, 6, 6, 2, 6], 'Miguel Almirón'],
  // ─── COL ───
  ['James Rodríguez', 'James', 'COL', 10, 'AM', '2011–2026', 2014, 1991, 181, 75, 'left', L3, false, [6, 9, 10, 9, 10, 8, 5, 9]],
  ['Radamel Falcao', 'Falcao', 'COL', 9, 'ST', '2007–2023', 2012, 1986, 177, 72, 'right', L3, true, [7, 10, 8, 7, 6, 10, 9, 9]],
  ['Carlos Valderrama', 'Valderrama', 'COL', 10, 'CM', '1985–1998', 1993, 1961, 175, 72, 'right', T1, false, [4, 6, 7, 9, 10, 6, 3, 10]],
  ['Luis Díaz', 'L. Díaz', 'COL', 7, 'LW', '2019–2026', 2025, 1997, null, null, null, null, false, [10, 8, 7, 9, 8, 8, 5, 9], 'Luis Díaz'],
  // ─── JPN ───
  ['Keisuke Honda', 'Honda', 'JPN', 4, 'AM', '2008–2018', 2010, 1986, 182, 74, 'left', AS, true, [6, 8, 9, 7, 8, 7, 6, 9]],
  ['Hidetoshi Nakata', 'Nakata', 'JPN', 7, 'CM', '1997–2006', 2001, 1977, 175, 72, 'right', AS, false, [6, 7, 8, 8, 9, 6, 5, 9]],
  ['Kaoru Mitoma', 'Mitoma', 'JPN', 9, 'LW', '2021–2026', 2023, 1997, 178, 71, 'right', AS, false, [9, 7, 6, 10, 7, 7, 4, 8]],
  // ─── ROU ───
  ['Gheorghe Hagi', 'Hagi', 'ROU', 10, 'AM', '1983–2000', 1994, 1965, 174, 74, 'left', L2, false, [7, 9, 10, 10, 10, 8, 4, 10]],
  ['Florin Răducioiu', 'Răducioiu', 'ROU', 9, 'ST', '1990–1996', 1994, 1970, 180, 74, 'right', L1, true, [8, 9, 7, 7, 6, 9, 7, 8]],
  // ─── DEN ───
  ['Michael Laudrup', 'M. Laudrup', 'DEN', 10, 'AM', '1982–1998', 1992, 1964, 183, 76, 'right', L1, false, [7, 8, 8, 10, 10, 8, 5, 10]],
  ['Christian Eriksen', 'Eriksen', 'DEN', 10, 'AM', '2010–2026', 2017, 1992, 182, 76, 'right', L1, false, [6, 8, 10, 8, 10, 7, 4, 9]],
  ['Rasmus Højlund', 'Højlund', 'DEN', 9, 'ST', '2023–2026', 2025, 2003, 191, 79, 'left', L1, true, [9, 8, 8, 6, 5, 8, 8, 7], 'Rasmus Højlund'],
  // ─── CMR ───
  ["Samuel Eto'o", "Eto'o", 'CMR', 9, 'ST', '1997–2014', 2009, 1981, 180, 75, 'right', D1, true, [10, 10, 8, 9, 7, 10, 7, 9]],
  ['Roger Milla', 'Milla', 'CMR', 9, 'ST', '1973–1994', 1990, 1952, 176, 73, 'right', D1, false, [7, 9, 7, 8, 6, 9, 7, 10]],
  ['Vincent Aboubakar', 'Aboubakar', 'CMR', 10, 'ST', '2010–2026', 2022, 1992, 184, 78, 'right', D1, false, [7, 8, 8, 6, 6, 8, 8, 8]],
  // ─── BUL ───
  ['Hristo Stoichkov', 'Stoichkov', 'BUL', 8, 'SS', '1987–1999', 1994, 1966, 178, 73, 'left', L1, true, [9, 10, 10, 9, 8, 9, 5, 10]],
  ['Dimitar Berbatov', 'Berbatov', 'BUL', 9, 'ST', '1999–2010', 2009, 1981, 189, 79, 'right', L1, false, [5, 9, 8, 10, 9, 8, 8, 9]],
  // ─── SCO ───
  ['Kenny Dalglish', 'Dalglish', 'SCO', 7, 'SS', '1971–1986', 1979, 1951, 173, 74, 'right', L1, true, [7, 9, 7, 9, 9, 9, 6, 10]],
  ['Scott McTominay', 'McTominay', 'SCO', 4, 'CM', '2018–2026', 2025, 1996, null, null, null, null, false, [6, 8, 9, 6, 6, 8, 9, 8], 'Scott McTominay'],
  ['John McGinn', 'McGinn', 'SCO', 7, 'CM', '2016–2026', 2023, 1994, null, null, null, null, false, [6, 7, 8, 7, 7, 6, 4, 8], 'John McGinn'],
  // ─── CRC ───
  ['Bryan Ruiz', 'Ruiz', 'CRC', 10, 'AM', '2005–2022', 2014, 1985, 187, 80, 'left', L3, false, [5, 7, 7, 8, 8, 7, 6, 8]],
  ['Joel Campbell', 'Campbell', 'CRC', 12, 'ST', '2011–2026', 2014, 1992, 178, 78, 'left', B2, true, [9, 7, 7, 8, 6, 7, 4, 7]],
  // ─── AUS ───
  ['Tim Cahill', 'Cahill', 'AUS', 4, 'SS', '2004–2018', 2006, 1979, 178, 70, 'right', L3, true, [6, 8, 8, 5, 6, 9, 10, 9]],
  ['Harry Kewell', 'Kewell', 'AUS', 10, 'LW', '1996–2012', 2002, 1978, 180, 76, 'left', L1, false, [9, 7, 8, 9, 7, 7, 5, 7]],
  // ─── GHA ───
  ['Asamoah Gyan', 'Gyan', 'GHA', 3, 'ST', '2003–2019', 2010, 1985, 186, 84, 'right', D1, true, [8, 8, 8, 6, 5, 8, 8, 7]],
  ['Michael Essien', 'Essien', 'GHA', 8, 'CM', '2002–2014', 2006, 1982, 178, 84, 'right', D1, false, [8, 6, 9, 7, 7, 5, 7, 8]],
  ['Mohammed Kudus', 'Kudus', 'GHA', 20, 'AM', '2019–2026', 2024, 2000, 175, 70, 'left', D1, false, [8, 8, 8, 10, 7, 7, 4, 7]],
  // ─── PER ───
  ['Paolo Guerrero', 'Guerrero', 'PER', 9, 'ST', '2004–2024', 2015, 1984, 185, 80, 'right', M3, true, [6, 8, 8, 7, 7, 8, 8, 8]],
  ['Jefferson Farfán', 'Farfán', 'PER', 10, 'RW', '2003–2018', 2010, 1984, 177, 74, 'right', B2, false, [9, 7, 8, 8, 7, 7, 5, 7]],
  // ─── NGA ───
  ['Jay-Jay Okocha', 'Okocha', 'NGA', 10, 'AM', '1993–2006', 1998, 1973, 175, 70, 'right', D1, false, [7, 7, 9, 10, 9, 6, 3, 9]],
  ['Nwankwo Kanu', 'Kanu', 'NGA', 4, 'ST', '1994–2010', 1999, 1976, 197, 80, 'right', D1, false, [6, 8, 7, 9, 8, 8, 7, 8]],
  ['Victor Osimhen', 'Osimhen', 'NGA', 9, 'ST', '2017–2026', 2023, 1998, null, null, null, null, true, [10, 9, 7, 6, 5, 10, 9, 8], 'Victor Osimhen'],
  // ─── KSA ───
  ['Salem Al-Dawsari', 'Al-Dawsari', 'KSA', 10, 'LW', '2011–2026', 2022, 1991, null, null, null, null, false, [7, 7, 8, 8, 7, 6, 3, 7], 'Salem Al-Dawsari'],
  ['Saeed Al-Owairan', 'Al-Owairan', 'KSA', 10, 'SS', '1992–1998', 1994, 1967, 184, 75, 'right', T1, true, [9, 7, 7, 8, 6, 7, 3, 7]],
  // ─── IRN ───
  ['Ali Daei', 'Daei', 'IRN', 10, 'ST', '1993–2006', 1998, 1969, 189, 84, 'right', '#ba8c7a', true, [5, 9, 8, 5, 6, 9, 10, 8]],
  ['Mehdi Taremi', 'Taremi', 'IRN', 9, 'ST', '2015–2026', 2023, 1992, null, null, null, null, false, [6, 8, 7, 6, 8, 9, 8, 9], 'Mehdi Taremi'],
  // ─── TUR ───
  ['Hakan Şükür', 'Şükür', 'TUR', 9, 'ST', '1992–2007', 1997, 1971, 191, 85, 'right', L2, true, [5, 9, 7, 5, 6, 9, 10, 8]],
  ['Arda Güler', 'Güler', 'TUR', 8, 'AM', '2023–2026', 2026, 2005, null, null, null, null, false, [6, 8, 9, 9, 10, 7, 3, 8], 'Arda Güler'],
  ['Kenan Yıldız', 'Yıldız', 'TUR', 10, 'LW', '2023–2026', 2026, 2005, null, null, null, null, false, [8, 8, 8, 9, 7, 7, 5, 8], 'Kenan Yildiz'],
  // ─── SEN ───
  ['Sadio Mané', 'Mané', 'SEN', 10, 'LW', '2012–2026', 2019, 1992, 175, 69, 'right', D1, true, [10, 9, 8, 9, 7, 9, 6, 9]],
  ['El Hadji Diouf', 'Diouf', 'SEN', 11, 'ST', '2000–2008', 2002, 1981, 180, 74, 'right', D1, false, [9, 7, 7, 8, 6, 7, 5, 6]],
  ['Papa Bouba Diop', 'Bouba Diop', 'SEN', 19, 'CM', '2001–2008', 2002, 1978, 195, 88, 'right', D1, false, [5, 6, 7, 5, 6, 6, 9, 7]],
  // ─── TUN ───
  ['Wahbi Khazri', 'Khazri', 'TUN', 10, 'SS', '2013–2022', 2018, 1991, 176, 75, 'right', L3, true, [6, 7, 9, 7, 8, 7, 4, 8]],
  ['Ellyes Skhiri', 'Skhiri', 'TUN', 17, 'CM', '2018–2026', 2022, 1995, null, null, null, null, false, [6, 5, 6, 6, 7, 5, 7, 7], 'Ellyes Skhiri'],
  // ─── NOR ───
  ['Erling Haaland', 'Haaland', 'NOR', 9, 'ST', '2019–2026', 2023, 2000, null, null, null, null, true, [11, 11, 10, 7, 6, 11, 10, 11], 'Erling Haaland'],
  ['Martin Ødegaard', 'Ødegaard', 'NOR', 10, 'AM', '2014–2026', 2023, 1998, null, null, null, null, false, [6, 8, 8, 9, 10, 7, 3, 9], 'Martin Ødegaard'],
  ['Ole Gunnar Solskjær', 'Solskjær', 'NOR', 11, 'ST', '1995–2007', 1999, 1973, 178, 70, 'right', L1, false, [7, 10, 7, 7, 7, 10, 6, 10]],
  // ─── ECU ───
  ['Enner Valencia', 'E. Valencia', 'ECU', 13, 'ST', '2012–2026', 2014, 1989, null, null, null, null, true, [9, 8, 8, 7, 6, 8, 7, 8], 'Enner Valencia'],
  ['Moisés Caicedo', 'Caicedo', 'ECU', 23, 'DM', '2020–2026', 2025, 2001, null, null, null, null, false, [7, 5, 6, 8, 8, 5, 6, 8], 'Moisés Caicedo'],
  ['Antonio Valencia', 'A. Valencia', 'ECU', 16, 'RW', '2005–2019', 2012, 1985, 180, 78, 'right', B2, false, [10, 6, 7, 7, 8, 6, 5, 7]],
  // ─── ALG ───
  ['Riyad Mahrez', 'Mahrez', 'ALG', 7, 'RW', '2014–2026', 2016, 1991, null, null, null, null, false, [8, 9, 8, 10, 9, 8, 3, 9], 'Riyad Mahrez'],
  ['Islam Slimani', 'Slimani', 'ALG', 13, 'ST', '2012–2026', 2016, 1988, 188, 79, 'right', L3, true, [7, 8, 7, 5, 5, 8, 10, 7]],
  // ─── CIV ───
  ['Didier Drogba', 'Drogba', 'CIV', 11, 'ST', '2002–2014', 2007, 1978, 189, 91, 'right', D1, true, [9, 9, 10, 7, 7, 9, 10, 10]],
  ['Yaya Touré', 'Y. Touré', 'CIV', 19, 'CM', '2004–2015', 2014, 1983, 188, 90, 'right', D1, false, [7, 8, 10, 9, 9, 7, 7, 9]],
  ['Gervinho', 'Gervinho', 'CIV', 10, 'LW', '2007–2019', 2014, 1987, 179, 67, 'right', D1, false, [10, 6, 6, 9, 6, 7, 3, 5]],
  // ─── EGY ───
  ['Mohamed Salah', 'Salah', 'EGY', 10, 'RW', '2011–2026', 2018, 1992, null, null, null, null, false, [10, 10, 8, 9, 9, 10, 4, 10], 'Mohamed Salah'],
  ['Omar Marmoush', 'Marmoush', 'EGY', 22, 'ST', '2021–2026', 2025, 1999, null, null, null, null, true, [9, 8, 8, 8, 7, 8, 4, 7], 'Omar Marmoush'],
]
