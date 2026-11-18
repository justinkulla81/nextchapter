// Workforce Hub, pure parts: a group of partners, who may start one, and what an update says. No database here.

export const MAX_GROUP_MEMBERS = 60
export const MAX_POSTS_SHOWN = 5

/** May the organization start another group? `limit` null = no limit (the paid plan). */
export function canStartGroup(limit: number | null, existing: number): { allowed: boolean; message: string | null } {
  if (limit === null || existing < limit) return { allowed: true, message: null }
  return { allowed: false, message: `The free plan runs ${limit === 1 ? 'one group' : `${limit} groups`}. Start your free trial, or ask us to switch on the paid plan, to run more.` }
}

export function validateGroup(f: { get: (k: string) => string | null }): { error: string } | { value: { name: string; purpose: string | null } } {
  const name = (f.get('name') ?? '').trim().slice(0, 80)
  if (!name) return { error: 'Give the group a name, such as “Workforce coordination council”.' }
  const purpose = (f.get('purpose') ?? '').trim().slice(0, 300)
  return { value: { name, purpose: purpose || null } }
}

export function validatePost(f: { get: (k: string) => string | null }): { error: string } | { value: { body: string } } {
  const body = (f.get('body') ?? '').trim().slice(0, 1500)
  if (!body) return { error: 'Write the update before posting it.' }
  return { value: { body } }
}

/** The member ids to keep: only partners the organization actually has, once each, at most MAX_GROUP_MEMBERS. */
export function cleanMembers(picked: string[], validPartnerIds: ReadonlySet<string>): string[] {
  const out: string[] = []
  for (const id of picked) if (validPartnerIds.has(id) && !out.includes(id)) out.push(id)
  return out.slice(0, MAX_GROUP_MEMBERS)
}

/** What changes when the member list is saved. */
export function memberChanges(current: string[], next: string[]) {
  const cur = new Set(current)
  const nxt = new Set(next)
  return { add: next.filter((id) => !cur.has(id)), remove: current.filter((id) => !nxt.has(id)) }
}
