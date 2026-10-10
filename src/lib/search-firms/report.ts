import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { contactRank, type FirmSegment } from './match'

export interface FirmContact {
  personId: string
  name: string
  title: string | null
  email: string | null
  /** Set only when there is no real email — always shown labelled as a guess. */
  guessedEmail: string | null
  guessedEmailBasis: string | null
  rank: number
}

export interface FirmRow {
  id: string
  sourceKey: string
  name: string
  website: string | null
  segment: FirmSegment
  liveSearchCount: number
  sampleTitles: string[]
  matchStatus: string
  crmOrg: { id: string; name: string } | null
  reviewOrg: { id: string; name: string } | null
  reviewReason: string | null
  teamPageUrl: string | null
  contacts: FirmContact[]
}

export type FirmFilter = 'live' | 'all' | 'review' | 'no_contacts'

/** Shown on the page; the CSV export carries every contact. */
const CONTACTS_PER_FIRM = 4

export async function loadFirmRows(filter: FirmFilter = 'live', q = '', contactsPerFirm = CONTACTS_PER_FIRM): Promise<FirmRow[]> {
  const where: Prisma.SearchFirmWhereInput = {
    ...(filter === 'live' ? { liveSearchCount: { gt: 0 } } : {}),
    ...(filter === 'review' ? { matchStatus: 'REVIEW' } : {}),
    ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
  }
  const firms = await prisma.searchFirm.findMany({
    where,
    orderBy: [{ liveSearchCount: 'desc' }, { name: 'asc' }],
    include: {
      crmOrg: {
        select: {
          id: true, name: true,
          affiliations: {
            where: { isCurrent: true, person: { deletedAt: null } },
            select: {
              title: true,
              person: { select: { id: true, fullName: true, email: true, guessedEmail: true, guessedEmailBasis: true } },
            },
          },
        },
      },
    },
  })
  const reviewIds = firms.map((f) => f.reviewOrgId).filter((id): id is string => !!id)
  const reviewOrgs = new Map((await prisma.crmOrganization.findMany({ where: { id: { in: reviewIds } }, select: { id: true, name: true } })).map((o) => [o.id, o]))

  const rows = firms.map((f): FirmRow => {
    const seen = new Set<string>()
    const contacts = (f.crmOrg?.affiliations ?? [])
      .map((a) => ({
        personId: a.person.id, name: a.person.fullName, title: a.title,
        email: a.person.email, guessedEmail: a.person.email ? null : a.person.guessedEmail,
        guessedEmailBasis: a.person.email ? null : a.person.guessedEmailBasis, rank: contactRank(a.title),
      }))
      .filter((c) => c.rank >= 0 && !seen.has(c.personId) && seen.add(c.personId))
      // Best title first; a real address beats a guess at the same level.
      .sort((a, b) => a.rank - b.rank || Number(!!b.email) - Number(!!a.email) || a.name.localeCompare(b.name))
      .slice(0, contactsPerFirm)
    return {
      id: f.id, sourceKey: f.sourceKey, name: f.name, website: f.website, segment: f.segment as FirmSegment,
      liveSearchCount: f.liveSearchCount, sampleTitles: f.sampleTitles, matchStatus: f.matchStatus,
      crmOrg: f.crmOrg ? { id: f.crmOrg.id, name: f.crmOrg.name } : null,
      reviewOrg: f.reviewOrgId ? reviewOrgs.get(f.reviewOrgId) ?? null : null,
      reviewReason: f.reviewReason, teamPageUrl: f.teamPageUrl, contacts,
    }
  })
  return filter === 'no_contacts' ? rows.filter((r) => r.contacts.length === 0) : rows
}

/** RFC-4180 quoting. */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const CSV_HEADERS = [
  'Firm', 'Segment', 'Live searches', 'Sample titles', 'CRM match', 'CRM organization', 'Possible match (needs review)',
  'Contact', 'Title', 'Email', 'Email is', 'Guess basis', 'Team page', 'Website',
]

/** One line per contact (or one line for a firm with none), so the sheet sorts and filters cleanly. */
export function firmRowsToCsv(rows: FirmRow[]): string {
  const lines = [CSV_HEADERS.join(',')]
  for (const r of rows) {
    const base = [
      r.name, r.segment, r.liveSearchCount, r.sampleTitles.join(' | '),
      r.matchStatus === 'REVIEW' ? 'Needs review' : r.matchStatus === 'ADDED' ? 'Added (was not in CRM)' : 'Matched',
      r.crmOrg?.name ?? '', r.reviewOrg ? `${r.reviewOrg.name} — ${r.reviewReason ?? ''}` : '',
    ]
    const tail = [r.teamPageUrl ?? '', r.website ?? '']
    if (r.contacts.length === 0) lines.push([...base, '', '', '', '', '', ...tail].map(csvCell).join(','))
    for (const c of r.contacts) {
      const email = c.email ?? c.guessedEmail ?? ''
      const kind = c.email ? 'real' : c.guessedEmail ? 'GUESS' : ''
      lines.push([...base, c.name, c.title ?? '', email, kind, c.guessedEmailBasis ?? '', ...tail].map(csvCell).join(','))
    }
  }
  return lines.join('\n')
}
