import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'
import { EMPLOYER_SECTIONS, isEmployerSectionKey, type EmployerSectionKey } from '@/lib/employer/sections'

// Sign-in bridge, option A of docs/specs/employer-sections-build-plan.md (3.2): a person signed in to one section gets
// into another section they hold, in one click, without any cookie, middleware or login change.
//
// How it works: the switcher POSTs to /api/employer/section-switch. The route checks (a) the signed-in user, (b) that
// getEmployerAccess says they hold the target section, then mints a one-time Supabase sign-in link for THAT USER'S OWN
// EMAIL (taken from their verified session, never from the request) and sends the browser to it. The link lands on
// /auth/callback?next=section-bridge, which signs the person in to the target section's own cookie (the same path the
// invite links use) and then asks completeSectionBridge for the page to open. The source session is never touched.
//
// Everything a request can choose is an allow-listed key: the destination is never a URL, path or `next` from the request.

/** Who may ask for a bridge: a CSRF token bound to the user, good for two hours (a page left open longer asks to be reloaded). */
export const CSRF_TTL_SECONDS = 2 * 60 * 60
/** How long after the link is minted the callback may still finish the bridge. Supabase's own link is single use. */
export const ARRIVAL_TTL_SECONDS = 5 * 60

export const BRIDGE_DESTINATIONS: readonly EmployerSectionKey[] = EMPLOYER_SECTIONS.map((s) => s.key)

export function parseBridgeTarget(v: unknown): EmployerSectionKey | null {
  return isEmployerSectionKey(v) ? v : null
}

function secret(): Buffer | null {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base) return null
  return createHmac('sha256', 'nextchapter-employer-section-bridge-v1').update(base).digest()
}

function sign(purpose: string, parts: string[]): string | null {
  const key = secret()
  if (!key) return null
  return createHmac('sha256', key).update([purpose, ...parts].join('|')).digest('base64url')
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** True when the bridge can run at all (the signing key is configured). When false the switcher falls back to plain links. */
export function bridgeAvailable(): boolean {
  return secret() !== null
}

/** `<expiresAt>.<signature>`, bound to the user. */
export function issueCsrf(userId: string, nowMs = Date.now()): string | null {
  const exp = Math.floor(nowMs / 1000) + CSRF_TTL_SECONDS
  const sig = sign('csrf', [userId, String(exp)])
  return sig ? `${exp}.${sig}` : null
}

export function verifyCsrf(userId: string, token: string | null | undefined, nowMs = Date.now()): boolean {
  if (!token) return false
  const [expRaw, sig, ...rest] = token.split('.')
  if (!expRaw || !sig || rest.length || !/^\d{1,12}$/.test(expRaw)) return false
  if (Number(expRaw) < Math.floor(nowMs / 1000)) return false
  const want = sign('csrf', [userId, expRaw])
  return !!want && safeEqual(want, sig)
}

/** Binds an arriving session to the person and target the link was minted for. */
export function issueArrival(userId: string, to: EmployerSectionKey, nowMs = Date.now()): string | null {
  const exp = Math.floor(nowMs / 1000) + ARRIVAL_TTL_SECONDS
  const sig = sign('arrival', [userId, to, String(exp)])
  return sig ? `${exp}.${sig}` : null
}

export function verifyArrival(userId: string, to: EmployerSectionKey, token: string | null | undefined, nowMs = Date.now()): 'ok' | 'expired' | 'invalid' {
  if (!token) return 'invalid'
  const [expRaw, sig, ...rest] = token.split('.')
  if (!expRaw || !sig || rest.length || !/^\d{1,12}$/.test(expRaw)) return 'invalid'
  const want = sign('arrival', [userId, to, expRaw])
  if (!want || !safeEqual(want, sig)) return 'invalid'
  return Number(expRaw) < Math.floor(nowMs / 1000) ? 'expired' : 'ok'
}

/** Whether a request's Origin (or, failing that, Referer) is one of our own origins. A missing one is refused. */
export function sameOrigin(originHeader: string | null, refererHeader: string | null, allowedOrigins: string[]): boolean {
  const raw = originHeader || refererHeader
  if (!raw) return false
  try {
    return allowedOrigins.includes(new URL(raw).origin)
  } catch {
    return false
  }
}
