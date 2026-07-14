'use server'

import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'

// Called once a password or Google identity is attached to the account —
// registrationCompletedAt alone (stamped the instant the email-confirmation
// link is clicked) doesn't mean the account has a durable way back in, which
// is what left candidates stuck at a duplicate-account "log in" dead end
// with no password to log in with.
export async function markPasswordSet() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { passwordSetAt: new Date() },
  })
}
