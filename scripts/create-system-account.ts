// One-time (idempotent) fixture: creates the single system CandidateProfile
// that authors admin-originated Community posts (see
// src/lib/community/admin-story.ts). Backed by a real Supabase auth user —
// no password set, nobody logs into it — following the same convention
// scripts/seed-test-candidates.ts uses for its fixture rows, so every
// existing tool that joins CandidateProfile.userId against a real auth user
// (e.g. src/lib/admin/auth-users.ts) keeps working against this row too.
//
// Re-runnable: exits cleanly if a system account already exists.
//
// Run: npx tsx scripts/create-system-account.ts

import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.')
}
const admin = createClient(supabaseUrl, serviceKey)

const SYSTEM_ACCOUNT_EMAIL = 'community-system@launchyournextchapter.com'

async function main() {
  const existing = await prisma.candidateProfile.findFirst({ where: { isSystemAccount: true } })
  if (existing) {
    console.log(`System account already exists: ${existing.id}`)
    return
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: SYSTEM_ACCOUNT_EMAIL,
    email_confirm: true,
    user_metadata: { full_name: 'NextChapter Team', is_system_account: true },
  })
  if (error) throw error

  const profile = await prisma.candidateProfile.create({
    data: {
      userId: data.user.id,
      email: SYSTEM_ACCOUNT_EMAIL,
      firstName: 'NextChapter Team',
      lastName: null,
      isSystemAccount: true,
      // Never candidate-facing as a "member" — locked/opted-out of every
      // surface that lists real candidates by default.
      privacyTier: 'LOCKED',
      leaderboardOptIn: false,
      recruiterDatabaseOptIn: false,
    },
  })
  console.log(`Created system account: ${profile.id} (auth user ${data.user.id})`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
