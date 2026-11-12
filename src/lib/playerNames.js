// The random-name button's names (Career's new-career form, College Football's name step) and the made-up players
// a college roster takes in once its real ones have moved on (components/cfb/cfbShared.js seasonData).
export const FIRST_NAMES = ['Marcus', 'Jalen', 'Tre', 'DeShawn', 'Cole', 'Isaiah', 'Brock', 'Malik', 'Darius', 'Kade', 'Xavier', 'Jordan', 'Bryce', 'Tyson', 'Elijah', 'Grant', 'Rashad', 'Mason', 'Caleb', 'Jaylen', 'Devin', 'Trey', 'Andre', 'Dominic', 'Quentin', 'Zion', 'Myles', 'Cam', 'Jace', 'Amari', 'Keon', 'Luca', 'Nico', 'Reggie', 'Terrell', 'Bo', 'Cooper', 'Dante', 'Gavin', 'Hunter', 'Jamal', 'Khalil', 'Lamont', 'Micah', 'Owen', 'Preston', 'Rome', 'Silas', 'Tavon', 'Wyatt']
export const LAST_NAMES = ['Williams', 'Johnson', 'Carter', 'Brooks', 'Mitchell', 'Hayes', 'Coleman', 'Bennett', 'Sanders', 'Reed', 'Washington', 'Harrison', 'Fletcher', 'Dawson', 'Holloway', 'Pierce', 'Sterling', 'Vance', 'Whitfield', 'Graves', 'McKenzie', 'Ellison', 'Booker', 'Calloway', 'Dupree', 'Fontaine', 'Gaines', 'Hollins', 'Jennings', 'Kingsley', 'Lockhart', 'Maddox', 'Norwood', 'Okafor', 'Prescott', 'Quarles', 'Rhodes', 'Stokes', 'Thornton', 'Underwood', 'Varner', 'Whitaker', 'Yates', 'Abernathy', 'Blackwell', 'Crawford', 'Delgado', 'Easley', 'Freeman', 'Gentry']
export const pickName = (list, rnd = Math.random) => list[Math.floor(rnd() * list.length)]
// a first and last name, never the one it's handed (so a second tap always changes it)
export function randomName(not = '') {
  let n
  do { n = `${pickName(FIRST_NAMES)} ${pickName(LAST_NAMES)}` } while (n === not)
  return n
}
