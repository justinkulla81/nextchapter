import 'server-only'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import type { Recruiter } from '@prisma/client'

// The /recruiters/calibrate/<token> and /job-board/*/<token> pages and their
// actions find the recruiter by the accessToken in the URL. A token in a URL
// leaks (history, referrers, forwarded screenshots), and these actions spend
// LLM budget and post jobs as that recruiter, so the token must also belong to
// the recruiter signed in right now. Same rule as coaches (src/lib/coach/access.ts).
export async function getRecruiterByToken(token: string): Promise<Recruiter | null> {
  const supabase = await createClient('recruiter')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const recruiter = await prisma.recruiter.findUnique({ where: { accessToken: token } })
  if (!recruiter || !recruiter.userId || recruiter.userId !== user.id) return null
  return recruiter
}
