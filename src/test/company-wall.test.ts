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
