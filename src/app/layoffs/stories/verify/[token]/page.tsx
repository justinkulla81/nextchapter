import type { Metadata } from 'next'
import { StoryActionButton } from '@/components/layoff-stories/StoryActionButton'

export const metadata: Metadata = { robots: { index: false, follow: false }, title: { absolute: 'Confirm your email | NextChapter' } }
export const dynamic = 'force-dynamic'

export default async function ConfirmStoryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return (
    <main className="mx-auto w-full max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold tracking-tight text-navy">Confirm your email</h1>
      <p className="mt-3 text-sm text-muted-foreground">Confirming shows us the address is yours, so your answers count in the numbers for the company. Your email is never shown.</p>
      <div className="mt-6"><StoryActionButton token={token} mode="confirm" companyName="company" /></div>
    </main>
  )
}
