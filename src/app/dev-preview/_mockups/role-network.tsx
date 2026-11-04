'use client'

import { RoleNetworkBandView, type RoleNetworkBandStatus } from '@/components/community/RoleNetworkBand'

// The closing block of a role page, in every state it can be in. The real page renders this same view.
function Frame({ status, error }: { status: RoleNetworkBandStatus; error?: string }) {
  return (
    <main className="mx-auto max-w-4xl p-6">
      <p className="text-sm text-muted-foreground">…the rest of the Chief Revenue Officer page above…</p>
      <RoleNetworkBandView status={status} short="CRO" spelled="Chief Revenue Officer" error={error ?? null} onJoin={() => {}} />
    </main>
  )
}

export const RoleNetworkSignedOut = () => <Frame status="signed_out" />
export const RoleNetworkCanJoin = () => <Frame status="can_join" />
export const RoleNetworkJoined = () => <Frame status="joined" />
export const RoleNetworkConfidential = () => <Frame status="confidential" />
export const RoleNetworkError = () => <Frame status="can_join" error="Something went wrong on our end. Your click was not lost: try again in a moment." />
