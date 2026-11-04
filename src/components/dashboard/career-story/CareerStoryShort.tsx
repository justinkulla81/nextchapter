'use client'

import { useMemo, useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { SubmitButton } from '@/components/ui/submit-button'
import { setStoryHideYears, noteStoryAction } from '@/app/dashboard/my-career/actions'
import { saveExploredTarget } from '@/app/dashboard/pivot-paths/actions'
import { layoutStory } from '@/lib/career-story/layout'
import { parseIso } from '@/lib/career-story/events'
import { summarizeStory } from '@/lib/career-story/summary'
import type { Door } from '@/lib/career-story/doors'
import type { CareerStory } from '@/lib/career-story/load'
import { StoryTimeline } from './StoryTimeline'
import { StoryList } from './StoryList'
import { EventDetail, EventEditor } from './EventEditor'
import { PhaseBar } from './DoorsSection'
import { PauseTool } from './PauseTool'
import { PeersCard } from './PeersCard'
import { cn } from '@/lib/utils'

const more = 'text-sm font-medium text-brand underline underline-offset-4'

// A door in the redesign (docs/candidate-redesign.md): a tag, a title, why, one fact and the first step, with the actions.
// How long it usually takes, and where it could lead, open on demand.
function DoorRow({ door, onTryPause }: { door: Door; onTryPause: () => void }) {
  return (
    <li className="space-y-2 p-4">
      <p className="text-xs font-semibold text-muted-foreground">{door.tag}</p>
      <h3 className="text-base font-semibold text-ink">{door.title}</h3>
      <p className="text-base text-ink"><span className="font-semibold">Why:</span> {door.why}</p>
      {door.cost && <p className="text-sm text-muted-foreground">{door.cost}</p>}
      <p className="text-base text-ink"><span className="font-semibold">First step:</span> {door.firstStep}</p>
      <div className="flex flex-wrap items-center gap-3">
        {door.radarFunction && !door.onRadar && (
          <form action={saveExploredTarget}>
            <input type="hidden" name="target" value={door.radarFunction} />
            <SubmitButton size="sm" variant="outline" pendingLabel="Adding…" savedLabel="On your radar">Put {door.radarFunction} on my radar</SubmitButton>
          </form>
        )}
        {door.onRadar && <span className="text-sm text-muted-foreground">On your radar</span>}
        {door.kind === 'PAUSE' && (
          <Button type="button" size="sm" variant="outline" onClick={onTryPause}>Try it on</Button>
        )}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-brand underline underline-offset-4">How long it usually takes</summary>
        <div className="mt-3 space-y-2">
          <PhaseBar door={door} />
          {door.opens.length > 0 && <p className="text-xs text-muted-foreground">Could lead to: {door.opens.slice(0, 3).join(', ')}</p>}
        </div>
      </details>
    </li>
  )
}

/**
 * Your career story, shortened to the page contract: the story and one action, where it could go, and one fold for the pause
 * calculator and "people like you". With no history it is only the empty card. Dev preview only until approved.
 */
export function CareerStoryShort({ story }: { story: CareerStory }) {
  const now = useMemo(() => parseIso(story.now), [story.now])
  const [hideYears, setHideYears] = useState(story.hideYears)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [pauseMonths, setPauseMonths] = useState(0)
  const [foldOpen, setFoldOpen] = useState(false)
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
    setFoldOpen(true)
    void noteStoryAction('pause_tried', 'open')
    setTimeout(() => document.getElementById('pause-tool')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }), 50)
  }

  if (!story.hasAnyHistory) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Your career story</h1>
        <EmptyState
          icon={Plus}
          title="Your story starts with a first chapter"
          description="Add your work history in your profile and it appears here on its own, or add a chapter yourself: a job, school, a venture of your own."
          cta={{ label: 'Open my profile', href: '/dashboard/profile' }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Your career story</h1>
        <p className="max-w-2xl text-base text-muted-foreground">{summarizeStory(story.events, now)}</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
          <span>Only you can see this.</span>
          <label className={cn('flex items-center gap-2', pending && 'cursor-progress')}>
            <input type="checkbox" role="switch" checked={hideYears} onChange={toggleYears} className="size-4 accent-[#1d4e89]" />
            Hide years
          </label>
        </div>
      </header>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="timeline-heading">
        <h2 id="timeline-heading" className="sr-only">Timeline</h2>
        <div className="hidden md:block">
          <StoryTimeline layout={layout} now={now} hideYears={hideYears} selectedId={selectedId} onSelect={(id) => { setAdding(false); setSelectedId(id) }} ghostMonths={pauseMonths} />
        </div>
        <details className="md:hidden" open>
          <summary className="sr-only">Your story as a list</summary>
          <StoryList events={story.events} now={now} hideYears={hideYears} selectedId={selectedId} onSelect={(id) => { setAdding(false); setSelectedId(id) }} />
        </details>
        <details className="hidden md:block" onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && void noteStoryAction('list_view', 'open')}>
          <summary className="cursor-pointer text-sm font-medium text-brand underline underline-offset-4">See it as a list</summary>
          <div className="mt-3">
            <StoryList events={story.events} now={now} hideYears={hideYears} selectedId={selectedId} onSelect={(id) => { setAdding(false); setSelectedId(id) }} />
          </div>
        </details>
        {unlabeled.length > 0 && !selected && !adding && (
          <p className="text-sm text-muted-foreground">
            There {unlabeled.length === 1 ? 'is a quiet stretch' : `are ${unlabeled.length} quiet stretches`} in your story. Select {unlabeled.length === 1 ? 'it' : 'one'} if you want to say what it was.
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
          <button
            type="button"
            onClick={() => { setSelectedId(null); setAdding(true) }}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-action px-6 text-sm font-semibold text-action-foreground hover:brightness-95"
          >
            <Plus className="size-4" aria-hidden /> Add a chapter
          </button>
        )}
      </section>

      <section aria-labelledby="doors-heading" className="space-y-3">
        <h2 id="doors-heading" className="font-display text-xl font-semibold text-ink">Where this could go</h2>
        <p className="text-sm text-muted-foreground">Looking is free. Time and cost are ranges from typical paths, not promises, and nothing changes in your search until you say so.</p>
        <ul className="divide-y divide-border rounded-2xl border border-border bg-white">
          {story.main.map((d) => <DoorRow key={d.id} door={d} onTryPause={() => tryPause(6)} />)}
        </ul>
        <details className="rounded-2xl border border-border">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink">More doors: your own practice, school, a new place, a pause</summary>
          <ul className="divide-y divide-border border-t border-border">
            {story.more.map((d) => <DoorRow key={d.id} door={d} onTryPause={() => tryPause(6)} />)}
          </ul>
        </details>
        <p className="text-sm text-muted-foreground">Want to compare roles, places and paths side by side? See <Link href="/dashboard/pivot-paths" className={more}>Other roles you could do</Link>.</p>
      </section>

      <details
        open={foldOpen}
        onToggle={(e) => setFoldOpen((e.currentTarget as HTMLDetailsElement).open)}
        className="group rounded-2xl border border-border"
      >
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-base font-semibold text-ink marker:content-none">
          <span>Plan a pause, and people like you</span>
          <span className="text-sm font-medium text-muted-foreground group-open:hidden">Show</span>
          <span className="hidden text-sm font-medium text-muted-foreground group-open:inline">Hide</span>
        </summary>
        <div className="space-y-6 border-t border-border p-4">
          <PauseTool cushionMonths={story.cushionMonths} months={pauseMonths} onMonths={setPauseMonths} />
          <PeersCard peers={story.peers} from={null} />
        </div>
      </details>

      <p className="text-xs text-muted-foreground">Drawn from your work history and education plus anything you add. Dates marked “about” are estimates. Hiding something here never changes your profile.</p>
    </div>
  )
}
