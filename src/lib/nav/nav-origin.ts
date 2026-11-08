// The member login lives on candidate.<site> and the public pages on <site>: the main site's header asks the candidate host whether the login is
// still live (src/app/api/nav-session/route.ts). Only the site's own origins may read the answer. No server-only imports.

/** The origin to put in Access-Control-Allow-Origin, or null when the page asking is not one of the site's own (the site, or www.). */
export function allowedNavOrigin(origin: string | null | undefined, appUrl: string | undefined): string | null {
  if (!origin || !appUrl) return null
  try {
    const site = new URL(appUrl)
    const asked = new URL(origin)
    if (asked.protocol !== site.protocol || asked.origin !== origin) return null
    const bare = site.host.replace(/^www\./, '')
    return asked.host === bare || asked.host === `www.${bare}` ? origin : null
  } catch {
    return null
  }
}
