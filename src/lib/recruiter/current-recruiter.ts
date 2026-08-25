import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import type { Recruiter } from '@prisma/client'

// Supabase-session-based recruiter lookup for pages/layouts — the same auth
// pattern every session-based recruiter page already inlined individually
// (distinct from the private requireRecruiter() in candidates/actions.ts,
// which returns null instead of redirecting since it's called from actions).
export async function getCurrentRecruiter(): Promise<Recruiter> {
  const supabase = await createClient('recruiter')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/recruiters/login')

  const recruiter = await prisma.recruiter.findUnique({ where: { userId: user.id } })
  if (!recruiter) redirect('/recruiters/signup')

  return recruiter
}
