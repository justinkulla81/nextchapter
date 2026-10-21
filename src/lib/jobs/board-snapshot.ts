import 'server-only'
import { promisify } from 'node:util'
import { gunzip as gunzipCb, gzip as gzipCb } from 'node:zlib'
import { prisma } from '@/lib/prisma'

// The prepared board, kept between server instances.
//
// A cold instance used to rebuild the whole board before its first board view: read
// ~370k light rows and ~215k job-occupation rows from Postgres and decode them
// (~12 s and ~4 s of CPU, almost all of it the database driver's row decoding),
// filter them (~1 s), and only then rank. That was the 14-21 s first load.
//
// Now an instance that has read the board from the database also writes what it read
// — the rows it kept, already filtered — to a private Supabase Storage bucket as a few
// gzipped JSON parts (board-snapshot-codec.ts). A cold instance reads those instead:
// a few MB from storage in the same AWS region and a JSON.parse, about a second.
//
// Never stale: a snapshot is used only when the board has not changed since it was
// read. Every write to the board's rows goes through BoardLightRow (its triggers, see
// board-light-rows.ts), so Postgres' own write counters for that table — inserts,
// updates, deletes since the server started — mark the board's version
// (boardFingerprint). A snapshot carries the version it was read at; any write since,
// and it is ignored and the database is read as before. What changes with the clock
// alone (a job expiring, a listing aging into ghost risk) is re-applied on load
// (board-shortlist.ts stillLive). The same version check lets a warm instance skip
// re-reading a board that hasn't changed.
//
// Snapshots are per deployment (a new build may filter differently) and per
// environment. Off with BOARD_SNAPSHOT=off.

const BUCKET = 'board-snapshots'
const FORMAT = 2
const READ_TIMEOUT_MS = 8_000
const WRITE_TIMEOUT_MS = 60_000
/** Parts older than this that no manifest names are deleted when a new snapshot is written. */
const ORPHAN_AGE_MS = 15 * 60_000
const BACKGROUND_DELAY_MS = 2_000

/** Lets other work (a request being answered) run between chunks of a long background job. */
export const yieldToRequests = () => new Promise<void>((resolve) => setImmediate(resolve))

const gzip = promisify(gzipCb)
const gunzip = promisify(gunzipCb)

export type SnapshotKind = 'board-core' | 'board-early' | 'occupations'

export interface SnapshotManifest {
  v: number
  build: string
  kind: SnapshotKind
  /** boardFingerprint() when the data was read (unchanged until the read was done). */
  fingerprint: string
  /** When the data was read (ms). */
  at: number
  parts: string[]
  rows: number
}

export function snapshotsDisabled(env: Record<string, string | undefined> = process.env): boolean {
  if (env.BOARD_SNAPSHOT === 'off' || !env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return true
  // A deployed server that can't name its build never shares snapshots (it could read another build's).
  return env.NODE_ENV === 'production' && !!env.VERCEL && !buildId(env)
}

const buildId = (env: Record<string, string | undefined>) => env.VERCEL_GIT_COMMIT_SHA || env.VERCEL_DEPLOYMENT_ID || env.BOARD_SNAPSHOT_BUILD

/** This deployment's id: a snapshot written by another build is never read. */
export function snapshotBuild(env: Record<string, string | undefined> = process.env): string {
  return buildId(env) || 'dev'
}

function folder(kind: SnapshotKind): string {
  return `${process.env.VERCEL_ENV ?? 'local'}/${kind}`
}

/**
 * The board's version: Postgres' cumulative insert / update / delete counts for
 * BoardLightRow, and the server's start time (the counters restart with it). Any write
 * to a board row changes it; one catalog read, no table scan. Null when unreadable.
 * (Counters can lag a write by up to a few seconds — the shared board already
 * tolerates a minute.)
 */
export async function boardFingerprint(): Promise<string | null> {
  try {
    const rows = await prisma.$queryRaw<{ fp: string }[]>`
      SELECT concat_ws(':', extract(epoch from pg_postmaster_start_time())::bigint, n_tup_ins, n_tup_upd, n_tup_del) AS fp
      FROM pg_stat_user_tables WHERE relid = to_regclass('"BoardLightRow"')`
    return rows[0]?.fp ?? null
  } catch (error) {
    console.error('Board snapshot: version unreadable', error)
    return null
  }
}

function storage(path: string): { url: string; headers: Record<string, string> } {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return {
    url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/${path}`,
    headers: { authorization: `Bearer ${key}`, apikey: key },
  }
}

async function getObject(path: string, opts: { fresh?: boolean } = {}): Promise<Buffer | null> {
  const s = storage(`object/${BUCKET}/${path}`)
  // Supabase's CDN caches objects, and a rewritten manifest can be served stale for a
  // while: the manifest is read past the cache. Parts never change once written.
  const res = await fetch(opts.fresh ? `${s.url}?at=${Date.now()}` : s.url, { headers: s.headers, signal: AbortSignal.timeout(READ_TIMEOUT_MS), cache: 'no-store' })
  if (res.status === 404 || res.status === 400) return null
  if (!res.ok) throw new Error(`storage read ${path}: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

async function putObject(path: string, body: Buffer, contentType: string): Promise<void> {
  const send = async () => {
    const s = storage(`object/${BUCKET}/${path}`)
    return fetch(s.url, {
      method: 'POST',
      headers: { ...s.headers, 'content-type': contentType, 'x-upsert': 'true', 'cache-control': 'no-cache' },
      body: new Uint8Array(body),
      signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
    })
  }
  let res = await send()
  if (!res.ok && /bucket not found/i.test(await res.clone().text())) {
    // First write ever: make the (private) bucket.
    const b = storage('bucket')
    await fetch(b.url, {
      method: 'POST',
      headers: { ...b.headers, 'content-type': 'application/json' },
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
    })
    res = await send()
  }
  if (!res.ok) throw new Error(`storage write ${path}: ${res.status} ${await res.text()}`)
}

async function removeOrphans(kind: SnapshotKind, keep: Set<string>): Promise<void> {
  const l = storage(`object/list/${BUCKET}`)
  const res = await fetch(l.url, {
    method: 'POST',
    headers: { ...l.headers, 'content-type': 'application/json' },
    body: JSON.stringify({ prefix: `${folder(kind)}/`, limit: 1000 }),
  })
  if (!res.ok) return
  const items = (await res.json()) as { name: string; created_at?: string }[]
  const old = items
    .map((i) => `${folder(kind)}/${i.name}`)
    .filter((p, idx) => !keep.has(p) && !p.endsWith('/manifest.json') && Date.now() - Date.parse(items[idx].created_at ?? '') > ORPHAN_AGE_MS)
  if (old.length === 0) return
  const d = storage(`object/${BUCKET}`)
  await fetch(d.url, { method: 'DELETE', headers: { ...d.headers, 'content-type': 'application/json' }, body: JSON.stringify({ prefixes: old }) })
}

/** The latest manifest for a kind written by this build, or null. */
export async function readManifest(kind: SnapshotKind): Promise<SnapshotManifest | null> {
  if (snapshotsDisabled()) return null
  try {
    const buf = await getObject(`${folder(kind)}/manifest.json`, { fresh: true })
    if (!buf) return null
    const m = JSON.parse(buf.toString('utf8')) as SnapshotManifest
    return m.v === FORMAT && m.build === snapshotBuild() && m.kind === kind ? m : null
  } catch (error) {
    console.error(`Board snapshot (${kind}): manifest unreadable`, error)
    return null
  }
}

/** A manifest's parts, parsed (in order); null when any part can't be read. */
export async function readParts(m: SnapshotManifest): Promise<unknown[] | null> {
  try {
    const bufs = await Promise.all(m.parts.map((p) => getObject(p)))
    if (bufs.some((b) => !b)) return null
    const out: unknown[] = []
    // Decompressed on libuv's thread pool; parsed one part at a time to bound the peak.
    for (const b of bufs) out.push(JSON.parse((await gunzip(b!)).toString('utf8')))
    return out
  } catch (error) {
    console.error(`Board snapshot (${m.kind}): parts unreadable`, error)
    return null
  }
}

const lastWrite = new Map<SnapshotKind, string>()

/**
 * Writes a snapshot: its parts, then the manifest that names them (so a reader never
 * sees a manifest whose parts aren't there yet), then removes parts no manifest names.
 * Best effort and in the background — a failure only means the next cold instance reads
 * the database. Skipped when this instance already wrote that version.
 */
export async function writeSnapshot(kind: SnapshotKind, fingerprint: string, at: number, parts: unknown[], rows: number): Promise<void> {
  if (snapshotsDisabled() || lastWrite.get(kind) === fingerprint) return
  const started = Date.now()
  lastWrite.set(kind, fingerprint)
  try {
    const current = await readManifest(kind)
    if (current && current.fingerprint === fingerprint && current.at >= at) return console.log(`[board-snapshot] ${kind} already written at this version`)
    const stamp = `${at}-${Math.random().toString(36).slice(2, 8)}`
    const paths: string[] = []
    for (let i = 0; i < parts.length; i++) {
      await yieldToRequests()
      const path = `${folder(kind)}/${stamp}-${i}.json.gz`
      await putObject(path, await gzip(Buffer.from(JSON.stringify(parts[i])), { level: 6 }), 'application/gzip')
      paths.push(path)
    }
    const manifest: SnapshotManifest = { v: FORMAT, build: snapshotBuild(), kind, fingerprint, at, parts: paths, rows }
    await putObject(`${folder(kind)}/manifest.json`, Buffer.from(JSON.stringify(manifest)), 'application/json')
    console.log(`[board-snapshot] wrote ${kind}`, JSON.stringify({ rows, parts: paths.length, fingerprint, ms: Date.now() - started }))
    await removeOrphans(kind, new Set(paths)).catch(() => undefined)
  } catch (error) {
    lastWrite.delete(kind)
    console.error(`Board snapshot (${kind}): write failed`, error)
  }
}

/**
 * Runs a background write past the response when the request allows it (Next's after()),
 * and as a plain promise otherwise (scripts, crons outside a request scope).
 */
export function inBackground(task: () => Promise<void>): void {
  // Started a moment later, so the request that read the board answers first.
  const run = new Promise((resolve) => setTimeout(resolve, BACKGROUND_DELAY_MS))
    .then(task)
    .catch((error) => console.error('Board snapshot: background task failed', error))
  import('next/server')
    .then(({ after }) => after(run))
    .catch(() => undefined)
}
