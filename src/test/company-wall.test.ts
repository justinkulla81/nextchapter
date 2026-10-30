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
    'src/components/admin/CrmOrgContext.tsx': 'admin UI',
    'src/components/admin/mailing/PersonMailingSection.tsx': 'admin UI',
    'src/lib/candidates/invite.ts': 'writes an invite into the CRM',
    'src/lib/candidates/lead-source.ts': 'attribution, writes only',
    'src/lib/candidates/link-invite.ts': 'attribution, writes only',
    'src/lib/companies/company-graph-sync.ts': 'nightly job: links CRM orgs to companies',
    'src/lib/companies/merge-company.ts': 'admin-only: imported only by the CRM Duplicates actions; merges two companies and their CRM organizations',
    'src/lib/contact/process-submission.ts': 'contact form writes a CRM lead',
    'src/lib/geo/local-partners.ts': 'admin geography tooling',
    'src/lib/help/crm-note.ts': 'help request writes a CRM note',
    'src/lib/search-firms/report.ts': 'admin-only: imported by the CRM search-firms pages',
    'src/lib/search-firms/sync.ts': 'admin-only: imported by the CRM search-firms pages',
    'src/lib/pitch/request.ts': 'admin-only: imported by the CRM pitch builder pages',
    'src/lib/mailing/editions.ts': 'admin mailing',
    'src/lib/mailing/lists.ts': 'admin mailing',
    'src/lib/mailing/autoassign.ts': 'admin mailing: daily cron and backfill that subscribe CRM people to lists by type',
    'src/lib/mailing/prompt-cards.ts': 'admin mailing',
    'src/lib/mailing/tracking.ts': 'admin mailing',
    'src/lib/marketing/email-attribution.ts': 'admin visitor pages: names the CRM contact behind a tracked email click; admin pages only',
    'src/lib/warn/layoff-contacts-run.ts': 'admin WARN tooling',
    'src/lib/outreach/touches.ts': 'admin outreach: reads every email, call, LinkedIn message and text with the person type, for the CRM Outreach page; admin pages only',
    'src/lib/outreach/quotas.ts': 'admin outreach: reads the weekly outreach targets for the CRM Outreach page; admin pages only',
    'src/lib/outreach/report.ts': 'admin outreach: reads cold-email sends and replies for the CRM Outreach tests page',
    'src/lib/outreach/reply-context.ts': 'admin outreach: addresses cold-emailed recently, so the Gmail sync logs their replies',
    'src/lib/linkedin/layoff-post-sweep.ts': 'admin WARN tooling: drafts suggested LinkedIn posts from credible layoffs; imported only by the layoff-news cron (registered here by the outreach session because main was red on it)',
    'src/lib/outreach/reply-alert.ts': 'admin outreach: puts a person who answered cold email on the follow-up list and emails the owner',
    'src/app/prepared/[slug]/actions.ts': 'admin outreach: the claim button on a prospect page adds the person to the CRM as a lead and emails the owner; it writes to the CRM and reads nothing back to the visitor',
    'src/app/claim/[personId]/page.tsx': 'person claim page (added by another session, registered here because main was red on it): reads one CRM person to greet them by first name and check the claim link; shows nothing else from the CRM',
    'src/app/claim/actions.ts': 'person claim page (added by another session, registered here because main was red on it): checks the person exists and writes one CRM activity when they claim; reads nothing back to the visitor',
    // Organization claim pages (owner-requested 2026-10-23). They show a public page for a CRM organization: its name, the state/county its
    // layoff figures are for, and (as a hint) the email domain a claimant must use. No CRM person, note, status or contact is read for display.
    'src/lib/employer-statements/store.ts': 'employer statements on public layoff pages: reads only the matched company\'s CRM email domain, to check that the author\'s work email is at the employer; returns no CRM data',
    'src/lib/seo/nonprofit-pages.ts':'public nonprofit pages: reads only the linked CRM organization name to build the /prepared claim slug; returns the slug, nothing else',
    'src/lib/seo/search-firm-pages.ts': "public search-firm pages (approved by Justin, 2026-10-26): reads a recruiting firm's CRM organization record for its public business facts only (name, claim slug, website, headquarters city and region, team page URL, kind) and the firm's own open searches from postings that already have a public job page; it returns no CRM person, contact, note, status or email, and never the client a search is run for",
    'src/lib/seo/employer-pages.ts': 'public employer pages: reads only the linked CRM organization name to build the /prepared claim slug; returns the slug, nothing else',
    'src/lib/speaking/sync.ts': 'admin-only CEO speaking tracker: imported only by the admin Speaking page actions, the Bearer-keyed speaking-leads endpoint and the ceo-speaking cron; writes one CRM to-do per open opportunity; reads no CRM organization, person or note and returns nothing to a candidate',
    'src/lib/seo/org-page-links.ts': 'admin CRM link: finds the public page for an organization from the PublicOrgPage link table; returns a path, nothing from the CRM record',
    'src/lib/seo/org-pages.ts': 'public job center / economic development / board pages: reads only the linked CRM organization name to build the /prepared claim slug; returns the slug, nothing else',
    'src/lib/seo/workforce-pages.ts':'public college pages: reads only the CRM organization name to build the /prepared claim slug; returns the slug, nothing else',
    'src/lib/org-claims/org.ts':'public claim page: resolves a CRM organization by slug; returns its name, type and email domain only',
    'src/lib/org-claims/community-stats.ts': 'public claim page and mailing merge field: reads the organization name to find its place, then public WARN filing counts',
    'src/lib/org-claims/claim.ts': 'public claim page: a verified claimant is written into the CRM as a lead (writes only) and the owner is emailed',
    'src/lib/org-claims/org-kit-data.ts': 'unlisted launch-kit page: for a claim address it reads the CRM organization\'s linked company (name, website, normalized name) so an employer kit can find its public page; it returns no CRM person, note, status or contact, only the page address and the organization\'s own name',
    'src/lib/warn/layoff-alert-view.ts': 'admin-only page for one layoff notice, laid out like the layoff alert email: reads the employer\'s CRM organization and people to count them and list who to contact with a Write email button; shown only in the admin Layoff notices area, never on a candidate page',
    'src/lib/org-claims/section-claim.ts':'not a CRM table read (matched only because the claim carries a crmOrganizationId field): after a verified claim it reads and writes Organization, OrgWorkspace, OrgWorkspaceAdmin and OrgClaim for one employer section, and emails the section\'s existing admins; it reads no CRM organization, person, note or status, and returns nothing to a candidate',
    'src/lib/employer/staff-workspaces.ts':'admin-only (called only from Server Actions behind requireAdmin and the staff organization page); not a CRM table read, matched only because OrgClaim carries a crmOrganizationId field: reads Organization, OrgWorkspace, OrgWorkspaceAdmin, OrgClaim and OutplacementEmployerOrg to run the staff section controls; it reads no CRM organization, person, note or status, and returns nothing to a candidate',
    'src/lib/outreach/events.ts': 'admin outreach: Resend webhook handler for tagged cold email; marks bounced or complaining addresses',
    'src/lib/warn/layoff-hr-enrich.ts': 'admin WARN tooling: imported only by the layoff alert; adds HR people at the employer to the CRM when a layoff is filed',
    'src/lib/warn/layoff-alert-people.ts': 'admin WARN tooling: imported only by the layoff alert; lists the CRM and workforce contacts tied to one layoff',
    'src/lib/warn/layoff-alert.ts':'admin WARN tooling: emails the owner about a new layoff; imported only by WARN sync, news-check and the SEC 8-K check',
    'src/lib/warn/layoff-hq-state.ts': 'admin WARN tooling: imported only by the layoff alert; fills in an employer\'s US state on its CRM organization from SEC filings',
    'src/lib/warn/layoff-primary-run.ts': 'admin WARN tooling: imported only by the warn-sync and layoff-news crons',
    'src/lib/warn/news-check.ts': 'admin WARN tooling: imported only by the warn-sync and layoff-news crons',
    'src/lib/warn/sync.ts': 'admin WARN tooling',
    'src/lib/bids/crm-filing.ts': 'admin bid-finder tooling: imported only by the board-bids and competitor-awards crons; files bids and competitor wins on CRM organizations',
    'src/lib/vision/competitor-sync.ts': 'admin competitor tooling: imported only by the admin Competitors actions, the competitor-watch cron and the bid-finder filing',
    'src/lib/workforce/college-crm.ts': 'admin workforce tooling',
    'src/lib/workforce/board-intro-data.ts': 'admin workforce tooling: imported only by the admin workforce-board page (behind requireAdmin); finds the director\'s CRM person to build the first email and its tracked link; returns nothing to a candidate',
    'src/lib/workforce/college-rank.ts': 'admin workforce tooling',
    'src/lib/workforce/college-org-link.ts': 'admin workforce tooling: links each college to its CRM organization (scripts/colleges/link-crm.ts and the Review List actions)',
    'src/components/admin/CrmCompetitorContracts.tsx': 'admin-only (rendered only on the admin CRM organization page): competitor awards, open bids and re-bid opportunities tied to one organization',
    'src/lib/warn/layoff-alert-click.ts': 'click redirect from the owner\'s layoff alert email (api/e/go): writes one CRM note that the Write email button was opened; reads no CRM field back to anyone',
    'src/lib/leads/lifecycle/conversion.ts': 'registration: writes one CRM note when a website lead becomes a member (where they came in, what we sent, whether they clicked); reads CRM rows only to build that note and returns nothing to the member',
    'src/lib/leads/lifecycle/file-lead.ts': 'public signup forms call it through notifyNewLead: writes only (files the lead as a CRM person, a note and a mailing-list row) and returns a person id that is never sent to the browser; reads no CRM field back to a candidate',
    'src/lib/leads/lifecycle/run.ts': 'cron only (lead-lifecycle): finds leads by their own signup tables, checks CRM registration and send history to decide the next email; returns counts, never a CRM record',
    'src/lib/leads/lifecycle/send.ts': 'cron and the admin test button: logs each welcome or reminder as a CRM email activity with open and click tracking; reads nothing back to a candidate',
    'src/lib/leads/nurture/run.ts': 'cron only (lead-nurture): finds leads by their own signup tables, checks CRM registration and send history to decide the next email; returns counts and subjects, never a CRM record or an address',
    'src/lib/leads/nurture/send.ts': 'cron only (lead-nurture): logs each follow-up as a CRM email activity with open and click tracking; reads nothing back to a candidate',
    'src/lib/leads/lead-status.ts': 'admin-only (the captured-emails page behind requireAdmin): shows whether each captured address is in the CRM, was emailed, opened, clicked or registered',
    'src/components/admin/CollegeReviewSection.tsx': 'admin Review List: colleges whose CRM match needs a person to decide',
    'src/lib/seo/college-pages.ts': 'public college pages: reads only the CRM organization name to build the /prepared claim slug; returns the slug, nothing else',
    'src/lib/higher-ed/demo-seed.ts': "not the CRM: writes crmExchangeRun, a college's CSV import log (Higher Ed)",
    'src/lib/higher-ed/crm-import.ts': "not the CRM: writes crmExchangeRun, a college's CSV import log (Higher Ed)",
    'src/components/higher-ed/screens.tsx': "not the CRM: lists crmExchangeRun, a college's CSV import history, to that college's admin",
    'src/components/higher-ed/screens-development.tsx': "not the CRM: lists crmExchangeRun, a college's CSV import/export history, to that college's Development office",
    'src/app/i/[slug]/export/[kind]/route.ts': "not the CRM: logs crmExchangeRun for a college's own CSV export (Higher Ed)",
    'src/lib/higher-ed/roi.ts': "not the CRM: reads crmExchangeRun for the college's last gift import date (Higher Ed)",
    'src/lib/institution/admin.ts': 'admin-only: creates a college workspace and its CRM college record',
    // The one reviewed CRM reader a member's page reaches (approved by Justin, 2026-10-15).
    // It returns ONLY MemberOrgSignal: a yes/no "we know someone at this employer" and a
    // guessed address for the posting's own named contact from the employer's email
    // format. No CRM person, title, note, email or status leaves it — pinned below and in
    // src/test/who-to-contact.test.ts.
    'src/lib/jobs/who-to-contact-crm.ts': 'member Who to contact: yes/no + format-based guess only (MemberOrgSignal)',
  }

  // No known violations. job-contacts.ts used to read CRM affiliations and show real CRM
  // emails to members; it now uses only the member's own contacts. If a candidate-facing
  // file ever has to appear here again, that is a policy decision, not a test edit.
  const KNOWN_VIOLATIONS: string[] = []

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

  it('the Who to contact CRM reader returns only the member-safe signal', () => {
    const src = stripComments(read(join(ROOT, 'src/lib/jobs/who-to-contact-crm.ts')))
    // Every exported reader returns MemberOrgSignal, and does so through toMemberOrgSignal.
    expect(src).toMatch(/export async function loadMemberOrgSignal\([\s\S]*?\): Promise<MemberOrgSignal>/)
    expect(src).toContain('return toMemberOrgSignal(')
    expect(src.match(/export async function/g)).toHaveLength(1)
    // The member-facing action never imports the CRM library itself.
    const action = read(join(ROOT, 'src/app/dashboard/find-my-job/who-to-contact-actions.ts'))
    expect(action).not.toMatch(/@\/lib\/crm\//)
  })

  it('job-contacts.ts reads no CRM table', () => {
    const src = stripComments(read(join(ROOT, 'src/lib/jobs/job-contacts.ts')))
    expect(src).not.toMatch(/\.(crm[A-Z][A-Za-z]*)\b/)
    expect(src).not.toMatch(/@\/lib\/crm\//)
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

