import 'server-only'
import { prisma } from '@/lib/prisma'
import { CRM_ACTIVITY_CUTOFF } from '@/lib/crm/cutoff'
import { layoffSignalsFor, LAYOFF_WINDOW_MONTHS } from '@/lib/crm/layoff-signals'

export interface RapSheetContext {
  personId: string
  personName: string
  orgId: string | null
  orgName: string | null
  /** Plain-text dossier of everything the CRM already knows, handed to the model. */
  crmText: string
}

const fmt = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : 'unknown')

/** Everything we already hold about a prospect — free to gather, and the model is told to treat it as ground truth. */
export async function gatherRapSheetContext(personId: string): Promise<RapSheetContext> {
  const person = await prisma.crmPerson.findUniqueOrThrow({
    where: { id: personId },
    include: {
      affiliations: { include: { org: true }, orderBy: [{ isPrimary: 'desc' }, { isCurrent: 'desc' }], take: 3 },
      activities: { where: { occurredAt: { gte: CRM_ACTIVITY_CUTOFF } }, orderBy: { occurredAt: 'desc' }, take: 15, select: { type: true, direction: true, occurredAt: true, subject: true, outcome: true } },
      opportunities: { include: { pipeline: true, stage: true }, take: 5 },
      researchItems: { take: 5 },
    },
  })
  const org = person.affiliations[0]?.org ?? null
  const domain = (person.email ?? person.emails[0] ?? '').split('@')[1] ?? null

  const lines: string[] = []
  lines.push(`Person: ${person.fullName}`)
  if (person.affiliations[0]?.title) lines.push(`Title: ${person.affiliations[0].title}`)
  lines.push(`Contact types: ${person.roles.join(', ') || 'none set'}; priority ${person.priority ?? 'none'}; warmth ${person.warmth}`)
  if (person.location) lines.push(`Location: ${person.location}`)
  if (domain) lines.push(`Email domain: ${domain} (use this to identify their organization if no organization is on file)`)
  if (person.linkedinUrl) lines.push(`LinkedIn: ${person.linkedinUrl}`)
  if (person.notes) lines.push(`Your notes on them: ${person.notes}`)
  if (org) {
    lines.push(`Organization: ${org.name} (${org.orgTypes.join(', ') || 'type not set'})`)
    for (const [k, v] of [['Website', org.website], ['HQ', [org.hqCity, org.hqRegion].filter(Boolean).join(', ')], ['Industry', org.industry], ['Focus', org.focus], ['Org notes', org.notes]] as const) if (v) lines.push(`${k}: ${v}`)
  } else {
    lines.push('Organization: none on file')
  }

  if (person.activities.length) {
    lines.push('', 'Recent history with them (newest first):')
    for (const a of person.activities) lines.push(`- ${fmt(a.occurredAt)} ${a.direction} ${a.type}${a.subject ? `: ${a.subject}` : ''}${a.outcome ? ` → ${a.outcome}` : ''}`)
  } else {
    lines.push('', 'No logged history with them yet.')
  }
  for (const o of person.opportunities) lines.push(`Opportunity: ${o.title} — ${o.pipeline.label} / ${o.stage.label}${o.nextStep ? `; next step: ${o.nextStep}` : ''}`)

  // Layoffs we already track. Free: WARN filings are in our own database.
  if (org) {
    const sig = (await layoffSignalsFor([org])).get(org.id)
    if (sig) lines.push('', `WARN/layoff notices on file for ${org.name} in the last ${LAYOFF_WINDOW_MONTHS} months: ${sig.notices} notice(s), ${sig.employees ?? 'unknown'} employees, latest ${fmt(sig.date)}.`)
  }
  const state = org?.usState && org.usState.length === 2 ? org.usState : null
  if (state) {
    const since = new Date(); since.setMonth(since.getMonth() - 12)
    const notices = await prisma.warnNotice.findMany({
      where: { state, noticeDate: { gte: since } }, orderBy: { employees: 'desc' }, take: 8,
      select: { employer: true, employees: true, noticeDate: true, county: true, industry: true },
    })
    if (notices.length) {
      lines.push('', `Largest WARN notices in ${state} over the last 12 months (from our database):`)
      for (const n of notices) lines.push(`- ${n.employer}${n.county ? ` (${n.county})` : ''}: ${n.employees ?? '?'} employees, ${fmt(n.noticeDate)}${n.industry ? `, ${n.industry}` : ''}`)
    }
  }

  return { personId, personName: person.fullName, orgId: org?.id ?? null, orgName: org?.name ?? null, crmText: lines.join('\n') }
}
