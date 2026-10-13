// Which sign-in providers are switched on in Supabase Auth, from its public
// settings endpoint (cached for an hour). Microsoft appears on college pages
// only once the Azure provider is configured there.

import 'server-only'

export async function enabledProviders(): Promise<{ google: boolean; microsoft: boolean }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return { google: false, microsoft: false }
  try {
    const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, next: { revalidate: 3600 } })
    const s = (await r.json()) as { external?: Record<string, boolean> }
    return { google: !!s.external?.google, microsoft: !!s.external?.azure }
  } catch {
    return { google: true, microsoft: false }
  }
}
