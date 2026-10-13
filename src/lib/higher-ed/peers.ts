// Peer benchmark: how a college compares with similar colleges on the public
// federal numbers (College Scorecard and IPEDS, stored in CollegeProfile).
// Peers are the same control (private nonprofit, public) with enrollment
// within half to double; same state first, the whole country if the state
// has fewer than 8. Public data only, never member data.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { readProfile } from './profile'

const MIN_PEERS = 8
const MAX_PEERS = 25

export type PeerMetric = { key: string; label: string; format: 'dollars' | 'percent'; value: number | null; median: number | null; rank: number | null; of: number }

export type PeerBenchmark = {
  college: { unitid: string; name: string; dataYear: string | null }
  peerScope: string
  peers: { unitid: string; name: string; state: string }[]
  metrics: PeerMetric[]
}

type Row = { unitid: string; name: string; state: string; enrollment: number | null; earnings10: number | null; employedShare10: number | null; completionRate: number | null; privateGifts: number | null; dataYear: string | null; control: string | null; level: string | null }

const SELECT = { unitid: true, name: true, state: true, enrollment: true, earnings10: true, employedShare10: true, completionRate: true, privateGifts: true, dataYear: true, control: true, level: true } as const

// The college's federal record: its unitid if one is set, else its exact name.
export async function collegeRecord(institution: { name: string; profile: unknown }): Promise<Row | null> {
  const profile = readProfile(institution.profile)
  const unitid = profile.college?.unitid
  if (unitid) return prisma.collegeProfile.findUnique({ where: { unitid }, select: SELECT })
  return prisma.collegeProfile.findFirst({ where: { name: { equals: institution.name, mode: 'insensitive' } }, select: SELECT })
}

const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export async function peerBenchmark(institution: { name: string; profile: unknown }): Promise<PeerBenchmark | null> {
  const me = await collegeRecord(institution)
  if (!me?.enrollment || !me.control) return null
  const where = { control: me.control, ...(me.level ? { level: me.level } : {}), unitid: { not: me.unitid }, enrollment: { gte: Math.floor(me.enrollment / 2), lte: me.enrollment * 2 }, earnings10: { not: null } }
  let peers = await prisma.collegeProfile.findMany({ where: { ...where, state: me.state }, select: SELECT })
  let peerScope = `${me.control.toLowerCase()} colleges in ${me.state} with ${Math.floor(me.enrollment / 2).toLocaleString()} to ${(me.enrollment * 2).toLocaleString()} students`
  if (peers.length < MIN_PEERS) {
    peers = await prisma.collegeProfile.findMany({ where, select: SELECT })
    peerScope = `${me.control.toLowerCase()} colleges nationwide with ${Math.floor(me.enrollment / 2).toLocaleString()} to ${(me.enrollment * 2).toLocaleString()} students`
  }
  // Closest in size first, capped so the comparison stays a peer set.
  peers = peers.sort((a, b) => Math.abs((a.enrollment ?? 0) - me.enrollment!) - Math.abs((b.enrollment ?? 0) - me.enrollment!)).slice(0, MAX_PEERS)
  if (peers.length < 3) return null

  const perStudentGifts = (r: Row) => (r.privateGifts && r.enrollment ? r.privateGifts / r.enrollment : null)
  const defs: { key: string; label: string; format: PeerMetric['format']; get: (r: Row) => number | null }[] = [
    { key: 'earnings10', label: 'Median earnings 10 years after entry', format: 'dollars', get: (r) => r.earnings10 },
    { key: 'employedShare10', label: 'Working 10 years after entry', format: 'percent', get: (r) => r.employedShare10 },
    { key: 'completionRate', label: 'Graduation rate', format: 'percent', get: (r) => r.completionRate },
    { key: 'giftsPerStudent', label: 'Private gifts per student', format: 'dollars', get: perStudentGifts },
  ]
  const metrics = defs.map((d) => {
    const value = d.get(me)
    const vals = peers.map(d.get).filter((v): v is number => v !== null)
    const all = value === null ? vals : [...vals, value]
    const rank = value === null ? null : all.filter((v) => v > value).length + 1
    return { key: d.key, label: d.label, format: d.format, value, median: median(vals), rank, of: all.length }
  })
  return { college: { unitid: me.unitid, name: me.name, dataYear: me.dataYear }, peerScope, peers: peers.map((p) => ({ unitid: p.unitid, name: p.name, state: p.state })), metrics }
}
