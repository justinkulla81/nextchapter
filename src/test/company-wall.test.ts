import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { toCandidateCompany, ADMIN_ONLY_COMPANY_FIELDS } from '@/lib/companies/candidate-view'

// The walls around the shared Company record. Company is public business facts;
// the CRM, a candidate's private search, a recruiter's mandates and an
// institution's targets each attach to it but must not become a channel into
// each other. These tests read the source so a future change that crosses a
// wall fails here instead of shipping.

const ROOT = join(__dirname, '..', '..')
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (name === 'node_modules' || name.startsWith('.')) return []
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(name) ? [p] : []
  })
const rel = (p: string) => relative(ROOT, p).split('\\').join('/')
const read = (p: string) => readFileSync(p, 'utf8')
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const CRM_USE = /\b(crmOrganization|crmPerson|crmActivity|crmAffiliation)\b|from ['"]@\/lib\/crm\//
// The one deliberate flow from the candidate side into the CRM: a candidate who signs
// up or buys a membership becomes a CRM lead. It writes TO the CRM; it never reads
// CRM data back, and nothing it returns reaches a candidate page.
const CANDIDATE_TO_CRM_SYNC = new Set([
  'src/app/dashboard/resume/actions.ts',
  'src/app/dashboard/membership/actions.ts',
])

describe('candidates never see CRM', () => {
  const candidateFiles = [
    ...walk(join(ROOT, 'src/app/dashboard')),
    ...walk(join(ROOT, 'src/components/dashboard')),
    ...walk(join(ROOT, 'src/components/companies')),
  ]

  it('no candidate-facing file reads CRM tables or the CRM library, except the one-way sync', () => {
    const offenders = candidateFiles
      .filter((f) => CRM_USE.test(stripComments(read(f))))
      .map(rel)
      .filter((f) => !CANDIDATE_TO_CRM_SYNC.has(f))
    expect(offenders).toEqual([])
  })

  it('the sync files only import the writer, not the CRM read paths', () => {
    for (const f of CANDIDATE_TO_CRM_SYNC) {
      const imports = read(join(ROOT, f)).match(/from ['"]@\/lib\/crm\/[^'"]+['"]/g) ?? []
      expect(imports.every((i) => i.includes('candidate-sync'))).toBe(true)
    }
  })

  it('admin-only Company fields are never read off a company in a candidate page', () => {
    const offenders = walk(join(ROOT, 'src/app/dashboard'))
      .filter((f) => /\b(company|companyRow)\.(chroName|chroEmail|chroLinkedinUrl|priority)\b/.test(stripComments(read(f))))
      .map(rel)
    expect(offenders).toEqual([])
  })

  it('strips admin-only fields from a Company before a candidate page can render it', () => {
    const row = { id: 'c', name: 'Acme', priority: 'P0', chroName: 'Pat', chroEmail: 'pat@acme.com', chroLinkedinUrl: 'https://x', website: 'https://acme.com' }
    const safe = toCandidateCompany(row as never) as unknown as Record<string, unknown>
    for (const f of ADMIN_ONLY_COMPANY_FIELDS) expect(safe[f]).toBeNull()
    expect(safe.website).toBe('https://acme.com')
    expect(safe.name).toBe('Acme')
  })

  it('the candidate company page runs its Company row through toCandidateCompany', () => {
    expect(read(join(ROOT, 'src/app/dashboard/companies/[slug]/page.tsx'))).toContain('toCandidateCompany')
  })
})

describe('the CRM never reads a candidate\'s private search data', () => {
  // Property access on the Prisma client (prisma.x / tx.x), so a local variable that
  // happens to share a name doesn't count. googleInboxConnection is deliberately
  // absent: it is the admin's own Gmail connection that the CRM syncs from, not a
  // candidate's.
  const PRIVATE =
    /\.(companyWatchlistEntry|supportNetworkContact|candidateInteraction|surfacedJob|candidateSearchCheckIn|emailConnection|trackedEmailActivity|trackedCalendarEvent|calendarConnection|marketRealityReport|coachConversation|coachMessage)\b/
  const crmFiles = [
    ...walk(join(ROOT, 'src/lib/crm')),
    ...walk(join(ROOT, 'src/app/support/admin/(portal)/crm')),
    ...walk(join(ROOT, 'src/app/api/crm')),
  ]

  it('no CRM file touches those tables', () => {
    const offenders = crmFiles.filter((f) => PRIVATE.test(stripComments(read(f)))).map(rel)
    expect(offenders).toEqual([])
  })
})

describe('an institution\'s target companies stay inside that institution', () => {
  it('are read only through institution-scoped code', () => {
    const roots = [join(ROOT, 'src/app'), join(ROOT, 'src/lib'), join(ROOT, 'src/components')]
    const users = roots.flatMap(walk).filter((f) => /institutionTargetCompany/.test(stripComments(read(f)))).map(rel)
    const outside = users.filter((f) => !/(higher-ed|institution|\/i\/)/i.test(f))
    expect(outside).toEqual([])
  })
})

// ── No indirect route ──────────────────────────────────────────────────────
// The first test above only sees candidate files that touch CRM tables directly. A
// helper in src/lib that reads the CRM and is imported by a candidate page walks
// straight past it — which is how job-contacts.ts got through. So every file OUTSIDE
// the CRM / admin zone that reads a CRM table is listed here, with why it is allowed,
// and the list must match exactly: a NEW reader fails this test until someone looks
// at it and adds it with a reason.
describe('no indirect route from CRM data to a candidate', () => {
  const CRM_MODEL = /\.(crm[A-Z][A-Za-z]*)\b/
  const ZONE = /^src\/(lib\/crm|app\/support|app\/api\/crm|app\/api\/admin|test|lib\/admin)\//

  // Allowed: they WRITE into the CRM from a public form or event, or they run only
  // in admin pages, the CRM sync, or crons. None returns CRM data to a candidate.
  const ALLOWED: Record<string, string> = {
    'src/app/api/cron/crm-sync/route.ts': 'cron',
    'src/components/admin/CrmOrgBackgroundSections.tsx': 'admin UI',
    'src/components/admin/mailing/PersonMailingSection.tsx': 'admin UI',
    'src/lib/candidates/invite.ts': 'writes an invite into the CRM',
    'src/lib/candidates/lead-source.ts': 'attribution, writes only',
    'src/lib/candidates/link-invite.ts': 'attribution, writes only',
    'src/lib/companies/company-graph-sync.ts': 'nightly job: links CRM orgs to companies',
    'src/lib/contact/process-submission.ts': 'contact form writes a CRM lead',
    'src/lib/geo/local-partners.ts': 'admin geography tooling',
    'src/lib/help/crm-note.ts': 'help request writes a CRM note',
    'src/lib/search-firms/report.ts': 'admin-only: imported by the CRM search-firms pages',
    'src/lib/search-firms/sync.ts': 'admin-only: imported by the CRM search-firms pages',
    'src/lib/mailing/editions.ts': 'admin mailing',
    'src/lib/mailing/lists.ts': 'admin mailing',
    'src/lib/mailing/prompt-cards.ts': 'admin mailing',
    'src/lib/mailing/tracking.ts': 'admin mailing',
    'src/lib/warn/layoff-contacts-run.ts': 'admin WARN tooling',
    'src/lib/warn/sync.ts': 'admin WARN tooling',
    'src/lib/workforce/college-crm.ts': 'admin workforce tooling',
    'src/lib/workforce/college-rank.ts': 'admin workforce tooling',
  }

  // KNOWN POLICY VIOLATION, pending the owner's decision. job-contacts.ts READS CRM
  // affiliations and the job board shows the result to candidates ("who to contact":
  // CRM recruiters at the employer). The rule is that candidates never see CRM data.
  // It is listed so the exception is visible and cannot grow; remove it from here
  // when the feature is changed to stop reading the CRM.
  const KNOWN_VIOLATIONS = ['src/lib/jobs/job-contacts.ts']

  const readers = [...walk(join(ROOT, 'src'))]
    .map(rel)
    .filter((f) => !ZONE.test(f) && CRM_MODEL.test(stripComments(read(join(ROOT, f)))))
    .sort()

  it('every reader outside the CRM zone is accounted for', () => {
    expect(readers).toEqual([...Object.keys(ALLOWED), ...KNOWN_VIOLATIONS].sort())
  })

  it('a candidate-facing file imports no CRM reader except the known one', () => {
    const candidateFiles = [
      ...walk(join(ROOT, 'src/app/dashboard')),
      ...walk(join(ROOT, 'src/components/dashboard')),
      ...walk(join(ROOT, 'src/components/companies')),
      ...walk(join(ROOT, 'src/lib/job-search-daily')),
    ]
    const importsOf = (file: string) =>
      [...read(file).matchAll(/from ['"]@\/([^'"]+)['"]/g)].map((m) => `src/${m[1]}.ts`)
    const offenders: string[] = []
    for (const f of candidateFiles) {
      for (const imp of importsOf(f)) {
        if (readers.includes(imp) && !KNOWN_VIOLATIONS.includes(imp) && !ALLOWED[imp]) offenders.push(`${rel(f)} -> ${imp}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('the known violation is imported by the job board only, and shrinks rather than spreads', () => {
    const users = [...walk(join(ROOT, 'src'))]
      .map(rel)
      .filter((f) => !f.startsWith('src/test/') && read(join(ROOT, f)).includes("@/lib/jobs/job-contacts"))
      .sort()
    expect(users).toEqual(['src/app/dashboard/find-my-job/page.tsx', 'src/components/dashboard/DiscoverJobCard.tsx'])
  })
})

// ── Research metrics and alumni data stay inside their walls ───────────────
describe('research metrics are admin-only', () => {
  // Outcomes and engagement by college, degree, level, function and industry are
  // NextChapter research. They describe observable behaviour in aggregate; they are
  // never shown to members, recruiters, coaches or hiring managers, and no one's
  // "work ethic" is ever labelled. The only importers allowed are admin pages.
  it('is imported only from the admin portal', () => {
    const importers = [...walk(join(ROOT, 'src'))]
      .map(rel)
      .filter((f) => !f.startsWith('src/test/') && !f.endsWith('src/lib/analytics/education-outcomes.ts'))
      .filter((f) => read(join(ROOT, f)).includes('@/lib/analytics/education-outcomes'))
    expect(importers.filter((f) => !f.startsWith('src/app/support/admin/'))).toEqual([])
  })

  it('suppresses small groups inside the module itself, not only in the page', () => {
    const src = read(join(ROOT, 'src/lib/analytics/education-outcomes.ts'))
    expect(src).toContain('suppressSmallCells')
    expect(src).toContain('confidentialSearchMode: false')
  })
})

describe('alumni networks stay opt-in, private and above the floor', () => {
  const src = read(join(ROOT, 'src/lib/community/alumni-networks.ts'))
  it('is never joined automatically', () => {
    // The auto-join sync (syncAutoJoinedCommunities) must not know about these types.
    const auto = read(join(ROOT, 'src/lib/community/communities.ts'))
    const syncBody = auto.slice(auto.indexOf('export async function syncAutoJoinedCommunities'), auto.indexOf('export async function getPendingAutoJoinNotices'))
    expect(syncBody).not.toMatch(/SCHOOL|FORMER_EMPLOYER/)
  })
  it('excludes Confidential Search Mode members from the offer and from every count', () => {
    expect(src).toContain('confidentialSearchMode')
    expect(src).toMatch(/c\."confidentialSearchMode" = false/)
  })
  it('applies the group-size floor', () => {
    expect(src).toContain('MIN_ALUMNI_GROUP')
    expect(src).toMatch(/n >= MIN_ALUMNI_GROUP/)
  })
  it('the alumni feed filter fails closed', () => {
    const c = read(join(ROOT, 'src/lib/community/communities.ts'))
    expect(c).toContain("__no_such_post__")
  })
})

describe('ex-employee feedback', () => {
  const src = read(join(ROOT, 'src/lib/companies/ex-employee-feedback.ts'))
  it('never asks a member in Confidential Search Mode, or about a current employer', () => {
    expect(src).toContain('confidentialSearchMode')
    expect(src).toContain('currentlyThere')
  })
  it('reports small counts as "fewer than 5", never as the number', () => {
    expect(src).toContain('MIN_CELL_SIZE')
    expect(src).toMatch(/floor\(/)
  })
})

