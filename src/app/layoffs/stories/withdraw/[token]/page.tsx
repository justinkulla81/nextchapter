import type { Metadata } from 'next'
import { StoryActionButton } from '@/components/layoff-stories/StoryActionButton'

export const metadata: Metadata = { robots: { index: false, follow: false }, title: { absolute: 'Delete your story | NextChapter' } }
export const dynamic = 'force-dynamic'

export default async function WithdrawStoryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return (
    <main className="mx-auto w-full max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold tracking-tight text-navy">Delete your story</h1>
      <p className="mt-3 text-sm text-muted-foreground">This deletes what you wrote and your email address. Your answers stop counting in the company numbers. It cannot be undone.</p>
      <div className="mt-6"><StoryActionButton token={token} mode="withdraw" companyName="company" /></div>
    </main>
  )
}
