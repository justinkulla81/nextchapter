import type { Metadata } from 'next'
import Link from 'next/link'
import { CrucibleInterestForm } from '@/components/crucible/CrucibleInterestForm'
import { CrucibleWordmark } from '@/components/crucible/CrucibleWordmark'

export const metadata: Metadata = { title: { absolute: 'The noexperienceneeded.ai Lesson' } }

export default function CrucibleLessonPage() {
  return (
    <div className="flex flex-1 flex-col bg-off-white">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/crucible">
            <CrucibleWordmark className="text-xl" />
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">
          How to turn a non-traditional background into the thing they hire.
        </h1>
        <p className="mt-4 text-muted-foreground">
          A short, practical lesson on the exact judgment this challenge measures — how to catch what an AI
          misses, and how to show that skill to an employer. Not open yet. Leave your email and we&apos;ll tell
          you the moment it is.
        </p>
        <div className="mt-8">
          <CrucibleInterestForm kind="LESSON" />
        </div>
      </div>
    </div>
  )
}
