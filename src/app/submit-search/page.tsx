import type { Metadata } from 'next'
import { PublicSiteHeader } from '@/components/marketing/PublicSiteChrome'
import { SubmitSearchForm } from '@/components/search-firms/SubmitSearchForm'
import { submitSearch } from './actions'

export const metadata: Metadata = {
  title: 'Send us a search',
  description:
    'Recruiters and employers: send NextChapter an open or confidential search. We return a screened shortlist of members at the right level within days. Free.',
  alternates: { canonical: '/submit-search' },
}

export default async function SubmitSearchPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams
  return (
    <div className="flex flex-1 flex-col">
      <PublicSiteHeader />
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">Send us a search</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          NextChapter members are experienced professionals who were laid off and are interviewing now. Send us an
          open or confidential search and we return a screened shortlist of members at the right level within days.
          AI reads every profile against your spec; a person on our team checks every name. It is free.
        </p>
        <div className="mt-8">
          <SubmitSearchForm action={submitSearch} refCode={ref?.slice(0, 60) ?? null} />
        </div>
      </div>
    </div>
  )
}
