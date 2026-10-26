import { NextResponse, type NextRequest } from 'next/server'
import { sameOrigin, verifyCsrf } from '@/lib/employer/section-bridge'
import { peekPortalUser, type PeekedUser } from '@/lib/supabase/peek-session'
import { portalOrigin } from '@/lib/portal-hosts'
import { allowRequest, HOUR_MS } from '@/lib/security/rate-limit'
import { confirmLinkFor, removeLinkFor, requestLinkFor } from '@/lib/employer/account-link-server'

// "Link my other account" (src/lib/employer/account-link.ts). POST only, same-origin, with the same CSRF token the section
// bridge uses (bound to the signed-in person). It reads the session without refreshing it and never sets a cookie.
// Actions: request (email the token to the other address), confirm (record the link), remove (unlink or cancel).
// It answers with a 303 to /employer-home?link=<code>, which says what happened.

export const dynamic = 'force-dynamic'

const APP_ORIGIN = () => new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').origin

function back(req: NextRequest, code: string) {
  return NextResponse.redirect(new URL(`/employer-home?link=${code}`, req.nextUrl.origin), 303)
}

const field = (form: FormData, name: string) => (typeof form.get(name) === 'string' ? (form.get(name) as string) : '')

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

  const candidates: PeekedUser[] = []
  for (const portal of ['employer', 'talent'] as const) {
    const u = await peekPortalUser(portal)
    if (u && !candidates.some((c) => c.id === u.id)) candidates.push(u)
  }
  const user = candidates.find((c) => verifyCsrf(c.id, field(form, 'csrf')))
  if (!user) return back(req, candidates.length ? 'expired' : 'signed_out')

  try {
    const action = field(form, 'action')
    if (action === 'request') {
      const r = await requestLinkFor(user, field(form, 'email'))
      return back(req, r.ok ? 'sent' : r.reason)
    }
    if (action === 'confirm') {
      if (!(await allowRequest({ bucket: 'employer-link-confirm', key: user.id, limit: 20, windowMs: HOUR_MS }))) return back(req, 'rate_limited')
      const r = await confirmLinkFor(user, field(form, 'token'))
      return back(req, r.ok ? 'linked' : r.reason === 'expired' ? 'token_expired' : r.reason)
    }
    if (action === 'remove') {
      const r = await removeLinkFor(user, field(form, 'linkId'))
      return back(req, r ? (r.wasActive ? 'removed' : 'cancelled') : 'not_found')
    }
  } catch (e) {
    console.error('Account link action failed:', e instanceof Error ? e.message : e)
    return back(req, 'unavailable')
  }
  return back(req, 'unavailable')
}
