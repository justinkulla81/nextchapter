/** Recruiters grouped under the firm they work for. Pure, so the grouping is testable without a database. */
export interface FirmPerson {
  id: string
  name: string
  title: string | null
  org: string | null
  orgId: string | null
  email: string | null
  guessed: boolean
  phone: string | null
  states: string[]
  industries: string[]
  functions: string[]
}

export interface FirmGroup<T extends FirmPerson = FirmPerson> {
  /** The organization id, or 'none' for people with no firm on file. */
  key: string
  orgId: string | null
  name: string
  people: T[]
  /** Everything any of its recruiters covers, most common first. */
  states: string[]
  industries: string[]
  functions: string[]
}

const common = (lists: string[][]): string[] => {
  const n = new Map<string, number>()
  for (const l of lists) for (const v of l) n.set(v, (n.get(v) ?? 0) + 1)
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v]) => v)
}

/** Within a firm, people we can email first (a real address before a guessed one), then by name. */
const byReachable = (a: FirmPerson, b: FirmPerson) => Number(!!b.email && !b.guessed) - Number(!!a.email && !a.guessed) || a.name.localeCompare(b.name)

/** One group per firm, firms with recruiters in `localState` first, then the biggest; people with no firm on file come last in one group. */
export function groupByFirm<T extends FirmPerson>(rows: T[], localState?: string): FirmGroup<T>[] {
  const local = (g: { states: string[] }) => Number(!!localState && g.states.includes(localState))
  const by = new Map<string, T[]>()
  for (const r of rows) by.set(r.orgId ?? 'none', [...(by.get(r.orgId ?? 'none') ?? []), r])
  return [...by.entries()]
    .map(([key, people]) => ({
      key, orgId: key === 'none' ? null : key, name: key === 'none' ? 'No firm on file' : people[0].org ?? 'Unnamed firm',
      people: [...people].sort(byReachable),
      states: common(people.map((p) => p.states)), industries: common(people.map((p) => p.industries)), functions: common(people.map((p) => p.functions)),
    }))
    .sort((a, b) => Number(a.key === 'none') - Number(b.key === 'none') || local(b) - local(a) || b.people.length - a.people.length || a.name.localeCompare(b.name))
}
