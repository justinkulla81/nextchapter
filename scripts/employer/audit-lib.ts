// The counting half of the production audit (build plan step 2). Pure. It sizes decisions 6 and 7 of the build plan
// (people with accounts in both portals; several hiring accounts at one company) and the backfills. No names or emails are
// returned: user ids, counts and company names only.

export interface HiringAccount {
  profileId: string
  userId: string
  companyName: string
  companyWebsite: string | null
  /** From the Supabase user, when looked up. */
  email?: string | null
}
export interface OrgUserAudit {
  orgId: string
  userId: string | null
  invitedEmail: string
  acceptedAt: Date | null
  invitedAt: Date
}

/** People who hold a hiring account and an outplacement login under the SAME sign-in (same auth user, so the same email). */
export function overlapByUser(hiringUserIds: string[], orgUsers: OrgUserAudit[]): string[] {
  const hiring = new Set(hiringUserIds)
  return [...new Set(orgUsers.map((o) => o.userId).filter((u): u is string => !!u && hiring.has(u)))].sort()
}

/**
 * People whose hiring account email is the email an outplacement invite went to, but under a different sign-in (so two
 * separate accounts). These are the ones the "link my other account" step in the build plan would be for. Needs the hiring emails.
 */
export function overlapByEmailOnly(hiring: HiringAccount[], orgUsers: OrgUserAudit[]): Array<{ hiringUserId: string; orgId: string }> {
  const byEmail = new Map(hiring.filter((h) => h.email).map((h) => [h.email!.trim().toLowerCase(), h]))
  const out: Array<{ hiringUserId: string; orgId: string }> = []
  for (const o of orgUsers) {
    const h = byEmail.get(o.invitedEmail.trim().toLowerCase())
    if (h && h.userId !== o.userId) out.push({ hiringUserId: h.userId, orgId: o.orgId })
  }
  return out
}

const SUFFIX = /\b(inc|llc|ltd|corp|corporation|co|company|plc|llp|lp|group|holdings)\b\.?/g

/** A key two accounts of one company share: the website's host when there is one, else the name without punctuation or suffixes. */
export function companyKey(a: { companyName: string; companyWebsite: string | null }): string {
  const site = (a.companyWebsite ?? '').trim().toLowerCase()
  if (site) {
    try {
      const host = new URL(/^https?:\/\//.test(site) ? site : `https://${site}`).hostname.replace(/^www\./, '')
      if (host.includes('.')) return `site:${host}`
    } catch {
      /* fall through to the name */
    }
  }
  const name = a.companyName.toLowerCase().replace(/&/g, ' and ').replace(SUFFIX, ' ').replace(/[^a-z0-9]+/g, ' ').trim()
  return `name:${name}`
}

/** Companies with more than one hiring account, largest first. */
export function severalHiringAccounts(hiring: HiringAccount[]): Array<{ key: string; accounts: number; example: string }> {
  const groups = new Map<string, HiringAccount[]>()
  for (const h of hiring) {
    const k = companyKey(h)
    if (k === 'name:') continue
    groups.set(k, [...(groups.get(k) ?? []), h])
  }
  return [...groups.entries()]
    .filter(([, v]) => v.length > 1)
    .map(([key, v]) => ({ key, accounts: v.length, example: v[0].companyName }))
    .sort((a, b) => b.accounts - a.accounts || a.key.localeCompare(b.key))
}

/** Outplacement login rows nobody has accepted, split by how long they have waited. */
export function pendingOrgUsers(orgUsers: OrgUserAudit[], now = new Date()): { total: number; olderThan30Days: number } {
  const pending = orgUsers.filter((o) => !o.acceptedAt)
  const cutoff = now.getTime() - 30 * 86_400_000
  return { total: pending.length, olderThan30Days: pending.filter((o) => o.invitedAt.getTime() < cutoff).length }
}

export function contractsTable(rows: Array<{ programType: string; status: string; _count: { _all: number } }>): Array<{ programType: string; status: string; contracts: number }> {
  return rows.map((r) => ({ programType: r.programType, status: r.status, contracts: r._count._all })).sort((a, b) => `${a.programType}${a.status}`.localeCompare(`${b.programType}${b.status}`))
}
