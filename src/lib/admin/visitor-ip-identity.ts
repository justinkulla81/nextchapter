// A visitor we have identified once (an email link, a click Resend recorded, an account, an address they gave) is the same
// person on the other events from that IP. The per-event rules each look in a short window (five seconds, ten minutes), so
// the rest of the visit stayed "Human". This carries a name to the unnamed rows of the same IP when exactly one person is
// evidenced there: two people on one IP (an office, a VPN) means nobody is named, because a wrong name is worse than none.

/** An unnamed event may inherit a name from an identified event up to this long before it... */
export const INHERIT_FORWARD_MS = 7 * 24 * 60 * 60 * 1000
/** ...or up to this long after it (the page view that came just before the click that named them). */
export const INHERIT_BACKWARD_MS = 60 * 60 * 1000

export interface IdentityRow {
  id: string
  ip: string | null
  at: Date
  /** Who this event already names (a stable key such as `crm:<id>` or `candidate:<id>`), or null. */
  identity: string | null
  /** Scanners, bots, datacenter and shared addresses never lend or receive a name. */
  excluded: boolean
}

/** Row id -> the identity key it inherits, for the rows that had none. */
export function inheritIdentityByIp(rows: IdentityRow[]): Map<string, string> {
  const byIp = new Map<string, IdentityRow[]>()
  for (const r of rows) {
    if (!r.ip || r.excluded) continue
    byIp.set(r.ip, [...(byIp.get(r.ip) ?? []), r])
  }
  const out = new Map<string, string>()
  for (const list of byIp.values()) {
    const named = list.filter((r) => r.identity)
    if (new Set(named.map((r) => r.identity)).size !== 1) continue
    for (const r of list) {
      if (r.identity) continue
      const near = named.some((n) => {
        const gap = r.at.getTime() - n.at.getTime()
        return gap >= -INHERIT_BACKWARD_MS && gap <= INHERIT_FORWARD_MS
      })
      if (near) out.set(r.id, named[0].identity as string)
    }
  }
  return out
}
