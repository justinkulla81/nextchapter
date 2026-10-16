'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { completeJoin, findMemberByEmail, findMemberByToken } from '@/lib/higher-ed/join'
import { captureServerEvent } from '@/lib/posthog/server'

export async function completeWelcome(slug: string, token: string | null, _prev: { error?: string } | null, formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user?.email) redirect(`/auth/login?next=${encodeURIComponent(`/i/${slug}/welcome`)}`)
  const inst = await prisma.institution.findUnique({ where: { slug }, select: { id: true, orgType: true } })
  if (!inst) return { error: 'This college isn’t on NextChapter.' }

  // The token's member must be this login; without a token, the login email
  // must be on the roster.
  const byToken = token ? await findMemberByToken(slug, token) : null
  const member = byToken && byToken.email === user.email.toLowerCase() ? byToken : await findMemberByEmail(inst.id, user.email)
  if (!member) return { error: 'We couldn’t find this email on the list. Ask the organization that invited you to add it.' }

  const yes = (k: string) => formData.get(k) === 'yes'
  const choices = {
    shareOutcome: yes('shareOutcome'),
    shareSearchDetail: yes('shareSearchDetail'),
    takeCalls: formData.get('takeCalls') === 'on',
    ...(inst.orgType !== 'COLLEGE' ? { shareDossier: yes('shareDossier') } : {}),
  }
  const { candidateId } = await completeJoin({ member, userId: user.id, choices })
  captureServerEvent(candidateId, 'he_member_joined', { institutionId: inst.id, slug, viaToken: !!byToken, ...choices })
  redirect('/dashboard')
}
