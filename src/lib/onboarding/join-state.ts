import 'server-only'
import crypto from 'crypto'
import { cookies } from 'next/headers'

// CSRF protection for the sign-up Google round trip. Unlike the Connect Gmail
// flows there is no signed-in member to bind the callback to, so the nonce in
// this cookie is the only proof that the callback follows this browser's own
// start. A missing or mismatched nonce must abort before the code is exchanged.
const COOKIE_NAME = 'nc_join_oauth'
const MAX_AGE_SECONDS = 10 * 60

export async function storeJoinState(): Promise<string> {
  const nonce = crypto.randomBytes(16).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, nonce, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: MAX_AGE_SECONDS,
    path: '/',
  })
  return nonce
}

export async function consumeJoinState(returnedState: string | null): Promise<boolean> {
  const cookieStore = await cookies()
  const expected = cookieStore.get(COOKIE_NAME)?.value
  cookieStore.delete(COOKIE_NAME)
  if (!expected || !returnedState) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(returnedState)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
