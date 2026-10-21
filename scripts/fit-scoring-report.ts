/* eslint-disable @typescript-eslint/no-explicit-any -- ad hoc analysis over raw rows */
// Fit-scoring report: per real member, how many live board jobs are good-or-better,
// strong, very strong and "really good" (very strong + the job match rates it
// strong/good) under the frozen pre-v2 scorer (what the emails use while
// FIT_SCORING_V2_FOR_EMAILS is off) and under v2 (the board). Also replays the
// fresh-job-alert cron for each of the last 3 days. Read-only.
//
//   set -a; . ./.env.local; set +a
//   npx tsx --conditions=react-server scripts/fit-scoring-report.ts [--cache /tmp/board.json] [--only <idSuffix>]
//
// --cache saves the board (descriptions included, ~170MB) on first run and reuses it.
import { prisma } from '@/lib/prisma'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { liveBoardWhere, rankBoardRows } from '@/lib/jobs/board-shortlist'
import { getClosedPostingCounts } from '@/lib/jobs/ghost-risk-data'
import { classifyLocation } from '@/lib/jobs/us-location'
import { ghostRisk, repostKey } from '@/lib/jobs/ghost-risk'
import { legacyComputeBoardListingFitBucket, legacyIsVeryStrongBoardFit } from '@/lib/jobs/job-fit-bucket-legacy'
import { computeBoardListingFitBucket, isVeryStrongBoardFit } from '@/lib/jobs/job-fit-bucket'
import { candidateScaleLevel } from '@/lib/jobs/job-seniority'
import { matchJobToCandidate, toMatchJob, MATCH_CANDIDATE_FIELDS } from '@/lib/jobs/job-match'

const arg = (name: string) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined }

async function loadBoard(): Promise<any[]> {
  const cache = arg('--cache')
  if (cache && existsSync(cache)) {
    const rows = JSON.parse(readFileSync(cache, 'utf8'))
    for (const p of rows) { p.createdAt = new Date(p.createdAt); p.postedAt = p.postedAt ? new Date(p.postedAt) : null }
    return rows
  }
  const closed = await getClosedPostingCounts()
  const rows: any[] = []
  let cursor: string | undefined
  const now = Date.now()
  for (;;) {
    const batch = await prisma.exclusiveJobPosting.findMany({
      where: liveBoardWhere(), orderBy: { id: 'asc' }, take: 5000, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, title: true, companyName: true, audienceTier: true, source: true, targetFunction: true, targetLevel: true, targetRemotePolicy: true, targetLocation: true, location: true, level: true, sourceCategory: true, postedAt: true, sourceCount: true, salaryMin: true, salaryMax: true, createdAt: true, description: true, distribution: true, disclosure: true },
    })
    if (batch.length === 0) break
    cursor = batch[batch.length - 1].id
    for (const p of batch) {
      if (classifyLocation(p.location) === 'non_us') continue
      const g = ghostRisk({ priorClosedCount: closed.get(repostKey(p.companyName, p.title, p.location)) ?? 0, ageDays: (now - p.createdAt.getTime()) / 86_400_000 })
      if (g.level !== 'likely') rows.push(p)
    }
  }
  if (cache) writeFileSync(cache, JSON.stringify(rows))
  return rows
}

async function measure(board: any[], members: any[], mode: 'old' | 'new') {
  const bucketFn = mode === 'old' ? legacyComputeBoardListingFitBucket : computeBoardListingFitBucket
  const vsFn = mode === 'old' ? legacyIsVeryStrongBoardFit : isVeryStrongBoardFit
  const now = Date.now()
  const results: any[] = []
  for (const m of members) {
    m.targetIndustries = m.targetIndustries ?? []
    m.resumeKeywords = m.resumeKeywords ?? []
    const t0 = Date.now()
    const buckets: Record<string, number> = { strong: 0, good: 0, stretch: 0, below_level: 0, overqualified: 0 }
    const vs: any[] = []
    for (const p of board) {
      const b = bucketFn(m, p)
      buckets[b]++
      if ((b === 'strong') && vsFn(m, p, candidateScaleLevel(p.level))) vs.push(p)
    }
    // really good: very strong + job-match overall strong/good
    const reallyGood: any[] = []
    if (vs.length) {
      const ids = vs.map((p) => p.id)
      const extra: any[] = await prisma.$queryRawUnsafe(`select id, skills, industry, "sourceName", "marketPayLow", "marketPayMid", "marketPayHigh" from "ExclusiveJobPosting" where id = any($1)`, ids)
      const ex = new Map(extra.map((e) => [e.id, e]))
      for (const p of vs) {
        const e = ex.get(p.id) ?? {}
        const job = toMatchJob({ ...p, skills: e.skills ?? [], industry: e.industry ?? null, sourceName: e.sourceName ?? null, marketPayLow: e.marketPayLow ?? null, marketPayMid: e.marketPayMid ?? null, marketPayHigh: e.marketPayHigh ?? null })
        const match = matchJobToCandidate({ ...m, confirmedSkillsHave: m.confirmedSkillsHave ?? [], certifications: m.certifications ?? [] }, job)
        if (match.overall === 'strong' || match.overall === 'good') reallyGood.push(p)
      }
    }
    // fresh alerts: replay the cron for each of the last 3 days — 24h posted window,
    // shortlist of 30 ranked by the same scorer, very-strong filter, max 2 jobs.
    const byId = new Map(board.map((p) => [p.id, p]))
    const days = [0, 1, 2].map((d) => {
      const hi = now - d * 86_400_000, lo = hi - 86_400_000
      const rows = board.filter((p) => { const t = (p.postedAt ?? p.createdAt).getTime(); return t > lo && t <= hi })
      const ranked = rankBoardRows(rows, { candidate: m, isCandidatePlus: false, size: 30, fitScoring: mode === 'old' ? 'legacy' : 'v2', now: new Date(hi) })
      return ranked.openIds.map((id) => byId.get(id)).filter((p) => vsFn(m, p, candidateScaleLevel(p.level))).slice(0, 2).length
    })
    const top = [...vs].sort((a, b) => (b.postedAt ?? b.createdAt) - (a.postedAt ?? a.createdAt)).slice(0, 3).map((p) => `${p.title} | ${p.companyName} | ${p.location}`)
    results.push({ id: m.id.slice(-6), fn: m.primaryFunction, level: m.highestLevelReached, lrs: m.levelRankScore, remote: m.remotePreference, target: m.targetRoleType, buckets, goodPlus: buckets.strong + buckets.good, strong: buckets.strong, veryStrong: vs.length, reallyGood: reallyGood.length, vsIds: vs.map((p) => p.id), rgIds: reallyGood.map((p) => p.id), freshVsPerDay: days, top, ms: Date.now() - t0 })
    if (process.env.VERBOSE) process.stderr.write(`${m.id.slice(-6)} ${JSON.stringify(buckets)} vs=${vs.length} rg=${reallyGood.length} ${Date.now() - t0}ms\n`)
  }
  return results
}

async function main() {
  const board = await loadBoard()
  const sel: Record<string, true> = { id: true }
  for (const f of ['primaryFunction','secondaryFunction','targetFunction','highestLevelReached','levelRankScore','remotePreference','currentCity','currentState','openToRelocation','targetCompMin','compFlexible','targetRoleType','resumeKeywords','yearsExperience','industryContext','secondaryIndustryContext','targetIndustries','hasJD','hasMD','hasDO','targetCompanySize','priorityMaxComp','priorityWorkLife','priorityBrandName','priorityMission', ...MATCH_CANDIDATE_FIELDS]) sel[f] = true
  let members: any[] = await prisma.candidateProfile.findMany({ where: { isSampleData: false, assessmentComplete: true, deactivatedAt: null }, select: sel })
  const only = arg('--only')
  if (only) members = members.filter((m) => m.id.endsWith(only))
  const [oldR, newR] = [await measure(board, members, 'old'), await measure(board, members, 'new')]
  console.log(`board jobs: ${board.length}\n`)
  console.log('| member | function | level | remote | good+ old→new | strong old→new | very strong old→new | really good old→new | alert jobs/day (3d) old→new |')
  console.log('|---|---|---|---|---|---|---|---|---|')
  for (let i = 0; i < oldR.length; i++) {
    const o = oldR[i], n = newR[i]
    console.log(`| ${o.id} | ${o.fn ?? '-'} | ${o.level ?? '-'} | ${o.remote ?? '-'} | ${o.goodPlus}→${n.goodPlus} | ${o.strong}→${n.strong} | ${o.veryStrong}→${n.veryStrong} | ${o.reallyGood}→${n.reallyGood} | ${o.freshVsPerDay.join('/')}→${n.freshVsPerDay.join('/')} |`)
  }
  console.log('\nTop new very-strong jobs:')
  for (const n of newR) if (n.top.length) console.log(`- ${n.id}: ${n.top.join(' ; ')}`)
}
main().finally(() => prisma.$disconnect())
