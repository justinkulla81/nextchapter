'use client'

import Link from 'next/link'
import { usePostHog } from 'posthog-js/react'
import type { CommunityGroup } from '@/lib/community/groups'

export function CommunityGroupStrip({ groups, otherParams }: { groups: CommunityGroup[]; otherParams: Record<string, string> }) {
  const posthog = usePostHog()

  if (groups.length === 0) return null

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
