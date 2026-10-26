import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { EmbedCard, embedRow } from '@/components/embed/EmbedCard'
import { stateFromSlug, stateName } from '@/lib/seo/states'
import { recentStateNotices } from '@/lib/data/layoff-export'
import { noticeDay } from '@/lib/warn/layoff-pages'

export const revalidate = 3600
export const metadata: Metadata = { robots: { index: false, follow: true } }

// Embeddable widget: the latest WARN layoff notices in one state. /data/embed has the snippet.
export default async function EmbedLayoffs({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  const code = stateFromSlug(state)
  if (!code) notFound()
  const all = await recentStateNotices(code)
  const workers = all.reduce((s, n) => s + (n.workers ?? 0), 0)
  return (
    <EmbedCard title={`${stateName(code)} layoffs`} href={`/layoffs/${state}`} linkLabel={`All ${stateName(code)} layoff notices`} note="Source: WARN notices filed with the state labor department.">
      {all.length === 0 ? (
        <p style={{ margin: 0 }}>No WARN notices filed in {stateName(code)} in the last 12 months.</p>
      ) : (
        <>
          <p style={{ margin: '0 0 8px' }}>{all.length.toLocaleString('en-US')} notices in the last 12 months{workers ? `, naming ${workers.toLocaleString('en-US')} workers` : ''}. Latest:</p>
          {all.slice(0, 6).map((n) => (
            <div key={n.id} style={embedRow}>
              <a href={`https://launchyournextchapter.com/layoffs/company/${n.slug}`} target="_blank" rel="noopener" style={{ color: '#14233a', fontWeight: 600 }}>{n.employer}</a>
              <span style={{ color: '#5a6a80', whiteSpace: 'nowrap' }}>{n.workers ? `${n.workers.toLocaleString('en-US')} · ` : ''}{noticeDay(n.noticeDate)}</span>
            </div>
          ))}
        </>
      )}
    </EmbedCard>
  )
}
