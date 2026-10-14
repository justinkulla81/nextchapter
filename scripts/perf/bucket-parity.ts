// Old (baseline copy of job-fit-bucket.ts from origin/main) vs new fit scorer, every live board row x real members. Read-only.
import { prisma } from '@/lib/prisma'
import { computeBoardListingFitBucket as oldBucket, computeFitAssessment as oldAssess } from './baseline/job-fit-bucket'
import { boardListingFitBucketScorer, computeFitAssessment, computeBoardListingIsIdealMatch, isVeryStrongBoardFit } from '@/lib/jobs/job-fit-bucket'
import * as base from './baseline/job-fit-bucket'
import { readFileSync } from 'fs'
const F = '/private/tmp/claude-501/-Users-salitkulla/4e7eb5e5-e52a-4531-8848-a44f741241c7/scratchpad/light.json'
async function main() {
  const rows: any[] = JSON.parse(readFileSync(F, 'utf8')); for (const p of rows) { p.createdAt = new Date(p.createdAt); p.postedAt = p.postedAt ? new Date(p.postedAt) : null }
  const cands = await prisma.candidateProfile.findMany({ where: { isSampleData: false } })
  // A few real postings with descriptions too, to exercise the description paths.
  const withDesc = await prisma.exclusiveJobPosting.findMany({ where: { description: { not: null } }, take: 300, orderBy: { createdAt: 'desc' } })
  await prisma.$disconnect()
  console.log('members', cands.length, 'rows', rows.length)
  let pairs = 0, diffs = 0, assessDiffs = 0
  for (const c of cands) {
    const score = boardListingFitBucketScorer(c as any)
    for (const p of rows) {
      pairs++
      if (score(p) !== oldBucket(c as any, { ...p, description: null })) { diffs++; if (diffs < 5) console.log('DIFF', c.id, p.id) }
    }
    for (const p of withDesc) {
      for (const lvl of [undefined, null, 'VP', 'Director']) {
        const a = JSON.stringify(computeFitAssessment(c as any, p as any, lvl)); const b = JSON.stringify(oldAssess(c as any, p as any, lvl))
        if (a !== b) { assessDiffs++; if (assessDiffs < 5) console.log('ASSESS DIFF', c.id, p.id, lvl, a, b) }
      }
      if (computeBoardListingIsIdealMatch(c as any, p) !== base.computeBoardListingIsIdealMatch(c as any, p)) { assessDiffs++; console.log('IDEAL DIFF') }
      if (isVeryStrongBoardFit(c as any, p, 'VP') !== base.isVeryStrongBoardFit(c as any, p, 'VP')) { assessDiffs++; console.log('VSTRONG DIFF') }
    }
  }
  console.log({ pairs, diffs, assessDiffs, descPairs: cands.length * withDesc.length })
}
main()
