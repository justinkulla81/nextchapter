import 'server-only'
import { promisify } from 'node:util'
import { gunzip as gunzipCb, gzip as gzipCb } from 'node:zlib'

// Supabase Storage for job syndication (the same REST calls as board-snapshot.ts):
//   'job-feeds'         PUBLIC  — formerly the aggregator XML feed parts (feeds removed 2026-10-26; nothing writes here now)
//   'syndication-state' PRIVATE — which job URLs IndexNow / Google have been told about
// Each bucket is created on its first write. Objects are capped at 50 MB by the
// project's global upload limit, so nothing written here may be larger.

export const FEED_BUCKET = 'job-feeds'
export const STATE_BUCKET = 'syndication-state'
const PUBLIC_BUCKETS = new Set([FEED_BUCKET])
const TIMEOUT_MS = 60_000

export const gzip = promisify(gzipCb)
const gunzip = promisify(gunzipCb)

export function storageConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY
}

function storage(path: string): { url: string; headers: Record<string, string> } {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return { url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/${path}`, headers: { authorization: `Bearer ${key}`, apikey: key } }
}

/** The public URL of an object in a public bucket (served by Supabase's CDN). */
export function publicObjectUrl(bucket: string, path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`
}

/** An object's bytes, or null when it doesn't exist. Read past the CDN cache. */
export async function getObject(bucket: string, path: string): Promise<Buffer | null> {
  const s = storage(`object/${bucket}/${path}`)
  const res = await fetch(`${s.url}?at=${Date.now()}`, { headers: s.headers, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (res.status === 404 || res.status === 400) return null
  if (!res.ok) throw new Error(`storage read ${bucket}/${path}: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

export async function putObject(bucket: string, path: string, body: Buffer, contentType: string, cacheControl = 'no-cache'): Promise<void> {
  const send = () => {
    const s = storage(`object/${bucket}/${path}`)
    return fetch(s.url, {
      method: 'POST',
      headers: { ...s.headers, 'content-type': contentType, 'x-upsert': 'true', 'cache-control': cacheControl },
      body: new Uint8Array(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  }
  let res = await send()
  if (!res.ok && /bucket not found/i.test(await res.clone().text())) {
    const b = storage('bucket')
    await fetch(b.url, {
      method: 'POST',
      headers: { ...b.headers, 'content-type': 'application/json' },
      body: JSON.stringify({ id: bucket, name: bucket, public: PUBLIC_BUCKETS.has(bucket) }),
    })
    res = await send()
  }
  if (!res.ok) throw new Error(`storage write ${bucket}/${path}: ${res.status} ${await res.text()}`)
}

/** A gzipped JSON object, or null when absent. */
export async function readJsonGz<T>(bucket: string, path: string): Promise<T | null> {
  const buf = await getObject(bucket, path)
  return buf ? (JSON.parse((await gunzip(buf)).toString('utf8')) as T) : null
}

export async function writeJsonGz(bucket: string, path: string, value: unknown): Promise<number> {
  const body = await gzip(Buffer.from(JSON.stringify(value)))
  await putObject(bucket, path, body, 'application/gzip')
  return body.length
}
