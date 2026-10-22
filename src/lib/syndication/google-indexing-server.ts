import 'server-only'
import { importPKCS8, SignJWT } from 'jose'
import { loadLiveJobs, readAnnounced, writeAnnounced } from '@/lib/syndication/indexnow-server'
import { googleIndexingEnabled, googleIndexingQuota, jobPageUrl, planGoogle } from '@/lib/syndication/syndication'

// Google Indexing API (https://developers.google.com/search/apis/indexing-api/v3/quickstart),
// which Google supports for JobPosting pages. Off unless GOOGLE_INDEXING_ENABLED is on
// and GOOGLE_INDEXING_SA_JSON holds a service account key whose email is an Owner of the
// launchyournextchapter.com property in Search Console. 200 publish requests a day by
// default (GOOGLE_INDEXING_DAILY_QUOTA if Google raises it).

const STATE_PATH = 'google-indexing/sent.json.gz'
const SCOPE = 'https://www.googleapis.com/auth/indexing'
const PUBLISH_URL = 'https://indexing.googleapis.com/v3/urlNotifications:publish'

interface ServiceAccount {
  client_email: string
  private_key: string
  token_uri?: string
}

async function accessToken(sa: ServiceAccount): Promise<string> {
  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token'
  const key = await importPKCS8(sa.private_key, 'RS256')
  const now = Math.floor(Date.now() / 1000)
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email)
    .setAudience(tokenUri)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key)
  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  if (!res.ok) throw new Error(`Google token: ${res.status} ${(await res.text()).slice(0, 300)}`)
  return ((await res.json()) as { access_token: string }).access_token
}

export interface GoogleIndexingResult {
  enabled: boolean
  dryRun: boolean
  quota: number
  live: number
  sentBefore: number
  deletedPlanned: number
  updatedPlanned: number
  deletedSent: number
  updatedSent: number
  failed: number
  stoppedEarly: string | null
  sample: string[]
}

export async function runGoogleIndexing(opts: { dryRun?: boolean } = {}): Promise<GoogleIndexingResult> {
  const enabled = googleIndexingEnabled()
  const dryRun = !!opts.dryRun || !enabled
  const quota = googleIndexingQuota()
  const [live, sent] = await Promise.all([loadLiveJobs(), readAnnounced(STATE_PATH)])
  const plan = planGoogle(live, sent, quota)
  const result: GoogleIndexingResult = {
    enabled,
    dryRun,
    quota,
    live: live.length,
    sentBefore: sent.size,
    deletedPlanned: plan.deleted.length,
    updatedPlanned: plan.updated.length,
    deletedSent: 0,
    updatedSent: 0,
    failed: 0,
    stoppedEarly: null,
    sample: [...plan.deleted.slice(0, 2), ...plan.updated.slice(0, 3)].map(jobPageUrl),
  }
  if (dryRun) return result

  const sa = JSON.parse(process.env.GOOGLE_INDEXING_SA_JSON!) as ServiceAccount
  const token = await accessToken(sa)
  const jobs = [...plan.deleted.map((id) => ({ id, type: 'URL_DELETED' as const })), ...plan.updated.map((id) => ({ id, type: 'URL_UPDATED' as const }))]
  // One at a time: 200 requests is a few seconds, and a 429 stops the run cleanly.
  for (const j of jobs) {
    const res = await fetch(PUBLISH_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ url: jobPageUrl(j.id), type: j.type }),
      signal: AbortSignal.timeout(30_000),
    })
    if (res.status === 429 || res.status === 403) {
      result.stoppedEarly = `Google answered ${res.status}: ${(await res.text()).slice(0, 300)}`
      break
    }
    if (!res.ok) {
      result.failed++
      continue
    }
    if (j.type === 'URL_DELETED') {
      sent.delete(j.id)
      result.deletedSent++
    } else {
      sent.add(j.id)
      result.updatedSent++
    }
  }
  if (result.deletedSent + result.updatedSent > 0) await writeAnnounced(STATE_PATH, sent)
  console.log('Google Indexing run', { ...result, sample: undefined })
  return result
}
