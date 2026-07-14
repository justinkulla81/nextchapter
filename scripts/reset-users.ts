// Reusable routine: fully deletes one or more users by email — their
// CandidateProfile (and everything that cascades from it: resumes, work
// samples, references, reports, sprints, community posts, etc.) plus their
// Supabase auth account. Lets a real email go through signup/onboarding
// again from scratch.
//
// Run: npm run reset:users -- someone@example.com another@example.com

import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.')
}
const admin = createClient(supabaseUrl, serviceKey)

async function findAuthUserByEmail(email: string) {
  // supabase-js has no direct admin.getUserByEmail — page through listUsers.
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

async function resetUser(email: string) {
  console.log(`\n--- ${email} ---`)

  const profiles = await prisma.candidateProfile.findMany({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, userId: true },
  })

  for (const profile of profiles) {
    // CandidateInteraction (legacy employer-side model) doesn't cascade from
    // CandidateProfile, unlike every other related table — delete explicitly
    // first so the profile delete below doesn't hit a FK constraint.
    await prisma.candidateInteraction.deleteMany({ where: { candidateId: profile.id } })
    await prisma.candidateProfile.delete({ where: { id: profile.id } })
    console.log(`Deleted CandidateProfile ${profile.id}`)
  }
  if (profiles.length === 0) {
    console.log('No CandidateProfile found.')
  }

  const authUser = await findAuthUserByEmail(email)
  if (authUser) {
    const { error } = await admin.auth.admin.deleteUser(authUser.id)
    if (error) throw error
    console.log(`Deleted Supabase auth user ${authUser.id}`)
  } else {
    console.log('No Supabase auth user found.')
  }
}

async function main() {
  const emails = process.argv.slice(2)
  if (emails.length === 0) {
    console.error('Usage: npm run reset:users -- <email> [email...]')
    process.exit(1)
  }

  for (const email of emails) {
    await resetUser(email)
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
