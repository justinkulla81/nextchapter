'use client'

import { RoleNetworkBandView, type RoleNetworkBandStatus } from '@/components/community/RoleNetworkBand'

// The top of a role page: heading and intro, then the network block as the page's one ask, then the first section.
// The shared capture box stays at the bottom of the page. The real page renders this same view under the intro.
function Frame({ status, error }: { status: RoleNetworkBandStatus; error?: string }) {
  return (
    <main className="mx-auto max-w-6xl bg-off-white px-6 py-8">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">Home › Roles › CRO</nav>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">Chief Revenue Officer jobs</h1>
      <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
        412 open Chief Revenue Officer jobs (CRO), taken from employers’ own career sites and checked to still be open. Listings that state pay show a median of $318,000 a year.
      </p>
      <RoleNetworkBandView status={status} short="CRO" spelled="Chief Revenue Officer" error={error ?? null} onJoin={() => {}} />
      <section className="mt-8 rounded-xl border border-border bg-white p-5">
        <h2 className="text-2xl font-bold tracking-tight text-navy">The market for Chief Revenue Officer work</h2>
        <p className="mt-2 text-sm text-muted-foreground">…the first section, unchanged…</p>
      </section>
    </main>
  )
}

export const RoleNetworkSignedOut = () => <Frame status="signed_out" />
export const RoleNetworkCanJoin = () => <Frame status="can_join" />
export const RoleNetworkJoined = () => <Frame status="joined" />
export const RoleNetworkConfidential = () => <Frame status="confidential" />
export const RoleNetworkError = () => <Frame status="can_join" error="Something went wrong on our end. Your click was not lost: try again in a moment." />
