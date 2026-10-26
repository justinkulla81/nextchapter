import Link from 'next/link'
import { ConferenceList } from '@/components/topics/blocks'
import type { Conf } from '@/lib/seo/topic-data'

// A "Conferences" block for place and higher-education pages. Loads from the cached conference catalog; a failed read hides the block.
// Renders nothing when there are no conferences, so a page below the bar does not grow an empty section.
export async function ConferenceSection({ id, title, intro, source, load, more }: {
  id: string
  title: string
  intro?: string
  source: string
  load: () => Promise<{ total: number; upcoming: number; rows: Conf[] }>
  more?: { href: string; label: string }
}) {
  const list = await load().catch(() => null)
  if (!list || list.rows.length === 0) return null
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className="text-2xl font-bold tracking-tight text-navy">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        {intro ?? ''}{intro ? ' ' : ''}{list.upcoming > 0 ? `${list.upcoming.toLocaleString()} with dates announced.` : 'No dates announced yet for the next edition.'}
      </p>
      <div className="mt-4"><ConferenceList rows={list.rows} total={list.total} upcoming={list.upcoming} source={source} /></div>
      {more && <p className="mt-3 text-sm"><Link href={more.href} className="text-brand underline underline-offset-4">{more.label}</Link></p>}
    </section>
  )
}
