import 'server-only'
import { signLink, verifyLink } from '@/lib/email/signed-links'

// The connect code a member pastes into the Apply Helper extension. Stateless like the
// signed email links: candidate id + expiry + signature, no table. It lets the extension
// read that member's own profile and log applications for them, nothing else.
const PURPOSE = 'apply-helper'
export const CODE_DAYS = 30

export function issueConnectCode(candidateId: string, now = Date.now()): { code: string; expiresAt: Date } {
  const exp = Math.floor(now / 1000) + CODE_DAYS * 86400
  const sig = signLink(PURPOSE, candidateId, String(exp))
  return { code: `nca1.${candidateId}.${exp}.${sig}`, expiresAt: new Date(exp * 1000) }
}

export function candidateFromAuthHeader(header: string | null, now = Date.now()): string | null {
  if (!header?.startsWith('Bearer ')) return null
  const parts = header.slice(7).trim().split('.')
  if (parts.length !== 4 || parts[0] !== 'nca1') return null
  const [, candidateId, exp, sig] = parts
  if (!/^\d+$/.test(exp) || Number(exp) * 1000 < now) return null
  return verifyLink(sig, PURPOSE, candidateId, exp) ? candidateId : null
}
