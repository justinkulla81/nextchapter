'use client'

import { NextStepBox } from '@/components/capture/NextStepBox'
import type { NetworkAsk, NetworkKind } from '@/lib/community/network-copy'

// The top of a role, function or industry page: heading and intro, then the page's one ask (the navy box, now the network join),
// then the first section. The email and journey options stay behind "Not ready?". The real pages render this same box.
const PAGES: Record<NetworkKind, { crumb: string; h1: string; intro: string; ask: NetworkAsk; section: string }> = {
  role: {
    crumb: 'Home › Roles › CRO',
    h1: 'Chief Revenue Officer jobs',
    intro: '412 open Chief Revenue Officer jobs (CRO), taken from employers’ own career sites and checked to still be open. Listings that state pay show a median of $318,000 a year.',
    ask: { key: 'role:chief-revenue-officer', kind: 'role', name: 'CRO', spelled: 'Chief Revenue Officer' },
    section: 'The market for Chief Revenue Officer work',
  },
  function: {
    crumb: 'Home › Functions › Sales',
    h1: 'Sales jobs and conferences',
    intro: '5,000 verified open Sales jobs, with the conferences where Sales people meet. Every figure names its source and period.',
    ask: { key: 'function:sales', kind: 'function', name: 'Sales', spelled: 'Sales' },
    section: 'Sales market snapshot',
  },
  industry: {
    crumb: 'Home › Industries › Health care',
    h1: 'Health care: jobs, conferences and layoffs',
    intro: '3,842 verified open jobs at Health care employers, the conferences in the industry and where layoffs have been filed.',
    ask: { key: 'industry:health-care', kind: 'industry', name: 'Health care', spelled: 'Health care' },
    section: 'Health care market snapshot',
  },
}

function Frame({ kind }: { kind: NetworkKind }) {
  const p = PAGES[kind]
  return (
    <main className="mx-auto max-w-6xl bg-off-white px-6 py-8">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">{p.crumb}</nav>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">{p.h1}</h1>
      <p className="mt-4 max-w-3xl text-lg text-muted-foreground">{p.intro}</p>
      <NextStepBox audience="seeker" slug={kind} network={p.ask} extras={<p className="text-sm">The first-week-plan email and the save-this-search box, as they are today.</p>} />
      <section className="mt-8 rounded-xl border border-border bg-white p-5">
        <h2 className="text-2xl font-bold tracking-tight text-navy">{p.section}</h2>
        <p className="mt-2 text-sm text-muted-foreground">…the first section, unchanged…</p>
      </section>
    </main>
  )
}

export const RoleNetworkAsk = () => <Frame kind="role" />
export const FunctionNetworkAsk = () => <Frame kind="function" />
export const IndustryNetworkAsk = () => <Frame kind="industry" />
