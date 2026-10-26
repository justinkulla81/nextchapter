import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { EmbedCard, embedRow } from '@/components/embed/EmbedCard'
import { industryBySlug } from '@/lib/seo/topics'
import { getTopicJobs } from '@/lib/seo/topic-data'

export const revalidate = 3600
export const metadata: Metadata = { robots: { index: false, follow: true } }

// Embeddable widget: newest verified open jobs in one industry, read from the stored snapshot (no scan of the job board).
export default async function EmbedHiring({ params }: { params: Promise<{ industry: string }> }) {
  const { industry: slug } = await params
  const industry = industryBySlug(slug)
  if (!industry?.rule) notFound()
  const jobs = await getTopicJobs({ rule: industry.rule }).catch(() => null)
  return (
    <EmbedCard title={`${industry.name} jobs`} href={`/industries/${slug}`} linkLabel={`${industry.name}: jobs, conferences and layoffs`} note="Verified open on the employer's own career site within the last week.">
      {!jobs || jobs.jobs.length === 0 ? (
        <p style={{ margin: 0 }}>Open jobs will appear here shortly.</p>
      ) : (
        <>
          <p style={{ margin: '0 0 8px' }}>About {jobs.total.toLocaleString('en-US')} verified open jobs. Newest:</p>
          {jobs.jobs.slice(0, 5).map((j) => (
            <div key={j.id} style={embedRow}>
              <a href={`https://launchyournextchapter.com/jobs/${j.id}`} target="_blank" rel="noopener" style={{ color: '#14233a', fontWeight: 600 }}>{j.title}</a>
              <span style={{ color: '#5a6a80', textAlign: 'right' }}>{j.company}</span>
            </div>
          ))}
        </>
      )}
    </EmbedCard>
  )
}
