/**
 * NextChapter — Test Profile Seeder (STEP 1 of 2)
 *
 * Creates real dev/staging accounts (justin.kulla+1..+50@gmail.com) from
 * nextchapter_seed_profiles.json, each with a real CandidateProfile row.
 * Run seed_resumes.ts (STEP 2) next to upload each profile's resume and
 * generate a real ResumeAnalysis + ResumeIssue rows via the real scoring
 * engine.
 *
 * Rewritten for Phase 2 Part B — the previous version of this file was a
 * placeholder that inserted into `profiles` / `activity_ledger` / `badges` /
 * `candidate_references` / `competency_scores` / `market_reality_grades` /
 * `onboarding_checklist` / `module_gates` via raw @supabase/supabase-js
 * table calls with a `user_id` column — none of those tables exist in this
 * schema, and it had a literal "CLAUDE CODE: this needs editing" TODO in
 * place of real column names. This version uses Prisma against the actual
 * schema: CandidateProfile, keyed by `candidateId` everywhere downstream,
 * linked to a Supabase auth user via `userId`.
 *
 * Deliberately Phase-1 scope: auth user + CandidateProfile only. The old
 * placeholder's activity-ledger/badges/references/competency-score/
 * market-reality-grade data doesn't get reproduced here — building a real
 * equivalent means driving WeeklySprint, DailyCheckIn, Reference,
 * CompetencyScore, and MarketRealityComponentScore through the same code
 * paths the app itself uses to populate them (point awards, grade
 * computation, etc.), which is real, separate work out of scope for this
 * pass. What this script DOES give you: 50 real candidates with real
 * profile fields, ready for seed_resumes.ts to attach a real resume and
 * generate real ResumeAnalysis/ResumeIssue rows against — enough to
 * exercise and verify the Part B analytics capture path end to end.
 *
 * DEV / STAGING ONLY. Refuses to run against a DATABASE_URL or Supabase URL
 * containing "prod".
 *
 * Usage:
 *   npm run seed:profiles
 *   npm run seed:profiles -- --wipe   (delete existing seeded accounts + profiles first, then reseed)
 */

import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'
import profiles from './nextchapter_seed_profiles.json'

const prisma = new PrismaClient()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const WIPE = process.argv.includes('--wipe')

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.')
  process.exit(1)
}
if (SUPABASE_URL.includes('prod') || (process.env.DATABASE_URL ?? '').includes('prod')) {
  console.error('Refusing to run against a URL containing "prod".')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const SEED_EMAIL_PREFIX = 'justin.kulla+'
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000)

interface SeedProfile {
  email: string
  password: string
  first_name: string
  last_name: string
  title: string
  function: string
  industry: string
  city: string
  state: string
  metro: string
  joined_days_ago: number
  resume_file: string | null
}

async function wipe(byEmail: Map<string, string>): Promise<void> {
  console.log('Wiping seeded accounts…')
  let deleted = 0
  for (const [, uid] of byEmail) {
    // CandidateProfile first — its onDelete: Cascade relations (Resume,
    // ResumeAnalysis, ResumeIssue, ReviewerQuestion, etc., see
    // schema.prisma) take everything downstream with it. Removing the auth
    // identity second means a failed profile delete never leaves an
    // unreachable orphaned profile with no matching auth user.
    await prisma.candidateProfile.deleteMany({ where: { userId: uid } })
    await admin.auth.admin.deleteUser(uid)
    deleted++
  }
  console.log(`Deleted ${deleted} accounts.`)
}

async function seedOne(p: SeedProfile, existingUid: string | undefined): Promise<void> {
  let uid = existingUid
  if (!uid) {
    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      email: p.email,
      password: p.password,
      email_confirm: true,
      user_metadata: { first_name: p.first_name, last_name: p.last_name, seeded: true },
    })
    if (authErr || !created.user) throw new Error(authErr?.message ?? 'no user returned from createUser')
    uid = created.user.id
  }

  const joined = daysAgo(p.joined_days_ago)
  const shared = {
    firstName: p.first_name,
    lastName: p.last_name,
    email: p.email,
    currentCity: p.city,
    currentState: p.state,
    metroArea: p.metro,
    primaryFunction: p.function,
    industryContext: p.industry,
    targetRoleType: p.title,
    targetIndustries: [p.industry],
    isSampleData: true,
  }

  await prisma.candidateProfile.upsert({
    where: { userId: uid },
    create: {
      userId: uid,
      ...shared,
      privacyTier: 'SEMI_PUBLIC',
      part1Complete: true,
      part2Complete: true,
      part3Complete: true,
      part4Complete: true,
      desireComplete: true,
      registrationCompletedAt: joined,
      passwordSetAt: joined,
      introCommittedAt: joined,
      createdAt: joined,
    },
    update: shared,
  })
}

async function main(): Promise<void> {
  const { data: userList } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const byEmail = new Map(
    (userList?.users ?? []).filter((u) => u.email?.startsWith(SEED_EMAIL_PREFIX)).map((u) => [u.email as string, u.id])
  )

  if (WIPE) {
    await wipe(byEmail)
    byEmail.clear()
  }

  let ok = 0
  const list = profiles as SeedProfile[]
  for (const p of list) {
    try {
      await seedOne(p, byEmail.get(p.email))
      ok++
      console.log(`✓ ${p.email}`)
    } catch (error) {
      console.error(`✗ ${p.email}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  console.log(`\nSeeded ${ok}/${list.length} candidate profiles.`)
  console.log('Next: npm run seed:resumes to upload resumes and generate real ResumeAnalysis/ResumeIssue rows.')
  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
