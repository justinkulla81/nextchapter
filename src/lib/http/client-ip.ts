import 'server-only'
import { headers } from 'next/headers'

// Vercel (and most proxies) set x-forwarded-for as a comma-separated chain —
// the first entry is the original client. Falls back to x-real-ip for
// non-Vercel environments that set that instead.
export async function getClientIp(): Promise<string | null> {
  const h = await headers()
  const forwardedFor = h.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()
  return h.get('x-real-ip')
}
