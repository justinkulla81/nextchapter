// Reusable, re-runnable fixture: 10 distinct test candidates spanning a
// spread of functions/levels/locations/comp, for exercising anything that
// depends on candidate variety (Job Board fit buckets, admin panels,
// matching). Each is a real Supabase auth user (admin-created, no password
// set — these are data fixtures, not accounts anyone logs into) plus a real
// CandidateProfile with enough fields populated for computeMatchScore /
// computeBoardListingFitBucket to have something real to work with.
//
// Deliberately does NOT populate a resume, references, or assessment
// responses — simulating those realistically is a much bigger lift than
// this fixture set needs. Every profile therefore reads as
// assessmentComplete: false / "not yet registered" wherever the app shows a
// Market Reality Grade — computeHireabilityGrade tolerates that (confirmed:
// the existing coach-jobs-view test client renders fine in that state), it
// just won't show a grade beyond F-by-default. If you need graded fixtures
// later, that's a separate, larger seed (real assessment + reference rows).
//
// All 10 share the @nextchapter.test email domain so reset/re-run can find
// and delete exactly this fixture set without touching anything else.
//
// Run:   npm run seed:test-candidates
// Reset: npm run seed:test-candidates -- --delete
// Re-run at any time — it's delete-then-create, not an upsert, so a plain
// re-run always leaves you with a clean set of exactly these 10.

import { createClient } from '@supabase/supabase-js'
import { PrismaClient, type CurrentJobStatus } from '@prisma/client'

const prisma = new PrismaClient()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.')
}
const admin = createClient(supabaseUrl, serviceKey)

const EMAIL_DOMAIN = 'nextchapter.test'

interface TestCandidate {
  firstName: string
  lastName: string
  primaryFunction: string
  highestLevelReached: string
  currentCity: string
  currentState: string
  remotePreference: string
  targetRoleType: string
  yearsExperience: number
  targetCompMin: number
  compFlexible: boolean
  openToRelocation: boolean
  currentJobStatus: CurrentJobStatus
}

const CANDIDATES: TestCandidate[] = [
  { firstName: 'Alicia', lastName: 'Chen', primaryFunction: 'Marketing', highestLevelReached: 'VP', currentCity: 'New York', currentState: 'NY', remotePreference: 'hybrid', targetRoleType: 'VP Marketing', yearsExperience: 15, targetCompMin: 220000, compFlexible: false, openToRelocation: false, currentJobStatus: 'LAID_OFF' },
  { firstName: 'Marcus', lastName: 'Okafor', primaryFunction: 'Engineering', highestLevelReached: 'Director', currentCity: 'San Francisco', currentState: 'CA', remotePreference: 'remote', targetRoleType: 'Director of Engineering', yearsExperience: 12, targetCompMin: 240000, compFlexible: true, openToRelocation: false, currentJobStatus: 'EMPLOYED_CONSIDERING_MOVE' },
  { firstName: 'Priya', lastName: 'Nair', primaryFunction: 'Product', highestLevelReached: 'IC', currentCity: 'Austin', currentState: 'TX', remotePreference: 'remote', targetRoleType: 'Senior Product Manager', yearsExperience: 6, targetCompMin: 150000, compFlexible: true, openToRelocation: true, currentJobStatus: 'CAREER_PIVOT' },
  { firstName: 'Daniel', lastName: 'Reyes', primaryFunction: 'Sales', highestLevelReached: 'Manager', currentCity: 'Chicago', currentState: 'IL', remotePreference: 'onsite', targetRoleType: 'Sales Manager', yearsExperience: 9, targetCompMin: 130000, compFlexible: false, openToRelocation: false, currentJobStatus: 'RESIGNED' },
  { firstName: 'Sofia', lastName: 'Marchetti', primaryFunction: 'Finance', highestLevelReached: 'C-Suite', currentCity: 'Boston', currentState: 'MA', remotePreference: 'hybrid', targetRoleType: 'CFO', yearsExperience: 22, targetCompMin: 300000, compFlexible: false, openToRelocation: false, currentJobStatus: 'LAID_OFF' },
  { firstName: 'Jamal', lastName: 'Wright', primaryFunction: 'People/HR', highestLevelReached: 'Director', currentCity: 'Denver', currentState: 'CO', remotePreference: 'remote', targetRoleType: 'Director of People', yearsExperience: 11, targetCompMin: 170000, compFlexible: true, openToRelocation: false, currentJobStatus: 'EMPLOYED_CONSIDERING_MOVE' },
  { firstName: 'Emma', lastName: 'Larsson', primaryFunction: 'Data/Analytics', highestLevelReached: 'IC', currentCity: 'Seattle', currentState: 'WA', remotePreference: 'remote', targetRoleType: 'Senior Data Analyst', yearsExperience: 5, targetCompMin: 120000, compFlexible: true, openToRelocation: true, currentJobStatus: 'NEW_GRADUATE_FIRST_JOB' },
  { firstName: 'Tomás', lastName: 'Silva', primaryFunction: 'Operations', highestLevelReached: 'Manager', currentCity: 'Atlanta', currentState: 'GA', remotePreference: 'hybrid', targetRoleType: 'Operations Manager', yearsExperience: 8, targetCompMin: 140000, compFlexible: false, openToRelocation: true, currentJobStatus: 'RELOCATED_FOR_FAMILY' },
  { firstName: 'Renee', lastName: 'Dubois', primaryFunction: 'Customer Success', highestLevelReached: 'VP', currentCity: 'Remote', currentState: '', remotePreference: 'remote', targetRoleType: 'VP Customer Success', yearsExperience: 14, targetCompMin: 200000, compFlexible: true, openToRelocation: false, currentJobStatus: 'CAREGIVER_LEAVE_SABBATICAL' },
  { firstName: 'Wei', lastName: 'Zhang', primaryFunction: 'Legal', highestLevelReached: 'Director', currentCity: 'Washington', currentState: 'DC', remotePreference: 'hybrid', targetRoleType: 'Director of Legal', yearsExperience: 13, targetCompMin: 190000, compFlexible: false, openToRelocation: false, currentJobStatus: 'EMPLOYED_CONSIDERING_MOVE' },
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
  for (let i = 0; i < CANDIDATES.length; i++) {
    const c = CANDIDATES[i]
    const email = emailFor(i)

    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: `${c.firstName} ${c.lastName}`, is_test_fixture: true },
    })
    if (error) throw error

    await prisma.candidateProfile.create({
      data: {
        userId: data.user.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email,
        primaryFunction: c.primaryFunction,
        highestLevelReached: c.highestLevelReached,
        currentCity: c.currentCity,
        currentState: c.currentState || null,
        remotePreference: c.remotePreference,
        targetRoleType: c.targetRoleType,
        yearsExperience: c.yearsExperience,
        targetCompMin: c.targetCompMin,
        compFlexible: c.compFlexible,
        openToRelocation: c.openToRelocation,
        currentJobStatus: c.currentJobStatus,
        desireComplete: true,
      },
    })
    console.log(`Created ${c.firstName} ${c.lastName} (${email}) — ${c.targetRoleType}`)
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
