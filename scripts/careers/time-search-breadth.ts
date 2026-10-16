// Times the board's ranking step with and without search breadth on the real live board
// (rows read once), so the in-memory cost is measured apart from network time. Read-only.
//
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/careers/time-search-breadth.ts <candidateId>...
import { prisma } from '../../src/lib/prisma'
import { findLightRows } from '../../src/lib/jobs/board-light-rows'
import { liveBoardWhere, rankBoardRows } from '../../src/lib/jobs/board-shortlist'
import { loadBreadthClassifier, loadJobSocs, loadSimilarityIndex } from '../../src/lib/jobs/search-breadth-server'

const ms = (t: number) => `${Math.round(performance.now() - t)} ms`

async function main() {
  let t = performance.now()
  const rows = await findLightRows(liveBoardWhere())
  console.log(`board rows ${rows.length} (read ${ms(t)})`)
  t = performance.now()
  await Promise.all([loadJobSocs(), loadSimilarityIndex()])
  console.log(`job occupations + similarity table, cold read ${ms(t)}`)
  for (const id of process.argv.slice(2)) {
    const candidate = await prisma.candidateProfile.findUniqueOrThrow({ where: { id } })
    const base = { candidate, isCandidatePlus: true }
    rankBoardRows(rows, base) // warms the member-independent per-row memos the board already keeps
    t = performance.now()
    rankBoardRows(rows, base)
    const plain = ms(t)
    t = performance.now()
    const c = await loadBreadthClassifier(candidate)
    const member = ms(t)
    t = performance.now()
    const cold = rankBoardRows(rows, { ...base, place: c?.place, breadth: 'narrow' })
    const coldMs = ms(t)
    t = performance.now()
    rankBoardRows(rows, { ...base, place: c?.place, breadth: 'wide', moreAtLevel: true })
    const warmMs = ms(t)
    t = performance.now()
    const c2 = await loadBreadthClassifier(candidate)
    rankBoardRows(rows, { ...base, place: c2?.place, breadth: 'narrow' })
    const nextRequest = ms(t)
    console.log(`${id}: rank without breadth ${plain} | member vector ${member} | rank+classify cold ${coldMs} | warm ${warmMs} | next request (memo) ${nextRequest} | narrow ${cold.narrowTotal} wide ${cold.wideTotal}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
