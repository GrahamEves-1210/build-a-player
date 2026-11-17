// FRANCHISE: the names of the men the game makes up (draft classes, depth signings, the street's veterans).
//
// A made-up man's name fits who he is: his background is drawn the way his position's NFL room is (faces.js MIX:
// corners almost all Black, kickers nearly all white, Polynesian men on the lines), his first and last names come
// from that background's lists, and his drawn face (faces.js, keyed by his name) is of the same background.
// Never a real player's name (any sport in the game's data, and the famous names in FAMOUS), never twice in a draft
// class or on a roster, and a class spreads its surnames (a common one up to three times, any other once or twice).
//   nameFor(R, pos, { taken, surn })  R: rng.js's; pos: a position or a spot (edge, dt, cb, s); taken: a Set of
//                                     full names to stay clear of; surn: a Map surname -> count (a class's spread)
import { mixOf, bgOf } from './faces'

// ── First names ──────────────────────────────────────────────────────────────
const F_B = ['Jalen', 'Jaylen', 'DeShawn', 'Malik', 'Darius', 'Tre', 'Trey', 'Tyrell', 'Terrell', 'Tavon', 'Khalil', 'Jamal', 'Lamont', 'Amari',
  'Keon', 'Zion', 'Rashad', 'Hakeem', 'Tariq', 'Marcell', 'Jarvis', 'Quincy', 'Jaden', 'Jayden', 'Kendrick', 'Kenyon', 'Kareem', 'Dorian',
  'Darnell', 'Demetrius', 'Desmond', 'Dwayne', 'Javon', 'Javonte', 'Jamari', 'Jamir', 'Jaquan', 'Jaylin', 'Jabari', 'Jahmir', 'Jalil',
  'DaQuan', 'Dajuan', 'Davonte', 'Demarco', 'Devonta', 'Deontae', 'Kamari', 'Kameron', 'Keshawn', 'Kyree', 'Kymani', 'Ladarius', 'Lamar',
  'Marquis', 'Marquise', 'Montez', 'Nehemiah', 'Quinton', 'Raheem', 'Rashard', 'Rashawn', 'Shamar', 'Shemar', 'Taj', 'Tavion', 'Terrance',
  'Torrey', 'Travon', 'Tyquan', 'Tyree', 'Xavier', 'Zaire', 'Ahmad', 'Akeem', 'Amir', 'Antwan', 'Cedric', 'Cornelius', 'Darian', 'Daylon',
  'Deandre', 'Dequan', 'Devontae', 'Dexter', 'Donte', 'Emmanuel', 'Jacoby', 'Jarell', 'Javion', 'Jerome', 'Jermaine', 'Kalen', 'Kelvin',
  'Keenan', 'Kobe', 'Lavell', 'Lavon', 'Malachi', 'Markell', 'Maurice', 'Montrell', 'Nasir', 'Omari', 'Reggie', 'Rodney', 'Samari', 'Savion',
  'Shaun', 'Solomon', 'Tevin', 'Treyvon', 'Tyshawn', 'Vernon', 'Wendell', 'Zaylen', 'Jamarion', 'Jakobe', 'Kaden', 'Dashawn', 'Damarion',
  'Jordyn', 'Kenji', 'Kortez', 'Ladell', 'Markus', 'Isaiah', 'Elijah', 'Jeremiah', 'Josiah', 'Demond', 'Keyon', 'Tymir', 'Zamir', 'Kahlil',
  'Jaylon', 'Dontae', 'Tremaine', 'Rasheed', 'Terrion', 'Jayvon', 'Kavon', 'Daquan', 'Antonio', 'Bryant', 'Roderick', 'Alonzo', 'Andre',
  'Darrell', 'Derius', 'Jalon', 'Kordell', 'Mekhi', 'Kenyatta', 'Jaheim', 'Daveon', 'Tyrique', 'Romello', 'Trevion', 'Corbin', 'Damari',
  'Jaire', 'Kyion', 'Nyheim', 'Quadir', 'Jaelen', 'Keion', 'Treshawn', 'Jahlil', 'Dwight', 'Lorenzo', 'Marlon', 'Reginald', 'Stanley']
const F_W = ['Brock', 'Cole', 'Kade', 'Grant', 'Mason', 'Wyatt', 'Hunter', 'Cooper', 'Jake', 'Connor', 'Luke', 'Jack', 'Logan', 'Carson',
  'Colby', 'Garrett', 'Blake', 'Brett', 'Chase', 'Clay', 'Colton', 'Dalton', 'Drew', 'Dylan', 'Evan', 'Gage', 'Gavin', 'Graham', 'Hayden',
  'Jace', 'Jared', 'Joel', 'Kyle', 'Landon', 'Levi', 'Mitchell', 'Nolan', 'Parker', 'Peyton', 'Reid', 'Riley', 'Sawyer', 'Seth', 'Spencer',
  'Tanner', 'Trent', 'Tucker', 'Weston', 'Zane', 'Austin', 'Bennett', 'Boone', 'Brody', 'Bryson', 'Cade', 'Caden', 'Camden', 'Casey',
  'Conor', 'Dane', 'Easton', 'Ethan', 'Finn', 'Gunnar', 'Hank', 'Holden', 'Jett', 'Keegan', 'Knox', 'Lane', 'Liam', 'Max', 'Nate', 'Owen',
  'Paxton', 'Pierce', 'Quinn', 'Ryder', 'Shane', 'Stone', 'Tate', 'Ty', 'Walker', 'Zach', 'Brayden', 'Braden', 'Brennan', 'Bo', 'Cal',
  'Cash', 'Clark', 'Collin', 'Dawson', 'Dillon', 'Eli', 'Emmett', 'Jonah', 'Jaxon', 'Kellen', 'Kole', 'Lincoln', 'Mack', 'Noah', 'Rhett',
  'Rowan', 'Sean', 'Shea', 'Silas', 'Steele', 'Thatcher', 'Trace', 'Tristan', 'Wade', 'Wes', 'Beau', 'Bryce', 'Cody', 'Corbin', 'Dax',
  'Grady', 'Hudson', 'Jensen', 'Kirk', 'Kolby', 'Lance', 'Mac', 'Nash', 'Reese', 'Ridge', 'Ross', 'Sutton', 'Tyce', 'Wil', 'Brooks',
  'Carter', 'Hollis', 'Jasper', 'Kody', 'Lukas', 'Marshall', 'Miles', 'Preston', 'Rylan', 'Slade', 'Tobin', 'Vance', 'Wilson', 'Bryce',
  'Caleb', 'Cayden', 'Gentry', 'Harrison', 'Hagen', 'Ian', 'Kasen', 'Kyler', 'Matthew', 'Peter', 'Reed', 'Trevor', 'Zeke', 'Bridger',
  'Cason', 'Davis', 'Gus', 'Jesse', 'Brady', 'Ashton', 'Callum', 'Declan', 'Gideon', 'Tyson', 'Asher', 'Ryland', 'Briggs', 'Crew']
const F_S = ['Michael', 'Chris', 'Jordan', 'Josh', 'Justin', 'Brandon', 'Anthony', 'Isaiah', 'Elijah', 'Caleb', 'Cameron', 'Devin', 'Aaron',
  'Adam', 'Alex', 'Andrew', 'Ben', 'Brian', 'Calvin', 'Charles', 'Christian', 'Daniel', 'David', 'Derek', 'Dominic', 'Eric', 'Gabriel',
  'Isaac', 'Jacob', 'James', 'Jason', 'Jeremiah', 'John', 'Jonathan', 'Joseph', 'Joshua', 'Julian', 'Kevin', 'Malcolm', 'Mark', 'Matt',
  'Nathan', 'Nick', 'Patrick', 'Paul', 'Robert', 'Ryan', 'Samuel', 'Stephen', 'Terry', 'Thomas', 'Tony', 'Travis', 'Troy', 'Victor',
  'William', 'Zachary', 'Kenny', 'Jeremy', 'Marcus', 'Myles', 'Micah', 'Tyler', 'Dante', 'Derrick', 'Darren', 'Damon', 'Corey', 'Chad',
  'Kendall', 'Jalen', 'Kyle', 'Bryce', 'Cole', 'Darius', 'Jamie', 'Jayden', 'Jaden', 'Kai', 'Nico', 'Omar', 'Owen', 'Ricky', 'Shawn',
  'Taylor', 'Tyrone', 'Will', 'Xavier', 'Zion', 'Austin', 'Blake', 'Carson', 'Chase', 'Garrett', 'Grant', 'Logan', 'Mason', 'Trey']
const F_P = ['Sione', 'Tevita', 'Viliami', 'Siaosi', 'Pita', 'Mosese', 'Taniela', 'Kaimana', 'Kekoa', 'Keoni', 'Makoa', 'Kainoa', 'Malakai',
  'Penei', 'Iosefa', 'Leki', 'Semisi', 'Talanoa', 'Manase', 'Netane', 'Kalani', 'Ikaika', 'Noa', 'Isileli', 'Feleti', 'Sefo', 'Tama',
  'Paea', 'Lokeni', 'Saia', 'Fetu', 'Mana', 'Alapati', 'Kanoa', 'Ioane', 'Tavita', 'Peni', 'Elisala', 'Afa', 'Lemeki']
const F_L = ['Alejandro', 'Mateo', 'Diego', 'Carlos', 'Luis', 'Miguel', 'Adrian', 'Eduardo', 'Javier', 'Andres', 'Marco', 'Rafael',
  'Santiago', 'Cristian', 'Fernando', 'Ricardo', 'Sergio', 'Joaquin', 'Emilio', 'Manny', 'Ramon', 'Hector', 'Angel', 'Ivan', 'Oscar',
  'Esteban', 'Tomas', 'Julio', 'Mario', 'Ruben']

// ── Last names ───────────────────────────────────────────────────────────────
// the most common ones first (a class may have three of these: real classes have their Johnsons and Williamses)
const L_COMMON = ['Williams', 'Johnson', 'Smith', 'Jones', 'Brown', 'Davis', 'Jackson', 'Thomas', 'Harris', 'Robinson', 'Taylor', 'Moore',
  'Wilson', 'Anderson', 'Thompson', 'White', 'Walker', 'Lewis', 'Allen', 'Young', 'Martin', 'Clark', 'Hall', 'Wright', 'Green', 'Scott']
const L_S = ['King', 'Baker', 'Adams', 'Nelson', 'Hill', 'Campbell', 'Mitchell', 'Roberts', 'Carter', 'Phillips', 'Evans', 'Turner', 'Parker',
  'Collins', 'Edwards', 'Stewart', 'Morris', 'Rogers', 'Reed', 'Cook', 'Morgan', 'Bell', 'Cooper', 'Richardson', 'Cox', 'Howard', 'Ward',
  'Peterson', 'Gray', 'James', 'Watson', 'Brooks', 'Kelly', 'Sanders', 'Price', 'Bennett', 'Wood', 'Barnes', 'Ross', 'Henderson', 'Coleman',
  'Jenkins', 'Perry', 'Powell', 'Long', 'Patterson', 'Hughes', 'Butler', 'Simmons', 'Foster', 'Bryant', 'Alexander', 'Russell', 'Griffin',
  'Hayes', 'Myers', 'Ford', 'Hamilton', 'Graham', 'Wallace', 'Woods', 'Cole', 'West', 'Jordan', 'Owens', 'Reynolds', 'Fisher', 'Ellis',
  'Harrison', 'Gibson', 'McDonald', 'Marshall', 'Gordon', 'Kennedy', 'Wells', 'Hunter', 'Hicks', 'Holmes', 'Palmer', 'Mason', 'Mills',
  'Nichols', 'Grant', 'Knight', 'Ferguson', 'Stone', 'Hawkins', 'Dunn', 'Perkins', 'Hudson', 'Spencer', 'Stephens', 'Pierce', 'Black',
  'Daniels', 'Payne', 'Pearson', 'Lane', 'Andrews', 'Riley', 'Armstrong', 'Carpenter', 'Weaver', 'Greene', 'Lawrence', 'Elliott', 'Sims',
  'Austin', 'Peters', 'Lawson', 'Fields', 'Carr', 'Franklin', 'Tucker', 'Porter', 'Hunt', 'Warren', 'Harper', 'Webb', 'Bishop', 'Hart',
  'Fletcher', 'Dawson', 'Holloway', 'Sterling', 'Whitfield', 'Graves', 'McKenzie', 'Ellison', 'Calloway', 'Jennings', 'Kingsley',
  'Lockhart', 'Maddox', 'Norwood', 'Prescott', 'Quarles', 'Stokes', 'Thornton', 'Underwood', 'Whitaker', 'Yates', 'Blackwell', 'Crawford',
  'Easley', 'Freeman', 'Gentry', 'Rhodes', 'Vance', 'Varner', 'Abernathy', 'Dupree', 'Fontaine', 'Hollins', 'Okafor', 'Bradley', 'Burke',
  'Chambers', 'Curtis', 'Dixon', 'Douglas', 'Fowler', 'Fuller', 'Garner', 'Gilmore', 'Hampton', 'Hardy', 'Hopkins', 'Horton', 'Jefferies',
  'Lyons', 'Malone', 'Mathis', 'Maxwell', 'McCoy', 'Middleton', 'Morton', 'Norman', 'Oliver', 'Pope', 'Robbins',
  'Rowe', 'Sharp', 'Shelton', 'Snow', 'Steele', 'Summers', 'Townsend', 'Vaughn', 'Walton', 'Watkins', 'Wheeler', 'Wilkins', 'Willis', 'Wise']
const L_B = ['Washington', 'Jefferson', 'Banks', 'Booker', 'Mosley', 'Battle', 'Gaines', 'Joseph', 'Pierre', 'Charles', 'Dorsey', 'Haynes',
  'Glover', 'Merriweather', 'Peoples', 'Wiggins', 'Cofield', 'Tolbert', 'Muhammad', 'Abdullah', 'Gilliam', 'Spears', 'Lofton', 'Ivory',
  'Pettaway', 'Dukes', 'Grier', 'Hairston', 'McCray', 'McNeal', 'Tillman', 'Whitlow', 'Bolden', 'Pryor', 'Swain', 'Echols', 'Gaither',
  'Hargrove', 'Jemison', 'Linton', 'Mabry', 'Redmond', 'Strickland', 'Truitt', 'Upshaw', 'Wimbush', 'Pugh', 'Rucker', 'Bynum', 'Cheeks',
  'Dabney', 'Fant', 'Goodwin', 'Holley', 'Huff', 'Ingram', 'Langford', 'McFadden', 'Moton', 'Mullins', 'Odom', 'Pittman', 'Ragland',
  'Shipp', 'Waddell', 'Wynn', 'Okonkwo', 'Adeyemi', 'Mensah', 'Owusu', 'Diallo', 'Nwosu', 'Obi', 'Eze', 'Mbaye', 'Okoye', 'Afolabi',
  'Ogbonna', 'Boateng', 'Asante', 'Toussaint', 'Baptiste', 'Jean-Louis', 'Augustin', 'Celestin', 'Desir', 'Fils-Aime', 'Mobley',
  'Ware', 'Blount', 'Bobo', 'Crump', 'Dandridge', 'Foreman', 'Gadson', 'Hagans', 'Hairgrove', 'Kearse', 'Knowles', 'Lattimer', 'Mayo',
  'McGhee', 'Nunn', 'Outlaw', 'Petty', 'Rainey', 'Ricks', 'Simms', 'Spikes', 'Sturdivant', 'Tate', 'Tyner', 'Wallace',
  'Wingate', 'Womack', 'Funderburk', 'Gholston', 'Brisco', 'Covington', 'Dunbar', 'Fobbs', 'Goins', 'Hilliard', 'Lucas',
  'McClain', 'Mims', 'Pringle', 'Royster', 'Session', 'Small', 'Talley', 'Tubbs', 'Vinson', 'Whitehead', 'Byrd', 'Coates', 'Deloach']
const L_W = ['Miller', 'Schmidt', 'Olson', 'Kowalski', 'Novak', 'Becker', 'Zimmerman', 'Hansen', 'Larson', 'Nielsen', 'Jorgensen', 'Murphy',
  "O'Brien", 'Sullivan', 'McCarthy', 'Walsh', 'Doyle', 'Brennan', 'Gallagher', 'Fitzgerald', 'Kavanaugh', 'Hoffman', 'Fischer', 'Weber',
  'Wagner', 'Schneider', 'Meyer', 'Koch', 'Krueger', 'Richter', 'Vogel', 'Hartman', 'Keller', 'Kramer', 'Lehman', 'Baumann', 'Brandt',
  'Stein', 'Ziegler', 'Yoder', 'Bauer', 'Engel', 'Haas', 'Mueller', 'Schultz', 'Snyder', 'Stoltz', 'Wolfe', 'Barrett', 'Bradford',
  'Brewer', 'Bowman', 'Caldwell', 'Chandler', 'Childress', 'Cline', 'Combs', 'Conley', 'Daugherty', 'Decker', 'Duffy', 'Eckert',
  'Fleming', 'Garrison', 'Gilbert', 'Harmon', 'Hatcher', 'Hendricks', 'Hobbs', 'Hogan', 'Holt', 'Hubbard', 'Jacobs', 'Jensen', 'Kemp',
  'Kirby', 'Klein', 'Lambert', 'Lowe', 'Lynch', 'Mahoney', 'McBride', 'McKnight', 'Mercer', 'Moody', 'Nash', 'Norris', "O'Connell",
  'Osborne', 'Pace', 'Patton', 'Pruitt', 'Quinn', 'Rasmussen', 'Reilly', 'Sawyer', 'Schaefer', 'Schofield', 'Shaffer', 'Sheridan', 'Slater',
  'Stanton', 'Stark', 'Strand', 'Sutton', 'Swanson', 'Tanner', 'Tierney', 'Tobin', 'Voss', 'Whitman', 'Wilder', 'Winters', 'Wolff',
  'Kuhn', 'Lutz', 'Roth', 'Sauer', 'Thiel', 'Haugen', 'Berg', 'Dahl', 'Lund', 'Thorsen', 'Ostrowski', 'Wojcik', 'Zielinski', 'Kaminski',
  'Nowak', 'Pulaski', 'Kessler', 'Carlson', 'Erickson', 'Gustafson', 'Halvorsen', 'Lindgren', 'Magnuson', 'Nyberg', 'Paulson', 'Sorensen',
  'Beckett', 'Bergstrom', 'Brandon', 'Burgess', 'Callahan', 'Coughlin', 'Dempsey', 'Driscoll', 'Egan', 'Finnegan', 'Flanagan', 'Galvin',
  'Hennessy', 'Keane', 'Keough', 'Lennon', 'Maguire', 'Moran', 'Nolan', 'Phelan', 'Quigley', 'Regan', 'Rooney', 'Shea', 'Toomey',
  'Ahlberg', 'Albrecht', 'Baer', 'Bergman', 'Dietrich', 'Ebert', 'Frank', 'Gruber', 'Hauser', 'Herrmann', 'Jaeger', 'Kohler', 'Lang',
  'Metzger', 'Pfeiffer', 'Reinhardt', 'Schroeder', 'Schuster', 'Seidel', 'Strauss', 'Ullrich', 'Wendt', 'Bancroft', 'Barlow', 'Blackburn',
  'Brock', 'Cassidy', 'Cutler', 'Emery', 'Fairbanks', 'Garland', 'Hadley', 'Halsey', 'Kendrick', 'Kimball', 'Lockwood',
  'Mansfield', 'Prater', 'Radcliffe', 'Ransom', 'Rutledge', 'Sheffield', 'Stockton', 'Thayer', 'Wakefield', 'Whitley', 'Yarbrough']
const L_P = ['Fifita', 'Taufa', 'Moala', 'Mauga', 'Tupou', 'Havili', 'Vea', 'Latu', 'Fonua', 'Kaufusi', 'Tonga', 'Pola', 'Lauina', 'Fuimaono',
  'Sopoaga', 'Tuitele', 'Leota', 'Alualu', 'Fale', 'Toleafoa', 'Seumalo', 'Tago', 'Fiso', 'Malau', 'Lavea', 'Lefiti', 'Pouha', 'Kioa',
  'Tafuna', 'Mataele', 'Afalava', 'Masoli', 'Unga', 'Paongo', 'Kaho', 'Palelei', 'Siliga', 'Tuipea', 'Vainikolo', 'Lolohea', 'Faleafa',
  'Tuiasosopo', 'Sapolu', 'Fonoti', 'Kemoeatu', 'Mahe', 'Taumoepeau', 'Vaifanua', 'Pututau', 'Aumavae']
const L_L = ['Garcia', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Perez', 'Sanchez', 'Ramirez', 'Torres', 'Flores', 'Rivera',
  'Gomez', 'Diaz', 'Reyes', 'Morales', 'Ortiz', 'Gutierrez', 'Castillo', 'Romero', 'Vargas', 'Mendoza', 'Herrera', 'Medina', 'Aguilar',
  'Delgado', 'Castro', 'Salazar', 'Navarro', 'Cardenas', 'Fuentes', 'Ochoa', 'Valdez', 'Zamora', 'Espinoza', 'Ibarra']

// which lists a background draws from: [list, weight]
const FIRST = { b: [[F_B, 7], [F_S, 3]], w: [[F_W, 7], [F_S, 3]], m: [[F_S, 5], [F_B, 3], [F_W, 2]], p: [[F_P, 6], [F_S, 3], [F_W, 1]], l: [[F_L, 6], [F_S, 4]] }
const LAST = { b: [[L_COMMON, 3], [L_S, 4], [L_B, 4]], w: [[L_COMMON, 2], [L_S, 4], [L_W, 5]], m: [[L_COMMON, 3], [L_S, 5], [L_B, 1], [L_W, 1]], p: [[L_P, 1]], l: [[L_L, 1]] }
const COMMON = new Set(L_COMMON)

// FAMOUS: names a made-up man must never have. Every real player in the game's data (all sports) whose first and
// last names are both on these lists (scripts/franchise2/names-famous.mjs writes this list), and famous men the
// data doesn't have.
const FAMOUS = new Set([
  // (scripts/franchise2/names-famous.mjs)
  /*FAMOUS*/
  'Aaron Banks', 'Aaron Brewer', 'Aaron Butler', 'Aaron Cook', 'Aaron Gordon', 'Aaron Johnson', 'Aaron Jones', 'Aaron McBride',
  'Aaron Smith', 'Aaron Wiggins', 'Adam Butler', 'Adam Clark', 'Adam Koch', 'Adam Weber', 'Adrian Martinez', 'Adrian Peterson',
  'Ahmad Hardy', 'Ahmad Henderson', 'Ahmad Miller', 'Akeem Wright', 'Alex Collins', 'Alex Gordon', 'Alex Morales', 'Alex Ross', 'Alex Scott',
  'Alex Smith', 'Alex Taylor', 'Alex Wilkins', 'Amari Allen', 'Amari Cooper', 'Amari Evans', 'Amari Williams', 'Andre Davis', 'Andre Dawson',
  'Andre Hall', 'Andre Jackson', 'Andre Johnson', 'Andre Miller', 'Andre Mills', 'Andre Reed', 'Andre Ware', 'Andre Williams',
  'Andrew Phillips', 'Andrew Pierce', 'Andrew Thomas', 'Andrew Wiggins', 'Angel Delgado', 'Angel Flores', 'Anthony Black', 'Anthony Carter',
  'Anthony Davis', 'Anthony Dixon', 'Anthony Edwards', 'Anthony Evans', 'Anthony Garcia', 'Anthony Gordon', 'Anthony Hill',
  'Anthony Johnson', 'Anthony Lucas', 'Anthony Miller', 'Anthony Reed', 'Anthony Richardson', 'Anthony Robinson', 'Anthony Smith',
  'Anthony Thompson', 'Anthony Weaver', 'Anthony Woods', 'Antonio Andrews', 'Antonio Brown', 'Antonio Bryant', 'Antonio Davis',
  'Antonio Freeman', 'Antonio Gibson', 'Antonio Harris', 'Antonio Johnson', 'Antonio Jordan', 'Antonio Martin', 'Antonio Pierce',
  'Antonio Williams', 'Antwan Roberts', 'Asher Clark', 'Ashton Daniels', 'Ashton Gray', 'Austin Carr', 'Austin Jackson', 'Austin Simmons',
  'Austin Wells', 'Beau Morgan', 'Ben Bennett', 'Ben Black', 'Ben Coates', 'Ben Ford', 'Ben Johnson', 'Ben Simmons', 'Ben Wallace',
  'Blake Baker', 'Blake Griffin', 'Blake Harper', 'Blake Miller', 'Bo Jackson', 'Braden Huff', 'Braden Smith', 'Brady Anderson',
  'Brady Cook', 'Brady Hart', 'Brady Quinn', 'Brady White', 'Brandon Allen', 'Brandon Coleman', 'Brandon Garrison', 'Brandon Graham',
  'Brandon Ingram', 'Brandon Jennings', 'Brandon Johnson', 'Brandon Jones', 'Brandon Lowe', 'Brandon Marshall', 'Brandon Miller',
  'Brandon Stephens', 'Brandon Webb', 'Brandon White', 'Brandon Williams', 'Brandon Young', 'Brennan Armstrong', 'Brett Decker',
  'Brian Bell', 'Brian Cook', 'Brian Flores', 'Brian Fuentes', 'Brian Grant', 'Brian Hill', 'Brian Johnson', 'Brian Mitchell',
  'Brian Pruitt', 'Brian Roberts', 'Brian Robinson', 'Brian Rowe', 'Brian Salazar', 'Brian Simmons', 'Brian Thomas', 'Brock Burke',
  'Brock Hoffman', 'Brock Wright', 'Brody Robinson', 'Brooks Robinson', 'Bryant Young', 'Bryce Baker', 'Bryce Brown', 'Bryce Ford',
  'Bryce Harper', 'Bryce Hopkins', 'Bryce James', 'Bryce Oliver', 'Bryce Petty', 'Bryce Underwood', 'Bryce Yates', 'Bryce Young',
  'Cade Phillips', 'Cade Smith', 'Caden Pierce', 'Caden Powell', 'Caleb Douglas', 'Caleb Foster', 'Caleb Hawkins', 'Caleb Holt',
  'Caleb Martin', 'Caleb Walker', 'Caleb Williams', 'Caleb Wilson', 'Calvin Austin', 'Calvin Johnson', 'Calvin Murphy', 'Calvin Russell',
  'Camden Coleman', 'Cameron Carr', 'Cameron Holmes', 'Cameron Johnson', 'Cameron Jordan', 'Cameron Latu', 'Cameron Payne', 'Cameron Thomas',
  'Cameron Williams', 'Carlos Delgado', 'Carlos Hernandez', 'Carlos Yates', 'Carson Clark', 'Carson Hansen', 'Carson Johnson',
  'Carson Palmer', 'Carter Bradley', 'Carter Bryant', 'Carter Jensen', 'Carter Jones', 'Casey Fitzgerald', 'Casey Jones', 'Cason Wallace',
  'Cedric Gray', 'Cedric Maxwell', 'Cedric Tillman', 'Chad Brown', 'Chad Cook', 'Charles Johnson', 'Charles Roberts', 'Charles Robinson',
  'Charles Rogers', 'Charles Sharp', 'Charles Smith', 'Charles Tillman', 'Charles White', 'Charles Williams', 'Chase Brown', 'Chase Foster',
  'Chase Hendricks', 'Chase Thompson', 'Chase Walker', 'Chase Young', 'Chris Bell', 'Chris Brooks', 'Chris Carpenter', 'Chris Davis',
  'Chris Douglas', 'Chris Jackson', 'Chris Johnson', 'Chris Jones', 'Chris Lawson', 'Chris Lofton', 'Chris Marshall', 'Chris Myers',
  'Chris Parker', 'Chris Porter', 'Chris Reed', 'Chris Reynolds', 'Chris Rodriguez', 'Chris Williams', 'Chris Wood', 'Christian Anderson',
  'Christian Brown', 'Christian Collins', 'Christian Gonzalez', 'Christian Harmon', 'Christian Harris', 'Christian Haynes',
  'Christian Jones', 'Christian Moore', 'Christian Parker', 'Christian Rhodes', 'Christian Scott', 'Christian Walker', 'Christian Watson',
  'Cody Hoffman', 'Cody Jackson', 'Cody White', 'Cody Williams', 'Colby Garland', 'Cole Bishop', 'Cole Campbell', 'Cole Franklin',
  'Cole Palmer', 'Collin Chandler', 'Collin Dixon', 'Collin Klein', 'Collin Tanner', 'Colton Joseph', 'Connor Cook', 'Cooper Koch',
  'Corey Brewer', 'Corey Coleman', 'Corey Davis', 'Corey Hawkins', 'Corey Robinson', 'Corey Scott', 'Cornelius Bennett', 'Dalton Schultz',
  'Damon Ferguson', 'Dane Evans', 'Daniel Carlson', 'Daniel Hill', 'Daniel Jones', 'Daniel Porter', 'Daniel Thomas', 'Dante Allen',
  'Dante Moore', 'Darian Mensah', 'Darius Adams', 'Darius Cooper', 'Darius Garland', 'Darius Taylor', 'Darnell Washington', 'Darnell Wright',
  'Darrell Green', 'Darrell Henderson', 'Darrell Thompson', 'Darren Brooks', 'Darren Harris', 'Darren Lewis', 'Darren McFadden',
  'David Bell', 'David Carr', 'David Castillo', 'David Edwards', 'David Gomez', 'David Greene', 'David Harris', 'David Johnson',
  'David Ortiz', 'David Peterson', 'David Price', 'David Rhodes', 'David Robinson', 'David Thompson', 'David West', 'David Williams',
  'David Wilson', 'David Wright', 'Davis Martin', 'Davis Mills', 'Davis Warren', 'Davis Webb', 'Dax Hall', 'Dax Hill', 'Declan Doyle',
  'Demetrius Knight', 'Demond Williams', 'Derek Carr', 'Derek Dixon', 'Derek Harper', 'Derrick Barnes', 'Derrick Brooks', 'Derrick Brown',
  'Derrick Coleman', 'Derrick Johnson', 'Derrick Jones', 'Derrick Mason', 'Derrick Thomas', 'Derrick White', 'Derrick Williams',
  'Desmond Clark', 'Desmond Howard', 'Devin Booker', 'Devin Brown', 'Devin Carter', 'Devin Harris', 'Devin West', 'Devin Williams',
  'Devonta Freeman', 'Devontae Booker', 'Dexter Lawrence', 'Dexter Williams', 'Dillon Bell', 'Dillon Brooks', 'Dillon Jones',
  'Dillon Mitchell', 'Donte Jackson', 'Dorian Williams', 'Drew Rasmussen', 'Drew Wagner', 'Dwayne Harris', 'Dwight Howard',
  'Dwight Phillips', 'Dwight Powell', 'Dylan Edwards', 'Dylan Grant', 'Dylan Harper', 'Dylan James', 'Dylan Riley', 'Eduardo Rodriguez',
  'Eli Jenkins', 'Eli Robinson', 'Eli Wood', 'Elijah Brown', 'Elijah Crawford', 'Elijah Fisher', 'Elijah Holmes', 'Elijah Jones',
  'Elijah Mitchell', 'Elijah Moore', 'Elijah Porter', 'Elijah Price', 'Elijah Thomas', 'Elijah Williams', 'Emmanuel Sanders',
  'Emmett Johnson', 'Emmett Mosley', 'Eric Allen', 'Eric Decker', 'Eric Gordon', 'Eric Gray', 'Eric Green', 'Eric Richardson', 'Eric Stokes',
  'Eric Wilson', 'Ethan Brown', 'Ethan Crawford', 'Ethan Roberts', 'Ethan Taylor', 'Ethan Thompson', 'Evan Brown', 'Evan Mobley',
  'Evan Stewart', 'Evan Turner', 'Evan Williams', 'Fernando Mendoza', 'Fernando Torres', 'Garrett Johnson', 'Garrett Mitchell',
  'Garrett Williams', 'Garrett Wilson', 'Garrett Wolfe', 'Gavin Freeman', 'Gavin Griffin', 'Gavin Williams', 'Grant Hill', 'Grant Taylor',
  'Grant Williams', 'Grant Wilson', 'Gunnar Henderson', 'Gus Bradley', 'Gus Edwards', 'Gus Williams', 'Hakeem Butler', 'Hank Brown',
  'Harrison Armstrong', 'Harrison Barnes', 'Harrison Ingram', 'Harrison Phillips', 'Harrison Smith', 'Hunter Brown', 'Hunter Summers',
  'Ian Clark', 'Ian Jackson', 'Ian Johnson', 'Ian Thomas', 'Isaac Brown', 'Isaac Carr', 'Isaac Ellis', 'Isaac Fontaine', 'Isaac Jones',
  'Isaac Seumalo', 'Isaac Williams', 'Isaac Wilson', 'Isaiah Adams', 'Isaiah Brown', 'Isaiah Coleman', 'Isaiah Crawford', 'Isaiah Davis',
  'Isaiah Evans', 'Isaiah Ford', 'Isaiah Horton', 'Isaiah Jackson', 'Isaiah Johnson', 'Isaiah Malone', 'Isaiah Marshall', 'Isaiah Myers',
  'Isaiah Rogers', 'Isaiah Stewart', 'Isaiah Thomas', 'Isaiah Ward', 'Isaiah West', 'Ivan Pace', 'Jabari Lewis', 'Jabari Smith',
  'Jabari Walker', 'Jace Petty', 'Jack Campbell', 'Jack Doyle', 'Jack Lambert', 'Jack Moran', 'Jack Morris', 'Jack Perkins', 'Jack Thompson',
  'Jacob Clark', 'Jacob Green', 'Jacob Lopez', 'Jacob Martin', 'Jacob Rodriguez', 'Jacob Walker', 'Jacob Webb', 'Jacob Wilson',
  'Jacob Young', 'Jaden Barnes', 'Jaden Bradley', 'Jaden Hardy', 'Jaden Johnson', 'Jaden Keller', 'Jaden Smith', 'Jaden Zimmerman',
  'Jahlil McClain', 'Jahmir Young', 'Jake Bennett', 'Jake Davis', 'Jake Elliott', 'Jake Ferguson', 'Jake Hall', 'Jake Hansen',
  'Jake McCarthy', 'Jake Moody', 'Jake Scott', 'Jake West', 'Jake Wilkins', 'Jalen Brooks', 'Jalen Carter', 'Jalen Cooper', 'Jalen Dupree',
  'Jalen Green', 'Jalen Harper', 'Jalen Haynes', 'Jalen Jackson', 'Jalen Johnson', 'Jalen Redmond', 'Jalen Smith', 'Jalen Stokes',
  'Jalen Thompson', 'Jalen Tolbert', 'Jalen Williams', 'Jalen Wilson', 'Jalon Daniels', 'Jamal Adams', 'Jamal Lewis', 'Jamal Roberts',
  'Jamari Hawkins', 'Jamari Phillips', 'James Brooks', 'James Cook', 'James Garner', 'James Hardy', 'James Harrison', 'James Jones',
  'James Lofton', 'James Morgan', 'James Scott', 'James Washington', 'James Wilder', 'James Williams', 'James Wood', 'Jamir Watkins',
  'Jaquan Johnson', 'Jared Allen', 'Jared Butler', 'Jared Curtis', 'Jared Hollins', 'Jared Jones', 'Jared Richardson', 'Jared Wilson',
  'Jarvis Green', 'Jason Campbell', 'Jason Collins', 'Jason Hill', 'Jason Marshall', 'Jason Myers', 'Jason Patterson', 'Jason Peters',
  'Jason Sanders', 'Jason Schofield', 'Jason Smith', 'Jason Taylor', 'Jason Williams', 'Jason Wright', 'Jasper Johnson', 'Javon Bennett',
  'Javon Perry', 'Javon Robinson', 'Javon Rogers', 'Javon Ross', 'Javon Small', 'Javonte Green', 'Javonte Williams', 'Jaxon Johnson',
  'Jaxon Kohler', 'Jaxon Richardson', 'Jayden Daniels', 'Jayden Dawson', 'Jayden Reed', 'Jayden Ross', 'Jayden Scott', 'Jaylen Adams',
  'Jaylen Andrews', 'Jaylen Brown', 'Jaylen Clark', 'Jaylen Hampton', 'Jaylen Henderson', 'Jaylen Petty', 'Jaylen Thompson', 'Jaylen Warren',
  'Jaylen Watson', 'Jaylen Wells', 'Jaylen Wright', 'Jaylin Carter', 'Jaylin Williams', 'Jaylon Hawkins', 'Jaylon Johnson', 'Jaylon Moore',
  'Jeremiah Jackson', 'Jeremiah Nash', 'Jeremiah Smith', 'Jeremiah Ware', 'Jeremy Payne', 'Jeremy Scott', 'Jermaine Austin',
  'Jermaine Johnson', 'Jermaine Lewis', 'Jermaine Taylor', 'Jerome Brown', 'Jerome Ford', 'Jerome Harrison', 'Jerome Lane', 'Jett Howard',
  'Joel Campbell', 'John Blackwell', 'John Carter', 'John Collins', 'John Henderson', 'John Jefferson', 'John Lucas', 'John Lynch',
  'John Mobley', 'John Stockton', 'John Taylor', 'John White', 'Jonah Coleman', 'Jonah Jackson', 'Jonathan Adams', 'Jonathan Allen',
  'Jonathan Ford', 'Jonathan Joseph', 'Jonathan Powell', 'Jonathan Smith', 'Jonathan Stewart', 'Jonathan Taylor', 'Jordan Allen',
  'Jordan Anderson', 'Jordan Battle', 'Jordan Bell', 'Jordan Clark', 'Jordan Crawford', 'Jordan Davis', 'Jordan Ford', 'Jordan Goodwin',
  'Jordan Hawkins', 'Jordan Hicks', 'Jordan James', 'Jordan Lynch', 'Jordan Marshall', 'Jordan Mason', 'Jordan Miller', 'Jordan Morgan',
  'Jordan Palmer', 'Jordan Phillips', 'Jordan Pope', 'Jordan Reed', 'Jordan Rogers', 'Jordan Ross', 'Jordan Scott', 'Jordan Shipp',
  'Jordan Smith', 'Jordan Turner', 'Jordan Walker', 'Jordan Walsh', 'Jordan Watkins', 'Jordan White', 'Jordyn Brooks', 'Joseph Williams',
  'Josh Allen', 'Josh Beckett', 'Josh Gordon', 'Josh Green', 'Josh Hamilton', 'Josh Harris', 'Josh Hart', 'Josh Holloway', 'Josh Howard',
  'Josh Hubbard', 'Josh Jacobs', 'Josh Johnson', 'Josh King', 'Josh Lowe', 'Josh Myers', 'Josh Norman', 'Josh Oliver', 'Josh Pearson',
  'Josh Reed', 'Josh Rodriguez', 'Josh Simmons', 'Josh Smith', 'Joshua Clark', 'Joshua Jefferson', 'Joshua Palmer', 'Joshua Porter',
  'Josiah Freeman', 'Josiah Moore', 'Josiah Parker', 'Josiah Sanders', 'Julian Lewis', 'Julian Phillips', 'Julio Jones', 'Justin Caldwell',
  'Justin Edwards', 'Justin Fields', 'Justin Hall', 'Justin Hardy', 'Justin Harper', 'Justin Jackson', 'Justin Jefferson', 'Justin McBride',
  'Justin Smith', 'Justin Tucker', 'Kaden Cooper', 'Kareem Hunt', 'Kareem Jackson', 'Keenan Allen', 'Keenan Jackson', 'Keenan Phillips',
  'Keenan Reynolds', 'Keion White', 'Kellen Hampton', 'Kellen Moore', 'Kelvin Banks', 'Kelvin Harmon', 'Kelvin Martin', 'Kendall Harris',
  'Kendall Williams', 'Kendall Wright', 'Kendrick Warren', 'Kenny Anderson', 'Kenny Clark', 'Kenny Easley', 'Kenny Green', 'Kenny Jackson',
  'Kenny Johnson', 'Kenny Rogers', 'Kenny Sanders', 'Kenny Thomas', 'Kenny Williams', 'Kenyon Martin', 'Keon Coleman', 'Keon Ellis',
  'Kevin Anderson', 'Kevin Butler', 'Kevin Curtis', 'Kevin Foster', 'Kevin Jennings', 'Kevin Johnson', 'Kevin Jones', 'Kevin Kelly',
  'Kevin O\'Connell', 'Kevin Porter', 'Kevin Richardson', 'Kevin Smith', 'Khalil Tate', 'Kirk Snyder', 'Kobe Brown', 'Kobe Bryant',
  'Kobe Sanders', 'Kolby King', 'Kordell Stewart', 'Kyle Allen', 'Kyle Anderson', 'Kyle Evans', 'Kyle Hamilton', 'Kyle Hendricks',
  'Kyle Jorgensen', 'Kyle Koch', 'Kyle McNeal', 'Kyle Tucker', 'Kyle Weaver', 'Kyle Williams', 'Lamar Butler', 'Lamar Jackson', 'Lamar Odom',
  'Lamar Washington', 'Lance Dunbar', 'Lance Moore', 'Lane Johnson', 'Levi Lewis', 'Liam Hicks', 'Lincoln Kennedy', 'Lincoln Williams',
  'Logan Gilbert', 'Logan Henderson', 'Logan Webb', 'Lorenzo White', 'Luis Castillo', 'Luis Medina', 'Luke Walsh', 'Luke Weaver',
  'Luke Wilson', 'Mac Jones', 'Mack Hollins', 'Mack Wilson', 'Malachi Fields', 'Malachi Nelson', 'Malachi Palmer', 'Malcolm Jenkins',
  'Malcolm Perry', 'Malcolm Rodriguez', 'Malcolm Thomas', 'Malik Davis', 'Malik Harrison', 'Malik Tillman', 'Malik Washington',
  'Malik Willis', 'Marcus Adams', 'Marcus Allen', 'Marcus Cox', 'Marcus Green', 'Marcus Harris', 'Marcus Johnson', 'Marcus Spears',
  'Marcus Stokes', 'Mario Sanders', 'Mario Williams', 'Mark Andrews', 'Mark Fletcher', 'Mark Haynes', 'Mark Ingram', 'Mark Jackson',
  'Mark Mitchell', 'Mark Price', 'Mark Sanchez', 'Mark Williams', 'Markus Allen', 'Markus Howard', 'Marquis Johnson', 'Marshall Henderson',
  'Mason Graham', 'Mason King', 'Mason McKenzie', 'Mason Miller', 'Mason Taylor', 'Mason Williams', 'Matt Bryant', 'Matt Burke',
  'Matt Coleman', 'Matt Fuller', 'Matt Howard', 'Matt Johnson', 'Matt Jones', 'Matt Long', 'Matt Olson', 'Matt Prater', 'Matt Williams',
  'Maurice Lucas', 'Maurice Turner', 'Max Johnson', 'Max Meyer', 'Mekhi Anderson', 'Mekhi Collins', 'Mekhi Mason', 'Mekhi Miller',
  'Mekhi Nelson', 'Micah Ford', 'Micah Gilbert', 'Micah Hudson', 'Micah McFadden', 'Micah Robinson', 'Michael Adams', 'Michael Bennett',
  'Michael Bishop', 'Michael Brooks', 'Michael Carter', 'Michael Cooper', 'Michael Gray', 'Michael Griffin', 'Michael Harris',
  'Michael Hawkins', 'Michael Jordan', 'Michael King', 'Michael Mitchell', 'Michael Pittman', 'Michael Porter', 'Michael Scott',
  'Michael Smith', 'Michael Thomas', 'Michael Turner', 'Michael Warren', 'Michael Wilson', 'Michael Young', 'Miguel Vargas', 'Miles Byrd',
  'Miles Coleman', 'Miles McBride', 'Miles Sanders', 'Mitchell Evans', 'Mitchell Robinson', 'Myles Mitchell', 'Myles Murphy', 'Myles Powell',
  'Myles Turner', 'Myles Walker', 'Nasir Meyer', 'Nasir Williams', 'Nate Bennett', 'Nate Davis', 'Nate Rogers', 'Nate Wiggins',
  'Nate Williams', 'Nathan Hayes', 'Nathan Mensah', 'Nathan Stewart', 'Nick Allen', 'Nick Anderson', 'Nick Martinez', 'Nick Nash',
  'Nick Scott', 'Nick Townsend', 'Nico Brown', 'Nico Collins', 'Nico Williams', 'Noa Lang', 'Noah Fant', 'Noah Fifita', 'Noah Gray',
  'Noah Jennings', 'Noah Okafor', 'Noah White', 'Noah Williams', 'Nolan James', 'Nolan Smith', 'Omar Cooper', 'Omar Jacobs', 'Omari Hayes',
  'Omari Moore', 'Owen Allen', 'Owen Daniels', 'Owen Larson', 'Parker Robinson', 'Parker Washington', 'Patrick Berg', 'Patrick Edwards',
  'Patrick Graham', 'Patrick Jones', 'Patrick Peterson', 'Patrick Williams', 'Patrick Willis', 'Paul Gruber', 'Paul Lowe', 'Paul Palmer',
  'Paul Pierce', 'Paul Reed', 'Paul Smith', 'Paxton Lynch', 'Peter Lambert', 'Peyton Jones', 'Peyton Watson', 'Peyton White',
  'Preston Bowman', 'Preston Brown', 'Preston Turner', 'Quincy Riley', 'Quincy Williams', 'Quinn Ellis', 'Quinton Patton', 'Raheem Morris',
  'Rashad Jennings', 'Rashawn Slater', 'Rasheed Jones', 'Rasheed Wallace', 'Reed Harris', 'Reese Miller', 'Reggie Jackson', 'Reggie Miller',
  'Reggie Nelson', 'Reggie Slater', 'Reggie White', 'Reggie Williams', 'Ricky Johnson', 'Ricky Pierce', 'Ricky White', 'Ricky Williams',
  'Riley Greene', 'Riley O\'Brien', 'Riley Parker', 'Robert Davis', 'Robert Fields', 'Robert Griffin', 'Robert Hunt', 'Robert Jennings',
  'Robert Mathis', 'Robert Miller', 'Robert Smith', 'Robert Williams', 'Robert Woods', 'Robert Wright', 'Rodney Brown', 'Rodney Fields',
  'Rodney Hampton', 'Rodney Harrison', 'Rodney Nelson', 'Ruben Brown', 'Ryan Blount', 'Ryan Dunn', 'Ryan Fitzgerald', 'Ryan Hopkins',
  'Ryan Howard', 'Ryan Hunt', 'Ryan Watson', 'Ryan Wolfe', 'Ryan Zimmerman', 'Samari Howard', 'Samuel Brown', 'Samuel Harris',
  'Santiago Castro', 'Savion Williams', 'Sawyer Anderson', 'Sean Burke', 'Sean Elliott', 'Sean Stewart', 'Sean Taylor', 'Sean Tucker',
  'Sean Wilson', 'Shamar Porter', 'Shaun Alexander', 'Shaun King', 'Shawn Bradley', 'Shawn Jones', 'Shawn Moore', 'Shemar James',
  'Solomon Thomas', 'Spencer Brown', 'Spencer Jones', 'Stanley Morgan', 'Stephen Cooper', 'Sutton Smith', 'Taj Bradley', 'Taj Gibson',
  'Tanner Gentry', 'Tanner Gordon', 'Tanner Hudson', 'Tanner Scott', 'Tavon Austin', 'Taylor Hendricks', 'Taylor Moton', 'Taylor Ward',
  'Terrance Ferguson', 'Terrance Williams', 'Terrell Brandon', 'Terrell Davis', 'Terrell Owens', 'Terry Baker', 'Terry Miller',
  'Terry Porter', 'Tevin Coleman', 'Thomas Bryant', 'Thomas Davis', 'Thomas Jones', 'Tony Adams', 'Tony Allen', 'Tony Bradley', 'Tony Diaz',
  'Tony Gonzalez', 'Tony Mitchell', 'Tony Parker', 'Torrey Smith', 'Trace Johnson', 'Travis Greene', 'Travis Hunter', 'Travis Jones',
  'Travis Perry', 'Travon Walker', 'Tre Johnson', 'Tre Jones', 'Tre Mason', 'Tre Richardson', 'Tre Tucker', 'Tre White', 'Trent Brown',
  'Trent Mosley', 'Trent Perry', 'Trent Pierce', 'Trent Taylor', 'Trent Walker', 'Trent Williams', 'Trevor Hoffman', 'Trevor Lawrence',
  'Trevor McDonald', 'Trevor Rogers', 'Trey Alexander', 'Trey Burke', 'Trey Campbell', 'Trey Green', 'Trey Jemison', 'Trey McBride',
  'Trey Murphy', 'Trey Owens', 'Trey Parker', 'Trey Petty', 'Trey Smith', 'Tristan Peters', 'Troy Bell', 'Troy Brown', 'Troy Davis',
  'Troy Edwards', 'Troy Franklin', 'Troy Henderson', 'Troy Murphy', 'Troy Smith', 'Tucker McDonald', 'Ty Chandler', 'Ty Clark', 'Ty Hawkins',
  'Ty Johnson', 'Ty Mims', 'Ty Robinson', 'Tyler Adams', 'Tyler Alexander', 'Tyler Bell', 'Tyler Booker', 'Tyler Brown', 'Tyler Hendricks',
  'Tyler Hughes', 'Tyler Johnson', 'Tyler Morton', 'Tyler Perkins', 'Tyler Rogers', 'Tyler Smith', 'Tyler Tanner', 'Tyler Warren',
  'Tyquan Thornton', 'Tyree Jackson', 'Tyrell Ward', 'Tyrone Hill', 'Tyrone Riley', 'Tyson Campbell', 'Tyson Wheeler', 'Vance Joseph',
  'Vernon Davis', 'Vernon Maxwell', 'Vernon Smith', 'Victor Snow', 'Victor Tucker', 'Wade Davis', 'Wade Phillips', 'Wade Smith',
  'Wade Taylor', 'Walker Kessler', 'Wendell Carter', 'Wendell Moore', 'Wes Chandler', 'Wes Phillips', 'Wil Lutz', 'Will Anderson',
  'Will Campbell', 'Will Fuller', 'Will Grier', 'Will Henderson', 'Will Howard', 'Will Johnson', 'Will Riley', 'Will Smith', 'Will Thomas',
  'Will Warren', 'Will Wilson', 'William Berg', 'William Moore', 'William Watson', 'Wyatt Langford', 'Wyatt Young', 'Xavier Booker',
  'Xavier Edwards', 'Xavier Rhodes', 'Xavier Smith', 'Xavier Tillman', 'Xavier Townsend', 'Xavier Woods', 'Zach Allen', 'Zach Collins',
  'Zach Miller', 'Zach Thomas', 'Zach Wilson', 'Zaire Barnes', 'Zaire Franklin', 'Zamir White', 'Zane Gonzalez', 'Zion Johnson',
  'Zion Turner',
  /*END*/
  'Michael Jordan', 'Michael Jackson', 'Michael Johnson', 'Will Smith', 'Tiger Woods', 'Chris Brown', 'Kevin Hart', 'Chris Rock',
  'Michael Vick', 'Marcus Allen', 'Tony Gonzalez', 'Reggie White', 'Calvin Johnson', 'Andre Johnson', 'Chris Johnson', 'Josh Allen',
  'Jalen Carter', 'Derrick Brooks', 'Andre Reed', 'Ed Reed', 'Deion Sanders', 'Barry Sanders', 'Jerry Rice', 'Jim Brown', 'Ray Lewis',
  'Bo Jackson', 'Lamar Jackson', 'Cam Newton', 'Peyton Manning', 'Eli Manning', 'Jamal Adams', 'Elijah Mitchell', 'Ricky Williams',
  'Kevin Durant', 'Anthony Davis', 'Chris Paul', 'James Harden', 'Russell Wilson', 'Patrick Ewing', 'Larry Bird', 'Tony Parker',
  'Paul George', 'John Wall', 'Kyle Walker', 'Harry Kane', 'Mike Tyson', 'Aaron Judge', 'Mookie Betts', 'Derek Jeter', 'Mark Wahlberg',
])
const famous = n => FAMOUS.has(n)

const pickW = (R, pairs) => { let t = 0; for (const [, w] of pairs) t += w; let u = R.u() * t; for (const [v, w] of pairs) { u -= w; if (u <= 0) return v } return pairs[pairs.length - 1][0] }
const pickIn = (R, lists) => R.pick(pickW(R, lists))
const capOf = last => (COMMON.has(last) ? 3 : 2)

// a made-up man's name (see the top); `real`: a Set of the real men's names to stay clear of (league.js hands it in)
export function nameFor(R, pos, { taken = null, surn = null, real = null } = {}) {
  const mix = mixOf(pos)
  let n = null
  for (let t = 0; t < 80; t++) {
    const g = pickW(R, mix)
    const first = pickIn(R, FIRST[g] ?? FIRST.m), last = pickIn(R, LAST[g] ?? LAST.m)
    if (first === last) continue
    n = `${first} ${last}`
    if (famous(n) || real?.has(n) || taken?.has(n)) continue
    if (surn && (surn.get(last) ?? 0) >= capOf(last) && t < 70) continue
    // (his drawn face is of the same background: faces.js draws it from his name)
    if (t < 60 && bgOf(n, pos) !== g) continue
    break
  }
  if (surn) { const last = n.slice(n.indexOf(' ') + 1); surn.set(last, (surn.get(last) ?? 0) + 1) }
  taken?.add(n)
  return n
}
export const famousName = famous
