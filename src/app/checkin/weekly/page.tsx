import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { NOINDEX } from '@/lib/seo/canonical'
import { WeeklyCheckInConfirm } from './WeeklyCheckInConfirm'

export const metadata = { ...NOINDEX, title: 'Weekly check-in' }

// Landing page for a Job Search Daily weekly check-in tap. The browser logs the tap on
// load (see actions.ts), then shows the thank-you and the Candidate+ line.
export default async function WeeklyCheckInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams
  const params = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]))
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <Link href="/" className="mb-8">
        <Logo className="text-2xl" />
      </Link>
      <WeeklyCheckInConfirm params={params} />
      <Link href="/dashboard" className="mt-6 text-sm font-medium text-primary underline underline-offset-4">
        Go to my dashboard →
      </Link>
    </div>
  )
}
