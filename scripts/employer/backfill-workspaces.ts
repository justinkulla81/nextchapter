// Build plan step 3: make the Outplacement and Employees workspaces match today's contracts. Additive and idempotent.
//
//   npm run employer:backfill-workspaces                   DRY RUN (the default): prints the plan, writes nothing
//   npm run employer:backfill-workspaces -- --apply        writes the plan
//   npm run employer:backfill-workspaces -- --json         the plan as JSON (also dry unless --apply)
//   ... -- --apply --create-missing-orgs reviewed.json     also creates an Organization for the outplacement orgs whose id is in
//                                                          reviewed.json (a JSON array of OutplacementEmployerOrg ids a person
//                                                          checked from the dry run's "without an Organization" list)
//
// What it does, per outplacement organization that already has an Organization (an OUTPLACEMENT workspace points at it):
//   - sets the Outplacement workspace plan to CONTRACT when an outplacement contract exists (only if the plan was never set);
//   - when it has an ACTIVE GROWTH or LEARNING contract, makes sure an Employees workspace exists pointing at the same
//     record, with services { learning, retention, retraining:false } from the contracts, plan CONTRACT;
//   - an existing Employees workspace only gets its empty fields filled; a service key that is already set is never changed.
// Needs prisma/manual/2026-10-24-employer-sections.sql applied first (the plan and services columns, the EMPLOYEES value).
// In a dry run the database client cannot write at all (scripts/employer/read-only-db.ts), so a mistake here still cannot write.

import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { readOnlyDb } from './read-only-db'
import { runWorkspaceBackfill } from './backfill-run'

const flag = (n: string) => process.argv.includes(`--${n}`)
const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const apply = flag('apply')
  const reviewedPath = arg('create-missing-orgs')
  const approved: string[] = reviewedPath ? (JSON.parse(readFileSync(reviewedPath, 'utf8')) as string[]) : []
  if (reviewedPath && !apply) console.error('Note: --create-missing-orgs does nothing without --apply.')

  const base = new PrismaClient()
  const reader = readOnlyDb(base) as unknown as PrismaClient
  try {
    console.log(apply ? 'APPLY: writing to the database.' : 'DRY RUN: nothing is written. Add --apply to write.')
    const { plan, applied } = await runWorkspaceBackfill(reader, base, { apply, createOrganizationsFor: approved })
    if (flag('json')) return console.log(JSON.stringify({ apply, plan, applied }, null, 2))
    console.log(`Operations planned: ${plan.ops.length} (${plan.ops.filter((o) => o.kind === 'create_workspace').length} new workspaces, ${plan.ops.filter((o) => o.kind === 'update_workspace').length} updates)`)
    for (const op of plan.ops) console.log(`  ${op.kind === 'create_workspace' ? `create ${op.data.type} for organization ${op.organizationId}` : `update workspace ${op.workspaceId}`}: ${op.why} ${JSON.stringify(op.data)}`)
    console.log(`Outplacement organizations without an Organization (review this list; nothing is created from it without --create-missing-orgs): ${plan.withoutOrganization.length}`)
    for (const o of plan.withoutOrganization.slice(0, 200)) console.log(`  ${o.id}  ${o.name}  <${o.primaryContactEmail}>`)
    if (plan.conflicts.length) {
      console.log(`Left alone for a person to decide: ${plan.conflicts.length}`)
      for (const c of plan.conflicts) console.log(`  ${c}`)
    }
    if (plan.skippedSampleOrgs) console.log(`Sample-data organizations skipped: ${plan.skippedSampleOrgs}`)
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
