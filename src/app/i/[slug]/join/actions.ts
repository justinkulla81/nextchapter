'use server'

import { redirect } from 'next/navigation'
import { joinLinkForToken } from '@/lib/higher-ed/join'
import { captureServerEvent } from '@/lib/posthog/server'

// "Join" on the landing page from the college's email: sign in as the roster
// address via a one-time magic link, then land on the welcome step.
export async function joinWithToken(slug: string, token: string): Promise<{ error?: string }> {
  const result = await joinLinkForToken(slug, token)
  if (result.error === 'used') redirect(`/auth/login?next=${encodeURIComponent(`/i/${slug}/welcome`)}`)
  if (result.error || !result.url) return { error: result.error ?? 'Something went wrong. Try the link again.' }
  captureServerEvent(`join:${token.slice(0, 8)}`, 'he_join_link_clicked', { slug })
  redirect(result.url)
}
