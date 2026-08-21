import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { CrucibleInterestForm } from '@/components/crucible/CrucibleInterestForm'

export const metadata: Metadata = { title: 'The Full noexperienceneeded.ai Assessment' }

export default function CrucibleFullPage() {
  return (
    <div className="flex flex-1 flex-col bg-off-white">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/crucible">
            <Logo className="text-xl" />
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">
          A real work sample you can send to employers.
        </h1>
        <p className="mt-4 text-muted-foreground">
          The full noexperienceneeded.ai assessment is a 75-minute evaluation on a real codebase, with a report you can share
          directly with employers — the interview, before the interview. It&apos;s not open yet. Leave your email
          and we&apos;ll tell you the moment it is.
        </p>
        <div className="mt-8">
          <CrucibleInterestForm kind="FULL" />
        </div>
      </div>
    </div>
  )
}
