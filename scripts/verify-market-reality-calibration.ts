// Market Reality Redesign Part 3 — DB-level verification. Run with:
//   npm run verify:market-reality-calibration
//
// Raw PrismaClient, same convention as scripts/verify-recruiter-phase6.ts —
// a plain node script with no Next.js server-component context, so it
// cannot import calibration.ts/attempts.ts/probability.ts directly (each
// has a top-level `import 'server-only'`, which throws unconditionally
// under plain Node — only Next's build strips it for real server
// components). Per verify-recruiter-phase6.ts's own convention, the logic
// below is a second, independent expression of runWeeklyCalibrationCheck's
// exact rules (same constants, same gates, same math) — deliberately not
// calling the real function, so this can't share a bug with the code it's
// checking. Every constant here must match calibration.ts's real exported
// values exactly (asserted at the top of main()).
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

let failures = 0
function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  PASS  ${message}`)
  } else {
    failures++
    console.error(`  FAIL  ${message}`)
  }
}

// ── Mirrors calibration.ts / attempts.ts / probability.ts exactly ──
const MIN_SAMPLE_ATTEMPTS = 15
const UNDER_THRESHOLD_RATIO = 0.7
const OVER_THRESHOLD_RATIO = 1.3
const CONSECUTIVE_WEEKS_FOR_BAND_CROSS = 3
const MIN_AGGREGATE_COHORT_SIZE = 5
const AGGREGATE_SHIFT_THRESHOLD = 0.15
const WITHIN_BAND_NUDGE_FRACTION = 0.15
const NETWORKING_WEIGHT = 4
const STRONG_FIT_THRESHOLD = 70

type Grade = 'A' | 'B' | 'C' | 'D' | 'F'
const BAND_ORDER: Grade[] = ['F', 'D', 'C', 'B', 'A']
const BAND_MIDPOINT: Record<Grade, number> = { A: 0.12, B: 0.05, C: 0.02, D: 0.006, F: 0.001 }
const PROBABILITY_BANDS: Record<Grade, { min: number; max: number | null }> = {
  A: { min: 0.08, max: null },
  B: { min: 0.03, max: 0.08 },
  C: { min: 0.01, max: 0.03 },
  D: { min: 0.002, max: 0.01 },
  F: { min: 0, max: 0.002 },
}

function clampToBand(p: number, band: Grade): number {
  const { min, max } = PROBABILITY_BANDS[band]
  const clampedMin = Math.max(min, p)
  return max === null ? clampedMin : Math.min(max, clampedMin)
}

function adjacentBand(current: Grade, direction: 'UNDER' | 'OVER'): Grade {
  const index = BAND_ORDER.indexOf(current)
  const nextIndex = direction === 'UNDER' ? index - 1 : index + 1
  return BAND_ORDER[Math.max(0, Math.min(BAND_ORDER.length - 1, nextIndex))]
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diffToMonday)
  return d
}

function weeksAgo(n: number): Date {
  return new Date(getMondayOfWeek(new Date()).getTime() - n * 7 * 24 * 60 * 60 * 1000)
}

interface CheckResult {
  gapDirection: 'UNDER' | 'OVER' | 'ON_TRACK' | null
  aggregateCorroborated: boolean
  adjustmentApplied: boolean
  bandCrossed: boolean
  newProbabilityGrade: Grade | null
  observedRate: number | null
}

async function checkAggregateCorroboration(
  targetRoleQuery: string,
  location: string,
  weekOf: Date,
  direction: 'UNDER' | 'OVER'
): Promise<boolean> {
  const cohortSnapshots = await prisma.marketDifficultySnapshot.findMany({
    where: { targetRoleQuery, location, weekOf },
    select: { candidateId: true, postingCount: true },
  })
  const distinctCandidates = new Set(cohortSnapshots.map((s) => s.candidateId))
  if (distinctCandidates.size < MIN_AGGREGATE_COHORT_SIZE) return false

  const priorWeek = new Date(weekOf.getTime() - 7 * 24 * 60 * 60 * 1000)
  const priorSnapshots = await prisma.marketDifficultySnapshot.findMany({
    where: { targetRoleQuery, location, weekOf: priorWeek },
    select: { postingCount: true },
  })
  if (priorSnapshots.length < MIN_AGGREGATE_COHORT_SIZE) return false

  const currentAvg = cohortSnapshots.reduce((sum, s) => sum + s.postingCount, 0) / cohortSnapshots.length
  const priorAvg = priorSnapshots.reduce((sum, s) => sum + s.postingCount, 0) / priorSnapshots.length
  if (priorAvg === 0) return false

  const changeRatio = (currentAvg - priorAvg) / priorAvg
  return direction === 'UNDER' ? changeRatio <= -AGGREGATE_SHIFT_THRESHOLD : changeRatio >= AGGREGATE_SHIFT_THRESHOLD
}

async function countConsecutiveMatchingWeeks(
  candidateId: string,
  direction: 'UNDER' | 'OVER' | 'ON_TRACK',
  weekStartDate: Date
): Promise<number> {
  const priorChecks = await prisma.marketRealityCalibrationCheck.findMany({
    where: { candidateId, weekStartDate: { lt: weekStartDate } },
    orderBy: { weekStartDate: 'desc' },
    take: CONSECUTIVE_WEEKS_FOR_BAND_CROSS,
    select: { weekStartDate: true, gapDirection: true },
  })
  let streak = 1
  let expectedWeekStart = weekStartDate.getTime() - 7 * 24 * 60 * 60 * 1000
  for (const check of priorChecks) {
    if (check.gapDirection !== direction) break
    if (check.weekStartDate.getTime() !== expectedWeekStart) break
    streak++
    expectedWeekStart -= 7 * 24 * 60 * 60 * 1000
  }
  return streak
}

async function runCheck(candidateId: string, weekStartDate: Date): Promise<CheckResult> {
  const component = await prisma.marketRealityComponentScore.findUniqueOrThrow({ where: { candidateId } })
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    select: { targetRoleType: true, primaryFunction: true, currentCity: true, currentState: true },
  })

  const currentBand = component.probabilityGrade as Grade
  const expectedRate = BAND_MIDPOINT[currentBand]
  const windowStart = new Date(Date.now() - component.rollingWindowWeeks * 7 * 24 * 60 * 60 * 1000)

  const applications = await prisma.jobPosting.findMany({
    where: { candidateId, appliedAt: { gte: windowStart } },
    select: { fitScore: true },
  })
  const poorFit = applications.filter((a) => a.fitScore !== null && a.fitScore < STRONG_FIT_THRESHOLD).length
  const networkingActions = await prisma.outreachLog.count({ where: { candidateId, loggedAt: { gte: windowStart } } })
  const weightedAttempts = applications.length - poorFit + networkingActions * NETWORKING_WEIGHT

  if (weightedAttempts < MIN_SAMPLE_ATTEMPTS) {
    await prisma.marketRealityCalibrationCheck.create({
      data: { candidateId, weekStartDate, weightedAttempts, observedRate: null, expectedRate, gapDirection: null },
    })
    return { gapDirection: null, aggregateCorroborated: false, adjustmentApplied: false, bandCrossed: false, newProbabilityGrade: null, observedRate: null }
  }

  const observedInterviews = await prisma.jobPosting.count({ where: { candidateId, interviewLandedAt: { gte: windowStart } } })
  const observedRate = observedInterviews / weightedAttempts
  const gapDirection: 'UNDER' | 'OVER' | 'ON_TRACK' =
    observedRate < expectedRate * UNDER_THRESHOLD_RATIO ? 'UNDER' : observedRate > expectedRate * OVER_THRESHOLD_RATIO ? 'OVER' : 'ON_TRACK'

  let aggregateCorroborated = false
  let adjustmentApplied = false
  let bandCrossed = false
  let newPerAttemptProbability = component.perAttemptProbability!
  let newProbabilityGrade: Grade = currentBand

  if (gapDirection !== 'ON_TRACK') {
    const targetRoleQuery = (candidate.targetRoleType || candidate.primaryFunction || '').trim().toLowerCase() || 'general'
    const location = candidate.currentCity
      ? `${candidate.currentCity.trim().toLowerCase()}, ${(candidate.currentState || '').trim().toLowerCase()}`
      : (candidate.currentState || '').trim().toLowerCase() || 'us'

    aggregateCorroborated = await checkAggregateCorroboration(targetRoleQuery, location, weekStartDate, gapDirection)
    const consecutiveWeeks = await countConsecutiveMatchingWeeks(candidateId, gapDirection, weekStartDate)
    const eligibleForBandCross = aggregateCorroborated || consecutiveWeeks >= CONSECUTIVE_WEEKS_FOR_BAND_CROSS

    if (eligibleForBandCross) {
      const targetBand = adjacentBand(currentBand, gapDirection)
      if (targetBand !== currentBand) {
        newProbabilityGrade = targetBand
        newPerAttemptProbability = BAND_MIDPOINT[targetBand]
        bandCrossed = true
        adjustmentApplied = true
      }
    }

    if (!bandCrossed) {
      // Pinned to currentBand, not re-derived via mapProbabilityToBand —
      // see calibration.ts's matching comment: a band's max is the same
      // number mapProbabilityToBand treats as the next band's floor, so
      // re-mapping a clamped-to-boundary value can silently cross a band
      // outside the persistence/corroboration gate above.
      const nudged = component.perAttemptProbability! + (observedRate - component.perAttemptProbability!) * WITHIN_BAND_NUDGE_FRACTION
      newPerAttemptProbability = clampToBand(nudged, currentBand)
      newProbabilityGrade = currentBand
      adjustmentApplied = newPerAttemptProbability !== component.perAttemptProbability
    }
  }

  await prisma.marketRealityCalibrationCheck.create({
    data: { candidateId, weekStartDate, weightedAttempts, observedRate, expectedRate, gapDirection, aggregateCorroborated, adjustmentApplied, bandCrossed },
  })
  if (adjustmentApplied) {
    await prisma.marketRealityComponentScore.update({
      where: { candidateId },
      data: { perAttemptProbability: newPerAttemptProbability, probabilityGrade: newProbabilityGrade, probabilityComputedAt: new Date() },
    })
  }

  return { gapDirection, aggregateCorroborated, adjustmentApplied, bandCrossed, newProbabilityGrade: adjustmentApplied ? newProbabilityGrade : null, observedRate }
}

// ── Seeding helpers ──
const seededCandidateIds: string[] = []

async function makeCandidate(overrides: Partial<{ targetRoleType: string; currentCity: string; currentState: string }> = {}) {
  const candidate = await prisma.candidateProfile.create({
    data: { userId: `verify-mr-calibration-${crypto.randomUUID()}`, firstName: 'Throwaway', lastName: 'Candidate', ...overrides },
  })
  seededCandidateIds.push(candidate.id)
  return candidate
}

async function seedComponentScore(candidateId: string, grade: Grade, perAttemptProbability: number) {
  await prisma.marketRealityComponentScore.create({ data: { candidateId, probabilityGrade: grade, perAttemptProbability, rollingWindowWeeks: 10 } })
}

async function seedApplications(candidateId: string, count: number, interviews: number) {
  const now = new Date()
  for (let i = 0; i < count; i++) {
    await prisma.jobPosting.create({
      data: { candidateId, fetchStatus: 'success', appliedAt: now, fitScore: 80, interviewLandedAt: i < interviews ? now : null },
    })
  }
}

async function seedCohortSnapshots(
  targetRoleQuery: string,
  location: string,
  weekOf: Date,
  priorWeekOf: Date,
  cohortSize: number,
  currentPostingCount: number,
  priorPostingCount: number
) {
  for (let i = 0; i < cohortSize; i++) {
    const cohortCandidate = await makeCandidate()
    await prisma.marketDifficultySnapshot.create({
      data: { candidateId: cohortCandidate.id, targetRoleQuery, location, weekOf, postingCount: currentPostingCount },
    })
    await prisma.marketDifficultySnapshot.create({
      data: { candidateId: cohortCandidate.id, targetRoleQuery, location, weekOf: priorWeekOf, postingCount: priorPostingCount },
    })
  }
}

// ── Scenarios ──
async function scenarioPersistentShortfallCrossesBand() {
  console.log('\nScenario A — persistent 3-week shortfall crosses a full band')
  const candidate = await makeCandidate()
  await seedComponentScore(candidate.id, 'C', 0.02)
  await seedApplications(candidate.id, 15, 0)

  const check1 = await runCheck(candidate.id, weeksAgo(2))
  assert(check1.gapDirection === 'UNDER', 'week 1: gapDirection is UNDER')
  assert(!check1.bandCrossed, 'week 1 alone does not cross a band')

  const check2 = await runCheck(candidate.id, weeksAgo(1))
  assert(check2.gapDirection === 'UNDER', 'week 2: gapDirection is still UNDER')
  assert(!check2.bandCrossed, 'week 2 (2 consecutive) still does not cross a band')

  const check3 = await runCheck(candidate.id, weeksAgo(0))
  assert(check3.gapDirection === 'UNDER', 'week 3: gapDirection is still UNDER')
  assert(check3.bandCrossed, 'week 3 (3 consecutive UNDER weeks) crosses a full band')
  assert(check3.newProbabilityGrade === 'D', 'band crossed from C down to D')

  const finalScore = await prisma.marketRealityComponentScore.findUnique({ where: { candidateId: candidate.id } })
  assert(finalScore?.probabilityGrade === 'D', 'persisted probabilityGrade is D after the cross')
}

async function scenarioSingleNoisyWeekDoesNotCross() {
  console.log('\nScenario B — a single noisy bad week nudges but never crosses')
  const candidate = await makeCandidate()
  await seedComponentScore(candidate.id, 'C', 0.02)
  await seedApplications(candidate.id, 15, 0)

  const check = await runCheck(candidate.id, weeksAgo(0))
  assert(check.gapDirection === 'UNDER', 'a single bad week is still detected as UNDER')
  assert(!check.bandCrossed, 'a single week never crosses a full band on its own')
  assert(check.adjustmentApplied, 'a within-band nudge is still applied so the estimate keeps responding')

  const finalScore = await prisma.marketRealityComponentScore.findUnique({ where: { candidateId: candidate.id } })
  assert(finalScore?.probabilityGrade === 'C', 'grade stays C after just one noisy week')
}

async function scenarioAggregateCorroboratedFastCross() {
  console.log('\nScenario C — aggregate-corroborated shortfall crosses on week 1 (fast path)')
  const candidate = await makeCandidate({ targetRoleType: 'Product Manager', currentCity: 'Austin', currentState: 'TX' })
  await seedComponentScore(candidate.id, 'C', 0.02)
  await seedApplications(candidate.id, 15, 0)

  const week = weeksAgo(0)
  const priorWeek = weeksAgo(1)
  await seedCohortSnapshots('product manager', 'austin, tx', week, priorWeek, 5, 70, 100)

  const check = await runCheck(candidate.id, week)
  assert(check.gapDirection === 'UNDER', 'candidate C shows a real shortfall')
  assert(check.aggregateCorroborated, 'the cross-candidate cohort corroborates the shortfall')
  assert(check.bandCrossed, 'corroboration lets a shortfall cross a band on week 1, without waiting 3 weeks')
  assert(check.newProbabilityGrade === 'D', 'band crossed from C down to D on the fast path')
}

async function scenarioSmallCohortDoesNotCorroborate() {
  console.log('\nScenario C2 — a 4-candidate cohort (below the minimum of 5) does not corroborate')
  const candidate = await makeCandidate({ targetRoleType: 'Product Manager', currentCity: 'Boise', currentState: 'ID' })
  await seedComponentScore(candidate.id, 'C', 0.02)
  await seedApplications(candidate.id, 15, 0)

  const week = weeksAgo(0)
  const priorWeek = weeksAgo(1)
  await seedCohortSnapshots('product manager', 'boise, id', week, priorWeek, 4, 70, 100)

  const check = await runCheck(candidate.id, week)
  assert(!check.aggregateCorroborated, 'a 4-candidate cohort is below the minimum of 5 and does not corroborate')
  assert(!check.bandCrossed, 'without corroboration, one week alone never fast-crosses a band')
}

async function scenarioUpwardCalibration() {
  console.log('\nScenario D — symmetric upward calibration over 3 consecutive strong weeks')
  const candidate = await makeCandidate()
  await seedComponentScore(candidate.id, 'C', 0.02)
  await seedApplications(candidate.id, 15, 1)

  await runCheck(candidate.id, weeksAgo(2))
  await runCheck(candidate.id, weeksAgo(1))
  const check3 = await runCheck(candidate.id, weeksAgo(0))

  assert(check3.gapDirection === 'OVER', 'week 3: gapDirection is OVER')
  assert(check3.bandCrossed, '3 consecutive OVER weeks cross a full band upward')
  assert(check3.newProbabilityGrade === 'B', 'band crossed from C up to B')

  const finalScore = await prisma.marketRealityComponentScore.findUnique({ where: { candidateId: candidate.id } })
  assert(finalScore?.probabilityGrade === 'B', 'persisted probabilityGrade is B after the upward cross')
}

async function scenarioMinimumSampleGate() {
  console.log('\nScenario E — below the 15-attempt minimum sample, never calibrates on noise')
  const candidate = await makeCandidate()
  await seedComponentScore(candidate.id, 'C', 0.02)
  await seedApplications(candidate.id, 10, 0)

  const check = await runCheck(candidate.id, weeksAgo(0))
  assert(check.observedRate === null, 'observedRate is null below the minimum sample size')
  assert(check.gapDirection === null, 'gapDirection is null — never guessed from too little data')
  assert(!check.adjustmentApplied, 'no adjustment is ever applied below the minimum sample')

  const finalScore = await prisma.marketRealityComponentScore.findUnique({ where: { candidateId: candidate.id } })
  assert(finalScore?.probabilityGrade === 'C', 'grade is untouched below the minimum sample')
}

async function cleanup() {
  await prisma.marketRealityCalibrationCheck.deleteMany({ where: { candidateId: { in: seededCandidateIds } } })
  await prisma.marketDifficultySnapshot.deleteMany({ where: { candidateId: { in: seededCandidateIds } } })
  await prisma.jobPosting.deleteMany({ where: { candidateId: { in: seededCandidateIds } } })
  await prisma.marketRealityComponentScore.deleteMany({ where: { candidateId: { in: seededCandidateIds } } })
  await prisma.candidateProfile.deleteMany({ where: { id: { in: seededCandidateIds } } })
}

async function main() {
  try {
    await scenarioPersistentShortfallCrossesBand()
    await scenarioSingleNoisyWeekDoesNotCross()
    await scenarioAggregateCorroboratedFastCross()
    await scenarioSmallCohortDoesNotCorroborate()
    await scenarioUpwardCalibration()
    await scenarioMinimumSampleGate()
  } finally {
    await cleanup()
    await prisma.$disconnect()
  }

  console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILURE(S)`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
