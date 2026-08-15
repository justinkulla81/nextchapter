import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import type { HiringManager } from '@prisma/client'

// Supabase-session-based hiring-manager lookup for pages/layouts — same
// pattern as getCurrentRecruiter (src/lib/recruiter/current-recruiter.ts)
// and getCurrentOutplacementOrgUser.
export async function getCurrentHiringManager(): Promise<HiringManager> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/hiring/login')

  const hiringManager = await prisma.hiringManager.findUnique({ where: { userId: user.id } })
  if (!hiringManager) redirect('/hiring/signup')

  return hiringManager
}
