import 'server-only'
import { getEmployerAccess } from '@/lib/employer/access'
import { sectionAppPath, cookieOwnerForSection } from '@/lib/employer/section-links'
import { parseBridgeTarget, verifyArrival } from '@/lib/employer/section-bridge'
import { createClient } from '@/lib/supabase/server'
import { captureServerEvent } from '@/lib/posthog/server'

// The last step of the sign-in bridge, run by /auth/callback once the target section's session exists: the person has
// arrived signed in to the section's own cookie. Confirms the arrival was minted for this person and this section, and
// answers with the page to open. The page comes from the allow-list in sections.ts, never from the request.
export async function finishSectionBridge(toRaw: string, arrival: string): Promise<{ error?: string; path?: string }> {
  const to = parseBridgeTarget(toRaw)
  if (!to) return { error: 'This link is not valid.' }
  const supabase = await createClient(cookieOwnerForSection(to))
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be signed in.' }

  const state = verifyArrival(user.id, to, arrival)
  if (state !== 'ok') {
    captureServerEvent(user.id, 'employer_section_switched', { to, result: state === 'expired' ? 'arrival_expired' : 'arrival_invalid' })
    return { error: state === 'expired' ? 'This link has expired.' : 'This link is not valid.' }
  }
  const access = await getEmployerAccess({ userId: user.id, email: user.email ?? null })
  if (!access.sections.includes(to)) {
    captureServerEvent(user.id, 'employer_section_switched', { to, result: 'blocked_no_access' })
    return { error: 'You do not have access to this section.' }
  }
  const withServices = access.grants.find((g) => g.section === to && g.services)
  captureServerEvent(user.id, 'employer_section_switched', { to, result: 'arrived' })
  return { path: sectionAppPath(to, withServices?.services) }
}
