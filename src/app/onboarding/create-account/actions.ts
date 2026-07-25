'use server'

import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'

// Fallback for when resume extraction couldn't find an email (no plain-text
// email on the resume, empty extracted text, or the model just missed it) —
// lets the candidate supply one directly on the create-account step instead
// of being stuck with a null profile.email and no way to receive a
// confirmation link.
export async function setCandidateEmail(email: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { email },
  })
}
