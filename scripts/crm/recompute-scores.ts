/**
 * Recomputes priorityScore for every opportunity, person and organization.
 *
 *   npm run crm:score              # dry run — prints the new top 20
 *   npm run crm:score -- --commit
 *
 * Intended to run nightly. The score depends on things that move on their own
 * (a deadline approaching, a conversation going cold), which is exactly why it
 * is computed rather than typed — the `Priority` column in the source
 * spreadsheets was a number entered in July that still said the same thing in
 * September.
 *
 * priorityOverride is never touched: when set, it wins at read time.
 */
import { PrismaClient } from '@prisma/client'
import { computePriority, warmPathFromContacts } from '../../src/lib/crm/scoring'

const prisma = new PrismaClient()
const COMMIT = process.argv.includes('--commit')
const NOW = new Date()

async function main() {
  console.log(`CRM SCORING — ${COMMIT ? 'COMMIT' : 'DRY RUN (no writes)'}`)

  const stageMax = new Map<string, number>()
  for (const p of await prisma.crmPipeline.findMany({ include: { stages: true } })) {
    stageMax.set(p.id, Math.max(...p.stages.map((s) => s.sortOrder), 1))
  }

  // ── opportunities ──
  const opps = await prisma.crmOpportunity.findMany({
    where: { outcome: 'OPEN' },
    select: {
      id: true, title: true, pipelineId: true, leadQuality: true, eligibility: true,
      nextStepDueAt: true, committedFollowUpAt: true, createdAt: true, priorityOverride: true,
      stage: { select: { sortOrder: true } },
      org: {
        select: {
          deadlines: { where: { dueAt: { not: null } }, orderBy: { dueAt: 'asc' }, take: 1, select: { dueAt: true } },
          affiliations: { select: { person: { select: { connectedAt: true, lastTouchedAt: true } } } },
        },
      },
      activities: { orderBy: { occurredAt: 'desc' }, take: 1, select: { occurredAt: true } },
    },
  })

  const oppUpdates = opps.map((o) => {
    const contacts = o.org?.affiliations.map((a) => a.person) ?? []
    const lastTouched =
      o.activities[0]?.occurredAt ??
      contacts.map((c) => c.lastTouchedAt).filter((d): d is Date => Boolean(d)).sort((a, b) => b.getTime() - a.getTime())[0] ??
      null
    const { score } = computePriority({
      quality: o.leadQuality,
      eligibility: o.eligibility,
      warmPath: warmPathFromContacts(contacts),
      nextDueAt: o.org?.deadlines[0]?.dueAt ?? o.nextStepDueAt ?? null,
      committedFollowUpAt: o.committedFollowUpAt,
      stageProgress: o.stage.sortOrder / (stageMax.get(o.pipelineId) ?? 1),
      lastTouchedAt: lastTouched,
      createdAt: o.createdAt,
      now: NOW,
    })
    return { id: o.id, title: o.title, score, override: o.priorityOverride }
  })

  // ── people ──
  const people = await prisma.crmPerson.findMany({
    select: {
      id: true, fullName: true, leadQuality: true, connectedAt: true,
      lastTouchedAt: true, createdAt: true, priorityOverride: true,
    },
  })
  const personUpdates = people.map((p) => {
    const { score } = computePriority({
      quality: p.leadQuality,
      eligibility: 'NOT_APPLICABLE',
      warmPath: warmPathFromContacts([{ connectedAt: p.connectedAt }]),
      nextDueAt: null,
      committedFollowUpAt: null,
      stageProgress: 0,
      lastTouchedAt: p.lastTouchedAt,
      createdAt: p.createdAt,
      now: NOW,
    })
    return { id: p.id, score }
  })

  // ── organizations: the best score among their open opportunities ──
  const byOrg = new Map<string, number>()
  for (const o of await prisma.crmOpportunity.findMany({ where: { outcome: 'OPEN', orgId: { not: null } }, select: { id: true, orgId: true } })) {
    const s = oppUpdates.find((u) => u.id === o.id)?.score ?? 0
    byOrg.set(o.orgId!, Math.max(byOrg.get(o.orgId!) ?? 0, s))
  }

  console.log(`\nscored ${oppUpdates.length} opportunities, ${personUpdates.length} people, ${byOrg.size} organizations`)
  console.log('\nTOP 20 OPPORTUNITIES')
  for (const u of [...oppUpdates].sort((a, b) => b.score - a.score).slice(0, 20)) {
    console.log(`  ${String(u.score).padStart(5)}  ${u.title.slice(0, 68)}${u.override !== null ? '  [override ' + u.override + ']' : ''}`)
  }

  if (!COMMIT) {
    console.log('\nDry run — nothing written. Re-run with --commit.')
    return
  }

  // One statement per table rather than thousands of round-trips.
  const oppCase = oppUpdates.map((u) => `WHEN '${u.id}' THEN ${u.score}`).join(' ')
  if (oppUpdates.length > 0) {
    await prisma.$executeRawUnsafe(
      `UPDATE "CrmOpportunity" SET "priorityScore" = CASE "id" ${oppCase} END, "priorityComputedAt" = NOW()
       WHERE "id" IN (${oppUpdates.map((u) => `'${u.id}'`).join(',')})`
    )
  }
  for (let i = 0; i < personUpdates.length; i += 1000) {
    const chunk = personUpdates.slice(i, i + 1000)
    await prisma.$executeRawUnsafe(
      `UPDATE "CrmPerson" SET "priorityScore" = CASE "id" ${chunk.map((u) => `WHEN '${u.id}' THEN ${u.score}`).join(' ')} END, "priorityComputedAt" = NOW()
       WHERE "id" IN (${chunk.map((u) => `'${u.id}'`).join(',')})`
    )
  }
  const orgEntries = [...byOrg.entries()]
  if (orgEntries.length > 0) {
    await prisma.$executeRawUnsafe(
      `UPDATE "CrmOrganization" SET "priorityScore" = CASE "id" ${orgEntries.map(([id, s]) => `WHEN '${id}' THEN ${s}`).join(' ')} END, "priorityComputedAt" = NOW()
       WHERE "id" IN (${orgEntries.map(([id]) => `'${id}'`).join(',')})`
    )
  }
  console.log('\nWritten.')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
