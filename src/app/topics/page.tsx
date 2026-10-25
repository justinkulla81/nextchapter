import Link from 'next/link'
import { LINK, SeoPage } from '@/components/seo/SeoPage'
import { pageMetadata } from '@/lib/seo/keywords'
import { TOPICS } from '@/lib/seo/topics'
import { ANCHORS } from '@/lib/seo/keywords'

export const metadata = pageMetadata('/topics')

export default function TopicsIndexPage() {
  return (
    <SeoPage
      trail={[{ name: 'Topics', path: '/topics' }]}
      h1="Job search, career change and layoff topics"
      lede="Plain answers to the questions people ask when they lose a job or plan a move: severance, resumes, job search strategy, career pivots, career exploration, executive recruiters and reverse recruiters."
    >
      <ul className="mt-10 max-w-3xl list-disc space-y-2 pl-5">
        {TOPICS.map((t) => (
          <li key={t.slug}><Link href={`/topics/${t.slug}`} className={LINK}>{ANCHORS[`/topics/${t.slug}`] ?? t.h1}</Link></li>
        ))}
      </ul>
      <p className="mt-8 text-sm text-muted-foreground">
        More: <Link href="/resources" className={LINK}>job search and layoff guides</Link>, <Link href="/unemployment-benefits" className={LINK}>unemployment benefits by state</Link> and the <Link href="/layoffs" className={LINK}>layoff tracker</Link>.
      </p>
    </SeoPage>
  )
}
