import 'server-only'
import { createHash } from 'node:crypto'
import { changeStatus } from '@/lib/jobs/change-status'
import { captureServerEvent } from '@/lib/posthog/server'

const HOSTS = [/(^|\.)greenhouse\.io$/i, /^jobs\.ashbyhq\.com$/i, /^jobs\.lever\.co$/i]

export function isSupportedJobUrl(raw: string): URL | null {
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' && HOSTS.some((h) => h.test(u.hostname)) ? u : null
  } catch {
    return null
  }
}

/** The same posting always maps to the same My jobs row. */
export function externalSourceId(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 24)
}

export async function logExtensionApplication(candidateId: string, input: { url: string; title: string; company: string; site: string }) {
  const u = isSupportedJobUrl(input.url)
  const title = input.title.trim().slice(0, 300)
  if (!u || !title) return { ok: false as const, error: 'bad_request' }
  const url = `${u.origin}${u.pathname}${u.search}`
  const r = await changeStatus(
    candidateId,
    { source: 'external', sourceId: externalSourceId(url), title, companyName: input.company.trim().slice(0, 200) || null, url, workType: 'full_time' },
    'applied',
    'apply_helper'
  )
  captureServerEvent(candidateId, 'apply_helper_application_logged', { site: input.site, ok: r.ok })
  return r.ok ? { ok: true as const } : { ok: false as const, error: 'failed' }
}
