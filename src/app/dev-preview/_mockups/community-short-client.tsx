'use client'

import { useState } from 'react'
import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PageHeader } from '@/components/candidate/PageHeader'
import { NeedsYou } from '@/components/candidate/NeedsYou'
import { HomeFold } from '@/components/candidate/HomeFold'
import { NetworkParts } from '@/components/network/NetworkParts'
import type { ReactNode } from 'react'

// Industry and function, shortened to the page contract (docs/candidate-redesign.md). Real stream components, sample data.
// The feed comes first, with one filter dropdown above it (there can be more than four groups). The composer is one button that
// opens the form in place, so posting stays the one visible action without pushing the feed down. The banners wait in the Needs
// you strip; the cohort and a link to the groups circle sit in one small fold. Sample choice: the encouragement form and the
// leaderboard teaser leave this page (encouragement to the close circle, rankings to Effort and results), pending the owner's say.

const more = 'text-sm font-medium text-brand underline underline-offset-4'
const GROUPS = ['Everything', 'Boston', 'Finance', 'Ohio State alumni', 'Operations leaders', 'Healthcare and logistics']

export function CommunityShortClient({ feed, composer, banner }: { feed: ReactNode; composer: ReactNode; banner: ReactNode }) {
  const [composing, setComposing] = useState(false)
  const [group, setGroup] = useState('Everything')
  return (
    <PreviewShell place="network" entry="circles" part="industry">
      <PageHeader title="Industry and function" />
      <NetworkParts current="industry" />

      <NeedsYou page="preview">
        {banner}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/60 p-5">
          <p className="max-w-xl text-base text-ink">“You are doing the right things. Keep going.” <span className="text-muted-foreground">from Alex</span></p>
          <button type="button" className="h-10 rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted">Dismiss</button>
        </div>
      </NeedsYou>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          Show
          <select value={group} onChange={(e) => setGroup(e.target.value)} className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm text-ink">
            {GROUPS.map((g) => <option key={g}>{g}</option>)}
          </select>
        </label>
        {!composing && (
          <button type="button" onClick={() => setComposing(true)} className="inline-flex h-11 items-center rounded-full bg-action px-6 text-sm font-semibold text-action-foreground hover:brightness-95">
            Share something with your field
          </button>
        )}
      </div>

      {composing && (
        <section aria-label="Post to the community" className="space-y-3 rounded-2xl border border-border p-5">
          {composer}
          <button type="button" onClick={() => setComposing(false)} className={more}>Close without posting</button>
        </section>
      )}

      <section aria-label="From your field">
        {group !== 'Everything' && <p className="mb-2 text-sm text-ink">Showing posts from {group}. <button type="button" onClick={() => setGroup('Everything')} className={more}>Show everything</button></p>}
        {feed}
      </section>

      <HomeFold title="Your cohort and groups" event="community_more_toggled">
        <p className="text-base text-ink"><span className="font-semibold">Your cohort: Northwind.</span> 14 people laid off in the same round are here too.</p>
        <p className="text-sm text-muted-foreground">Find more groups, like your school and past employers, on <a href="#" className={more}>Alumni and groups</a>.</p>
      </HomeFold>
    </PreviewShell>
  )
}
