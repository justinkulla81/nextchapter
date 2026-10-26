import { NextResponse, type NextRequest } from 'next/server'
import { getEmployerAccess } from '@/lib/employer/access'
import { sectionAppPath, cookieOwnerForSection } from '@/lib/employer/section-links'
import { issueArrival, parseBridgeTarget, sameOrigin, verifyCsrf } from '@/lib/employer/section-bridge'
import { peekPortalUser, type PeekedUser } from '@/lib/supabase/peek-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureServerEvent } from '@/lib/posthog/server'
import { linkedIdentityFor } from '@/lib/employer/account-link-server'
import { callbackOriginForAppPath, portalOrigin, urlForAppPath } from '@/lib/portal-hosts'

// Sign-in bridge (src/lib/employer/section-bridge.ts). POST only, with a CSRF token bound to the signed-in user and an
// Origin check. It never changes a cookie: it reads the signed-in session without refreshing it, and either sends the
// person straight to the target section (if they are already signed in to it) or to a one-time sign-in link for their
// OWN email, which signs them in to the target section's own cookie.

export const dynamic = 'force-dynamic'

const APP_ORIGIN = () => new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').origin

function back(req: NextRequest, reason: string) {
  // 303 so the browser follows with a GET. /employer-home reads ?switch= and says what to do next.
  return NextResponse.redirect(new URL(`/employer-home?switch=${reason}`, req.nextUrl.origin), 303)
}

export async function POST(req: NextRequest) {
  const allowed = [req.nextUrl.origin, APP_ORIGIN(), portalOrigin('employer')]
  if (!sameOrigin(req.headers.get('origin'), req.headers.get('referer'), allowed)) {
    return NextResponse.json({ error: 'Request not allowed.' }, { status: 403 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return back(req, 'unavailable')
  }
  const to = parseBridgeTarget(form.get('to'))
  const csrf = typeof form.get('csrf') === 'string' ? (form.get('csrf') as string) : null
  if (!to) return back(req, 'unavailable')

  // The signed-in person is whoever's session the CSRF token was issued for. Both sessions are read without refreshing.
  const candidates: PeekedUser[] = []
  for (const portal of ['employer', 'talent'] as const) {
    const u = await peekPortalUser(portal)
    if (u && !candidates.some((c) => c.id === u.id)) candidates.push(u)
  }
  const user = candidates.find((c) => verifyCsrf(c.id, csrf))
  if (!user) {
    captureServerEvent(candidates[0]?.id ?? 'anonymous', 'employer_section_switched', { to, result: candidates.length ? 'blocked_csrf' : 'blocked_signed_out' })
    return back(req, candidates.length ? 'expired' : 'signed_out')
  }

  const access = await getEmployerAccess({ userId: user.id, email: user.email, includeLinked: true })
  // The person's own grants come first. A linked account's grant (viaUserId) is used only when they hold nothing in this
  // section themselves.
  const forTo = access.grants.filter((g) => g.section === to)
  const own = forTo.filter((g) => !g.viaUserId)
  const pool = own.length ? own : forTo
  const grant = pool.find((g) => g.services) ?? pool[0]
  if (!grant) {
    captureServerEvent(user.id, 'employer_section_switched', { to, result: 'blocked_no_access' })
    return back(req, 'no_access')
  }
  const dest = sectionAppPath(to, grant.services)
  const heldSections = access.sections
  const linkedUserId = own.length ? null : (grant.viaUserId ?? null)

  // Already signed in to the target section's own session as the person who holds it: nothing to mint.
  const targetUser = await peekPortalUser(cookieOwnerForSection(to))
  if (targetUser?.id === (linkedUserId ?? user.id)) {
    captureServerEvent(user.id, 'employer_section_switched', { to, result: 'direct', heldSections, linked: !!linkedUserId })
    return NextResponse.redirect(urlForAppPath(dest), 303)
  }

  // The link is for a verified email and nothing else: this session's own or, for a section held only through a linked
  // account, that account's, and only while an active link joins the two and the linked account is a verified party to it.
  let signInEmail = user.email
  let signInUserId = user.id
  if (linkedUserId) {
    const identity = await linkedIdentityFor(user.id, linkedUserId)
    if (!identity) {
      captureServerEvent(user.id, 'employer_section_switched', { to, result: 'blocked_link_invalid' })
      return back(req, 'no_access')
    }
    signInEmail = identity.email
    signInUserId = identity.id
  }
  if (!signInEmail) return back(req, 'unavailable')
  const arrival = issueArrival(signInUserId, to)
  if (!arrival) return back(req, 'unavailable')
  const redirectTo = `${callbackOriginForAppPath(dest)}/auth/callback?next=section-bridge&to=${to}&arrival=${encodeURIComponent(arrival)}`
  try {
    const { data, error } = await createAdminClient().auth.admin.generateLink({ type: 'magiclink', email: signInEmail, options: { redirectTo } })
    const link = data?.properties?.action_link
    // Only ever send the browser to our own Supabase project.
    if (error || !link || new URL(link).origin !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin) {
      captureServerEvent(user.id, 'employer_section_switched', { to, result: 'link_failed' })
      return back(req, 'unavailable')
    }
    captureServerEvent(user.id, 'employer_section_switched', { to, result: 'link_issued', heldSections, linked: !!linkedUserId })
    return NextResponse.redirect(link, 303)
  } catch {
    captureServerEvent(user.id, 'employer_section_switched', { to, result: 'link_failed' })
    return back(req, 'unavailable')
  }
}
