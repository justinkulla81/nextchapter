import 'server-only'
import { prisma } from '@/lib/prisma'
import { mergeSources, type AlertSource } from './layoff-alert-rules'

const host = (url: string): string => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url } }

/** Every page that reported this layoff: the notice's own link, then each news story tied to it, newest first. */
export async function loadAlertSources(noticeId: string, noticeUrl: string | null, noticeLabel: string): Promise<AlertSource[]> {
  const mentions = await prisma.layoffNewsMention.findMany({
    where: { noticeId }, orderBy: { publishedAt: 'desc' }, take: 8,
    select: { url: true, publisher: true, headline: true },
  }).catch(() => [])
  return mergeSources(
    noticeUrl ? { label: `${noticeLabel} · ${host(noticeUrl)}`, url: noticeUrl } : null,
    mentions.map((m) => ({ label: `${m.publisher ?? host(m.url)}: ${m.headline}`, url: m.url })),
  )
}
