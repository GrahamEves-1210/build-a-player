// FRANCHISE: coaches' names. Men in their forties to sixties, so the names of men born in the 1960s and 70s ("Gary,
// Dennis, Mike, Ron, Greg, Dave, Jim, Steve, Rick, Todd, Kevin, Lovie, Romeo, Marvin, Herm, Tony, Raheem", owner
// 2026-11-15), not the young players' names. Drawn by the coach's background so the name and the face go together.
//   coachName(rnd, g)                  'First Last' (rnd: () => 0..1, g: b w l p m)
//   randomCoachName(not, rnd)          { first, last }, never the one passed in (the coach builder's random button)
const FIRST = {
  w: ['Gary', 'Dennis', 'Mike', 'Ron', 'Greg', 'Dave', 'Jim', 'Steve', 'Rick', 'Todd', 'Kevin', 'Bill', 'Bob', 'Doug', 'Jeff', 'Mark', 'Tom',
    'Pete', 'Dan', 'Joe', 'Wade', 'Chuck', 'Marty', 'Jack', 'Don', 'Ken', 'Rex', 'Buddy', 'Brian', 'Sean', 'John', 'Jay', 'Tim', 'Larry', 'Phil',
    'Ray', 'Wayne', 'Frank', 'Mel', 'Dom', 'Gus', 'Bruce', 'Jerry', 'Rich', 'Scott', 'Kirk', 'Pat', 'Ted', 'Ed', 'Al', 'Monte', 'Norv', 'Wink', 'Rod'],
  b: ['Lovie', 'Romeo', 'Marvin', 'Herm', 'Tony', 'Raheem', 'Leslie', 'Jim', 'Mike', 'Todd', 'Dennis', 'Ray', 'Art', 'Vance', 'Kevin', 'Greg',
    'Curtis', 'Reggie', 'Darrell', 'Eric', 'Teryl', 'Byron', 'Ken', 'Ron', 'Lionel', 'Jerome', 'Cedric', 'Anthony', 'Dwayne', 'Melvin', 'Hue',
    'Vic', 'Larry', 'Steve', 'Jerry', 'Clarence', 'Willie', 'Maurice', 'Terry', 'Floyd', 'Harold'],
  l: ['Tony', 'Robert', 'Ron', 'Mike', 'Joe', 'Dave', 'Ricky', 'Frank', 'Manny', 'Rick', 'Steve', 'Ray'],
  p: ['Ken', 'Kalani', 'Ron', 'Mike', 'Joe', 'Dave', 'Pete'],
}
FIRST.m = [...FIRST.w.slice(0, 20), ...FIRST.b.slice(0, 20)]
const LAST = {
  w: ['Adams', 'Baker', 'Brennan', 'Callahan', 'Carroll', 'Doyle', 'Dwyer', 'Fischer', 'Gallagher', 'Hartman', 'Hoffman', 'Kessler', 'Koch',
    'Kowalski', 'Lindqvist', 'McAllister', 'Novak', "O'Brien", 'Pruitt', 'Quinlan', 'Riggs', 'Schultz', 'Sorensen', 'Stanton', 'Thornton',
    'Vickers', 'Walsh', 'Whitlock', 'Yates', 'Albright', 'Bowers', 'Delaney', 'Fenwick', 'Garner', 'Hollis', 'Jarrett', 'Keene', 'Mercer',
    'Oakes', 'Pennington', 'Rowe', 'Talbert', 'Underwood', 'Shanley', 'Mulcahy', 'Brandt', 'Hauser', 'Lindgren', 'McGraw', 'Rudd', 'Sweeney'],
  b: ['Washington', 'Jefferson', 'Robinson', 'Coleman', 'Simmons', 'Booker', 'Hairston', 'Dorsey', 'Gaines', 'Pettaway', 'Sherrod', 'Holloway',
    'Gibbs', 'Mayfield', 'Turner', 'Bryant', 'Strickland', 'Whitfield', 'Lewis', 'Jackson', 'Moore', 'Henderson', 'Thigpen', 'Dupree', 'Mitchell',
    'Ellison', 'Fuller', 'Grier', 'Hampton', 'Lattimore', 'McCray', 'Rucker', 'Spencer', 'Tolliver', 'Woodard'],
  l: ['Garcia', 'Martinez', 'Alvarez', 'Ramirez', 'Castillo', 'Ortiz', 'Medina', 'Salazar', 'Navarro', 'Fuentes'],
  p: ['Tuiasosopo', 'Mauga', 'Fonoti', 'Kekumu', 'Salave\'a', 'Tuitele'],
}
LAST.m = [...LAST.w.slice(0, 25), ...LAST.b.slice(0, 20)]
const pick = (rnd, list) => list[Math.floor(rnd() * list.length) % list.length]
export function coachName(rnd = Math.random, g = 'w') {
  const k = FIRST[g] ? g : 'w'
  return `${pick(rnd, FIRST[k])} ${pick(rnd, LAST[k])}`
}
// the coach builder's random-name button: a white or a Black coach's name, as the league's staffs run
export function randomCoachName(not = null, rnd = Math.random) {
  for (let k = 0; k < 20; k++) {
    const g = rnd() < 0.78 ? 'w' : 'b'
    const [first, last] = [pick(rnd, FIRST[g]), pick(rnd, LAST[g])]
    if (!not || first !== not.first || last !== not.last) return { first, last }
  }
  return { first: 'Gary', last: 'Brennan' }
}
