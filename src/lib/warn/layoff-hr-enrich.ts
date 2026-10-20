import 'server-only'
import { prisma } from '@/lib/prisma'
import { addContactToCrm, ensureOrg } from '@/lib/crm/add-contact'
import { goalsForRoles } from '@/lib/crm/goals'
import { hunterAccount, hunterConfigured, hunterDomainSearch, isTrustedEmail } from '@/lib/crm/hunter'
import { isHrLeaderTitle, lookupDomain } from '@/lib/crm/org-domains'
import { hrTeamKind, isUsWideTitle } from './layoff-hr-rules'

/** Hunter searches kept back for people who already use them. */
const HUNTER_RESERVE = 25
/** Most people added per layoff: the head of HR plus the few who buy or run the transition. */
const MAX_ADDED = 4

const hostOf = (website: string | null | undefined): string | null => {
  if (!website) return null
  try { return new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`).hostname.replace(/^www\./, '') } catch { return null }
}

/**
 * Finds the people to call about a layoff the moment it is filed, so the alert email is not empty:
 * one Hunter domain search, the head of HR first and then total rewards, employee relations, talent and
 * HR partners, written into the CRM with a verified address when Hunter has one and only a guess when it
 * does not. Skips a company that already has a head of HR. Costs one Hunter search per layoff, never
 * dips into the reserve, and never throws: a failure leaves the alert as it was.
 * Returns the organization id (created if the company was new) or null.
 */
export async function enrichLayoffHr(employer: string, orgId: string | null): Promise<string | null> {
  try {
    if (!hunterConfigured()) return orgId
    const org = orgId ? await prisma.crmOrganization.findUnique({ where: { id: orgId }, select: { id: true, name: true, website: true, emailDomain: true } }) : null
    if (org) {
      const titles = await prisma.crmAffiliation.findMany({ where: { orgId: org.id, isCurrent: true, person: { deletedAt: null } }, select: { title: true } })
      if (titles.some((t) => isHrLeaderTitle(t.title))) return org.id
    }
    const domain = org?.emailDomain ?? hostOf(org?.website) ?? (await lookupDomain(org?.name ?? employer).catch(() => null))
    if (!domain) return org?.id ?? null
    const acct = await hunterAccount().catch(() => null)
    if (!acct || acct.requests.searches.available - acct.requests.searches.used <= HUNTER_RESERVE) return org?.id ?? null

    const found = await hunterDomainSearch(domain, 10).catch(() => null)
    const picks = (found?.people ?? [])
      .filter((p) => p.firstName && p.lastName && p.position && !isUsWideTitle(p.position) && (p.confidence ?? 0) >= 70)
      .map((p) => ({ p, kind: isHrLeaderTitle(p.position) ? ('head_hr' as const) : hrTeamKind(p.position!) }))
      .filter((x): x is { p: typeof x.p; kind: NonNullable<typeof x.kind> } => !!x.kind)
      .sort((a, b) => Number(b.kind === 'head_hr') - Number(a.kind === 'head_hr') || (b.p.confidence ?? 0) - (a.p.confidence ?? 0))
      .slice(0, MAX_ADDED)

    // A company new to the CRM is created now, so the people have somewhere to attach.
    const target = org ?? (picks.length ? await ensureOrg({ name: employer, type: 'EMPLOYER', website: domain }) : null)
    let resolved = target?.id ?? null
    for (const { p, kind } of picks) {
      const roles = kind === 'head_hr' ? (['HIRING_MANAGER', 'OUTPLACEMENT_BUYER'] as const) : (['OUTPLACEMENT_BUYER'] as const)
      const trusted = isTrustedEmail(p.status, p.confidence)
      const r = await addContactToCrm({
        fullName: `${p.firstName} ${p.lastName}`, title: p.position, email: trusted ? p.email : null,
        guessedEmail: trusted ? null : p.email, guessedEmailBasis: trusted ? null : 'Hunter domain search, not verified',
        orgId: target!.id, orgName: target!.name, roles: [...roles], goals: goalsForRoles([...roles]), priority: 'P2',
        note: `${kind === 'head_hr' ? 'Head of HR' : 'HR'} at ${employer}, found by Hunter domain search on ${domain} when ${employer} filed a layoff. Confirm before outreach.`,
      }).catch(() => null)
      void r
    }
    return resolved
  } catch (e) {
    console.error('Layoff HR enrichment failed for', employer, e)
    return orgId
  }
}
