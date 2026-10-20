'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { JobSearchForm } from '@/components/home/JobSearchForm'
import { JourneyPicker } from '@/components/home/JourneyPicker'
import { posthog } from '@/lib/posthog/client'

// The homepage's one "try it first" section, for people who are not ready to give a résumé:
// tell us where you are (a first-week plan by email) or just search jobs. Two options, so two
// adjacent buttons. Both leave the way open to the full assessment.
export function HomeTryIt() {
  const [tab, setTab] = useState<'journey' | 'search'>('journey')
  const pick = (t: 'journey' | 'search') => {
    setTab(t)
    posthog.capture('home_tryit_tab_selected', { tab: t })
  }

  return (
    <section className="bg-off-white py-14" aria-labelledby="home-tryit-heading">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <h2 id="home-tryit-heading" className="font-display text-3xl font-semibold tracking-tight text-ink text-balance">
            Not ready to sign up? Start here.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">No résumé and no account. Tell us where you are, or look around.</p>
        </div>
        <div role="group" aria-label="Choose how to start" className="mt-6 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
          <Button type="button" size="default" variant={tab === 'journey' ? 'default' : 'outline'} aria-pressed={tab === 'journey'} className="h-auto min-h-10 whitespace-normal rounded-full py-2" onClick={() => pick('journey')}>
            Where are you in your search?
          </Button>
          <Button type="button" size="default" variant={tab === 'search' ? 'default' : 'outline'} aria-pressed={tab === 'search'} className="h-auto min-h-10 whitespace-normal rounded-full py-2" onClick={() => pick('search')}>
            Search jobs
          </Button>
        </div>
        <div className="mt-8">{tab === 'journey' ? <JourneyPicker /> : <JobSearchForm source="home" />}</div>
      </div>
    </section>
  )
}
