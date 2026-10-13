import 'server-only'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

// Server-side fetch of a URL a user (or an email the user's inbox received)
// supplied. Plain fetch() follows redirects and will happily hit
// 169.254.169.254, localhost or an internal hostname. This refuses non-http(s)
// schemes, resolves the hostname and rejects any private/loopback/link-local/
// CGNAT/multicast address (v4 and v6), and follows redirects manually so each
// hop is re-validated. Residual risk: the OS resolves again at connect time
// (DNS rebinding); egress from Vercel Functions has no internal network to
// reach, so this closes the practical SSRF paths.

export class UnsafeUrlError extends Error {}

const MAX_REDIRECTS = 4

function isPrivateV4(ip: string): boolean {
  const p = ip.split('.').map(Number)
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n))) return true
  const [a, b] = p
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  )
}

function isPrivateV6(ip: string): boolean {
  const s = ip.toLowerCase()
  if (s === '::' || s === '::1') return true
  const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateV4(mapped[1])
  if (s.startsWith('::ffff:')) return true
  return s.startsWith('fc') || s.startsWith('fd') || /^fe[89ab]/.test(s) || s.startsWith('ff') || s.startsWith('64:ff9b')
}

export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw new UnsafeUrlError('That is not a valid URL.')
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new UnsafeUrlError('Only http and https links can be fetched.')
  if (u.username || u.password) throw new UnsafeUrlError('Links with embedded credentials cannot be fetched.')
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new UnsafeUrlError('That link points at an internal address, so it will not be fetched.')
  }
  const literal = isIP(host)
  const addresses = literal ? [{ address: host, family: literal }] : await lookup(host, { all: true }).catch(() => [])
  if (addresses.length === 0) throw new UnsafeUrlError('That host could not be resolved.')
  for (const { address, family } of addresses) {
    if (family === 4 ? isPrivateV4(address) : isPrivateV6(address)) {
      throw new UnsafeUrlError('That link points at an internal address, so it will not be fetched.')
    }
  }
  return u
}

/** fetch() with scheme/IP validation on the URL and on every redirect hop. */
export async function safeFetch(raw: string, init: RequestInit = {}): Promise<Response> {
  let url = (await assertPublicHttpUrl(raw)).toString()
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url, { ...init, redirect: 'manual' })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = (await assertPublicHttpUrl(new URL(res.headers.get('location')!, url).toString())).toString()
      continue
    }
    return res
  }
  throw new UnsafeUrlError('Too many redirects.')
}
