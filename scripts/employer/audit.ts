// Build plan step 2: the read-only production audit for the employer sections. READ ONLY: the client is wrapped so any write,
// raw SQL or transaction throws (scripts/employer/read-only-db.ts). It prints counts, user ids and company names, no emails.
//
//   npm run employer:audit -- --dry-run     says what it would read; connects to nothing
//   npm run employer:audit                  runs against DATABASE_URL
//   npm run employer:audit -- --json        machine-readable
//   npm run employer:audit -- --no-auth-lookup   skip reading hiring owners' emails from Supabase (the email-only overlap is then not counted)
//
// Answers: who has both a hiring account and an outplacement login (same sign-in, and different sign-ins with the same email);
// which companies have several hiring accounts; contracts by program type and status; outplacement logins nobody accepted;
// and how much the workspace backfills have left to do.

import { PrismaClient } from '@prisma/client'
import { readOnlyDb } from './read-only-db'
import { contractsTable, overlapByEmailOnly, overlapByUser, pendingOrgUsers, severalHiringAccounts, type HiringAccount } from './audit-lib'

const flag = (n: string) => process.argv.includes(`--${n}`)

async function main() {
  if (flag('dry-run')) {
    console.log('Dry run. Nothing is read and nothing is written. A real run (still read only) would count:')
    console.log('  - people with a hiring account and an outplacement login under the same sign-in, and under different sign-ins with the same email')
    console.log('  - companies with several hiring accounts (by website host, else company name)')
    console.log('  - contracts by program type and status; outplacement logins without an accepted invite')
    console.log('  - outplacement organizations with no Outplacement workspace; Employees workspaces still to create; hiring accounts without a Hiring workspace')
    return
  }
  const base = new PrismaClient()
  const db = readOnlyDb(base) as unknown as PrismaClient
  try {
    const [profiles, seats, orgUsers, contractRows, orgs, workspaces] = await Promise.all([
      db.employerProfile.findMany({ select: { id: true, userId: true, companyName: true, companyWebsite: true } }),
      db.employerSeat.findMany({ where: { userId: { not: null }, acceptedAt: { not: null } }, select: { userId: true } }),
      db.outplacementOrgUser.findMany({ select: { orgId: true, userId: true, invitedEmail: true, acceptedAt: true, invitedAt: true } }),
      db.outplacementContract.groupBy({ by: ['programType', 'status'], _count: { _all: true } }),
      db.outplacementEmployerOrg.findMany({ where: { isSampleData: false }, select: { id: true } }),
      db.orgWorkspace.findMany({ where: { type: { in: ['HIRING', 'EMPLOYEES', 'OUTPLACEMENT'] } }, select: { type: true, refId: true } }),
    ])
    const activeEmployeesOrgs = new Set(
      (await db.outplacementContract.findMany({ where: { status: 'ACTIVE', programType: { in: ['GROWTH', 'LEARNING'] } }, select: { orgId: true }, distinct: ['orgId'] })).map((c) => c.orgId)
    )

    const hiring: HiringAccount[] = profiles.map((p) => ({ profileId: p.id, userId: p.userId, companyName: p.companyName, companyWebsite: p.companyWebsite }))
    if (!flag('no-auth-lookup')) {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const admin = createAdminClient()
      // Read only: getUserById never changes a user. Five at a time.
      for (let i = 0; i < hiring.length; i += 5) {
        await Promise.all(hiring.slice(i, i + 5).map(async (h) => (h.email = (await admin.auth.admin.getUserById(h.userId)).data.user?.email ?? null)))
      }
    }

    let newTable = 'readable'
    let admins = 0
    try {
      admins = await db.orgWorkspaceAdmin.count()
    } catch {
      newTable = 'NOT readable (prisma/manual/2026-10-24-employer-sections.sql is not applied)'
    }

    const sameSignIn = overlapByUser([...profiles.map((p) => p.userId), ...(seats.map((s) => s.userId).filter(Boolean) as string[])], orgUsers)
    const emailOnly = flag('no-auth-lookup') ? null : overlapByEmailOnly(hiring, orgUsers)
    const outplacementWs = new Set(workspaces.filter((w) => w.type === 'OUTPLACEMENT' && w.refId).map((w) => w.refId))
    const employeesWs = new Set(workspaces.filter((w) => w.type === 'EMPLOYEES' && w.refId).map((w) => w.refId))
    const hiringWs = new Set(workspaces.filter((w) => w.type === 'HIRING' && w.refId).map((w) => w.refId))

    const report = {
      peopleWithHiringAndOutplacementSameSignIn: { count: sameSignIn.length, userIds: sameSignIn.slice(0, 50) },
      peopleWithHiringAndOutplacementSameEmailDifferentSignIn: emailOnly ? { count: emailOnly.length, rows: emailOnly.slice(0, 50) } : 'skipped (--no-auth-lookup)',
      companiesWithSeveralHiringAccounts: { count: severalHiringAccounts(hiring).length, top: severalHiringAccounts(hiring).slice(0, 25) },
      contractsByProgramTypeAndStatus: contractsTable(contractRows),
      outplacementLoginsNobodyAccepted: pendingOrgUsers(orgUsers),
      backfillSizing: {
        outplacementOrganizations: orgs.length,
        withoutOutplacementWorkspace: orgs.filter((o) => !outplacementWs.has(o.id)).length,
        employeesWorkspacesToCreate: [...activeEmployeesOrgs].filter((id) => outplacementWs.has(id) && !employeesWs.has(id)).length,
        hiringAccountsWithoutHiringWorkspace: profiles.filter((p) => !hiringWs.has(p.id)).length,
        orgWorkspaceAdminRows: admins,
        orgWorkspaceAdminTable: newTable,
      },
    }
    if (flag('json')) return console.log(JSON.stringify(report, null, 2))
    console.log(`Same sign-in in Hiring and Outplacement: ${report.peopleWithHiringAndOutplacementSameSignIn.count}`)
    console.log(`Same email, two separate sign-ins: ${typeof report.peopleWithHiringAndOutplacementSameEmailDifferentSignIn === 'string' ? report.peopleWithHiringAndOutplacementSameEmailDifferentSignIn : report.peopleWithHiringAndOutplacementSameEmailDifferentSignIn.count}`)
    console.log(`Companies with several hiring accounts: ${report.companiesWithSeveralHiringAccounts.count}`)
    for (const g of report.companiesWithSeveralHiringAccounts.top) console.log(`  ${g.accounts} x ${g.example} (${g.key})`)
    console.log('Contracts by program type and status:')
    for (const c of report.contractsByProgramTypeAndStatus) console.log(`  ${c.programType} ${c.status}: ${c.contracts}`)
    console.log(`Outplacement logins nobody accepted: ${report.outplacementLoginsNobodyAccepted.total} (${report.outplacementLoginsNobodyAccepted.olderThan30Days} older than 30 days)`)
    console.log('Backfill sizing:', JSON.stringify(report.backfillSizing))
  } finally {
    await base.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
