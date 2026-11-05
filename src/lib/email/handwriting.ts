import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'

// Gmail ignores web fonts, so a handwritten aside has to be an image. /api/email/handwriting draws the text in Caveat. The URL is signed so
// the endpoint only draws text our own emails asked for, not whatever a stranger puts in a link.

export const HANDWRITING_MAX = 60

function sign(text: string): string | null {
  const secret = process.env.CRON_SECRET
  if (!secret) return null
  return createHmac('sha256', secret).update(`handwriting-v1\n${text}`).digest('base64url')
}

/** Signed image URL for a short handwritten note, or null when the text is empty or too long, or signing is not configured. */
export function handwritingUrl(appUrl: string, text: string): string | null {
  const t = text.trim()
  if (!t || t.length > HANDWRITING_MAX) return null
  const s = sign(t)
  if (!s) return null
  return `${appUrl}/api/email/handwriting?t=${encodeURIComponent(t)}&s=${s}`
}

export function readHandwriting(params: URLSearchParams): string | null {
  const t = params.get('t')?.trim()
  const s = params.get('s')
  if (!t || !s || t.length > HANDWRITING_MAX) return null
  const expected = sign(t)
  if (!expected) return null
  const a = Buffer.from(s)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b) ? t : null
}
