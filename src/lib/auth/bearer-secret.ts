import { createHash, timingSafeEqual } from 'node:crypto'

const MIN_SECRET_LENGTH = 16

// Fail-closed check for `Authorization: Bearer <secret>` machine-to-machine
// auth (Vercel cron, ATS importer). The previous inline check
// `header !== \`Bearer ${process.env.X}\`` accepted the literal string
// "Bearer undefined" whenever the env var was missing, and compared with a
// non-constant-time `!==`. Here an unset/short secret rejects everything, and
// both sides are hashed first so timingSafeEqual sees equal-length buffers.
export function isBearerAuthorized(
  authorizationHeader: string | null | undefined,
  secret: string | undefined,
): boolean {
  if (!secret || secret.length < MIN_SECRET_LENGTH) return false
  if (!authorizationHeader) return false
  const digest = (v: string) => createHash('sha256').update(v).digest()
  return timingSafeEqual(digest(authorizationHeader), digest(`Bearer ${secret}`))
}
