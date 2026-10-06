import type { Metadata } from 'next'

/**
 * A page's own canonical, as a metadata fragment to spread in:
 * `export const metadata = { title, description, ...canonical('/pricing') }`.
 *
 * The root layout deliberately sets no canonical: Next.js copies a parent's
 * `alternates` into every page that doesn't set its own, and a root canonical
 * of "/" told Google that /pricing (and every other page without one) was a
 * duplicate of the homepage. Each public page declares its own instead.
 */
export function canonical(path: string): Pick<Metadata, 'alternates'> {
  return { alternates: { canonical: path } }
}

/**
 * For utility pages nobody should land on from a search: sign-in, sign-up,
 * password reset, one-time token links, thank-you screens. Links on them are
 * still followed.
 */
export const NOINDEX: Pick<Metadata, 'robots'> = { robots: { index: false, follow: true } }
