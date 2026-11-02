import 'server-only'
import { revalidateTag } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { pageClicks } from '@/lib/google/page-clicks'
import { armFor, decide, EMPTY_ARM, TITLE_TESTS, WARMUP_DAYS, type ArmStats } from './title-tests'

const DAY_MS = 24 * 60 * 60 * 1000
// Search Console data trails by about two days.
const DATA_LAG_DAYS = 2

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

export interface TitleTestRunResult {
  key: string
  outcome: string
}

/**
 * Nightly: starts any test that has no row yet, and for each running test past its warm-up reads the click rate of both arms from Search
 * Console and records the winner once the gap is real (see decide). Safe to run again; a decided test is left alone.
 */
export async function runTitleTests(now: Date = new Date()): Promise<TitleTestRunResult[]> {
  const results: TitleTestRunResult[] = []
  for (const def of TITLE_TESTS) {
    const test = await prisma.seoTitleTest.upsert({ where: { key: def.key }, create: { key: def.key }, update: {} })
    if (test.status === 'decided') {
      results.push({ key: def.key, outcome: `decided: ${test.winner}` })
      continue
    }
    const ageDays = (now.getTime() - test.startedAt.getTime()) / DAY_MS
    if (ageDays < WARMUP_DAYS) {
      results.push({ key: def.key, outcome: `warming up (day ${Math.floor(ageDays)} of ${WARMUP_DAYS})` })
      continue
    }
    const from = isoDay(new Date(test.startedAt.getTime() + WARMUP_DAYS * DAY_MS))
    const to = isoDay(new Date(now.getTime() - DATA_LAG_DAYS * DAY_MS))
    if (from > to) {
      results.push({ key: def.key, outcome: 'no data days yet' })
      continue
    }
    const data = await pageClicks(def.pathPrefix, from, to)
    if (data.status !== 'ok') {
      results.push({ key: def.key, outcome: `Search Console unavailable: ${data.message}` })
      continue
    }
    const arms: Record<'A' | 'B', ArmStats> = { A: { ...EMPTY_ARM }, B: { ...EMPTY_ARM } }
    for (const row of data.rows) {
      const arm = arms[armFor(row.path)]
      arm.impressions += row.impressions
      arm.clicks += row.clicks
      arm.positionSum += row.position * row.impressions
    }
    const verdict = decide(arms.A, arms.B, ageDays)
    const decided = verdict.verdict !== 'continue'
    await prisma.seoTitleTest.update({
      where: { key: def.key },
      data: {
        lastCheckedAt: now,
        ...(decided ? { status: 'decided', winner: verdict.verdict, decidedAt: now } : {}),
        result: { from, to, truncated: data.truncated, A: arms.A, B: arms.B, ...verdict } as unknown as Prisma.InputJsonValue,
      },
    })
    if (decided) revalidateTag('seo-title-test', { expire: 0 })
    results.push({ key: def.key, outcome: decided ? `decided ${verdict.verdict}: ${verdict.reason}` : `running: ${verdict.reason}` })
  }
  return results
}
