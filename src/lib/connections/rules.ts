// Connected portals, pure parts (owner decisions 2026-11-17 and 2026-11-18). Two organizations' portals stay separate and agree to
// share chosen things, like a LinkedIn invitation between organizations: one side asks, the other side's admin accepts, and then each
// side chooses, item by item, what it shares with the other. Sharing is per item and per direction, can be narrowed or ended at any
// time, and every change is logged. Either side can disconnect. Any kind of organization can connect: workforce boards, economic
// development, chambers, community groups and nonprofits, colleges and employers. People are never moved by a connection.
// No database here.

export type PartyKind = 'INSTITUTION' | 'EMPLOYER'
export type Party = { kind: PartyKind; id: string }

export type ConnectionStatus = 'REQUESTED' | 'ACTIVE' | 'DECLINED' | 'ENDED'

/** What one side can share with the other. Referrals of people come later: each one is an invitation the person accepts. */
export const SHARE_ITEMS = [
  { key: 'JOBS', label: 'Jobs', detail: 'The jobs you added or featured' },
  { key: 'EVENTS', label: 'Events', detail: 'Events you host or co-host' },
  { key: 'LAYOFFS', label: 'Layoffs', detail: 'Layoffs you are tracking and your response to each' },
] as const
export type ShareKey = (typeof SHARE_ITEMS)[number]['key']
export const SHARE_KEYS: string[] = SHARE_ITEMS.map((s) => s.key)

/** What a new connection shares from each side until someone changes it: jobs and events, the things every kind of organization has. */
export const DEFAULT_SHARES: ShareKey[] = ['JOBS', 'EVENTS']

/** Keep only known items, once each, in a fixed order. */
export function normalizeShares(input: readonly string[]): ShareKey[] {
  const want = new Set(input)
  return SHARE_ITEMS.map((s) => s.key).filter((k) => want.has(k))
}

export const sameParty = (a: Party, b: Party) => a.kind === b.kind && a.id === b.id
export const partyKey = (p: Party) => `${p.kind}:${p.id}`

type Row = { status: string; requesterKind: string; requesterId: string; targetKind: string; targetId: string }
const requesterOf = (r: Row): Party => ({ kind: r.requesterKind as PartyKind, id: r.requesterId })
const targetOf = (r: Row): Party => ({ kind: r.targetKind as PartyKind, id: r.targetId })

/** Which side of the connection this organization is on, or null when it is not part of it. */
export function sideOf(r: Row, me: Party): 'requester' | 'target' | null {
  if (sameParty(requesterOf(r), me)) return 'requester'
  if (sameParty(targetOf(r), me)) return 'target'
  return null
}
export const otherParty = (r: Row, me: Party): Party | null => {
  const side = sideOf(r, me)
  return side === 'requester' ? targetOf(r) : side === 'target' ? requesterOf(r) : null
}

/** Why this organization cannot ask to connect, or null. A declined or ended connection can be asked for again. */
export function requestBlocked(args: { me: Party; other: Party; existing: Row | null }): string | null {
  if (sameParty(args.me, args.other)) return 'That is your own organization.'
  const s = args.existing?.status
  if (s === 'ACTIVE') return 'You are already connected.'
  if (s === 'REQUESTED') {
    return sideOf(args.existing!, args.me) === 'target' ? 'They already asked to connect with you. Accept their request below.' : 'Your request is waiting for them to accept.'
  }
  return null
}

export type Decision = 'accept' | 'decline'
/** Only the side that was asked can accept or decline, and only while the request is open. */
export function decideBlocked(r: Row, me: Party): string | null {
  if (sideOf(r, me) !== 'target') return 'Only the organization that was asked can answer this request.'
  if (r.status !== 'REQUESTED') return 'This request was already answered.'
  return null
}

/** Either side can change what it shares while connected, and either side can disconnect (or withdraw its own request). */
export function shareBlocked(r: Row, me: Party): string | null {
  if (!sideOf(r, me)) return 'This connection is not yours.'
  if (r.status !== 'ACTIVE') return 'Connect first, then choose what to share.'
  return null
}
export function endBlocked(r: Row, me: Party): string | null {
  const side = sideOf(r, me)
  if (!side) return 'This connection is not yours.'
  if (r.status === 'ACTIVE') return null
  if (r.status === 'REQUESTED' && side === 'requester') return null
  return 'There is nothing to end.'
}

/** What the other side shares with me: only while connected, and only the items they chose. */
export function sharedWithMe(r: Row & { requesterShares: string[]; targetShares: string[] }, me: Party): ShareKey[] {
  if (r.status !== 'ACTIVE') return []
  const side = sideOf(r, me)
  return side === 'requester' ? normalizeShares(r.targetShares) : side === 'target' ? normalizeShares(r.requesterShares) : []
}
export function mySharesIn(r: { requesterShares: string[]; targetShares: string[] } & Row, me: Party): ShareKey[] {
  const side = sideOf(r, me)
  return side === 'requester' ? normalizeShares(r.requesterShares) : side === 'target' ? normalizeShares(r.targetShares) : []
}
