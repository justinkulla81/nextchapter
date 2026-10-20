'use client'

import { useActionState } from 'react'
import { Code2, Palette, PenLine, Sparkles } from 'lucide-react'
import { submitWorkSampleType } from '@/app/dashboard/work-samples/actions'
import { cn } from '@/lib/utils'

const OPTIONS = [
  { value: 'writing', title: 'Writing', hint: 'Articles, docs, proposals', icon: PenLine },
  { value: 'code', title: 'Code', hint: 'Projects, repos, tools', icon: Code2 },
  { value: 'design', title: 'Design', hint: 'Visual, product, UX work', icon: Palette },
  { value: 'other', title: 'Something else', hint: 'A deck, a case study, a model', icon: Sparkles },
] as const

/**
 * "Do you have work you could show?" Four kinds are buttons; "nothing to share" is a quiet link rather
 * than a fifth button. Plain words and one orange accent, in the style of the Premium page.
 */
export function WorkSampleTypeGateForm({ alreadyAwarded: _alreadyAwarded = false }: { alreadyAwarded?: boolean }) {
  const [state, formAction, pending] = useActionState(submitWorkSampleType, undefined)

  return (
    <section aria-labelledby="gate-heading" className={cn('space-y-5 rounded-2xl border border-orange/30 bg-orange/5 p-6', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <div className="space-y-1">
        <h2 id="gate-heading" className="font-serif text-2xl font-semibold tracking-tight text-navy">
          Do you have work you could show?
        </h2>
        <p className="max-w-xl text-base text-muted-foreground">A real sample proves more than another line on a résumé.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map(({ value, title, hint, icon: Icon }) => (
          <form key={value} action={formAction}>
            <input type="hidden" name="workSampleType" value={value} />
            <button
              type="submit"
              disabled={pending}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-white px-4 py-3.5 text-left transition-colors hover:border-orange hover:bg-white disabled:opacity-60"
            >
              <Icon className="size-5 shrink-0 text-orange" aria-hidden />
              <span>
                <span className="block text-base font-semibold text-navy">{title}</span>
                <span className="block text-sm text-muted-foreground">{hint}</span>
              </span>
            </button>
          </form>
        ))}
      </div>
      <form action={formAction}>
        <input type="hidden" name="workSampleType" value="none" />
        <button type="submit" disabled={pending} className="text-sm font-medium text-primary underline underline-offset-4 disabled:opacity-60">
          Nothing I&apos;d want to share
        </button>
      </form>
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </section>
  )
}
