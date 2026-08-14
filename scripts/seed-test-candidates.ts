// Reusable, re-runnable fixture: 20 distinct test candidates spanning a
// spread of functions/levels/geos/circumstances — some deliberately similar
// (same function+city, different level; same city, different function) to
// exercise matching/search, and some very different. Split across four
// activity tiers (A: highly active w/ streak + A-List, B: moderately
// active, C: low activity, D: dormant/just signed up) so the admin
// Candidates list and drill-down pages have something realistic to show.
//
// Each is a real Supabase auth user (admin-created, no password set —
// these are data fixtures, not accounts anyone logs into) plus a real
// CandidateProfile with grade history (MarketRealityReport), weekly activity
// (WeeklySprint + SundayNightReport, some with onAList: true +
// WeeklyBadgeEarned), and daily-checkin streaks (DailyCheckIn rows +
// CandidateProfile.currentStreak/longestStreak) as appropriate for the tier.
//
// All 20 share the @nextchapter.test email domain so reset/re-run can find
// and delete exactly this fixture set without touching anything else.
//
// Run:   npm run seed:test-candidates
// Reset: npm run seed:test-candidates -- --delete
// Re-run at any time — it's delete-then-create, not an upsert, so a plain
// re-run always leaves you with a clean set of exactly these 20.

import { createClient } from '@supabase/supabase-js'
import { PrismaClient, Prisma, type CurrentJobStatus, type SearchIntensity, type Mood } from '@prisma/client'
import { scoreToGrade } from '../src/lib/scoring/grade'
import { estimateActionEffort, isRecurringActionType } from '../src/lib/weekly/action-effort'

const prisma = new PrismaClient()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.')
}
const admin = createClient(supabaseUrl, serviceKey)

const EMAIL_DOMAIN = 'nextchapter.test'

type Tier = 'A' | 'B' | 'C' | 'D'

interface TestCandidate {
  firstName: string
  lastName: string
  primaryFunction: string
  highestLevelReached: string
  currentCity: string
  currentState: string
  currentCountry: string
  remotePreference: string
  targetRoleType: string
  yearsExperience: number
  targetCompMin: number
  compFlexible: boolean
  openToRelocation: boolean
  currentJobStatus: CurrentJobStatus
  searchIntensity: SearchIntensity
  recruiterDatabaseOptIn: boolean
  tier: Tier
  score: number // overall grade-band anchor score for this candidate
}

const CANDIDATES: TestCandidate[] = [
  // Tier A — highly active: streak, A-List, weeks of completed sprints
  { firstName: 'Alicia', lastName: 'Chen', primaryFunction: 'Marketing', highestLevelReached: 'VP', currentCity: 'New York', currentState: 'NY', currentCountry: 'US', remotePreference: 'hybrid', targetRoleType: 'VP Marketing', yearsExperience: 15, targetCompMin: 220000, compFlexible: false, openToRelocation: false, currentJobStatus: 'LAID_OFF', searchIntensity: 'ACTIVELY_SEARCHING', recruiterDatabaseOptIn: true, tier: 'A', score: 92 },
  { firstName: 'Marcus', lastName: 'Okafor', primaryFunction: 'Engineering', highestLevelReached: 'Director', currentCity: 'San Francisco', currentState: 'CA', currentCountry: 'US', remotePreference: 'remote', targetRoleType: 'Director of Engineering', yearsExperience: 12, targetCompMin: 240000, compFlexible: true, openToRelocation: false, currentJobStatus: 'EMPLOYED_CONSIDERING_MOVE', searchIntensity: 'CASUALLY_LOOKING', recruiterDatabaseOptIn: true, tier: 'A', score: 88 },
  { firstName: 'Priya', lastName: 'Nair', primaryFunction: 'Product', highestLevelReached: 'IC', currentCity: 'Austin', currentState: 'TX', currentCountry: 'US', remotePreference: 'remote', targetRoleType: 'Senior Product Manager', yearsExperience: 6, targetCompMin: 150000, compFlexible: true, openToRelocation: true, currentJobStatus: 'CAREER_PIVOT', searchIntensity: 'ACTIVELY_SEARCHING', recruiterDatabaseOptIn: false, tier: 'A', score: 90 },
  { firstName: 'Sofia', lastName: 'Marchetti', primaryFunction: 'Finance', highestLevelReached: 'C-Suite', currentCity: 'Boston', currentState: 'MA', currentCountry: 'US', remotePreference: 'hybrid', targetRoleType: 'CFO', yearsExperience: 22, targetCompMin: 300000, compFlexible: false, openToRelocation: false, currentJobStatus: 'LAID_OFF', searchIntensity: 'ACTIVELY_SEARCHING', recruiterDatabaseOptIn: true, tier: 'A', score: 95 },
  { firstName: 'Jamal', lastName: 'Wright', primaryFunction: 'Human Resources', highestLevelReached: 'Director', currentCity: 'Denver', currentState: 'CO', currentCountry: 'US', remotePreference: 'remote', targetRoleType: 'Director of People', yearsExperience: 11, targetCompMin: 170000, compFlexible: true, openToRelocation: false, currentJobStatus: 'EMPLOYED_CONSIDERING_MOVE', searchIntensity: 'CASUALLY_LOOKING', recruiterDatabaseOptIn: true, tier: 'A', score: 86 },

  // Tier B — moderately active
  { firstName: 'Daniel', lastName: 'Reyes', primaryFunction: 'Sales', highestLevelReached: 'Manager', currentCity: 'Chicago', currentState: 'IL', currentCountry: 'US', remotePreference: 'onsite', targetRoleType: 'Sales Manager', yearsExperience: 9, targetCompMin: 130000, compFlexible: false, openToRelocation: false, currentJobStatus: 'RESIGNED', searchIntensity: 'ACTIVELY_SEARCHING', recruiterDatabaseOptIn: false, tier: 'B', score: 78 },
  { firstName: 'Emma', lastName: 'Larsson', primaryFunction: 'Data & Analytics', highestLevelReached: 'IC', currentCity: 'Seattle', currentState: 'WA', currentCountry: 'US', remotePreference: 'remote', targetRoleType: 'Senior Data Analyst', yearsExperience: 5, targetCompMin: 120000, compFlexible: true, openToRelocation: true, currentJobStatus: 'NEW_GRADUATE_FIRST_JOB', searchIntensity: 'ACTIVELY_SEARCHING', recruiterDatabaseOptIn: true, tier: 'B', score: 82 },
  { firstName: 'Tomás', lastName: 'Silva', primaryFunction: 'Operations', highestLevelReached: 'Manager', currentCity: 'Atlanta', currentState: 'GA', currentCountry: 'US', remotePreference: 'hybrid', targetRoleType: 'Operations Manager', yearsExperience: 8, targetCompMin: 140000, compFlexible: false, openToRelocation: true, currentJobStatus: 'RELOCATED_FOR_FAMILY', searchIntensity: 'CASUALLY_LOOKING', recruiterDatabaseOptIn: false, tier: 'B', score: 75 },
  { firstName: 'Renee', lastName: 'Dubois', primaryFunction: 'Customer Success', highestLevelReached: 'VP', currentCity: 'Remote', currentState: '', currentCountry: 'US', remotePreference: 'remote', targetRoleType: 'VP Customer Success', yearsExperience: 14, targetCompMin: 200000, compFlexible: true, openToRelocation: false, currentJobStatus: 'CAREGIVER_LEAVE_SABBATICAL', searchIntensity: 'CASUALLY_LOOKING', recruiterDatabaseOptIn: true, tier: 'B', score: 80 },
  { firstName: 'Wei', lastName: 'Zhang', primaryFunction: 'Legal', highestLevelReached: 'Director', currentCity: 'Washington', currentState: 'DC', currentCountry: 'US', remotePreference: 'hybrid', targetRoleType: 'Director of Legal', yearsExperience: 13, targetCompMin: 190000, compFlexible: false, openToRelocation: false, currentJobStatus: 'EMPLOYED_CONSIDERING_MOVE', searchIntensity: 'EXPLORING', recruiterDatabaseOptIn: false, tier: 'B', score: 77 },
  { firstName: 'Nathan', lastName: 'Brooks', primaryFunction: 'Engineering', highestLevelReached: 'IC', currentCity: 'San Francisco', currentState: 'CA', currentCountry: 'US', remotePreference: 'hybrid', targetRoleType: 'Senior Software Engineer', yearsExperience: 7, targetCompMin: 180000, compFlexible: true, openToRelocation: false, currentJobStatus: 'LAID_OFF', searchIntensity: 'ACTIVELY_SEARCHING', recruiterDatabaseOptIn: true, tier: 'B', score: 84 },

  // Tier C — low activity
  { firstName: 'Grace', lastName: 'Kim', primaryFunction: 'Marketing', highestLevelReached: 'Manager', currentCity: 'Los Angeles', currentState: 'CA', currentCountry: 'US', remotePreference: 'hybrid', targetRoleType: 'Marketing Manager', yearsExperience: 6, targetCompMin: 110000, compFlexible: true, openToRelocation: false, currentJobStatus: 'CAREER_PIVOT', searchIntensity: 'EXPLORING', recruiterDatabaseOptIn: false, tier: 'C', score: 55 },
  { firstName: 'Omar', lastName: 'Haddad', primaryFunction: 'Product', highestLevelReached: 'Director', currentCity: 'Remote', currentState: '', currentCountry: 'US', remotePreference: 'remote', targetRoleType: 'Director of Product', yearsExperience: 10, targetCompMin: 195000, compFlexible: false, openToRelocation: false, currentJobStatus: 'RESIGNED', searchIntensity: 'CASUALLY_LOOKING', recruiterDatabaseOptIn: false, tier: 'C', score: 48 },
  { firstName: 'Lucas', lastName: 'Ferreira', primaryFunction: 'Sales', highestLevelReached: 'IC', currentCity: 'Miami', currentState: 'FL', currentCountry: 'US', remotePreference: 'onsite', targetRoleType: 'Account Executive', yearsExperience: 3, targetCompMin: 90000, compFlexible: true, openToRelocation: true, currentJobStatus: 'NEW_GRADUATE_FIRST_JOB', searchIntensity: 'EXPLORING', recruiterDatabaseOptIn: false, tier: 'C', score: 42 },
  { firstName: 'Isabella', lastName: 'Rossi', primaryFunction: 'Finance', highestLevelReached: 'Manager', currentCity: 'Boston', currentState: 'MA', currentCountry: 'US', remotePreference: 'hybrid', targetRoleType: 'Finance Manager', yearsExperience: 7, targetCompMin: 125000, compFlexible: false, openToRelocation: false, currentJobStatus: 'EMPLOYED_CONSIDERING_MOVE', searchIntensity: 'CASUALLY_LOOKING', recruiterDatabaseOptIn: true, tier: 'C', score: 60 },
  { firstName: 'Kwame', lastName: 'Asante', primaryFunction: 'Data & Analytics', highestLevelReached: 'Director', currentCity: 'Washington', currentState: 'DC', currentCountry: 'US', remotePreference: 'hybrid', targetRoleType: 'Director of Analytics', yearsExperience: 12, targetCompMin: 185000, compFlexible: false, openToRelocation: false, currentJobStatus: 'LAID_OFF', searchIntensity: 'ACTIVELY_SEARCHING', recruiterDatabaseOptIn: true, tier: 'C', score: 52 },
  { firstName: 'Hannah', lastName: 'Müller', primaryFunction: 'Operations', highestLevelReached: 'IC', currentCity: 'Berlin', currentState: '', currentCountry: 'DE', remotePreference: 'remote', targetRoleType: 'Operations Analyst', yearsExperience: 4, targetCompMin: 70000, compFlexible: true, openToRelocation: true, currentJobStatus: 'RELOCATED_FOR_FAMILY', searchIntensity: 'EXPLORING', recruiterDatabaseOptIn: false, tier: 'C', score: 45 },

  // Tier D — dormant / just signed up, no grade yet
  { firstName: 'Ethan', lastName: 'Park', primaryFunction: 'Customer Success', highestLevelReached: 'Manager', currentCity: 'Remote', currentState: '', currentCountry: 'US', remotePreference: 'remote', targetRoleType: 'Customer Success Manager', yearsExperience: 6, targetCompMin: 115000, compFlexible: true, openToRelocation: false, currentJobStatus: 'CAREER_PIVOT', searchIntensity: 'OPEN', recruiterDatabaseOptIn: false, tier: 'D', score: 0 },
  { firstName: 'Fatima', lastName: 'Al-Sayed', primaryFunction: 'Legal', highestLevelReached: 'IC', currentCity: 'Washington', currentState: 'DC', currentCountry: 'US', remotePreference: 'hybrid', targetRoleType: 'Corporate Counsel', yearsExperience: 5, targetCompMin: 140000, compFlexible: false, openToRelocation: false, currentJobStatus: 'CAREGIVER_LEAVE_SABBATICAL', searchIntensity: 'OPEN', recruiterDatabaseOptIn: false, tier: 'D', score: 0 },
  { firstName: 'Ryan', lastName: "O'Connell", primaryFunction: 'Engineering', highestLevelReached: 'Manager', currentCity: 'San Francisco', currentState: 'CA', currentCountry: 'US', remotePreference: 'hybrid', targetRoleType: 'Engineering Manager', yearsExperience: 9, targetCompMin: 210000, compFlexible: true, openToRelocation: false, currentJobStatus: 'RESIGNED', searchIntensity: 'EXPLORING', recruiterDatabaseOptIn: false, tier: 'D', score: 0 },
]

function emailFor(index: number) {
  return `test-candidate-${String(index + 1).padStart(2, '0')}@${EMAIL_DOMAIN}`
}

async function findAuthUserByEmail(email: string) {
  let page = 1
  const perPage = 200
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (match) return match
    if (data.users.length < perPage) return null
    page++
  }
}

// Rotation spanning all four weekly engines (connecting, learning, working,
// effort — see ENGINE_BY_ACTION_TYPE) so seeded committed actions produce a
// realistic, non-zero score in every engine bucket.
const COMMITTED_ACTION_TYPE_CYCLE = [
  'OUTREACH_MESSAGE',
  'LEARNING_MODULE',
  'RESUME_UPDATE',
  'INTERVIEW_PREP',
  'ENGAGE_COMMENT',
]

// Monday 00:00 UTC of the week `weeksAgo` weeks before the current week.
function weekStart(weeksAgo: number): Date {
  const now = new Date()
  const day = now.getUTCDay() // 0 = Sunday
  const diffToMonday = (day + 6) % 7
  const thisMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday))
  thisMonday.setUTCDate(thisMonday.getUTCDate() - weeksAgo * 7)
  return thisMonday
}

const CATEGORY_KEYS = ['targetFit', 'leadership', 'skillsExecution', 'communication', 'adaptability', 'ownership'] as const
const CATEGORY_LABEL: Record<string, string> = {
  targetFit: 'Target Fit',
  leadership: 'Leadership & Management',
  skillsExecution: 'Skills & Execution',
  communication: 'Communication & Collaboration',
  adaptability: 'Adaptability & Change Readiness',
  ownership: 'Ownership & Reliability',
}
const ENGINE_KEYS = ['learning', 'effort', 'working', 'connecting'] as const
const ENGINE_LABEL: Record<string, string> = {
  learning: 'Learning',
  effort: 'Effort',
  working: 'Working',
  connecting: 'Networking',
}
const CATEGORY_JITTER = [-6, 4, -3, 7, -8, 2]
const ENGINE_JITTER = [3, -5, 6, -2]

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n))
}

function buildGradeSnapshot(score: number, tier: Tier) {
  const grade = scoreToGrade(score)
  const categories = CATEGORY_KEYS.map((key, i) => {
    const s = clamp(score + CATEGORY_JITTER[i])
    return {
      key,
      label: CATEGORY_LABEL[key],
      score: s,
      grade: scoreToGrade(s),
      confidence: tier === 'A' ? 'HIGH' : tier === 'B' ? 'HIGH' : 'BUILDING',
    }
  })
  const weeklyEngines = ENGINE_KEYS.map((key, i) => {
    const s = clamp(score + ENGINE_JITTER[i])
    return { key, label: ENGINE_LABEL[key], score: s, grade: scoreToGrade(s) }
  })
  const laggingEngines = tier === 'A' ? [] : weeklyEngines.filter((e) => e.score < 60).map((e) => e.key)
  const weeklyPointsTarget = 150
  const weeklyPoints =
    tier === 'A' ? Math.round(weeklyPointsTarget * 0.92) : tier === 'B' ? Math.round(weeklyPointsTarget * 0.6) : Math.round(weeklyPointsTarget * 0.3)

  return {
    score,
    grade,
    categories,
    weeklyEngines,
    categoryMinimumsMet: tier === 'A',
    laggingEngines,
    weeklyPoints,
    weeklyPointsTarget,
    recognizedWeeklyPoints: weeklyPoints,
    bonusMultiplier: 1,
    hasExecutiveCoach: false,
    hadPriorWeekA: tier === 'A',
  }
}

const MOODS: Mood[] = ['STUCK', 'GETTING_THERE', 'MOVING', 'FIRED_UP']

async function deleteFixtures() {
  console.log('Deleting existing test-candidate fixtures…')
  const profiles = await prisma.candidateProfile.findMany({
    where: { email: { endsWith: `@${EMAIL_DOMAIN}`, mode: 'insensitive' } },
    select: { id: true },
  })
  for (const profile of profiles) {
    await prisma.candidateInteraction.deleteMany({ where: { candidateId: profile.id } })
    await prisma.candidateProfile.delete({ where: { id: profile.id } })
  }
  console.log(`Deleted ${profiles.length} CandidateProfile row(s).`)

  let deletedUsers = 0
  for (let i = 0; i < CANDIDATES.length; i++) {
    const authUser = await findAuthUserByEmail(emailFor(i))
    if (authUser) {
      const { error } = await admin.auth.admin.deleteUser(authUser.id)
      if (error) throw error
      deletedUsers++
    }
  }
  console.log(`Deleted ${deletedUsers} Supabase auth user(s).`)
}

async function createFixtures() {
  console.log('Creating test-candidate fixtures…')
  const now = new Date()

  for (let i = 0; i < CANDIDATES.length; i++) {
    const c = CANDIDATES[i]
    const email = emailFor(i)

    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: `${c.firstName} ${c.lastName}`, is_test_fixture: true },
    })
    if (error) throw error
    const userId = data.user.id

    const isRegistered = c.tier !== 'D'
    // Tier B gets a couple of days' streak lapse baked into longestStreak
    // vs currentStreak, so it doesn't read as a flat, unrealistic number.
    const currentStreak = c.tier === 'A' ? 12 + (i % 5) * 4 : c.tier === 'B' ? 3 + (i % 4) * 2 : c.tier === 'C' ? i % 3 : 0
    const longestStreak = c.tier === 'A' ? currentStreak + 6 : c.tier === 'B' ? currentStreak + 3 : currentStreak

    const profile = await prisma.candidateProfile.create({
      data: {
        userId,
        firstName: c.firstName,
        lastName: c.lastName,
        email,
        primaryFunction: c.primaryFunction,
        highestLevelReached: c.highestLevelReached,
        currentCity: c.currentCity,
        currentState: c.currentState || null,
        currentCountry: c.currentCountry,
        remotePreference: c.remotePreference,
        targetRoleType: c.targetRoleType,
        yearsExperience: c.yearsExperience,
        targetCompMin: c.targetCompMin,
        compFlexible: c.compFlexible,
        openToRelocation: c.openToRelocation,
        currentJobStatus: c.currentJobStatus,
        searchIntensity: c.searchIntensity,
        recruiterDatabaseOptIn: c.recruiterDatabaseOptIn,
        desireComplete: true,
        part1Complete: isRegistered,
        part3Complete: isRegistered,
        part4Complete: isRegistered,
        resumeStepComplete: isRegistered,
        assessmentComplete: isRegistered,
        contractAccepted: isRegistered,
        contractAcceptedAt: isRegistered ? now : null,
        registrationCompletedAt: isRegistered ? now : null,
        introCommittedAt: isRegistered ? now : null,
        currentStreak,
        longestStreak,
        lastCheckInAt: currentStreak > 0 ? now : null,
      },
    })

    // Daily check-ins backing the streak.
    if (currentStreak > 0) {
      const checkIns = Array.from({ length: currentStreak }, (_, d) => ({
        candidateId: profile.id,
        mood: MOODS[(i + d) % MOODS.length],
        checkedInAt: new Date(now.getTime() - d * 24 * 60 * 60 * 1000),
      }))
      await prisma.dailyCheckIn.createMany({ data: checkIns })
    }

    if (!isRegistered) {
      console.log(`Created ${c.firstName} ${c.lastName} (${email}) — dormant, not graded`)
      continue
    }

    // Grade history: one MarketRealityReport per candidate, most recent
    // snapshot also mirrored onto a run of weekly reports/sprints below.
    const gradeSnapshot = buildGradeSnapshot(c.score, c.tier)
    await prisma.marketRealityReport.create({
      data: {
        candidateId: profile.id,
        strengths: [{ title: 'Track record', detail: `Consistent results as a ${c.targetRoleType}.` }],
        weaknesses: [{ title: 'Narrower network', detail: 'Fewer warm intros in target industry.' }],
        actionPlan: Array.from({ length: 7 }, (_, d) => ({ day: d + 1, items: [`Action item ${d + 1}`] })),
        gapAnalysis: { targetRole: c.targetRoleType, gaps: [] },
        dossierGradeAtGeneration: gradeSnapshot,
        generatedAt: now,
      },
    })

    // Weekly activity: sprints + Sunday Night Reports going back N weeks.
    const weekCount = c.tier === 'A' ? 6 : c.tier === 'B' ? 3 : 1
    const completionRate = c.tier === 'A' ? 0.95 : c.tier === 'B' ? 0.6 : 0.3
    const onAListWeeks = c.tier === 'A' ? 2 : c.tier === 'B' && i % 3 === 0 ? 1 : 0

    let previousSnapshot: ReturnType<typeof buildGradeSnapshot> | null = null
    for (let w = weekCount - 1; w >= 0; w--) {
      const ws = weekStart(w)
      const actionCount = c.tier === 'A' ? 5 : c.tier === 'B' ? 4 : 2
      const committedActions = Array.from({ length: actionCount }, (_, a) => {
        const actionType = COMMITTED_ACTION_TYPE_CYCLE[a % COMMITTED_ACTION_TYPE_CYCLE.length]
        const effort = estimateActionEffort({ actionType })
        return {
          text: `Committed action ${a + 1}`,
          actionType,
          points: effort.points,
          estimatedMinutes: effort.minutes,
          recurring: isRecurringActionType(actionType),
          completed: a / actionCount < completionRate,
          completedAt: a / actionCount < completionRate ? ws : null,
        }
      })
      await prisma.weeklySprint.create({
        data: { candidateId: profile.id, weekStartDate: ws, committedActions, autoAssigned: false },
      })

      const weekScore = clamp(c.score - w * 2)
      const weekSnapshot = buildGradeSnapshot(weekScore, c.tier)
      const onAList = w < onAListWeeks

      await prisma.sundayNightReport.create({
        data: {
          candidateId: profile.id,
          weekStartDate: ws,
          gradeSnapshot: weekSnapshot,
          previousGradeSnapshot: previousSnapshot ?? Prisma.JsonNull,
          lastWeekCommittedCount: actionCount,
          lastWeekCompletedCount: Math.round(actionCount * completionRate),
          lastWeekCompletedTexts: committedActions.filter((a) => a.completed).map((a) => a.text),
          lastWeekSkippedTexts: committedActions.filter((a) => !a.completed).map((a) => a.text),
          strengths: [{ title: 'Consistency', detail: 'Kept showing up on committed actions.' }],
          weaknesses: [{ title: 'Networking', detail: 'Fewer new connections this week.' }],
          observations: { motivationReading: c.tier === 'A' ? 'high' : 'steady', progressPatterns: 'on track', dataInconsistency: null },
          straightTalk: c.tier === 'A' ? "You're doing the work — keep it up." : 'Room to pick up the pace this week.',
          suggestedActionPlan: [{ text: 'Follow up with two warm contacts', isAStandard: true }],
          onAList,
          aListMemberNames: onAList ? [`${c.firstName} ${c.lastName[0]}.`] : [],
          aListCount: onAList ? 1 : 0,
          generatedAt: ws,
        },
      })

      if (onAList) {
        await prisma.weeklyBadgeEarned.create({
          data: { candidateId: profile.id, weekStartDate: ws, badgeKey: 'WEEKLY_SCORE_A_LIST', earnedAt: ws },
        })
      }

      previousSnapshot = weekSnapshot
    }

    console.log(`Created ${c.firstName} ${c.lastName} (${email}) — ${c.targetRoleType} — Tier ${c.tier}, grade ${gradeSnapshot.grade}`)
  }
}

async function main() {
  const shouldDelete = process.argv.includes('--delete')

  await deleteFixtures()
  if (!shouldDelete) {
    await createFixtures()
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
