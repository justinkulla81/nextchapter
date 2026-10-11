// HE-02 / HE-03 verification against the real database, inside ONE
// transaction that is always rolled back (no fixture row persists):
//
//   1. Role resolution: each persona sees exactly its workspaces (HE-03
//      "done when"), including VIEWER read-only, nc_admin on demo vs. real
//      tenants, View-as, pending employer links and revoked staff.
//   2. Consent views: a staff user without consent sees no search detail
//      through any path (HE-02 "done when"): every gated column flips with
//      the member's consent, the transition view has no reason/source, the
//      readers refuse the wrong roles, and API roles can't read the views.
//   3. Audit: a staff view of a member writes AdminAccessLog, and "Who
//      viewed my profile" returns the workspace and date only.
//
//   npm run verify:he02
import { randomUUID } from 'crypto'
import { PrismaClient, type Prisma } from '@prisma/client'
import { resolveInstitutionAccess, VIEW_AS_SURFACE, type InstitutionAccess } from '../../src/lib/higher-ed/resolve'
import {
  getMemberForStaff,
  getRoiInputs,
  listCaseloadActivity,
  listEmployerDossiers,
  listMemberDirectory,
  listOpenTransitions,
} from '../../src/lib/higher-ed/views'
import { listProfileViews } from '../../src/lib/higher-ed/audit'
import { isReadOnlyIn } from '../../src/lib/higher-ed/workspaces'

type Tx = Prisma.TransactionClient
class Rollback extends Error {}

const P = 'he02test_'
const id = (s: string) => P + s

let passed = 0
const failures: string[] = []
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) passed++
  else failures.push(`${name}: expected ${e}, got ${a}`)
}
async function rejects(name: string, fn: () => Promise<unknown>) {
  try {
    await fn()
    failures.push(`${name}: expected an access error, got none`)
  } catch {
    passed++
  }
}

const U = Object.fromEntries(
  ['admin', 'alumni', 'dev', 'career', 'career2', 'employerRel', 'viewer', 'revoked', 'member', 'staffMember', 'employer', 'pendingEmployer', 'nc', 'nobody'].map((k) => [k, randomUUID()]),
) as Record<string, string>

async function seed(tx: Tx) {
  const ex = (sql: string, ...p: unknown[]) => tx.$executeRawUnsafe(sql, ...p)
  // Institution tier: every workspace exists, so role resolution is what's tested
  // (tier gating has its own checks below and in the unit tests).
  await tx.institution.create({ data: { id: id('real'), slug: id('real'), name: 'Real U', tier: 'INSTITUTION' }, select: { id: true } })
  await tx.institution.create({ data: { id: id('demo'), slug: id('demo'), name: 'Demo U', isDemo: true, tier: 'INSTITUTION' }, select: { id: true } })
  await tx.institution.create({ data: { id: id('career'), slug: id('career'), name: 'Career-tier U', tier: 'CAREER' }, select: { id: true } })
  await tx.roleGrant.create({ data: { userId: U.nc, role: 'nc_admin' } })

  const staff: [string, string, string | null, boolean][] = [
    ['admin', 'INSTITUTION_ADMIN', null, false],
    ['alumni', 'ALUMNI_RELATIONS', null, false],
    ['dev', 'DEVELOPMENT', null, false],
    ['career', 'CAREER_SERVICES', null, false],
    ['career2', 'CAREER_SERVICES', null, false],
    ['employerRel', 'EMPLOYER_RELATIONS', null, false],
    ['viewer', 'VIEWER', 'alumni', false],
    ['revoked', 'DEVELOPMENT', null, true],
    ['staffMember', 'ALUMNI_RELATIONS', null, false],
  ]
  for (const [k, role, workspace, revoked] of staff) {
    await tx.institutionUser.create({
      data: {
        id: id(`u_${k}`),
        institutionId: id('real'),
        userId: U[k],
        invitedEmail: `${k}@he02.test`,
        role: role as never,
        workspace,
        acceptedAt: new Date(),
        revokedAt: revoked ? new Date() : null,
      },
    })
  }

  // Two candidates who are members; the second is also staff.
  for (const [k, uid] of [['c1', U.member], ['c2', U.staffMember]] as const) {
    await ex(
      `insert into "CandidateProfile"(id,"userId","updatedAt","positioningStatementText") values ($1,$2,now(),$3)`,
      id(k), uid, k === 'c1' ? 'Operations leader who turns around plants.' : null,
    )
  }
  await tx.institutionMember.create({
    data: { id: id('m1'), institutionId: id('real'), candidateId: id('c1'), email: 'm1@he02.test', firstName: 'Mia', lastName: 'One', classYear: 2010, lastKnownEmployer: 'Roster Co', lastKnownTitle: 'Roster Title', status: 'CLAIMED' },
  })
  await tx.institutionMember.create({
    data: { id: id('m2'), institutionId: id('real'), candidateId: id('c2'), email: 'm2@he02.test', firstName: 'Max', lastName: 'Two', status: 'CLAIMED' },
  })

  // NextChapter-side activity for m1: current job, a sprint, a login.
  await tx.company.create({ data: { id: id('co'), name: 'Kestrel Test Co', canonicalNameNormalized: id('kestrel') } })
  await tx.memberEmployment.create({ data: { candidateId: id('c1'), companyId: id('co'), title: 'VP Operations', isCurrent: true } })
  await tx.weeklySprint.create({
    data: { candidateId: id('c1'), weekStartDate: new Date('2026-09-28T00:00:00Z'), committedActions: [{ text: 'a', completed: true }, { text: 'b', completed: false }] },
  })
  await tx.candidateLoginEvent.create({ data: { candidateId: id('c1') } })
  await tx.engagementEvent.create({
    data: { institutionId: id('real'), memberId: id('m1'), type: 'EVENT', caseCategory: 'EXPERIENTIAL', points: 3, occurredAt: new Date(), sourceTable: 'he02test', sourceId: '1' },
  })
  await tx.transitionFlag.create({
    data: { id: id('flag'), memberId: id('m1'), openFlagMemberId: id('m1'), source: 'COUNSELOR', reason: 'SECRET reason' },
  })
  await tx.caseloadAssignment.create({ data: { institutionId: id('real'), counselorId: id('u_career'), memberId: id('m1') } })

  // Employers: one approved link, one pending.
  for (const [k, uid, status] of [['emp', U.employer, 'APPROVED'], ['pend', U.pendingEmployer, 'PENDING']] as const) {
    await tx.employerProfile.create({ data: { id: id(k), userId: uid, companyName: `${k} Inc` } })
    await tx.institutionEmployer.create({ data: { institutionId: id('real'), employerProfileId: id(k), status } })
  }
}

async function access(tx: Tx, user: string, slug = id('real'), demoPersona: string | null = null) {
  const a = await resolveInstitutionAccess({ slug, userId: U[user], email: `${user}@he02.test`, demoPersona }, tx)
  if (!a) throw new Error('institution not found')
  return a
}
const ctxOf = (a: InstitutionAccess, workspace: string) => ({ ...a, workspace })

async function run(tx: Tx) {
  // ── 1. Each persona sees exactly its workspaces ───────────────────────
  check('INSTITUTION_ADMIN', (await access(tx, 'admin')).workspaces, ['alumni', 'development', 'career', 'teaching', 'execed', 'admin'])
  check('ALUMNI_RELATIONS', (await access(tx, 'alumni')).workspaces, ['alumni'])
  check('DEVELOPMENT', (await access(tx, 'dev')).workspaces, ['development'])
  check('CAREER_SERVICES', (await access(tx, 'career')).workspaces, ['career'])
  check('EMPLOYER_RELATIONS', (await access(tx, 'employerRel')).workspaces, ['career'])
  const viewer = await access(tx, 'viewer')
  check('VIEWER (alumni)', viewer.workspaces, ['alumni'])
  check('VIEWER is read-only', isReadOnlyIn(viewer.tokens, 'alumni'), true)
  check('ALUMNI_RELATIONS is not read-only', isReadOnlyIn((await access(tx, 'alumni')).tokens, 'alumni'), false)
  check('Revoked staff', (await access(tx, 'revoked')).workspaces, [])
  check('Member', (await access(tx, 'member')).workspaces, ['candidate'])
  check('Staff who is also a member', (await access(tx, 'staffMember')).workspaces, ['candidate', 'alumni'])
  check('Approved employer', (await access(tx, 'employer')).workspaces, ['employer'])
  check('Pending employer', (await access(tx, 'pendingEmployer')).workspaces, [])
  check('Stranger', (await access(tx, 'nobody')).workspaces, [])
  check('Unknown slug', await resolveInstitutionAccess({ slug: id('nope'), userId: U.nobody, email: null }, tx), null)

  const allV1 = ['candidate', 'alumni', 'development', 'career', 'teaching', 'execed', 'employer', 'admin']
  const ncReal = await access(tx, 'nc')
  check('nc_admin on a real tenant without View-as', ncReal.workspaces, [])
  await tx.adminAccessLog.create({ data: { adminEmail: 'nc@he02.test', viewedInstitutionId: id('real'), surface: VIEW_AS_SURFACE, reason: 'support ticket' } })
  const ncViewAs = await access(tx, 'nc')
  check('nc_admin with a logged View-as', [ncViewAs.mode, ncViewAs.workspaces], ['view-as', allV1])
  const ncDemo = await access(tx, 'nc', id('demo'))
  check('nc_admin on a demo tenant', [ncDemo.mode, ncDemo.workspaces], ['demo-admin', allV1])
  check('Demo "Preview as" Development', (await access(tx, 'nc', id('demo'), 'DEVELOPMENT')).workspaces, ['development'])
  check('Demo "Preview as" Career Services', (await access(tx, 'nc', id('demo'), 'CAREER_SERVICES')).workspaces, ['career'])
  check('Demo "Preview as" Coach', (await access(tx, 'nc', id('demo'), 'COACH')).workspaces, ['career'])
  await tx.adminAccessLog.create({ data: { adminEmail: 'nc@he02.test', viewedInstitutionId: id('career'), surface: VIEW_AS_SURFACE, reason: 'tier check' } })
  check('Career tier: no Development, Teaching or Exec Ed even for nc_admin', (await access(tx, 'nc', id('career'))).workspaces, ['candidate', 'alumni', 'career', 'employer', 'admin'])
  check('Demo "Preview as" Faculty', (await access(tx, 'nc', id('demo'), 'FACULTY')).workspaces, ['teaching', 'execed'])
  check('A non-admin on the demo tenant gets nothing', (await access(tx, 'alumni', id('demo'))).workspaces, [])

  // ── 2. Consent views ───────────────────────────────────────────────────
  const alumni = ctxOf(await access(tx, 'alumni'), 'alumni')
  const dev = ctxOf(await access(tx, 'dev'), 'development')
  const career = ctxOf(await access(tx, 'career'), 'career')
  const career2 = ctxOf(await access(tx, 'career2'), 'career')
  const admin = ctxOf(await access(tx, 'admin'), 'admin')
  const employer = ctxOf(await access(tx, 'employer'), 'employer')

  const m1 = async () => (await listMemberDirectory(alumni, { q: 'Mia' }, tx)).rows[0]
  let row = await m1()
  check('Directory: outcome shared by default → current employer', [row.employer, row.title], ['Kestrel Test Co', 'VP Operations'])
  check('Directory: engagement shared by default', row.engagementPoints12mo, 3)

  const consent = (scope: string, granted: boolean) =>
    tx.institutionConsent.create({ data: { memberId: id('m1'), scope: scope as never, granted, source: 'MEMBER', changedAt: new Date(Date.now() + passed * 1000) } })
  await consent('SHARE_OUTCOME', false)
  await consent('SHARE_ENGAGEMENT', false)
  row = await m1()
  check('Directory: outcome off → no employer or title', [row.employer, row.title], [null, null])
  check('Directory: engagement off → no points', row.engagementPoints12mo, null)

  let cl = (await listCaseloadActivity(career, tx)).find((r) => r.memberId === id('m1'))
  check('Caseload: no search-detail consent → no detail',
    [cl?.lastActivityAt, cl?.sprintWeekStart, cl?.sprintActionsTotal, cl?.sprintActionsDone, cl?.lastCoachingAt], [null, null, null, null, null])
  await consent('SHARE_SEARCH_DETAIL_WITH_CAREER', true)
  cl = (await listCaseloadActivity(career, tx)).find((r) => r.memberId === id('m1'))
  check('Caseload: consent on → sprint shows', [cl?.sprintActionsTotal, cl?.sprintActionsDone, !!cl?.lastActivityAt], [2, 1, true])
  await consent('SHARE_SEARCH_DETAIL_WITH_CAREER', false)
  cl = (await listCaseloadActivity(career, tx)).find((r) => r.memberId === id('m1'))
  check('Caseload: consent revoked → detail gone again', [cl?.sprintActionsTotal, cl?.lastActivityAt], [null, null])
  check('Caseload: unassigned counselor sees none of it', (await listCaseloadActivity(career2, tx)).length, 0)
  check('Caseload: director (INSTITUTION_ADMIN) sees it', (await listCaseloadActivity(admin, tx)).some((r) => r.memberId === id('m1')), true)

  check('Dossiers: sharing off by default → none', (await listEmployerDossiers(employer, tx)).length, 0)
  await consent('SHARE_DOSSIER_WITH_EMPLOYERS', true)
  const dossiers = await listEmployerDossiers(employer, tx)
  check('Dossiers: sharing on → approved summary only', dossiers.map((d) => d.dossierSummary), ['Operations leader who turns around plants.'])

  const transitions = await listOpenTransitions(dev, tx)
  check('Transition: Development sees the open flag', transitions.map((t) => [t.memberId, t.doNotSolicit]), [[id('m1'), true]])
  check('Transition: no reason or source in what Development gets', Object.keys(transitions[0]).some((k) => /reason|source/i.test(k)), false)
  const cols = await tx.$queryRaw<{ c: string }[]>`
    select column_name as c from information_schema.columns where table_schema = 'private' and table_name = 'v_member_transition'`
  check('Transition view has no reason/source column at all', cols.some((c) => /reason|source/i.test(c.c)), false)

  // Readers refuse the wrong roles.
  await rejects('Development cannot read caseload activity', () => listCaseloadActivity(dev, tx))
  await rejects('Alumni Relations cannot read ROI inputs', () => getRoiInputs(alumni, tx))
  await rejects('An employer cannot read the member directory', () => listMemberDirectory(employer, {}, tx))
  await rejects('An employer cannot read transition flags', () => listOpenTransitions(employer, tx))
  const employerRel = ctxOf(await access(tx, 'employerRel'), 'career')
  await rejects('Employer Relations cannot read transition flags', () => listOpenTransitions(employerRel, tx))
  await rejects('Staff cannot read employer Dossiers', () => listEmployerDossiers(admin, tx))
  check('Development reads ROI aggregates', (await getRoiInputs(dev, tx))?.openFlagCount, 1)

  // API roles can't reach the views or candidate tables at all.
  await tx.$executeRawUnsafe('savepoint api')
  await tx.$executeRawUnsafe('set local role authenticated')
  await tx.$queryRawUnsafe(`select set_config('request.jwt.claims', $1, true)`, JSON.stringify({ sub: U.dev, role: 'authenticated' }))
  let viewErr = false
  try {
    await tx.$queryRawUnsafe('select 1 from private.v_caseload_activity limit 1')
  } catch {
    viewErr = true
  }
  await tx.$executeRawUnsafe('rollback to savepoint api')
  check('Signed-in API client cannot read the views', viewErr, true)
  await tx.$executeRawUnsafe('set local role authenticated')
  await tx.$queryRawUnsafe(`select set_config('request.jwt.claims', $1, true)`, JSON.stringify({ sub: U.dev, role: 'authenticated' }))
  const sprints = await tx.$queryRawUnsafe<{ n: number }[]>(`select count(*)::int as n from "WeeklySprint" where "candidateId" = $1`, id('c1'))
  await tx.$executeRawUnsafe('rollback to savepoint api')
  await tx.$executeRawUnsafe('release savepoint api')
  check('Signed-in API client sees no sprint rows directly', sprints[0].n, 0)

  // ── 3. Audit ───────────────────────────────────────────────────────────
  const viewed = await getMemberForStaff(alumni, id('m1'), tx)
  check('Staff member view returns the consent-applied row', viewed?.employer, null)
  const log = await tx.adminAccessLog.findFirst({ where: { viewedInstitutionMemberId: id('m1') } })
  check('Staff member view writes AdminAccessLog', [log?.surface, log?.viewedCandidateId, log?.adminEmail], ['alumni', id('c1'), 'alumni@he02.test'])
  const views = await listProfileViews(id('m1'), tx)
  check('Who viewed my profile: workspace and date, no names', [views.length, Object.keys(views[0]).sort()], [1, ['viewedAt', 'workspace']])
}

async function main() {
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } })
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`set local lock_timeout = '5s'`)
        await seed(tx)
        await run(tx)
        throw new Rollback()
      },
      { timeout: 120_000, maxWait: 20_000 },
    )
  } catch (e) {
    if (!(e instanceof Rollback)) throw e
  } finally {
    await prisma.$disconnect()
  }
  console.log(`${passed} passed, ${failures.length} failed (all fixtures rolled back)`)
  for (const f of failures) console.log('  FAIL ' + f)
  if (failures.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
