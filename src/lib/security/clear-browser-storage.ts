// CASA 6.6.1 (ASVS 8.2.3): nothing a member typed or was shown may stay in the
// browser after they sign out. On sign-out we empty localStorage and
// sessionStorage for this site, keeping only the keys below, and reset
// PostHog's identity (its ph_* storage and cookie carry the member id and
// email).
//
// An allowlist, not a denylist: a key a future feature adds is cleared by
// default, so new member data can't quietly survive a logout. Only add a key
// here if it holds a UI preference with no member data in it.
export const KEPT_STORAGE_KEYS: ReadonlySet<string> = new Set([
  'nc-menu-collapsed', // candidate menu open or collapsed
  'admin-nav-collapsed', // admin menu open or collapsed
  'nc_report_popup_dismissed_at', // public report page: newsletter popup dismissed (a timestamp)
])

type KeyedStorage = Pick<Storage, 'length' | 'key' | 'removeItem'>

/** Removes every key not in KEPT_STORAGE_KEYS. Returns how many were removed. */
export function clearStorageExceptKept(storage: KeyedStorage | null | undefined): number {
  if (!storage) return 0
  const doomed: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i)
    if (k !== null && !KEPT_STORAGE_KEYS.has(k)) doomed.push(k)
  }
  for (const k of doomed) storage.removeItem(k)
  return doomed.length
}

/** Names of PostHog's first-party cookies in a document.cookie string. */
export function posthogCookieNames(cookieHeader: string): string[] {
  return cookieHeader
    .split(';')
    .map((c) => c.split('=')[0]?.trim() ?? '')
    .filter((name) => /^ph_.+_posthog$/.test(name))
}

/**
 * Browser-only. Safe to call anywhere: every storage access is guarded,
 * because storage can be blocked (private mode, site data off).
 */
export function clearMemberBrowserStorage(): void {
  if (typeof window === 'undefined') return
  try { clearStorageExceptKept(window.localStorage) } catch { /* storage blocked */ }
  try { clearStorageExceptKept(window.sessionStorage) } catch { /* storage blocked */ }
  try {
    for (const name of posthogCookieNames(document.cookie)) {
      document.cookie = `${name}=; Max-Age=0; path=/`
      document.cookie = `${name}=; Max-Age=0; path=/; domain=.${location.hostname.split('.').slice(-2).join('.')}`
    }
  } catch { /* cookies blocked */ }
}
