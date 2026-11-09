// The visitor's id from posthog-js's own cookie (ph_<key>_posthog, URL-encoded JSON), read on the server so a server event can join the
// same person as their browser events. Null when the cookie is missing or unreadable. No server-only imports.
export function posthogCookieName(): string {
  return `ph_${process.env.NEXT_PUBLIC_POSTHOG_KEY}_posthog`
}

export function posthogDistinctId(value: string | undefined | null): string | null {
  if (!value) return null
  try {
    const id = (JSON.parse(decodeURIComponent(value)) as { distinct_id?: unknown }).distinct_id
    return typeof id === 'string' && id.length > 0 && id.length <= 200 ? id : null
  } catch {
    return null
  }
}
