'use client'

import Link from 'next/link'
import { usePostHog } from '@/lib/posthog/client'
import type { CommunityGroup } from '@/lib/community/groups'

export function CommunityGroupStrip({ groups, otherParams, redesign = false }: { groups: CommunityGroup[]; otherParams: Record<string, string>; redesign?: boolean }) {
  const posthog = usePostHog()

  if (groups.length === 0) return null

  // The redesign: a plain sentence says what these are, and the member count is part of the label instead of an orange badge.
  if (redesign) {
    return (
      <div className="space-y-2">
        <p className="text-base font-semibold text-ink">Peers like you</p>
        <p className="text-sm text-muted-foreground">You are in these automatically, so there is nothing to join. Choose one to see only its posts.</p>
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => {
            const params = new URLSearchParams({ ...otherParams, group: `${g.dimension}:${g.value}` })
            return (
              <Link
                key={`${g.dimension}:${g.value}`}
                href={`/dashboard/community?${params.toString()}`}
                onClick={() => posthog?.capture('community_group_selected', { dimension: g.dimension, value: g.value, memberCount: g.memberCount })}
                className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted"
              >
                {g.label} ({g.memberCount})
              </Link>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        Peers like you — you&apos;re in these automatically, nothing to join
      </p>
      <div className="flex flex-wrap gap-2">
        {groups.map((g) => {
          const params = new URLSearchParams({ ...otherParams, group: `${g.dimension}:${g.value}` })
          return (
            <Link
              key={`${g.dimension}:${g.value}`}
              href={`/dashboard/community?${params.toString()}`}
              onClick={() =>
                posthog?.capture('community_group_selected', {
                  dimension: g.dimension,
                  value: g.value,
                  memberCount: g.memberCount,
                })
              }
              className="flex items-center gap-1.5 rounded-full border border-border bg-off-white px-3 py-1 text-sm font-medium text-foreground hover:border-brand/40"
            >
              {g.label}
              <span className="rounded-full bg-orange/20 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-orange tabular-nums">
                {g.memberCount}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
