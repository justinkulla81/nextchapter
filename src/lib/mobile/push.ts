import 'server-only'
import { prisma } from '@/lib/prisma'
import { searchPublicBoard } from '@/lib/jobs/public-board'
import { queryLayoffs } from '@/lib/layoffs/public-query'
import { captureServerEvent } from '@/lib/posthog/server'

// New-match and new-layoff pushes for saved searches, sent through Expo's push service (free, no per-message cost).
// Runs only when MOBILE_PUSH_ENABLED=1, so deploying the code sends nothing.
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const MAX_PER_RUN = 300

export interface PushMessage { to: string; title: string; body: string; data: Record<string, string> }

export async function sendExpoPush(messages: PushMessage[]): Promise<void> {
  for (let i = 0; i < messages.length; i += 100) {
    const res = await fetch(EXPO_PUSH_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(messages.slice(i, i + 100)) })
    if (!res.ok) throw new Error(`Expo push ${res.status}`)
  }
}

const label = (s: { q: string; loc: string }) => [s.q, s.loc && `in ${s.loc}`].filter(Boolean).join(' ') || 'all jobs'

export async function runMobilePush(now = new Date()): Promise<{ checked: number; pushed: number }> {
  const saved = await prisma.mobileSavedSearch.findMany({ orderBy: { lastPushedAt: { sort: 'asc', nulls: 'first' } }, take: MAX_PER_RUN })
  let pushed = 0
  for (const s of saved) {
    const since = s.lastPushedAt ?? s.createdAt
    try {
      let message: Omit<PushMessage, 'to'> | null = null
      if (s.kind === 'jobs') {
        const r = await searchPublicBoard({ q: s.q, loc: s.loc, remote: s.remote, since, ...(s.minPay ? { minPay: s.minPay } : {}) })
        if (r.jobs.length > 0) message = { title: 'New jobs for your search', body: `${r.jobs.length >= 12 ? '12+' : r.jobs.length} new: ${label(s)}`, data: { screen: 'jobs', id: s.id } }
      } else {
        const a = await queryLayoffs({ employer: s.q, days: 14, limit: 5 })
        const fresh = a.notices.filter((n) => new Date(n.filedOn) > since)
        if (fresh.length > 0) message = { title: `New layoff filing: ${fresh[0].employer}`, body: `${fresh[0].workers ?? 'Some'} workers, ${fresh[0].state}. Filed ${fresh[0].filedOn}.`, data: { screen: 'layoffs', id: s.id } }
      }
      if (!message) continue
      const devices = await prisma.mobileDevice.findMany({ where: { userId: s.userId }, select: { pushToken: true } })
      if (devices.length === 0) continue
      await sendExpoPush(devices.map((d) => ({ to: d.pushToken, ...message! })))
      await prisma.mobileSavedSearch.update({ where: { id: s.id }, data: { lastPushedAt: now } })
      captureServerEvent(s.userId, 'mobile_push_sent', { kind: s.kind, savedId: s.id })
      pushed++
    } catch (e) {
      console.error('mobile push failed for', s.id, e instanceof Error ? e.message : e)
    }
  }
  return { checked: saved.length, pushed }
}
