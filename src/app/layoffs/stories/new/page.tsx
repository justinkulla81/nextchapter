import type { Metadata } from 'next'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { StoryForm } from '@/components/layoff-stories/StoryForm'
import { publishOpen } from '@/lib/layoff-stories/store'
import { getCompanies } from '@/lib/warn/layoff-pages'

export const metadata: Metadata = { title: { absolute: 'Share your layoff story | NextChapter' }, robots: { index: false, follow: true } }
export const dynamic = 'force-dynamic'

export default async function NewStoryPage({ searchParams }: { searchParams: Promise<{ company?: string; source?: string }> }) {
  const sp = await searchParams
  const c = sp.company ? (await getCompanies()).get(sp.company) : undefined
  const now = new Date()
  const prefill = c ? { slug: c.slug, name: c.name, month: c.latest.getTime() > now.getTime() - 5 * 365 * 86_400_000 && c.latest.getTime() <= now.getTime() ? `${c.latest.getUTCFullYear()}-${String(c.latest.getUTCMonth() + 1).padStart(2, '0')}` : '' } : null
  const years = Array.from({ length: 6 }, (_, i) => now.getUTCFullYear() - i)
  return (
    <div className="flex flex-1 flex-col">
      <PublicSiteHeader current="news" />
      <main className="flex-1 bg-off-white py-12">
        <div className="mx-auto max-w-6xl px-6">
          <h1 className="text-3xl font-bold tracking-tight text-navy">{c ? `What happened at ${c.name}?` : 'What happened when you were laid off?'}</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">Two minutes. Private by default. Your answers help the next person laid off see what to expect: notice, severance, and how it was handled.</p>
          <div className="mt-8"><StoryForm prefill={prefill} source={sp.source?.slice(0, 40) || 'direct'} publishOpen={publishOpen()} years={years} /></div>
        </div>
      </main>
      <PublicSiteFooter page="layoffs" />
    </div>
  )
}
