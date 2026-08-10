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
    <ul className="list-disc space-y-1.5 pl-5 marker:text-muted-foreground">
      {boards.map((board) => (
        <li key={board.name}>
          <a
            href={board.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => posthog?.capture('job_board_link_clicked', { name: board.name, url: board.url, category })}
            className="text-sm text-foreground underline underline-offset-4 transition-colors hover:text-brand"
          >
            {board.name}
          </a>
        </li>
      ))}
    </ul>
  )
}
