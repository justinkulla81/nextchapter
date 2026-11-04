'use client'

import { NetworkBandView } from '@/components/community/NetworkBand'
import type { NetworkKind } from '@/lib/community/network-copy'

// The top of a role, function or industry page: heading and intro, then the network block as the page's one ask, then the
// first section. The shared capture box stays at the bottom of the page. The real pages render this same view under the intro.
const PAGES: Record<NetworkKind, { crumb: string; h1: string; intro: string; name: string; spelled: string; section: string }> = {
  role: {
    crumb: 'Home › Roles › CRO',
    h1: 'Chief Revenue Officer jobs',
    intro: '412 open Chief Revenue Officer jobs (CRO), taken from employers’ own career sites and checked to still be open. Listings that state pay show a median of $318,000 a year.',
    name: 'CRO',
    spelled: 'Chief Revenue Officer',
    section: 'The market for Chief Revenue Officer work',
  },
  function: {
    crumb: 'Home › Functions › Sales',
    h1: 'Sales jobs and conferences',
    intro: '5,000 verified open Sales jobs, with the conferences where Sales people meet. Every figure names its source and period.',
    name: 'Sales',
    spelled: 'Sales',
    section: 'Sales market snapshot',
  },
  industry: {
    crumb: 'Home › Industries › Health care',
    h1: 'Health care: jobs, conferences and layoffs',
    intro: '3,842 verified open jobs at Health care employers, the conferences in the industry and where layoffs have been filed.',
    name: 'Health care',
    spelled: 'Health care',
    section: 'Health care market snapshot',
  },
}

function Frame({ kind, error }: { kind: NetworkKind; error?: string }) {
  const p = PAGES[kind]
  return (
    <main className="mx-auto max-w-6xl bg-off-white px-6 py-8">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">{p.crumb}</nav>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">{p.h1}</h1>
      <p className="mt-4 max-w-3xl text-lg text-muted-foreground">{p.intro}</p>
      <NetworkBandView kind={kind} name={p.name} spelled={p.spelled} error={error ?? null} onJoin={() => {}} />
      <section className="mt-8 rounded-xl border border-border bg-white p-5">
        <h2 className="text-2xl font-bold tracking-tight text-navy">{p.section}</h2>
        <p className="mt-2 text-sm text-muted-foreground">…the first section, unchanged…</p>
      </section>
    </main>
  )
}

export const RoleNetworkSignedOut = () => <Frame kind="role" />
export const RoleNetworkError = () => <Frame kind="role" error="Something went wrong on our end. Your click was not lost: try again in a moment." />
export const FunctionNetworkSignedOut = () => <Frame kind="function" />
export const IndustryNetworkSignedOut = () => <Frame kind="industry" />
