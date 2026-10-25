// Build plan step 4: copy today's people into OrgWorkspaceAdmin (source MIGRATED). Additive and idempotent.
//
//   npm run employer:backfill-admins                 DRY RUN (the default): prints the plan, writes nothing
//   npm run employer:backfill-admins -- --apply      writes the plan
//   npm run employer:backfill-admins -- --json       the plan as JSON (also dry unless --apply)
//   ... -- --no-auth-lookup                          do not read hiring owners' emails from Supabase (their rows are then skipped)
//
// Copies, to workspaces that already exist (run employer:backfill-workspaces first):
//   OutplacementOrgUser  -> the Outplacement workspace (ADMIN, VIEWER, LEGAL, FINANCE unchanged), and the Employees workspace for
//                           ADMIN and VIEWER only
//   EmployerProfile owner -> the Hiring workspace as ADMIN (the owner's email is read from their Supabase user; read only)
//   EmployerSeat          -> the Hiring workspace: OWNER is ADMIN, MEMBER is VIEWER
// A row that already exists for the same workspace and email is left alone. Nothing reads these rows to REMOVE access, and
// today's checks still answer first, so copying them changes what nobody can do. In a dry run the database client cannot write at all.

import { PrismaClient } from '@prisma/client'
import { readOnlyDb } from './read-only-db'
import { runAdminBackfill } from './backfill-run'

const flag = (n: string) => process.argv.includes(`--${n}`)

async function main() {
  const apply = flag('apply')
  const base = new PrismaClient()
  const reader = readOnlyDb(base) as unknown as PrismaClient

  let lookupEmail: (userId: string) => Promise<string | null> = async () => null
  if (!flag('no-auth-lookup')) {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()
    // Read only: getUserById never changes the user.
    lookupEmail = async (userId) => (await admin.auth.admin.getUserById(userId)).data.user?.email ?? null
  }
  try {
    console.log(apply ? 'APPLY: writing to the database.' : 'DRY RUN: nothing is written. Add --apply to write.')
    const { plan, applied } = await runAdminBackfill(reader, base, { apply }, lookupEmail)
    if (flag('json')) return console.log(JSON.stringify({ apply, plan: { ...plan, ops: plan.ops.map((o) => ({ ...o, email: o.email.replace(/^(.).*(@.*)$/, '$1***$2') })) }, applied }, null, 2))
    const by = new Map<string, number>()
    for (const o of plan.ops) by.set(`${o.from} -> ${o.role}`, (by.get(`${o.from} -> ${o.role}`) ?? 0) + 1)
    console.log(`Rows to create: ${plan.ops.length}; already there: ${plan.alreadyThere}; skipped: ${plan.skipped.length}`)
    for (const [k, n] of [...by.entries()].sort()) console.log(`  ${k}: ${n}`)
    for (const s of plan.skipped.slice(0, 100)) console.log(`  skipped: ${s}`)
    if (applied) console.log(`Applied: ${JSON.stringify(applied)}`)
    else console.log('Nothing was written.')
  } finally {
    await base.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
