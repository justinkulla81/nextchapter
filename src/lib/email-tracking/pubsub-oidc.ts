import { createPublicKey, verify as verifySignature, type JsonWebKey, type KeyObject } from 'node:crypto'

// Verifies the OIDC token Google Pub/Sub attaches to an authenticated push
// (Authorization: Bearer <JWT>), so the Gmail push endpoint no longer needs a
// shared secret in its URL (CASA 2.1.1 / 6.5.1). Checks, per Google's
// "Authenticate push subscriptions" guide:
//   - RS256 signature by one of Google's current OAuth2 signing keys
//   - iss is accounts.google.com
//   - aud is exactly our endpoint (the subscription's --push-auth-token-audience)
//   - email is the push subscription's service account, and email_verified
//   - not expired (a little clock skew allowed)

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com'])
const SKEW_SECONDS = 60

export type PubSubOidcConfig = { audience: string; serviceAccount: string }
export type KeyLookup = (kid: string) => Promise<KeyObject | null>
export type OidcResult = { ok: true; email: string } | { ok: false; reason: string }

let certs: { keys: Map<string, KeyObject>; expiresAt: number; fetchedAt: number } | null = null

async function fetchCerts(): Promise<void> {
  const res = await fetch(GOOGLE_CERTS_URL, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Google certs fetch failed: ${res.status}`)
  const body = (await res.json()) as { keys?: (JsonWebKey & { kid?: string })[] }
  const keys = new Map<string, KeyObject>()
  for (const jwk of body.keys ?? []) {
    if (jwk.kid && jwk.kty === 'RSA') keys.set(jwk.kid, createPublicKey({ key: jwk, format: 'jwk' }))
  }
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600)
  certs = { keys, fetchedAt: Date.now(), expiresAt: Date.now() + Math.min(maxAge, 6 * 3600) * 1000 }
}

/** Google's signing key by id, cached for as long as Google says; refetched at most once a minute for an unknown id. */
export const googleSigningKey: KeyLookup = async (kid) => {
  const stale = !certs || Date.now() > certs.expiresAt
  const unknownKid = certs && !certs.keys.has(kid) && Date.now() - certs.fetchedAt > 60_000
  if (stale || unknownKid) await fetchCerts()
  return certs?.keys.get(kid) ?? null
}

function b64urlJson(part: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(Buffer.from(part, 'base64url').toString('utf-8'))
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export async function verifyPubSubOidcToken(
  authorization: string | null,
  config: PubSubOidcConfig,
  opts: { getKey?: KeyLookup; nowSeconds?: number } = {},
): Promise<OidcResult> {
  const match = /^Bearer\s+(\S+)$/i.exec(authorization ?? '')
  if (!match) return { ok: false, reason: 'no_bearer' }
  const parts = match[1].split('.')
  if (parts.length !== 3) return { ok: false, reason: 'malformed' }
  const [h, p, s] = parts
  const header = b64urlJson(h)
  const payload = b64urlJson(p)
  if (!header || !payload) return { ok: false, reason: 'malformed' }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') return { ok: false, reason: 'bad_alg' }

  let key: KeyObject | null
  try {
    key = await (opts.getKey ?? googleSigningKey)(header.kid)
  } catch {
    return { ok: false, reason: 'keys_unavailable' }
  }
  if (!key) return { ok: false, reason: 'unknown_kid' }
  const signed = verifySignature('RSA-SHA256', Buffer.from(`${h}.${p}`), key, Buffer.from(s, 'base64url'))
  if (!signed) return { ok: false, reason: 'bad_signature' }

  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000)
  if (!ISSUERS.has(String(payload.iss))) return { ok: false, reason: 'bad_issuer' }
  const aud = payload.aud
  if (!(aud === config.audience || (Array.isArray(aud) && aud.length === 1 && aud[0] === config.audience))) return { ok: false, reason: 'bad_audience' }
  if (typeof payload.exp !== 'number' || payload.exp + SKEW_SECONDS < now) return { ok: false, reason: 'expired' }
  if (typeof payload.iat === 'number' && payload.iat - SKEW_SECONDS > now) return { ok: false, reason: 'not_yet_valid' }
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : ''
  if (!email || email !== config.serviceAccount.trim().toLowerCase()) return { ok: false, reason: 'wrong_service_account' }
  if (payload.email_verified !== true) return { ok: false, reason: 'email_unverified' }
  return { ok: true, email }
}
