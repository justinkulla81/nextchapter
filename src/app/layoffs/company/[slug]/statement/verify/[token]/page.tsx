import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ConfirmStatementButton } from '@/components/employers/ConfirmStatementButton'
import { getCompanies } from '@/lib/warn/layoff-pages'

export const metadata: Metadata = { robots: { index: false, follow: false }, title: { absolute: 'Confirm your statement | NextChapter' } }
export const dynamic = 'force-dynamic'

export default async function ConfirmStatementPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params
  const c = (await getCompanies()).get(slug)
  if (!c) notFound()
  return (
    <main className="mx-auto w-full max-w-md px-6 py-16">
      <p className="text-sm font-semibold tracking-widest text-brand uppercase">{c.name}</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-navy">Confirm your statement</h1>
      <p className="mt-3 text-sm text-muted-foreground">Confirming shows us the email address is yours. A person on our team then reads the statement before it is shown next to the layoff notice.</p>
      <div className="mt-6"><ConfirmStatementButton token={token} slug={slug} companyName={c.name} /></div>
    </main>
  )
}
