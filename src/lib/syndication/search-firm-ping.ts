// Which search-firm pages to ping to IndexNow. Pure so it is unit-tested. The announced set holds "slug@YYYY-MM-DD" entries:
// a page is re-sent when its last-verified day moves on (its roles changed), and a slug that left the list is sent once as gone.

export interface PingFirm { slug: string; lastVerifiedAt: string }

export function planSearchFirmPings(firms: PingFirm[], announced: Set<string>): { send: string[]; removed: string[]; next: Set<string> } {
  const key = (f: PingFirm) => `${f.slug}@${f.lastVerifiedAt.slice(0, 10)}`
  const live = new Set(firms.map((f) => f.slug))
  const next = new Set<string>(firms.map(key))
  const send = firms.filter((f) => !announced.has(key(f))).map((f) => f.slug)
  const removed = [...new Set([...announced].map((a) => a.split('@')[0]))].filter((s) => !live.has(s))
  return { send, removed, next }
}
