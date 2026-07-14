import type { Metadata } from 'next'
import { signOut } from './actions'
import { Button } from '@/components/ui/button'
import { DashboardNav } from '@/components/dashboard/DashboardNav'
import { Logo } from '@/components/Logo'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// The first-registration report generation + email (see get-dashboard-data.ts's
// `after()` block) runs an LLM call plus an email send in the background after
// the response is sent — comfortably past the platform's default function
// duration, which was silently truncating it before the email ever went out.
export const maxDuration = 60

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 pt-4">
          <Logo className="text-2xl" />
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
        <div className="mx-auto max-w-4xl px-6 py-4">
          <DashboardNav />
        </div>
      </header>
      <main className="flex-1 px-6 py-12">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  )
}
