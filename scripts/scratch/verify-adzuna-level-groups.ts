// Direct Adzuna comparison — bypasses the getMarketConditions cache/
// background-refresh machinery entirely (which needs a real Next.js request
// scope for its after() background fetch, unavailable in a script) to
// directly compare the OLD literal-title query against the NEW
// level-group-broadened query for the two candidates the user flagged.
//
// Run: npx tsx --env-file=.env.local scripts/scratch/verify-adzuna-level-groups.ts

import { searchAdzunaJobs } from '../../src/lib/market/adzuna'
import { classifyTitleLevelGroup, extractFunctionalCore, LEVEL_GROUP_SYNONYMS } from '../../src/lib/jobs/level-groups'

const CASES = [
  { title: 'VP of Corporate Development', where: 'New York, NY' },
  { title: 'Partner', where: 'New York, NY', primaryFunction: 'Finance' },
]

async function main() {
  for (const c of CASES) {
    const levelGroup = classifyTitleLevelGroup(c.title)
    const functionalCore = extractFunctionalCore(c.title)
    const newWhat = functionalCore || c.primaryFunction || c.title
    const whatOr = levelGroup ? LEVEL_GROUP_SYNONYMS[levelGroup] : undefined

    console.log(`\n=== "${c.title}" ===`)
    console.log(`  levelGroup=${levelGroup}  functionalCore="${functionalCore}"  new what="${newWhat}"  whatOr=${JSON.stringify(whatOr)}`)

    const oldResult = await searchAdzunaJobs(c.title, c.where)
    console.log(`  OLD (literal title, title_only): count=${oldResult.count}  status=${oldResult.status}  error=${oldResult.error}`)

    const newResult = await searchAdzunaJobs(newWhat, c.where, 50, null, whatOr)
    console.log(`  NEW (function + level-group breadth): count=${newResult.count}  status=${newResult.status}  error=${newResult.error}`)
  }
}

main()
