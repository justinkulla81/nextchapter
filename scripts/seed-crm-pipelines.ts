/**
 * Seeds the nine admin-CRM pipelines and their stages.
 *
 * All nine share a seven-stage spine with per-pipeline labels, so adding a
 * tenth pipeline later is a row in this file rather than a code change. Only
 * the "committed" and "won" labels differ meaningfully between pipelines —
 * what it means to have landed a coach is not what it means to have landed a
 * term sheet.
 *
 * Idempotent: upserts on (pipeline.key) and (pipelineId, stage.key), so
 * re-running after editing a label updates in place and never duplicates.
 *
 *   npm run seed:crm-pipelines
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type StageSeed = {
  key: string
  label: string
  isWon?: boolean
  isLost?: boolean
  defaultProbability?: number
}

/** The shared spine. `committed` and `won` are overridden per pipeline. */
const spine = (committed: string, won: string): StageSeed[] => [
  { key: 'identified', label: 'Identified', defaultProbability: 0.02 },
  { key: 'researched', label: 'Researched', defaultProbability: 0.05 },
  { key: 'warm_path', label: 'Warm path found', defaultProbability: 0.1 },
  { key: 'contacted', label: 'Contacted', defaultProbability: 0.2 },
  { key: 'in_conversation', label: 'In conversation', defaultProbability: 0.4 },
  { key: 'committed', label: committed, defaultProbability: 0.75 },
  { key: 'won', label: won, isWon: true, defaultProbability: 1 },
  { key: 'lost', label: 'Lost', isLost: true, defaultProbability: 0 },
  { key: 'dormant', label: 'Dormant', isLost: true, defaultProbability: 0 },
]

const PIPELINES: { key: string; label: string; stages: StageSeed[] }[] = [
  { key: 'fundraising', label: 'Fundraising', stages: spine('Term sheet or award', 'Funded') },
  { key: 'bd_partnerships', label: 'BD & partnerships', stages: spine('Agreement drafted', 'Live partnership') },
  { key: 'outplacement', label: 'Outplacement sales', stages: spine('Proposal out', 'Contract signed') },
  { key: 'coach_recruiting', label: 'Coach recruiting', stages: spine('Onboarding started', 'Active coach') },
  { key: 'recruiter_recruiting', label: 'Recruiter recruiting', stages: spine('Firm agreement', 'Active recruiter') },
  { key: 'hiring_managers', label: 'Hiring managers & employers', stages: spine('Role shared', 'Placement made') },
  { key: 'employee_recruiting', label: 'Employee recruiting', stages: spine('Offer out', 'Hired') },
  { key: 'policy_advisers', label: 'Policy & advisers', stages: spine('Adviser agreement', 'Active adviser') },
  { key: 'job_seekers', label: 'Job seekers', stages: spine('Signed up', 'Active member') },
]

async function main() {
  let pipelineCount = 0
  let stageCount = 0

  for (const [i, p] of PIPELINES.entries()) {
    const pipeline = await prisma.crmPipeline.upsert({
      where: { key: p.key },
      create: { key: p.key, label: p.label, sortOrder: i },
      update: { label: p.label, sortOrder: i },
    })
    pipelineCount++

    for (const [j, s] of p.stages.entries()) {
      await prisma.crmStage.upsert({
        where: { pipelineId_key: { pipelineId: pipeline.id, key: s.key } },
        create: {
          pipelineId: pipeline.id,
          key: s.key,
          label: s.label,
          sortOrder: j,
          isWon: s.isWon ?? false,
          isLost: s.isLost ?? false,
          defaultProbability: s.defaultProbability ?? null,
        },
        update: {
          label: s.label,
          sortOrder: j,
          isWon: s.isWon ?? false,
          isLost: s.isLost ?? false,
          defaultProbability: s.defaultProbability ?? null,
        },
      })
      stageCount++
    }

    console.log(`  ${p.label.padEnd(30)} ${p.stages.length} stages`)
  }

  console.log(`\nSeeded ${pipelineCount} pipelines, ${stageCount} stages.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
