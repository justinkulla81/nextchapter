'use client'

import { useMemo, useState, useTransition } from 'react'
import { Lock, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { setStoryHideYears, noteStoryAction } from '@/app/dashboard/my-career/actions'
import { layoutStory } from '@/lib/career-story/layout'
import { parseIso } from '@/lib/career-story/events'
import { summarizeStory } from '@/lib/career-story/summary'
import type { CareerStory } from '@/lib/career-story/load'
import { StoryTimeline } from './StoryTimeline'
import { StoryList } from './StoryList'
import { EventDetail, EventEditor } from './EventEditor'
import { DoorsSection } from './DoorsSection'
import { PauseTool } from './PauseTool'
import { PeersCard } from './PeersCard'
import { cn } from '@/lib/utils'

export function CareerStoryView({ story, from }: { story: CareerStory; from: string | null }) {
  const now = useMemo(() => parseIso(story.now), [story.now])
  const [hideYears, setHideYears] = useState(story.hideYears)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [pauseMonths, setPauseMonths] = useState(0)
  const [pending, startTransition] = useTransition()
  const layout = useMemo(() => layoutStory(story.events, now, { hideYears }), [story.events, now, hideYears])
  const selected = story.events.find((e) => e.id === selectedId) ?? null
  const unlabeled = story.events.filter((e) => e.unlabeled)

  function toggleYears() {
    const next = !hideYears
    setHideYears(next)
    startTransition(async () => {
      const r = await setStoryHideYears(next)
      if (!r.ok) setHideYears(!next)
    })
  }
  function tryPause(months = 6) {
    setPauseMonths((m) => m || months)
    void noteStoryAction('pause_tried', 'open')
    document.getElementById('pause-tool')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }
  function select(id: string) {
    setAdding(false)
    setSelectedId(id)
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Your career story</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">{summarizeStory(story.events, now)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              <Lock className="size-3" aria-hidden="true" /> Only you can see this
            </span>
            <label className={cn('flex items-center gap-2 text-sm', pending && 'cursor-progress')}>
              <input type="checkbox" role="switch" checked={hideYears} onChange={toggleYears} className="size-4 accent-[#1d4e89]" />
              Hide years
            </label>
          </div>
        </div>
      </header>

      {!story.hasAnyHistory ? (
        <EmptyState
          icon={Plus}
          title="Your story starts with a first chapter"
          description="Add your work history in your profile and it appears here on its own, or add a chapter yourself: a job, school, a venture of your own."
          cta={{ label: 'Open my profile', href: '/dashboard/profile' }}
        />
      ) : (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="timeline-heading">
          <h2 id="timeline-heading" className="sr-only">
            Timeline
          </h2>
          <div className="hidden md:block">
            <StoryTimeline layout={layout} now={now} hideYears={hideYears} selectedId={selectedId} onSelect={select} ghostMonths={pauseMonths} />
          </div>
          <details className="md:hidden" open>
            <summary className="sr-only">Your story as a list</summary>
            <StoryList events={story.events} now={now} hideYears={hideYears} selectedId={selectedId} onSelect={select} />
          </details>
          <details className="hidden md:block" onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && void noteStoryAction('list_view', 'open')}>
            <summary className="cursor-pointer text-sm font-medium text-primary">See it as a list</summary>
            <div className="mt-3">
              <StoryList events={story.events} now={now} hideYears={hideYears} selectedId={selectedId} onSelect={select} />
            </div>
          </details>
          {unlabeled.length > 0 && !selected && !adding && (
            <p className="text-sm text-muted-foreground">
              There {unlabeled.length === 1 ? 'is a quiet stretch' : `are ${unlabeled.length} quiet stretches`} in your story. Select {unlabeled.length === 1 ? 'it' : 'one'} if you want to say what happened. That is optional.
            </p>
          )}
          {selected && (
            <div className="rounded-xl border border-border bg-background p-4">
              <EventDetail key={selected.id} event={selected} now={now} hideYears={hideYears} onClose={() => setSelectedId(null)} />
            </div>
          )}
          {adding ? (
            <div className="rounded-xl border border-border bg-background p-4">
              <EventEditor event={null} onDone={() => setAdding(false)} />
            </div>
          ) : (
            <Button type="button" variant="outline" onClick={() => (setSelectedId(null), setAdding(true))}>
              <Plus aria-hidden="true" /> Add a chapter
            </Button>
          )}
        </section>
      )}

      <DoorsSection main={story.main} more={story.more} onTryPause={() => tryPause(6)} />
      <PauseTool cushionMonths={story.cushionMonths} months={pauseMonths} onMonths={setPauseMonths} />
      <PeersCard peers={story.peers} from={from} />
      <p className="text-xs text-muted-foreground">
        Your story is drawn from your work history and education, plus anything you add. Dates marked “about” are estimates. Hiding something here never changes your profile. Time and cost are ranges from typical paths, not promises.
      </p>
    </div>
  )
}
