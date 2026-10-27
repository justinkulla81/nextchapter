import Link from 'next/link'
import { NoticeTable } from '@/components/layoffs/NoticeTable'
import { H2, LINK } from '@/components/seo/SeoPage'
import type { PageNotices } from '@/lib/seo/org-notices'

const n0 = (n: number) => n.toLocaleString('en-US')

/** Layoff notices on an organization's page: the latest few, the count and the link to the full record. Renders nothing when there are none. */
export function AreaNotices({ id, title, intro, notices, moreHref, moreLabel, showState = false }: {
  id: string
  title: string
  intro: string
  notices: PageNotices
  moreHref: string
  moreLabel: string
  showState?: boolean
}) {
  if (notices.total === 0) return null
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className={H2}>{title}</h2>
      <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
        {intro} {n0(notices.total)} {notices.total === 1 ? 'notice' : 'notices'} in the last 12 months{notices.workers > 0 ? `, ${n0(notices.workers)} workers where a headcount is given` : ''}.
      </p>
      <div className="mt-4">
        <NoticeTable notices={notices.items} caption={title} showState={showState} linkEmployer page="state" />
      </div>
      <p className="mt-3 text-sm"><Link href={moreHref} className={LINK}>{moreLabel}</Link></p>
    </section>
  )
}
