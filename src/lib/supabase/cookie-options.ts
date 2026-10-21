import type { CookieOptionsWithName } from '@supabase/ssr'

// Options for every Supabase session cookie (candidate and each portal's own
// name). @supabase/ssr's defaults leave out `Secure`, so the session cookie
// could ride a plain-http request; CASA 2.3.1 / ASVS 3.4.1 want it set.
// HttpOnly stays off: the browser Supabase client reads these cookies to run
// sign-in, sign-up and password reset in the page.
// `secure` is decided by the caller: the server uses production mode, the
// browser uses the page's own protocol, so `next dev` on http://localhost
// still gets a cookie it can store.
export function sessionCookieOptions(name: string | undefined, secure: boolean): CookieOptionsWithName {
  return name ? { name, secure } : { secure }
}

export const SERVER_COOKIES_SECURE = process.env.NODE_ENV === 'production'

export function browserCookiesSecure(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'https:'
}
