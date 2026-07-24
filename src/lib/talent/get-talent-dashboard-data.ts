import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveEmployerForUserId } from './get-employer-for-user'

export async function getTalentDashboardData() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login?next=/talent')
  }

  const employer = await resolveEmployerForUserId(user.id)

  if (!employer) {
    redirect('/talent/signup')
  }

  return employer
}
