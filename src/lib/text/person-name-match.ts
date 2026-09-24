// "Are these two names probably the same person?" — for review queues only,
// never for linking anything automatically. Tolerant of what actually
// differs between a LinkedIn profile and a signup form: middle names and
// initials, credentials ("Jane Doe, MBA"), suffixes, accents, punctuation,
// a nickname vs. the full first name, and a small typo. The last name has to
// agree (bar a one-letter slip) — a shared first name alone means nothing.

const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'esq', 'phd', 'md', 'mba', 'cpa', 'cfa', 'jd', 'pmp', 'dr', 'mr', 'mrs', 'ms'])

const NICKNAMES: Record<string, string[]> = {
  william: ['bill', 'will', 'billy', 'liam'], robert: ['bob', 'rob', 'bobby', 'robbie'], richard: ['rick', 'dick', 'rich'],
  james: ['jim', 'jimmy', 'jamie'], john: ['jack', 'johnny'], michael: ['mike', 'mikey'], elizabeth: ['liz', 'beth', 'betsy', 'eliza'],
  katherine: ['kate', 'katie', 'kathy', 'kat'], catherine: ['cathy', 'cat', 'kate'], margaret: ['maggie', 'meg', 'peggy'],
  alexander: ['alex', 'xander'], alexandra: ['alex', 'lexi'], christopher: ['chris'], christine: ['chris', 'tina'],
  daniel: ['dan', 'danny'], david: ['dave'], edward: ['ed', 'eddie', 'ted'], jennifer: ['jen', 'jenny'],
  joseph: ['joe', 'joey'], matthew: ['matt'], nicholas: ['nick', 'nico', 'niko'], patricia: ['pat', 'patty', 'trish'],
  patrick: ['pat'], rebecca: ['becca', 'becky'], samuel: ['sam'], samantha: ['sam'], stephen: ['steve'], steven: ['steve'],
  susan: ['sue', 'susie'], thomas: ['tom', 'tommy'], timothy: ['tim'], anthony: ['tony'], andrew: ['andy', 'drew'],
  benjamin: ['ben'], charles: ['charlie', 'chuck'], deborah: ['deb', 'debbie'], gregory: ['greg'], jonathan: ['jon'],
  kenneth: ['ken', 'kenny'], lawrence: ['larry'], nathaniel: ['nate', 'nathan'], peter: ['pete'], ronald: ['ron'],
  victoria: ['vicky', 'tori'], zachary: ['zach', 'zack'], frederick: ['fred'], gerald: ['jerry'], jeffrey: ['jeff'],
}

function tokens(name: string): string[] {
  return name
    .split(',')[0] // "Jane Doe, MBA" / "Marianne Voss, Esq."
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ') // "Robert (Bob) Smith"
    .replace(/[^a-z\s'-]/g, ' ')
    .split(/[\s-]+/)
    .map((t) => t.replace(/'/g, ''))
    .filter((t) => t.length > 1 && !SUFFIXES.has(t)) // drops initials and suffixes
}

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

function firstNamesMatch(a: string, b: string): boolean {
  if (a === b) return true
  if (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a))) return true // Jon / Jonathan
  if (NICKNAMES[a]?.includes(b) || NICKNAMES[b]?.includes(a)) return true
  return a.length >= 5 && editDistance(a, b) <= 1
}

export function namesLookAlike(a: string, b: string): boolean {
  const ta = tokens(a)
  const tb = tokens(b)
  if (ta.length < 2 || tb.length < 2) return false
  const lastA = ta[ta.length - 1]
  const lastB = tb[tb.length - 1]
  const lastOk = lastA === lastB || (Math.min(lastA.length, lastB.length) >= 5 && editDistance(lastA, lastB) <= 1)
  if (lastOk) return firstNamesMatch(ta[0], tb[0])
  // A compound or married surname: "Patricia Fukuda O'Donnell" on the signup
  // form, "Patricia Fukuda" on LinkedIn — the shorter name's surname is one
  // of the longer name's later names.
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta]
  const shortLast = short[short.length - 1]
  return long.length > short.length && shortLast.length >= 3 && long.slice(1).includes(shortLast) && firstNamesMatch(ta[0], tb[0])
}
