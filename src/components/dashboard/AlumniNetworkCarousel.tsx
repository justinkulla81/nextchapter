'use client'

import { usePostHog } from 'posthog-js/react'
import type { AlumniNetworkGroup } from '@prisma/client'

// Styled to match the video carousels on the Videos and Webinars page
// (CuratedVideoCard) — horizontal scroll, logo art up top, name/description
// below, click-through to the real group's own site. Groups are matched
// server-side against the candidate's real work history and education (see
// getMatchedAlumniGroups) — this component just renders whatever it's given.
export function AlumniNetworkCarousel({ groups }: { groups: AlumniNetworkGroup[] }) {
  const posthog = usePostHog()

  if (groups.length === 0) return null

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div>
        <h2 className="text-sm font-medium text-foreground">Alumni &amp; Employer Networks</h2>
        <p className="text-sm text-muted-foreground">
          Affinity groups tied to the companies and schools on your profile — often the fastest way in.
        </p>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {groups.map((group) => (
          <a
            key={group.id}
            href={group.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => posthog?.capture('alumni_group_clicked', { groupId: group.id, name: group.name })}
            className="group block w-56 shrink-0 overflow-hidden rounded-lg border border-border bg-card"
          >
            <div className="flex h-24 items-center justify-center bg-muted p-4">
              {group.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- external logo; no remote-image domain configured for next/image
                <img src={group.logoUrl} alt="" className="max-h-12 max-w-full object-contain" />
              ) : (
                <span className="text-sm font-medium text-muted-foreground">{group.name}</span>
              )}
            </div>
            <div className="space-y-1 p-3">
              <p className="truncate text-sm font-medium text-foreground group-hover:text-brand">{group.name}</p>
              {group.description && (
                <p className="line-clamp-2 text-xs text-muted-foreground">{group.description}</p>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
