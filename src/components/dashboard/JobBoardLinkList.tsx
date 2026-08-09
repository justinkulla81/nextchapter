'use client'

import { usePostHog } from 'posthog-js/react'
import type { JobBoardRecommendation } from '@/lib/constants/industry-job-boards'

export function JobBoardLinkList({
  boards,
  category,
}: {
  boards: JobBoardRecommendation[]
  category: string
}) {
  const posthog = usePostHog()

  return (
    <div className="flex flex-wrap gap-2">
      {boards.map((board) => (
        <a
          key={board.name}
          href={board.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => posthog?.capture('job_board_link_clicked', { name: board.name, url: board.url, category })}
          className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-brand hover:text-brand"
        >
          {board.name} ↗
        </a>
      ))}
    </div>
  )
}
