/**
 * Common English given-name/nickname equivalence groups — "Art" and
 * "Arthur" are the same first name for dedup purposes, not just a
 * case-insensitive string match. Deliberately a curated, finite list rather
 * than an algorithmic guess (edit-distance would as happily conflate "Don"
 * and "Ron" as it would "Don" and "Donald") — a name pair not covered here
 * simply isn't flagged, which is the safe direction to be wrong in for a
 * merge suggestion.
 */
const NICKNAME_GROUPS: string[][] = [
  ['arthur', 'art'],
  ['robert', 'rob', 'bob', 'bobby', 'robbie'],
  ['william', 'bill', 'billy', 'will', 'willy', 'liam'],
  ['michael', 'mike', 'mikey', 'mick'],
  ['james', 'jim', 'jimmy', 'jamie'],
  ['david', 'dave', 'davy'],
  ['christopher', 'chris'],
  ['elizabeth', 'liz', 'beth', 'betty', 'eliza', 'lizzie'],
  ['thomas', 'tom', 'tommy'],
  ['daniel', 'dan', 'danny'],
  ['steven', 'stephen', 'steve', 'stevie'],
  ['joseph', 'joe', 'joey'],
  ['samuel', 'sam', 'sammy'],
  ['nicholas', 'nick', 'nicky'],
  ['alexander', 'alex', 'sasha'],
  ['benjamin', 'ben', 'benny'],
  ['andrew', 'andy', 'drew'],
  ['anthony', 'tony'],
  ['edward', 'ed', 'eddie', 'ted', 'teddy'],
  ['francis', 'frank', 'frankie'],
  ['gregory', 'greg'],
  ['jeffrey', 'jeff'],
  ['kenneth', 'ken', 'kenny'],
  ['lawrence', 'larry'],
  ['matthew', 'matt'],
  ['patrick', 'pat', 'paddy'],
  ['richard', 'rich', 'rick', 'ricky', 'dick'],
  ['ronald', 'ron', 'ronnie'],
  ['russell', 'russ'],
  ['terrence', 'terence', 'terry'],
  ['timothy', 'tim', 'timmy'],
  ['vincent', 'vince'],
  ['walter', 'walt'],
  ['zachary', 'zack', 'zach'],
  ['nathaniel', 'nathan', 'nate'],
  ['charles', 'charlie', 'chuck'],
  ['frederick', 'fred', 'freddy'],
  ['gerald', 'gerry', 'jerry'],
  ['donald', 'don', 'donny'],
  ['douglas', 'doug'],
  ['harold', 'harry'],
  ['henry', 'hank', 'harry'],
  ['jonathan', 'jon', 'jonny'],
  ['joshua', 'josh'],
  ['margaret', 'meg', 'peggy', 'maggie'],
  ['katherine', 'catherine', 'kate', 'katie', 'kathy', 'kat'],
  ['jennifer', 'jen', 'jenny'],
  ['jessica', 'jess', 'jessie'],
  ['rebecca', 'becky', 'becca'],
  ['deborah', 'debra', 'deb', 'debbie'],
  ['susan', 'sue', 'susie'],
  ['patricia', 'pat', 'patty', 'tricia'],
  ['barbara', 'barb'],
  ['cynthia', 'cindy'],
  ['victoria', 'vicky', 'tori'],
  ['stephanie', 'steph'],
  ['nicole', 'nikki'],
  ['gabriel', 'gabe'],
  ['peter', 'pete'],
  ['philip', 'phillip', 'phil'],
  ['raymond', 'ray'],
  ['albert', 'al'],
  ['alfred', 'alfie', 'fred'],
  ['leonard', 'leo', 'lenny'],
  ['martin', 'marty'],
  ['maxwell', 'max'],
]

const GROUP_BY_NAME = new Map<string, number>()
NICKNAME_GROUPS.forEach((group, i) => group.forEach((n) => GROUP_BY_NAME.set(n, i)))

function normalizeFirstName(name: string): string {
  return name.trim().toLowerCase()
}

/** True for an exact match or a known nickname/formal-name pair (Art/Arthur). */
export function firstNamesAreEquivalent(a: string, b: string): boolean {
  const na = normalizeFirstName(a)
  const nb = normalizeFirstName(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const ga = GROUP_BY_NAME.get(na)
  const gb = GROUP_BY_NAME.get(nb)
  return ga !== undefined && ga === gb
}

/** Best-effort last name — the final whitespace-separated token of a full name. */
export function lastNameOf(fullName: string): string | null {
  const parts = fullName.trim().split(/\s+/)
  return parts.length > 1 ? parts[parts.length - 1] : null
}

/** Best-effort first name — everything before the last token. */
export function firstNameOf(fullName: string): string | null {
  const parts = fullName.trim().split(/\s+/)
  return parts.length > 1 ? parts[0] : null
}
